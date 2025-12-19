/**
 * Tests for WebGL Context Store
 *
 * Tests the context lifecycle management including:
 * - State transitions (active → lost → restoring → active/failed)
 * - Recovery attempt tracking with exponential backoff
 * - Rapid failure detection
 * - Page visibility handling
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useWebGLContextStore, DEFAULT_RECOVERY_CONFIG, RECOVERY_STATE_KEY } from '@/stores/webglContextStore'

describe('webglContextStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWebGLContextStore.getState().reset()
    // Clear localStorage
    localStorage.removeItem(RECOVERY_STATE_KEY)
  })



  describe('onContextLost', () => {
    it('should set status to lost', () => {
      useWebGLContextStore.getState().onContextLost()
      expect(useWebGLContextStore.getState().status).toBe('lost')
    })

    it('should record lostAt timestamp', () => {
      const before = Date.now()
      useWebGLContextStore.getState().onContextLost()
      const after = Date.now()

      const lostAt = useWebGLContextStore.getState().lostAt
      expect(lostAt).toBeGreaterThanOrEqual(before)
      expect(lostAt).toBeLessThanOrEqual(after)
    })

    it('should increment lostCount', () => {
      useWebGLContextStore.getState().onContextLost()
      expect(useWebGLContextStore.getState().lostCount).toBe(1)

      useWebGLContextStore.getState().reset()
      useWebGLContextStore.getState().onContextLost()
      useWebGLContextStore.getState().onContextLost()
      expect(useWebGLContextStore.getState().lostCount).toBe(2)
    })

    it('should update loss history for rapid failure detection', () => {
      useWebGLContextStore.getState().onContextLost()
      expect(useWebGLContextStore.getState().lossHistory.length).toBe(1)
    })
  })

  describe('onContextRestoring', () => {
    it('should set status to restoring', () => {
      useWebGLContextStore.getState().onContextLost()
      useWebGLContextStore.getState().onContextRestoring()
      expect(useWebGLContextStore.getState().status).toBe('restoring')
    })

    it('should increment recoveryAttempts', () => {
      useWebGLContextStore.getState().onContextRestoring()
      expect(useWebGLContextStore.getState().recoveryAttempts).toBe(1)

      useWebGLContextStore.getState().onContextRestoring()
      expect(useWebGLContextStore.getState().recoveryAttempts).toBe(2)
    })
  })

  describe('onContextRestored', () => {
    it('should set status to active', () => {
      useWebGLContextStore.getState().onContextLost()
      useWebGLContextStore.getState().onContextRestored()
      expect(useWebGLContextStore.getState().status).toBe('active')
    })

    it('should record restoredAt timestamp', () => {
      const before = Date.now()
      useWebGLContextStore.getState().onContextRestored()
      const after = Date.now()

      const restoredAt = useWebGLContextStore.getState().restoredAt
      expect(restoredAt).toBeGreaterThanOrEqual(before)
      expect(restoredAt).toBeLessThanOrEqual(after)
    })

    it('should increment restoreCount', () => {
      useWebGLContextStore.getState().onContextRestored()
      expect(useWebGLContextStore.getState().restoreCount).toBe(1)

      useWebGLContextStore.getState().onContextRestored()
      expect(useWebGLContextStore.getState().restoreCount).toBe(2)
    })

    it('should reset recoveryAttempts to zero', () => {
      useWebGLContextStore.getState().onContextRestoring()
      useWebGLContextStore.getState().onContextRestoring()
      expect(useWebGLContextStore.getState().recoveryAttempts).toBe(2)

      useWebGLContextStore.getState().onContextRestored()
      expect(useWebGLContextStore.getState().recoveryAttempts).toBe(0)
    })

    it('should reset timeout to initial value', () => {
      // Simulate some recovery attempts to increase timeout
      useWebGLContextStore.getState().onContextRestoring()
      useWebGLContextStore.getState().onContextRestoring()

      useWebGLContextStore.getState().onContextRestored()
      expect(useWebGLContextStore.getState().currentTimeout).toBe(
        DEFAULT_RECOVERY_CONFIG.initialTimeout
      )
    })
  })

  describe('onContextFailed', () => {
    it('should set status to failed', () => {
      useWebGLContextStore.getState().onContextFailed('Test error')
      expect(useWebGLContextStore.getState().status).toBe('failed')
    })

    it('should store lastError message', () => {
      useWebGLContextStore.getState().onContextFailed('Test error message')
      expect(useWebGLContextStore.getState().lastError).toBe('Test error message')
    })

    it('should save state to localStorage for recovery', () => {
      useWebGLContextStore.getState().onContextFailed('Test error')

      const saved = localStorage.getItem(RECOVERY_STATE_KEY)
      expect(saved).not.toBeNull()

      const parsed = JSON.parse(saved!)
      expect(parsed.savedAt).toBeDefined()
      expect(parsed.savedAt).toBeGreaterThan(0)
    })
  })

  describe('onVisibilityChange', () => {
    it('should update isPageVisible to true', () => {
      useWebGLContextStore.getState().onVisibilityChange(false)
      expect(useWebGLContextStore.getState().isPageVisible).toBe(false)

      useWebGLContextStore.getState().onVisibilityChange(true)
      expect(useWebGLContextStore.getState().isPageVisible).toBe(true)
    })

    it('should update isPageVisible to false', () => {
      useWebGLContextStore.getState().onVisibilityChange(false)
      expect(useWebGLContextStore.getState().isPageVisible).toBe(false)
    })
  })

  describe('getCurrentTimeout', () => {
    it('should return initial timeout on first attempt', () => {
      const timeout = useWebGLContextStore.getState().getCurrentTimeout()
      expect(timeout).toBe(DEFAULT_RECOVERY_CONFIG.initialTimeout)
    })

    it('should increase timeout with exponential backoff', () => {
      useWebGLContextStore.getState().onContextRestoring()
      const timeout1 = useWebGLContextStore.getState().getCurrentTimeout()

      useWebGLContextStore.getState().onContextRestoring()
      const timeout2 = useWebGLContextStore.getState().getCurrentTimeout()

      // Second timeout should be larger (backoff multiplier = 2)
      expect(timeout2).toBeGreaterThan(timeout1)
    })

    it('should not exceed max timeout', () => {
      // Simulate many recovery attempts
      for (let i = 0; i < 20; i++) {
        useWebGLContextStore.getState().onContextRestoring()
      }

      const timeout = useWebGLContextStore.getState().getCurrentTimeout()
      expect(timeout).toBeLessThanOrEqual(DEFAULT_RECOVERY_CONFIG.maxTimeout)
    })
  })

  describe('isRapidFailure', () => {
    it('should return false with no failures', () => {
      expect(useWebGLContextStore.getState().isRapidFailure()).toBe(false)
    })

    it('should return false with few failures', () => {
      useWebGLContextStore.getState().onContextLost()
      useWebGLContextStore.getState().onContextLost()
      expect(useWebGLContextStore.getState().isRapidFailure()).toBe(false)
    })

    it('should return true when threshold exceeded', () => {
      // Trigger enough losses to exceed threshold (default = 3)
      useWebGLContextStore.getState().onContextLost()
      useWebGLContextStore.getState().onContextLost()
      useWebGLContextStore.getState().onContextLost()
      expect(useWebGLContextStore.getState().isRapidFailure()).toBe(true)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Modify state
      useWebGLContextStore.getState().onContextLost()
      useWebGLContextStore.getState().onContextRestoring()
      useWebGLContextStore.getState().onVisibilityChange(false)

      // Reset
      useWebGLContextStore.getState().reset()

      const state = useWebGLContextStore.getState()
      expect(state.status).toBe('active')
      expect(state.lostAt).toBeNull()
      expect(state.restoredAt).toBeNull()
      expect(state.restoreCount).toBe(0)
      expect(state.lostCount).toBe(0)
      expect(state.isPageVisible).toBe(true)
      expect(state.recoveryAttempts).toBe(0)
    })
  })

  describe('debugTriggerContextLoss', () => {
    it('should increment debugContextLossCounter in non-production', () => {
      const before = useWebGLContextStore.getState().debugContextLossCounter
      useWebGLContextStore.getState().debugTriggerContextLoss()
      const after = useWebGLContextStore.getState().debugContextLossCounter

      // In test environment (not production), counter should increment
      expect(after).toBeGreaterThan(before)
    })
  })
})
