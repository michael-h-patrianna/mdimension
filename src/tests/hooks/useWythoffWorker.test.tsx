/**
 * Tests for useWythoffWorker Hook
 *
 * Note: Web Workers don't run in Vitest's environment, so we mock the worker
 * and test the hook's state management and message handling logic.
 *
 * @see src/hooks/useWythoffWorker.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WorkerResponse } from '@/workers/wythoff.worker'

// Mock the worker module
const mockPostMessage = vi.fn()
const mockTerminate = vi.fn()

let mockOnMessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
let mockOnError: ((event: ErrorEvent) => void) | null = null

vi.mock('@/workers/wythoff.worker?worker', () => {
  return {
    default: class MockWorker {
      postMessage = mockPostMessage
      terminate = mockTerminate

      set onmessage(handler: ((event: MessageEvent<WorkerResponse>) => void) | null) {
        mockOnMessage = handler
      }

      set onerror(handler: ((event: ErrorEvent) => void) | null) {
        mockOnError = handler
      }
    },
  }
})

// Import after mocking
import { useWythoffWorker } from '@/hooks/useWythoffWorker'

describe('useWythoffWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnMessage = null
    mockOnError = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWythoffWorker())

      expect(result.current.geometry).toBeNull()
      expect(result.current.warnings).toEqual([])
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.progress).toBe(0)
      expect(result.current.error).toBeNull()
    })

    it('should provide stable generate function', () => {
      const { result, rerender } = renderHook(() => useWythoffWorker())

      const firstGenerate = result.current.generate
      rerender()
      const secondGenerate = result.current.generate

      expect(firstGenerate).toBe(secondGenerate)
    })
  })

  describe('generate', () => {
    it('should send message to worker on generate', () => {
      const { result } = renderHook(() => useWythoffWorker())

      act(() => {
        result.current.generate(4, { symmetryGroup: 'B', preset: 'regular' })
      })

      expect(mockPostMessage).toHaveBeenCalledTimes(1)
      const message = mockPostMessage.mock.calls[0]?.[0]
      expect(message.type).toBe('generate')
      expect(message.dimension).toBe(4)
      expect(message.config).toEqual({ symmetryGroup: 'B', preset: 'regular' })
      expect(message.id).toBeDefined()
    })

    it('should set isGenerating to true when generate is called', () => {
      const { result } = renderHook(() => useWythoffWorker())

      expect(result.current.isGenerating).toBe(false)

      act(() => {
        result.current.generate(4)
      })

      expect(result.current.isGenerating).toBe(true)
    })

    it('should reset error state on new generate', () => {
      const { result } = renderHook(() => useWythoffWorker())

      // Simulate an error first
      act(() => {
        result.current.generate(4)
      })

      act(() => {
        if (mockOnMessage) {
          mockOnMessage({
            data: {
              type: 'error',
              id: mockPostMessage.mock.calls[0]?.[0].id,
              error: 'Test error',
            },
          } as unknown as MessageEvent<WorkerResponse>)
        }
      })

      expect(result.current.error).toBe('Test error')

      // Generate again
      act(() => {
        result.current.generate(5)
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('worker response handling', () => {
    it('should update progress on progress message', async () => {
      const { result } = renderHook(() => useWythoffWorker())

      act(() => {
        result.current.generate(4)
      })

      const requestId = mockPostMessage.mock.calls[0]?.[0].id

      act(() => {
        if (mockOnMessage) {
          mockOnMessage({
            data: {
              type: 'progress',
              id: requestId,
              progress: 50,
            },
          } as unknown as MessageEvent<WorkerResponse>)
        }
      })

      expect(result.current.progress).toBe(50)
    })

    it('should update state on result message', async () => {
      const { result } = renderHook(() => useWythoffWorker())

      act(() => {
        result.current.generate(4)
      })

      const requestId = mockPostMessage.mock.calls[0]?.[0].id
      const testGeometry = {
        type: 'wythoff-polytope' as const,
        dimension: 4,
        vertices: [[1, 2, 3, 4]],
        edges: [] as [number, number][],
      }

      act(() => {
        if (mockOnMessage) {
          mockOnMessage({
            data: {
              type: 'result',
              id: requestId,
              geometry: testGeometry,
              warnings: ['Test warning'],
            },
          } as unknown as MessageEvent<WorkerResponse>)
        }
      })

      expect(result.current.geometry).toEqual(testGeometry)
      expect(result.current.warnings).toEqual(['Test warning'])
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.progress).toBe(100)
      expect(result.current.error).toBeNull()
    })

    it('should correctly inflate transferable geometry', async () => {
      const { result } = renderHook(() => useWythoffWorker())

      act(() => {
        result.current.generate(4)
      })

      const requestId = mockPostMessage.mock.calls[0]?.[0].id
      
      // Create transferable data
      const vertices = new Float64Array([1, 2, 3, 4])
      const edges = new Uint32Array([0, 0]) // Just dummy data
      
      act(() => {
        if (mockOnMessage) {
          mockOnMessage({
            data: {
              type: 'result',
              id: requestId,
              transferableGeometry: {
                type: 'wythoff-polytope',
                dimension: 4,
                vertices,
                edges,
              },
              warnings: [],
            },
          } as unknown as MessageEvent<WorkerResponse>)
        }
      })

      expect(result.current.geometry).not.toBeNull()
      expect(result.current.geometry?.dimension).toBe(4)
      expect(result.current.geometry?.vertices[0]).toEqual([1, 2, 3, 4])
    })

    it('should update error on error message', async () => {
      const { result } = renderHook(() => useWythoffWorker())

      act(() => {
        result.current.generate(4)
      })

      const requestId = mockPostMessage.mock.calls[0]?.[0].id

      act(() => {
        if (mockOnMessage) {
          mockOnMessage({
            data: {
              type: 'error',
              id: requestId,
              error: 'Generation failed',
            },
          } as unknown as MessageEvent<WorkerResponse>)
        }
      })

      expect(result.current.error).toBe('Generation failed')
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.progress).toBe(0)
    })

    it('should ignore responses for stale request IDs', async () => {
      const { result } = renderHook(() => useWythoffWorker())

      // First request
      act(() => {
        result.current.generate(4)
      })

      const firstRequestId = mockPostMessage.mock.calls[0]?.[0].id

      // Second request (supersedes first)
      act(() => {
        result.current.generate(5)
      })

      // Send response for first (stale) request
      act(() => {
        if (mockOnMessage) {
          mockOnMessage({
            data: {
              type: 'result',
              id: firstRequestId,
              geometry: {
                type: 'wythoff-polytope',
                dimension: 4,
                vertices: [],
                edges: [],
              },
            },
          } as unknown as MessageEvent<WorkerResponse>)
        }
      })

      // Should still be generating (waiting for second request)
      expect(result.current.isGenerating).toBe(true)
      expect(result.current.geometry).toBeNull()
    })
  })

  describe('cleanup', () => {
    it('should terminate worker on unmount', () => {
      const { unmount } = renderHook(() => useWythoffWorker())

      unmount()

      expect(mockTerminate).toHaveBeenCalled()
    })
  })

  describe('worker error handling', () => {
    it('should handle worker onerror event', async () => {
      const { result } = renderHook(() => useWythoffWorker())

      act(() => {
        result.current.generate(4)
      })

      act(() => {
        if (mockOnError) {
          mockOnError({
            message: 'Worker crashed',
          } as ErrorEvent)
        }
      })

      expect(result.current.error).toBe('Worker error: Worker crashed')
      expect(result.current.isGenerating).toBe(false)
    })
  })
})
