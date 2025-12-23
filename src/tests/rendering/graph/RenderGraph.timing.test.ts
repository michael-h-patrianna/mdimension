/**
 * Tests for RenderGraph GPU timing integration.
 *
 * Tests the integration of GPUTimer with RenderGraph execution.
 */

import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BasePass } from '@/rendering/graph/BasePass'
import { RenderGraph } from '@/rendering/graph/RenderGraph'
import type { RenderContext, RenderPassConfig } from '@/rendering/graph/types'

/**
 * Test pass implementation.
 */
class TestPass extends BasePass {
  executed = false
  executionTime = 0

  constructor(config: RenderPassConfig) {
    super(config)
  }

  execute(_ctx: RenderContext): void {
    this.executed = true
    // Simulate some work
    const start = performance.now()
    while (performance.now() - start < this.executionTime) {
      // Busy wait
    }
  }
}

/**
 * Create a minimal mock renderer for testing.
 *
 * @returns Mock renderer and GL context
 */
function createMockRenderer(): {
  renderer: THREE.WebGLRenderer
  gl: WebGL2RenderingContext
} {
  const queries = new Map<WebGLQuery, { available: boolean; result: number }>()
  let queryIdCounter = 0
  let disjoint = false

  const ext = {
    TIME_ELAPSED_EXT: 0x88bf,
    TIMESTAMP_EXT: 0x8e28,
    GPU_DISJOINT_EXT: 0x8fbb,
    QUERY_COUNTER_BITS_EXT: 0x8864,
  }

  const gl = {
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,

    getExtension: vi.fn((name: string) => {
      if (name === 'EXT_disjoint_timer_query_webgl2') {
        return ext
      }
      return null
    }),

    createQuery: vi.fn(() => {
      const query = { id: queryIdCounter++ } as unknown as WebGLQuery
      queries.set(query, { available: false, result: 0 })
      return query
    }),

    deleteQuery: vi.fn((query: WebGLQuery) => {
      queries.delete(query)
    }),

    beginQuery: vi.fn((_target: number, _query: WebGLQuery) => {}),
    endQuery: vi.fn((_target: number) => {}),

    getParameter: vi.fn((pname: number) => {
      if (pname === ext.GPU_DISJOINT_EXT) {
        return disjoint
      }
      return 0
    }),

    getQueryParameter: vi.fn((query: WebGLQuery, pname: number) => {
      const state = queries.get(query)
      if (!state) return 0

      if (pname === 0x8867) return state.available
      if (pname === 0x8866) return state.result
      return 0
    }),

    // MRTStateManager required methods
    drawBuffers: vi.fn(),
    BACK: 0x0405,
    COLOR_ATTACHMENT0: 0x8ce0,
  } as unknown as WebGL2RenderingContext

  const tempColor = new THREE.Color(0, 0, 0)

  const renderer = {
    getContext: () => gl,
    setRenderTarget: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    clearDepth: vi.fn(),
    clearStencil: vi.fn(),
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: false,
    info: {
      render: { triangles: 0, points: 0, lines: 0 },
    },
    // StateBarrier required methods
    getRenderTarget: vi.fn().mockReturnValue(null),
    getClearColor: vi.fn().mockImplementation((target: THREE.Color) => {
      target.copy(tempColor)
      return target
    }),
    getClearAlpha: vi.fn().mockReturnValue(1.0),
    setClearColor: vi.fn(),
  } as unknown as THREE.WebGLRenderer

  return { renderer, gl }
}

