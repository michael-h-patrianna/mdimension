/**
 * Tests for TemporalResource
 *
 * Verifies N-frame history management for temporal effects.
 */

import { describe, expect, it, vi } from 'vitest'

import { TemporalResource } from '@/rendering/graph/TemporalResource'

describe('TemporalResource', () => {
  describe('constructor', () => {
    it('should create resource with specified history length', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      expect(resource.getHistoryLength()).toBe(2)
      resource.dispose()
    })

    it('should throw if history length is less than 1', () => {
      expect(
        () =>
          new TemporalResource({
            historyLength: 0,
            factory: () => ({ value: 0 }),
          })
      ).toThrow('historyLength must be at least 1')
    })

    it('should pre-allocate all history slots', () => {
      const factoryFn = vi.fn(() => ({ value: 0 }))

      const resource = new TemporalResource({
        historyLength: 3,
        factory: factoryFn,
      })

      expect(factoryFn).toHaveBeenCalledTimes(3)
      resource.dispose()
    })

    it('should support debug name', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
        debugName: 'testResource',
      })

      expect(resource.getDebugName()).toBe('testResource')
      resource.dispose()
    })
  })

  describe('getWrite', () => {
    it('should return the current write target', () => {
      let counter = 0
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ id: counter++ }),
      })

      const writeTarget = resource.getWrite()
      expect(writeTarget).toEqual({ id: 0 })

      resource.dispose()
    })

    it('should throw if disposed', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.dispose()

      expect(() => resource.getWrite()).toThrow('has been disposed')
    })
  })

  describe('getRead', () => {
    it('should return previous frame with offset 1', () => {
      let counter = 0
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ id: counter++ }),
      })

      // Initial state: write at 0, history = [{id:0}, {id:1}]
      // After advance: write at 1
      resource.advanceFrame()

      // Read offset 1 should be index 0 (the previous write)
      const readTarget = resource.getRead(1)
      expect(readTarget).toEqual({ id: 0 })

      resource.dispose()
    })

    it('should return current frame with offset 0', () => {
      let counter = 0
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ id: counter++ }),
      })

      resource.advanceFrame() // write index now 1

      const readTarget = resource.getRead(0)
      expect(readTarget).toEqual({ id: 1 })

      resource.dispose()
    })

    it('should throw for negative offset', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      expect(() => resource.getRead(-1)).toThrow('must be non-negative')
      resource.dispose()
    })

    it('should throw if offset exceeds history length', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      expect(() => resource.getRead(2)).toThrow('exceeds history length')
      resource.dispose()
    })

    it('should throw if disposed', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.dispose()

      expect(() => resource.getRead(1)).toThrow('has been disposed')
    })
  })

  describe('hasValidHistory', () => {
    it('should return false immediately after creation', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      expect(resource.hasValidHistory(1)).toBe(false)
      resource.dispose()
    })

    it('should return true after enough frames', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame() // framesSinceReset = 1
      expect(resource.hasValidHistory(0)).toBe(true)
      expect(resource.hasValidHistory(1)).toBe(false)

      resource.advanceFrame() // framesSinceReset = 2
      expect(resource.hasValidHistory(1)).toBe(true)

      resource.dispose()
    })

    it('should return false for offset >= history length', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.advanceFrame()
      resource.advanceFrame()

      expect(resource.hasValidHistory(2)).toBe(false)
      resource.dispose()
    })

    it('should return false for negative offset', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      expect(resource.hasValidHistory(-1)).toBe(false)
      resource.dispose()
    })

    it('should return false when disposed', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.advanceFrame()
      resource.dispose()

      expect(resource.hasValidHistory(1)).toBe(false)
    })
  })

  describe('getValidHistoryCount', () => {
    it('should return 0 immediately after creation', () => {
      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ value: 0 }),
      })

      expect(resource.getValidHistoryCount()).toBe(0)
      resource.dispose()
    })

    it('should increase after each frame', () => {
      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      expect(resource.getValidHistoryCount()).toBe(1)

      resource.advanceFrame()
      expect(resource.getValidHistoryCount()).toBe(2)

      resource.dispose()
    })

    it('should cap at history length minus 1', () => {
      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.advanceFrame()
      resource.advanceFrame()
      resource.advanceFrame()
      resource.advanceFrame()

      // Max valid count is historyLength - 1 = 2
      expect(resource.getValidHistoryCount()).toBe(2)
      resource.dispose()
    })

    it('should return 0 when disposed', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.dispose()

      expect(resource.getValidHistoryCount()).toBe(0)
    })
  })

  describe('advanceFrame', () => {
    it('should move write index forward', () => {
      let counter = 0
      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ id: counter++ }),
      })

      // Initial: write at 0, history = [{id:0}, {id:1}, {id:2}]
      expect(resource.getWrite()).toEqual({ id: 0 })

      resource.advanceFrame() // write at 1
      expect(resource.getWrite()).toEqual({ id: 1 })

      resource.advanceFrame() // write at 2
      expect(resource.getWrite()).toEqual({ id: 2 })

      resource.advanceFrame() // write at 0 (wraps around)
      expect(resource.getWrite()).toEqual({ id: 0 })

      resource.dispose()
    })

    it('should increment frames since reset', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      expect(resource.getFramesSinceReset()).toBe(0)

      resource.advanceFrame()
      expect(resource.getFramesSinceReset()).toBe(1)

      resource.advanceFrame()
      expect(resource.getFramesSinceReset()).toBe(2)

      resource.dispose()
    })

    it('should throw if disposed', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.dispose()

      expect(() => resource.advanceFrame()).toThrow('has been disposed')
    })
  })

  describe('invalidateHistory', () => {
    it('should reset frames since reset to 0', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.advanceFrame()
      expect(resource.getFramesSinceReset()).toBe(2)

      resource.invalidateHistory()
      expect(resource.getFramesSinceReset()).toBe(0)

      resource.dispose()
    })

    it('should make hasValidHistory return false', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.advanceFrame()
      expect(resource.hasValidHistory(1)).toBe(true)

      resource.invalidateHistory()
      expect(resource.hasValidHistory(1)).toBe(false)

      resource.dispose()
    })

    it('should not throw if disposed', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.dispose()

      // Should not throw
      expect(() => resource.invalidateHistory()).not.toThrow()
    })
  })

  describe('isWarm', () => {
    it('should return false when not enough frames accumulated', () => {
      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ value: 0 }),
      })

      expect(resource.isWarm()).toBe(false)

      resource.advanceFrame()
      expect(resource.isWarm()).toBe(false)

      resource.advanceFrame()
      expect(resource.isWarm()).toBe(false)

      resource.dispose()
    })

    it('should return true when history length frames accumulated', () => {
      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.advanceFrame()
      resource.advanceFrame()

      expect(resource.isWarm()).toBe(true)
      resource.dispose()
    })

    it('should return false after invalidation', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      resource.advanceFrame()
      resource.advanceFrame()
      expect(resource.isWarm()).toBe(true)

      resource.invalidateHistory()
      expect(resource.isWarm()).toBe(false)

      resource.dispose()
    })
  })

  describe('dispose', () => {
    it('should call dispose function for each history entry', () => {
      const disposeFn = vi.fn()

      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ value: 0 }),
        dispose: disposeFn,
      })

      resource.dispose()

      expect(disposeFn).toHaveBeenCalledTimes(3)
    })

    it('should set disposed flag', () => {
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
      })

      expect(resource.isDisposed()).toBe(false)
      resource.dispose()
      expect(resource.isDisposed()).toBe(true)
    })

    it('should be idempotent', () => {
      const disposeFn = vi.fn()

      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ value: 0 }),
        dispose: disposeFn,
      })

      resource.dispose()
      resource.dispose()

      // Should only be called once per entry
      expect(disposeFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('circular buffer behavior', () => {
    it('should correctly wrap around for ping-pong buffer', () => {
      let counter = 0
      const resource = new TemporalResource({
        historyLength: 2,
        factory: () => ({ id: counter++ }),
      })

      // Frame 0: write=0, read(1) would be 1
      const frame0Write = resource.getWrite()
      expect(frame0Write.id).toBe(0)

      resource.advanceFrame() // write=1

      // Frame 1: write=1, read(1)=0
      const frame1Write = resource.getWrite()
      expect(frame1Write.id).toBe(1)
      expect(resource.getRead(1).id).toBe(0)

      resource.advanceFrame() // write=0 (wrapped)

      // Frame 2: write=0, read(1)=1
      expect(resource.getWrite().id).toBe(0)
      expect(resource.getRead(1).id).toBe(1)

      resource.dispose()
    })

    it('should correctly handle 3-frame history', () => {
      let counter = 0
      const resource = new TemporalResource({
        historyLength: 3,
        factory: () => ({ id: counter++ }),
      })

      // Initial: write=0, history=[{0}, {1}, {2}]
      resource.advanceFrame() // write=1
      resource.advanceFrame() // write=2
      resource.advanceFrame() // write=0 (wrapped)

      // Now: write=0, we can read 1 and 2 frames back
      expect(resource.getWrite().id).toBe(0)
      expect(resource.getRead(1).id).toBe(2) // 1 frame ago
      expect(resource.getRead(2).id).toBe(1) // 2 frames ago

      resource.dispose()
    })
  })

  describe('typical use case - cubemap capture', () => {
    it('should support 2-frame cubemap pattern', () => {
      interface MockCubemap {
        resolution: number
        frameRendered: number
      }

      let frameCounter = -1
      const resource = new TemporalResource<MockCubemap>({
        historyLength: 2,
        factory: () => ({ resolution: 512, frameRendered: -1 }),
        dispose: () => {},
        debugName: 'skyboxCubemap',
      })

      // Frame 0: Capture to write target, history not yet valid
      // framesSinceReset = 0
      frameCounter++
      const write0 = resource.getWrite()
      write0.frameRendered = frameCounter
      expect(resource.hasValidHistory(1)).toBe(false)
      resource.advanceFrame() // framesSinceReset = 1

      // Frame 1: Still no valid history at offset 1 (need framesSinceReset > 1)
      frameCounter++
      const write1 = resource.getWrite()
      write1.frameRendered = frameCounter
      expect(resource.hasValidHistory(1)).toBe(false) // Need 2 frames for offset 1
      resource.advanceFrame() // framesSinceReset = 2

      // Frame 2: NOW previous frame is valid (framesSinceReset = 2 > 1)
      frameCounter++
      const write2 = resource.getWrite()
      write2.frameRendered = frameCounter
      expect(resource.hasValidHistory(1)).toBe(true)
      const read2 = resource.getRead(1)
      expect(read2.frameRendered).toBe(1) // Frame 1's capture (the previous write slot)
      resource.advanceFrame()

      // Frame 3: History continues to be valid
      frameCounter++
      resource.getWrite().frameRendered = frameCounter
      expect(resource.hasValidHistory(1)).toBe(true)
      const read3 = resource.getRead(1)
      expect(read3.frameRendered).toBe(2) // Frame 2's capture

      resource.dispose()
    })
  })
})
