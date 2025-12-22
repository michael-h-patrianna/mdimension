/**
 * Tests for GPUTimer.
 *
 * Tests GPU timing query functionality with mocked WebGL2 context.
 */

import type * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GPUTimer } from '@/rendering/graph/GPUTimer'

/**
 * Mock EXT_disjoint_timer_query_webgl2 extension.
 */
interface MockTimerQueryExt {
  TIME_ELAPSED_EXT: number
  TIMESTAMP_EXT: number
  GPU_DISJOINT_EXT: number
  QUERY_COUNTER_BITS_EXT: number
}

/**
 * Create a mock WebGL2RenderingContext with timer query support.
 *
 * @param supportsTimerQuery - Whether to simulate extension support
 * @returns Mock GL context and helpers
 */
function createMockGL(supportsTimerQuery = true): {
  gl: WebGL2RenderingContext
  ext: MockTimerQueryExt | null
  queries: Map<WebGLQuery, { available: boolean; result: number }>
  disjoint: boolean
} {
  const queries = new Map<WebGLQuery, { available: boolean; result: number }>()
  let disjoint = false

  const ext: MockTimerQueryExt | null = supportsTimerQuery
    ? {
        TIME_ELAPSED_EXT: 0x88bf,
        TIMESTAMP_EXT: 0x8e28,
        GPU_DISJOINT_EXT: 0x8fbb,
        QUERY_COUNTER_BITS_EXT: 0x8864,
      }
    : null

  let queryIdCounter = 0

  const gl = {
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,

    getExtension: vi.fn((name: string) => {
      if (name === 'EXT_disjoint_timer_query_webgl2' && supportsTimerQuery) {
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

    beginQuery: vi.fn((_target: number, _query: WebGLQuery) => {
      // Query started
    }),

    endQuery: vi.fn((_target: number) => {
      // Query ended
    }),

    getParameter: vi.fn((pname: number) => {
      if (ext && pname === ext.GPU_DISJOINT_EXT) {
        return disjoint
      }
      return 0
    }),

    getQueryParameter: vi.fn((query: WebGLQuery, pname: number) => {
      const state = queries.get(query)
      if (!state) return 0

      if (pname === 0x8867) {
        // QUERY_RESULT_AVAILABLE
        return state.available
      }
      if (pname === 0x8866) {
        // QUERY_RESULT
        return state.result
      }
      return 0
    }),
  } as unknown as WebGL2RenderingContext

  return {
    gl,
    ext,
    queries,
    get disjoint() {
      return disjoint
    },
    set disjoint(value: boolean) {
      disjoint = value
    },
  }
}

/**
 * Create a mock Three.js WebGLRenderer.
 *
 * @param gl - Mock WebGL2 context
 * @returns Mock renderer
 */
function createMockRenderer(gl: WebGL2RenderingContext): THREE.WebGLRenderer {
  return {
    getContext: () => gl,
  } as unknown as THREE.WebGLRenderer
}

describe('GPUTimer', () => {
  let gpuTimer: GPUTimer

  beforeEach(() => {
    gpuTimer = new GPUTimer()
  })

  afterEach(() => {
    gpuTimer.dispose()
  })

  describe('initialization', () => {
    it('should initialize with timer query extension', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)

      const result = gpuTimer.initialize(renderer)

      expect(result).toBe(true)
      expect(gpuTimer.isAvailable()).toBe(true)
    })

    it('should handle missing extension gracefully', () => {
      const { gl } = createMockGL(false)
      const renderer = createMockRenderer(gl)

      const result = gpuTimer.initialize(renderer)

      expect(result).toBe(false)
      expect(gpuTimer.isAvailable()).toBe(false)
    })

    it('should handle non-WebGL2 context', () => {
      // Create a mock that doesn't have getExtension (not WebGL at all)
      const mockGL = {}
      const renderer = {
        getContext: () => mockGL,
      } as unknown as THREE.WebGLRenderer

      const result = gpuTimer.initialize(renderer)

      expect(result).toBe(false)
      expect(gpuTimer.isAvailable()).toBe(false)
    })

    it('should handle null context', () => {
      const renderer = {
        getContext: () => null,
      } as unknown as THREE.WebGLRenderer

      const result = gpuTimer.initialize(renderer)

      expect(result).toBe(false)
      expect(gpuTimer.isAvailable()).toBe(false)
    })
  })

  describe('enable/disable', () => {
    it('should enable timing when extension is available', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)

      gpuTimer.setEnabled(true)

      expect(gpuTimer.isEnabled()).toBe(true)
    })

    it('should not enable timing when extension is unavailable', () => {
      const { gl } = createMockGL(false)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)

      gpuTimer.setEnabled(true)

      expect(gpuTimer.isEnabled()).toBe(false)
    })

    it('should disable timing', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      gpuTimer.setEnabled(false)

      expect(gpuTimer.isEnabled()).toBe(false)
    })
  })

  describe('query lifecycle', () => {
    it('should begin and end queries', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      gpuTimer.beginFrame()
      gpuTimer.beginQuery('testPass')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      // Verify GL calls were made
      expect(gl.beginQuery).toHaveBeenCalled()
      expect(gl.endQuery).toHaveBeenCalled()
    })

    it('should not make GL calls when disabled', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      // Explicitly not enabling

      gpuTimer.beginFrame()
      gpuTimer.beginQuery('testPass')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      expect(gl.beginQuery).not.toHaveBeenCalled()
      expect(gl.endQuery).not.toHaveBeenCalled()
    })

    it('should handle dangling queries at frame end', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      // Suppress warning for this test
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      gpuTimer.beginFrame()
      gpuTimer.beginQuery('testPass')
      // Deliberately not calling endQuery
      gpuTimer.endFrame()

      expect(gl.endQuery).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('result retrieval', () => {
    it('should return 0 for passes with no results yet', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      const time = gpuTimer.getPassTime('nonexistent')

      expect(time).toBe(0)
    })

    it('should retrieve results when available', () => {
      const { gl, queries } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      // Frame 1: Start a query
      gpuTimer.beginFrame()
      gpuTimer.beginQuery('testPass')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      // Simulate query completion (result in nanoseconds: 5ms)
      for (const [, state] of queries) {
        state.available = true
        state.result = 5_000_000 // 5ms in nanoseconds
      }

      // Frame 2: Poll results
      gpuTimer.beginFrame()
      gpuTimer.endFrame()

      const time = gpuTimer.getPassTime('testPass')
      expect(time).toBe(5) // 5ms
    })

    it('should return results map', () => {
      const { gl, queries } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      // Run a query
      gpuTimer.beginFrame()
      gpuTimer.beginQuery('pass1')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      // Make result available
      for (const [, state] of queries) {
        state.available = true
        state.result = 2_000_000 // 2ms
      }

      // Poll
      gpuTimer.beginFrame()
      gpuTimer.endFrame()

      const results = gpuTimer.getResults()
      expect(results.size).toBe(1)
      expect(results.get('pass1')?.gpuTimeMs).toBe(2)
      expect(results.get('pass1')?.valid).toBe(true)
    })

    it('should handle disjoint GPU state', () => {
      const mock = createMockGL(true)
      const renderer = createMockRenderer(mock.gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      // Run a query
      gpuTimer.beginFrame()
      gpuTimer.beginQuery('testPass')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      // Simulate disjoint (GPU clock reset)
      mock.disjoint = true

      // Poll (should discard pending queries)
      gpuTimer.beginFrame()
      gpuTimer.endFrame()

      // Result should not be available
      const time = gpuTimer.getPassTime('testPass')
      expect(time).toBe(0)
    })

    it('should clear results', () => {
      const { gl, queries } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      // Run and complete a query
      gpuTimer.beginFrame()
      gpuTimer.beginQuery('testPass')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      for (const [, state] of queries) {
        state.available = true
        state.result = 1_000_000
      }

      gpuTimer.beginFrame()
      gpuTimer.endFrame()

      // Clear results
      gpuTimer.clearResults()

      expect(gpuTimer.getResults().size).toBe(0)
    })
  })

  describe('query pool', () => {
    it('should reuse query objects', () => {
      const { gl, queries } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      // Run first query
      gpuTimer.beginFrame()
      gpuTimer.beginQuery('pass1')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      const createCountAfterFirst = (gl.createQuery as ReturnType<typeof vi.fn>).mock.calls.length

      // Complete query
      for (const [, state] of queries) {
        state.available = true
        state.result = 1_000_000
      }

      gpuTimer.beginFrame()
      gpuTimer.endFrame()

      // Run second query - should reuse
      gpuTimer.beginFrame()
      gpuTimer.beginQuery('pass2')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      // Should have reused from pool (no new query created)
      const createCountAfterSecond = (gl.createQuery as ReturnType<typeof vi.fn>).mock.calls.length

      expect(createCountAfterSecond).toBe(createCountAfterFirst)
    })
  })

  describe('disposal', () => {
    it('should clean up resources on dispose', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      gpuTimer.beginFrame()
      gpuTimer.beginQuery('testPass')
      gpuTimer.endQuery()
      gpuTimer.endFrame()

      gpuTimer.dispose()

      expect(gpuTimer.isAvailable()).toBe(false)
      expect(gpuTimer.isEnabled()).toBe(false)
      expect(gpuTimer.getResults().size).toBe(0)
    })
  })

  describe('context loss', () => {
    it('should handle context loss', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      gpuTimer.invalidateForContextLoss()

      expect(gpuTimer.isAvailable()).toBe(false)
    })

    it('should reinitialize after context restoration', () => {
      const { gl } = createMockGL(true)
      const renderer = createMockRenderer(gl)
      gpuTimer.initialize(renderer)
      gpuTimer.setEnabled(true)

      gpuTimer.invalidateForContextLoss()
      gpuTimer.reinitialize(renderer)

      expect(gpuTimer.isAvailable()).toBe(true)
      // Note: isEnabled will be true because reinitialize preserves the flag
    })
  })
})
