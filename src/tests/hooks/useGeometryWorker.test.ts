/**
 * Tests for useGeometryWorker hook
 *
 * Tests hook behavior when Worker is unavailable (test environment).
 */

import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGeometryWorker, generateRequestId } from '@/hooks/useGeometryWorker'

describe('useGeometryWorker', () => {
  describe('sendRequest', () => {
    it('rejects when Worker is unavailable', async () => {
      const { result } = renderHook(() => useGeometryWorker())

      await expect(
        result.current.sendRequest({
          type: 'generate-wythoff',
          id: 'test-1',
          dimension: 4,
          config: { preset: 'regular' },
        })
      ).rejects.toThrow('Worker not available')
    })
  })

  describe('cancelRequest', () => {
    it('is safe to call for nonexistent request', () => {
      const { result } = renderHook(() => useGeometryWorker())

      expect(() => {
        act(() => {
          result.current.cancelRequest('nonexistent-id')
        })
      }).not.toThrow()
    })

    it('is safe to call multiple times for same id', () => {
      const { result } = renderHook(() => useGeometryWorker())

      expect(() => {
        act(() => {
          result.current.cancelRequest('test-id')
          result.current.cancelRequest('test-id')
          result.current.cancelRequest('test-id')
        })
      }).not.toThrow()
    })
  })

  describe('isRequestPending', () => {
    it('returns false for unknown request', () => {
      const { result } = renderHook(() => useGeometryWorker())

      expect(result.current.isRequestPending('nonexistent')).toBe(false)
    })

    it('returns false for any request when worker unavailable', () => {
      const { result } = renderHook(() => useGeometryWorker())

      expect(result.current.isRequestPending('any-id')).toBe(false)
      expect(result.current.isRequestPending('')).toBe(false)
      expect(result.current.isRequestPending('12345')).toBe(false)
    })
  })

  describe('hook lifecycle', () => {
    it('can be rendered multiple times', () => {
      const { result: result1 } = renderHook(() => useGeometryWorker())
      const { result: result2 } = renderHook(() => useGeometryWorker())

      expect(result1.current.sendRequest).toBeDefined()
      expect(result2.current.sendRequest).toBeDefined()
    })
  })
})

describe('generateRequestId', () => {
  it('produces unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 20; i++) {
      ids.add(generateRequestId())
    }
    expect(ids.size).toBe(20)
  })

  it('includes default prefix', () => {
    const id = generateRequestId()
    expect(id.startsWith('req-')).toBe(true)
  })

  it('accepts custom prefix', () => {
    const id = generateRequestId('custom')
    expect(id.startsWith('custom-')).toBe(true)
  })

  it('includes timestamp component', () => {
    const id = generateRequestId()
    // Format: prefix-timestamp-random
    const parts = id.split('-')
    expect(parts.length).toBeGreaterThanOrEqual(2)

    // Second part should be a timestamp
    const timestamp = parseInt(parts[1]!, 10)
    expect(Number.isNaN(timestamp)).toBe(false)
    expect(timestamp).toBeGreaterThan(0)
  })

  it('includes random component', () => {
    const id = generateRequestId()
    const parts = id.split('-')
    // Last part is the random component
    const randomPart = parts[parts.length - 1]
    expect(randomPart).toBeDefined()
    expect(randomPart!.length).toBeGreaterThan(0)
  })
})
