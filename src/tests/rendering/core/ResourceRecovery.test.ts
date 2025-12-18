/**
 * Tests for ResourceRecovery Coordinator
 *
 * Tests the resource recovery coordination including:
 * - Manager registration and unregistration
 * - Priority-ordered recovery
 * - Event emission
 * - Partial recovery on failure
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resourceRecovery,
  RECOVERY_PRIORITY,
  type ResourceManager,
  type RecoveryEvent,
} from '@/rendering/core/ResourceRecovery'
import * as THREE from 'three'

// Mock WebGLRenderer
const mockGl = {} as THREE.WebGLRenderer

describe('ResourceRecovery', () => {
  beforeEach(() => {
    // Clear all registered managers and listeners
    resourceRecovery.clear()
  })

  describe('register', () => {
    it('should register a manager', () => {
      const manager: ResourceManager = {
        name: 'TestManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockResolvedValue(undefined),
      }

      resourceRecovery.register(manager)
      expect(resourceRecovery.getRegisteredManagers()).toContain('TestManager')
    })

    it('should replace manager with same name', () => {
      const manager1: ResourceManager = {
        name: 'TestManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockResolvedValue(undefined),
      }
      const manager2: ResourceManager = {
        name: 'TestManager',
        priority: 20,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockResolvedValue(undefined),
      }

      resourceRecovery.register(manager1)
      resourceRecovery.register(manager2)

      expect(resourceRecovery.getRegisteredManagers().length).toBe(1)
    })
  })

  describe('unregister', () => {
    it('should unregister a manager', () => {
      const manager: ResourceManager = {
        name: 'TestManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockResolvedValue(undefined),
      }

      resourceRecovery.register(manager)
      resourceRecovery.unregister('TestManager')

      expect(resourceRecovery.getRegisteredManagers()).not.toContain('TestManager')
    })

    it('should handle unregistering non-existent manager', () => {
      // Should not throw
      expect(() => resourceRecovery.unregister('NonExistent')).not.toThrow()
    })
  })

  describe('recover', () => {
    it('should call invalidate on all managers', async () => {
      const invalidate1 = vi.fn()
      const invalidate2 = vi.fn()

      resourceRecovery.register({
        name: 'Manager1',
        priority: 10,
        invalidate: invalidate1,
        reinitialize: vi.fn().mockResolvedValue(undefined),
      })
      resourceRecovery.register({
        name: 'Manager2',
        priority: 20,
        invalidate: invalidate2,
        reinitialize: vi.fn().mockResolvedValue(undefined),
      })

      await resourceRecovery.recover(mockGl)

      expect(invalidate1).toHaveBeenCalled()
      expect(invalidate2).toHaveBeenCalled()
    })

    it('should call reinitialize in priority order', async () => {
      const callOrder: string[] = []

      resourceRecovery.register({
        name: 'HighPriority',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockImplementation(async () => {
          callOrder.push('HighPriority')
        }),
      })
      resourceRecovery.register({
        name: 'LowPriority',
        priority: 30,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockImplementation(async () => {
          callOrder.push('LowPriority')
        }),
      })
      resourceRecovery.register({
        name: 'MediumPriority',
        priority: 20,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockImplementation(async () => {
          callOrder.push('MediumPriority')
        }),
      })

      await resourceRecovery.recover(mockGl)

      expect(callOrder).toEqual(['HighPriority', 'MediumPriority', 'LowPriority'])
    })

    it('should continue recovery when one manager fails', async () => {
      const reinitialize1 = vi.fn().mockRejectedValue(new Error('Test error'))
      const reinitialize2 = vi.fn().mockResolvedValue(undefined)

      resourceRecovery.register({
        name: 'FailingManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: reinitialize1,
      })
      resourceRecovery.register({
        name: 'WorkingManager',
        priority: 20,
        invalidate: vi.fn(),
        reinitialize: reinitialize2,
      })

      await resourceRecovery.recover(mockGl)

      // Second manager should still be called
      expect(reinitialize2).toHaveBeenCalled()
    })

    it('should prevent concurrent recovery', async () => {
      let recoveryCount = 0

      resourceRecovery.register({
        name: 'SlowManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockImplementation(async () => {
          recoveryCount++
          await new Promise((resolve) => setTimeout(resolve, 100))
        }),
      })

      // Start two recoveries simultaneously
      const promise1 = resourceRecovery.recover(mockGl)
      const promise2 = resourceRecovery.recover(mockGl)

      await Promise.all([promise1, promise2])

      // Only one recovery should have occurred
      expect(recoveryCount).toBe(1)
    })
  })

  describe('addListener', () => {
    it('should emit events during recovery', async () => {
      const events: RecoveryEvent[] = []
      const listener = (event: RecoveryEvent) => events.push(event)

      resourceRecovery.addListener(listener)
      resourceRecovery.register({
        name: 'TestManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockResolvedValue(undefined),
      })

      await resourceRecovery.recover(mockGl)

      expect(events.some((e) => e.type === 'invalidating')).toBe(true)
      expect(events.some((e) => e.type === 'invalidated')).toBe(true)
      expect(events.some((e) => e.type === 'complete')).toBe(true)
    })

    it('should return unsubscribe function', async () => {
      const events: RecoveryEvent[] = []
      const listener = (event: RecoveryEvent) => events.push(event)

      const unsubscribe = resourceRecovery.addListener(listener)
      unsubscribe()

      resourceRecovery.register({
        name: 'TestManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockResolvedValue(undefined),
      })

      await resourceRecovery.recover(mockGl)

      // Should not receive any events after unsubscribe
      expect(events.length).toBe(0)
    })
  })

  describe('RECOVERY_PRIORITY constants', () => {
    it('should have correct priority ordering', () => {
      expect(RECOVERY_PRIORITY.WEBGL_STATE).toBeLessThan(RECOVERY_PRIORITY.POST_PROCESSING)
      expect(RECOVERY_PRIORITY.POST_PROCESSING).toBeLessThan(RECOVERY_PRIORITY.TEMPORAL_DEPTH)
      expect(RECOVERY_PRIORITY.TEMPORAL_DEPTH).toBeLessThan(RECOVERY_PRIORITY.TEMPORAL_CLOUD)
      expect(RECOVERY_PRIORITY.TEMPORAL_CLOUD).toBeLessThan(RECOVERY_PRIORITY.CLOUD_PASS)
      expect(RECOVERY_PRIORITY.CLOUD_PASS).toBeLessThan(RECOVERY_PRIORITY.SCENE_MATERIALS)
      expect(RECOVERY_PRIORITY.SCENE_MATERIALS).toBeLessThan(RECOVERY_PRIORITY.SKYBOX_PMREM)
    })
  })

  describe('isInProgress', () => {
    it('should return false when not recovering', () => {
      expect(resourceRecovery.isInProgress()).toBe(false)
    })

    it('should return true during recovery', async () => {
      let duringRecovery = false

      resourceRecovery.register({
        name: 'TestManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockImplementation(async () => {
          duringRecovery = resourceRecovery.isInProgress()
        }),
      })

      await resourceRecovery.recover(mockGl)

      expect(duringRecovery).toBe(true)
    })

    it('should return false after recovery completes', async () => {
      resourceRecovery.register({
        name: 'TestManager',
        priority: 10,
        invalidate: vi.fn(),
        reinitialize: vi.fn().mockResolvedValue(undefined),
      })

      await resourceRecovery.recover(mockGl)

      expect(resourceRecovery.isInProgress()).toBe(false)
    })
  })
})