describe('RenderGraph GPU Timing', () => {
  let graph: RenderGraph
  let mockRenderer: THREE.WebGLRenderer
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera

  beforeEach(() => {
    graph = new RenderGraph()
    const mock = createMockRenderer()
    mockRenderer = mock.renderer
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera()

    // Set up graph size
    graph.setSize(800, 600)
  })

  afterEach(() => {
    graph.dispose()
  })

  describe('enableTimingQueries', () => {
    it('should enable GPU timing when available', () => {
      graph.enableTimingQueries(true)

      // Execute to initialize
      graph.execute(mockRenderer, scene, camera, 0.016)

      expect(graph.isGPUTimingAvailable()).toBe(true)
    })

    it('should also enable CPU timing when GPU timing is enabled', () => {
      graph.enableTimingQueries(true)

      // Add a pass to verify timing is collected
      const pass = new TestPass({
        id: 'test',
        inputs: [],
        outputs: [],
      })
      graph.addPass(pass)

      graph.execute(mockRenderer, scene, camera, 0.016)

      const stats = graph.getFrameStats()
      expect(stats).not.toBeNull()
      expect(stats?.passTiming.length).toBeGreaterThan(0)
    })
  })

  describe('getPassTimings', () => {
    it('should return empty array when timing is disabled', () => {
      const timings = graph.getPassTimings()
      expect(timings).toEqual([])
    })

    it('should return pass timing data when enabled', () => {
      // Add passes
      graph.addResource({
        id: 'color',
        type: 'renderTarget',
        size: { mode: 'screen' },
      })

      const pass1 = new TestPass({
        id: 'pass1',
        inputs: [],
        outputs: [{ resourceId: 'color', access: 'write' }],
      })

      const pass2 = new TestPass({
        id: 'pass2',
        inputs: [{ resourceId: 'color', access: 'read' }],
        outputs: [],
      })

      graph.addPass(pass1)
      graph.addPass(pass2)
      graph.enableTimingQueries(true)

      // Execute
      graph.execute(mockRenderer, scene, camera, 0.016)

      const timings = graph.getPassTimings()
      expect(timings.length).toBe(2)
      expect(timings.find((t) => t.passId === 'pass1')).toBeDefined()
      expect(timings.find((t) => t.passId === 'pass2')).toBeDefined()
    })

    it('should include CPU time for each pass', () => {
      const pass = new TestPass({
        id: 'test',
        inputs: [],
        outputs: [],
      })
      pass.executionTime = 1 // 1ms of busy wait

      graph.addPass(pass)
      graph.enableTimingQueries(true)
      graph.execute(mockRenderer, scene, camera, 0.016)

      const timings = graph.getPassTimings()
      const passTiming = timings.find((t) => t.passId === 'test')

      expect(passTiming).toBeDefined()
      expect(passTiming!.cpuTimeMs).toBeGreaterThan(0)
    })

    it('should mark skipped passes correctly', () => {
      // Pass that is conditionally disabled
      const pass = new TestPass({
        id: 'conditionalPass',
        inputs: [],
        outputs: [],
        enabled: () => false, // Always disabled
      })

      graph.addPass(pass)
      graph.enableTimingQueries(true)
      graph.execute(mockRenderer, scene, camera, 0.016)

      const timings = graph.getPassTimings()
      const passTiming = timings.find((t) => t.passId === 'conditionalPass')

      expect(passTiming).toBeDefined()
      expect(passTiming!.skipped).toBe(true)
      expect(passTiming!.cpuTimeMs).toBe(0)
    })
  })

  describe('getFrameStats', () => {
    it('should include GPU timing in frame stats', () => {
      const pass = new TestPass({
        id: 'test',
        inputs: [],
        outputs: [],
      })

      graph.addPass(pass)
      graph.enableTimingQueries(true)
      graph.execute(mockRenderer, scene, camera, 0.016)

      const stats = graph.getFrameStats()
      expect(stats).not.toBeNull()
      expect(stats!.passTiming).toBeDefined()

      const passTiming = stats!.passTiming.find((t) => t.passId === 'test')
      expect(passTiming).toBeDefined()
      // GPU time will be 0 initially (async results not yet available)
      expect(passTiming!.gpuTimeMs).toBeDefined()
    })

    it('should calculate total time from pass timings', () => {
      const pass1 = new TestPass({
        id: 'pass1',
        inputs: [],
        outputs: [],
      })
      pass1.executionTime = 1

      const pass2 = new TestPass({
        id: 'pass2',
        inputs: [],
        outputs: [],
      })
      pass2.executionTime = 1

      graph.addPass(pass1)
      graph.addPass(pass2)
      graph.enableTimingQueries(true)
      graph.execute(mockRenderer, scene, camera, 0.016)

      const stats = graph.getFrameStats()
      expect(stats).not.toBeNull()
      expect(stats!.totalTimeMs).toBeGreaterThan(0)
    })
  })

  describe('isGPUTimingAvailable', () => {
    it('should return true when extension is available', () => {
      // Execute to trigger initialization
      graph.execute(mockRenderer, scene, camera, 0.016)

      expect(graph.isGPUTimingAvailable()).toBe(true)
    })

    it('should return false before initialization', () => {
      // Don't execute - GPU timer not initialized yet
      expect(graph.isGPUTimingAvailable()).toBe(false)
    })
  })

  describe('context loss handling', () => {
    it('should handle context loss gracefully', () => {
      graph.enableTimingQueries(true)
      graph.execute(mockRenderer, scene, camera, 0.016)

      // Simulate context loss
      graph.invalidateForContextLoss()

      // Should not throw
      expect(() => graph.execute(mockRenderer, scene, camera, 0.016)).not.toThrow()
    })

    it('should reinitialize GPU timer after context restore', () => {
      graph.enableTimingQueries(true)
      graph.execute(mockRenderer, scene, camera, 0.016)

      graph.invalidateForContextLoss()
      graph.reinitialize(mockRenderer)

      expect(graph.isGPUTimingAvailable()).toBe(true)
    })
  })

  describe('disposal', () => {
    it('should clean up GPU timer on dispose', () => {
      graph.enableTimingQueries(true)
      graph.execute(mockRenderer, scene, camera, 0.016)

      graph.dispose()

      // After dispose, GPU timing should not be available
      expect(graph.isGPUTimingAvailable()).toBe(false)
    })
  })
})
