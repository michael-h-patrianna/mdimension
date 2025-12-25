/**
 * Tests for Performance Metrics Store
 *
 * Tests the performance metrics state and actions including:
 * - updateMetrics for general metrics
 * - updateSceneGpu for scene-only GPU stats
 * - updateBufferStats for render target dimensions
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GRAPH_POINTS,
  usePerformanceMetricsStore,
  type BufferStats,
  type GPUStats,
} from '@/stores/performanceMetricsStore'

describe('performanceMetricsStore', () => {
  // Store initial state for reset
  const initialState = {
    fps: 60,
    minFps: Infinity,
    maxFps: 0,
    frameTime: 0,
    cpuTime: 0,
    gpu: { calls: 0, triangles: 0, points: 0, lines: 0 },
    sceneGpu: { calls: 0, triangles: 0, points: 0, lines: 0 },
    memory: { geometries: 0, textures: 0, programs: 0, heap: 0 },
    vram: { geometries: 0, textures: 0, total: 0 },
    viewport: { width: 0, height: 0, dpr: 1 },
    buffers: {
      depth: { width: 0, height: 0 },
      normal: { width: 0, height: 0 },
      temporal: { width: 0, height: 0 },
      screen: { width: 0, height: 0 },
    },
    history: {
      fps: new Array(GRAPH_POINTS).fill(60),
      cpu: new Array(GRAPH_POINTS).fill(0),
      mem: new Array(GRAPH_POINTS).fill(0),
    },
    gpuName: 'Unknown GPU',
  }

  beforeEach(() => {
    // Reset store to initial state before each test
    usePerformanceMetricsStore.setState(initialState)
  })

  afterEach(() => {
    // Clean up after each test
    usePerformanceMetricsStore.setState(initialState)
  })

  describe('initial state', () => {
    it('should have default fps of 60', () => {
      expect(usePerformanceMetricsStore.getState().fps).toBe(60)
    })

    it('should have empty gpu stats', () => {
      const { gpu } = usePerformanceMetricsStore.getState()
      expect(gpu.calls).toBe(0)
      expect(gpu.triangles).toBe(0)
      expect(gpu.points).toBe(0)
      expect(gpu.lines).toBe(0)
    })

    it('should have empty sceneGpu stats', () => {
      const { sceneGpu } = usePerformanceMetricsStore.getState()
      expect(sceneGpu.calls).toBe(0)
      expect(sceneGpu.triangles).toBe(0)
      expect(sceneGpu.points).toBe(0)
      expect(sceneGpu.lines).toBe(0)
    })

    it('should have default buffer dimensions of 0x0', () => {
      const { buffers } = usePerformanceMetricsStore.getState()
      expect(buffers.screen.width).toBe(0)
      expect(buffers.screen.height).toBe(0)
      expect(buffers.depth.width).toBe(0)
      expect(buffers.depth.height).toBe(0)
    })

    it('should have fps history of correct length', () => {
      const { history } = usePerformanceMetricsStore.getState()
      expect(history.fps).toHaveLength(GRAPH_POINTS)
    })
  })

  describe('updateMetrics', () => {
    it('should update fps', () => {
      usePerformanceMetricsStore.getState().updateMetrics({ fps: 45 })
      expect(usePerformanceMetricsStore.getState().fps).toBe(45)
    })

    it('should update gpu stats', () => {
      const gpuStats: GPUStats = { calls: 100, triangles: 5000, points: 200, lines: 50 }
      usePerformanceMetricsStore.getState().updateMetrics({ gpu: gpuStats })

      const { gpu } = usePerformanceMetricsStore.getState()
      expect(gpu.calls).toBe(100)
      expect(gpu.triangles).toBe(5000)
      expect(gpu.points).toBe(200)
      expect(gpu.lines).toBe(50)
    })

    it('should update viewport', () => {
      usePerformanceMetricsStore.getState().updateMetrics({
        viewport: { width: 1920, height: 1080, dpr: 2 },
      })

      const { viewport } = usePerformanceMetricsStore.getState()
      expect(viewport.width).toBe(1920)
      expect(viewport.height).toBe(1080)
      expect(viewport.dpr).toBe(2)
    })

    it('should update multiple fields at once', () => {
      usePerformanceMetricsStore.getState().updateMetrics({
        fps: 55,
        frameTime: 18.2,
        cpuTime: 5.5,
      })

      const state = usePerformanceMetricsStore.getState()
      expect(state.fps).toBe(55)
      expect(state.frameTime).toBe(18.2)
      expect(state.cpuTime).toBe(5.5)
    })
  })

  describe('updateSceneGpu', () => {
    it('should update scene-only GPU stats', () => {
      const sceneStats: GPUStats = { calls: 10, triangles: 1000, points: 50, lines: 24 }
      usePerformanceMetricsStore.getState().updateSceneGpu(sceneStats)

      const { sceneGpu } = usePerformanceMetricsStore.getState()
      expect(sceneGpu.calls).toBe(10)
      expect(sceneGpu.triangles).toBe(1000)
      expect(sceneGpu.points).toBe(50)
      expect(sceneGpu.lines).toBe(24)
    })

    it('should not affect total gpu stats when updating sceneGpu', () => {
      // First set total gpu stats
      const totalStats: GPUStats = { calls: 50, triangles: 3000, points: 100, lines: 60 }
      usePerformanceMetricsStore.getState().updateMetrics({ gpu: totalStats })

      // Then update scene-only stats
      const sceneStats: GPUStats = { calls: 10, triangles: 1000, points: 50, lines: 24 }
      usePerformanceMetricsStore.getState().updateSceneGpu(sceneStats)

      // Total should remain unchanged
      const { gpu, sceneGpu } = usePerformanceMetricsStore.getState()
      expect(gpu.calls).toBe(50)
      expect(gpu.triangles).toBe(3000)
      expect(sceneGpu.calls).toBe(10)
      expect(sceneGpu.triangles).toBe(1000)
    })

    it('should allow scene stats to differ from total stats', () => {
      // Scene renders less than total (post-processing adds more)
      const totalStats: GPUStats = { calls: 100, triangles: 10000, points: 0, lines: 0 }
      const sceneStats: GPUStats = { calls: 5, triangles: 2000, points: 0, lines: 0 }

      usePerformanceMetricsStore.getState().updateMetrics({ gpu: totalStats })
      usePerformanceMetricsStore.getState().updateSceneGpu(sceneStats)

      const { gpu, sceneGpu } = usePerformanceMetricsStore.getState()
      expect(gpu.triangles).toBeGreaterThan(sceneGpu.triangles)
      expect(gpu.calls).toBeGreaterThan(sceneGpu.calls)
    })
  })

  describe('updateBufferStats', () => {
    it('should update buffer dimensions', () => {
      const buffers: BufferStats = {
        screen: { width: 1920, height: 1080 },
        depth: { width: 1920, height: 1080 },
        normal: { width: 1920, height: 1080 },
        temporal: { width: 1920, height: 1080 },
      }
      usePerformanceMetricsStore.getState().updateBufferStats(buffers)

      const { buffers: storedBuffers } = usePerformanceMetricsStore.getState()
      expect(storedBuffers.screen.width).toBe(1920)
      expect(storedBuffers.screen.height).toBe(1080)
      expect(storedBuffers.depth.width).toBe(1920)
      expect(storedBuffers.normal.width).toBe(1920)
      expect(storedBuffers.temporal.width).toBe(1920)
    })

    it('should handle different buffer sizes', () => {
      // Temporal might be half resolution
      const buffers: BufferStats = {
        screen: { width: 1920, height: 1080 },
        depth: { width: 1920, height: 1080 },
        normal: { width: 1920, height: 1080 },
        temporal: { width: 960, height: 540 },
      }
      usePerformanceMetricsStore.getState().updateBufferStats(buffers)

      const { buffers: storedBuffers } = usePerformanceMetricsStore.getState()
      expect(storedBuffers.screen.width).toBe(1920)
      expect(storedBuffers.temporal.width).toBe(960)
    })
  })

  describe('setGpuName', () => {
    it('should update GPU name', () => {
      usePerformanceMetricsStore.getState().setGpuName('Apple M1 Pro')
      expect(usePerformanceMetricsStore.getState().gpuName).toBe('Apple M1 Pro')
    })

    it('should handle various GPU name formats', () => {
      usePerformanceMetricsStore.getState().setGpuName('NVIDIA GeForce RTX 4090')
      expect(usePerformanceMetricsStore.getState().gpuName).toBe('NVIDIA GeForce RTX 4090')
    })
  })
})

