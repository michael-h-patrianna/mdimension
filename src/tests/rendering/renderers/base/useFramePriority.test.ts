/**
 * Tests for useFramePriority hook and utility functions.
 *
 * Tests frame callback priority enforcement and utilities.
 */

import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import {
  getFramePriorityOrder,
  getFramePriorityValue,
  isFramePriorityKey,
  useFramePriority,
  useFramePriorityValue,
  type FramePriorityKey,
} from '@/rendering/renderers/base/useFramePriority'
import { describe, expect, it } from 'vitest'

describe('useFramePriority', () => {
  describe('exports', () => {
    it('should export useFramePriority as a function', () => {
      expect(typeof useFramePriority).toBe('function')
    })

    it('should export useFramePriorityValue as a function', () => {
      expect(typeof useFramePriorityValue).toBe('function')
    })

    it('should export isFramePriorityKey as a function', () => {
      expect(typeof isFramePriorityKey).toBe('function')
    })

    it('should export getFramePriorityValue as a function', () => {
      expect(typeof getFramePriorityValue).toBe('function')
    })

    it('should export getFramePriorityOrder as a function', () => {
      expect(typeof getFramePriorityOrder).toBe('function')
    })
  })

  describe('isFramePriorityKey', () => {
    it('should return true for valid FRAME_PRIORITY keys', () => {
      expect(isFramePriorityKey('ENVIRONMENT_CAPTURE')).toBe(true)
      expect(isFramePriorityKey('SKYBOX_CAPTURE')).toBe(true)
      expect(isFramePriorityKey('BLACK_HOLE_UNIFORMS')).toBe(true)
      expect(isFramePriorityKey('RENDERER_UNIFORMS')).toBe(true)
      expect(isFramePriorityKey('CAMERA')).toBe(true)
      expect(isFramePriorityKey('ANIMATION')).toBe(true)
      expect(isFramePriorityKey('RENDERERS')).toBe(true)
      expect(isFramePriorityKey('POST_EFFECTS')).toBe(true)
      expect(isFramePriorityKey('STATS')).toBe(true)
    })

    it('should return false for invalid keys', () => {
      expect(isFramePriorityKey('INVALID_KEY')).toBe(false)
      expect(isFramePriorityKey('')).toBe(false)
      expect(isFramePriorityKey('renderer_uniforms')).toBe(false)
      expect(isFramePriorityKey('random')).toBe(false)
    })

    it('should return false for primitive values', () => {
      expect(isFramePriorityKey('0')).toBe(false)
      expect(isFramePriorityKey('1')).toBe(false)
      expect(isFramePriorityKey('-10')).toBe(false)
    })
  })

  describe('getFramePriorityValue', () => {
    it('should return correct numeric values for all priority keys', () => {
      expect(getFramePriorityValue('ENVIRONMENT_CAPTURE')).toBe(-30)
      expect(getFramePriorityValue('SKYBOX_CAPTURE')).toBe(-20)
      expect(getFramePriorityValue('BLACK_HOLE_UNIFORMS')).toBe(-10)
      expect(getFramePriorityValue('RENDERER_UNIFORMS')).toBe(1)
      expect(getFramePriorityValue('CAMERA')).toBe(0)
      expect(getFramePriorityValue('ANIMATION')).toBe(0)
      expect(getFramePriorityValue('RENDERERS')).toBe(0)
      expect(getFramePriorityValue('POST_EFFECTS')).toBe(10)
      expect(getFramePriorityValue('STATS')).toBe(20)
    })

    it('should match FRAME_PRIORITY constant values', () => {
      const keys: FramePriorityKey[] = [
        'ENVIRONMENT_CAPTURE',
        'SKYBOX_CAPTURE',
        'BLACK_HOLE_UNIFORMS',
        'RENDERER_UNIFORMS',
        'CAMERA',
        'ANIMATION',
        'RENDERERS',
        'POST_EFFECTS',
        'STATS',
      ]

      for (const key of keys) {
        expect(getFramePriorityValue(key)).toBe(FRAME_PRIORITY[key])
      }
    })
  })

  describe('getFramePriorityOrder', () => {
    it('should return array of all priority keys', () => {
      const order = getFramePriorityOrder()
      expect(Array.isArray(order)).toBe(true)
      expect(order.length).toBeGreaterThan(0)
    })

    it('should return keys sorted by execution order (lowest first)', () => {
      const order = getFramePriorityOrder()

      // Verify sorted order
      for (let i = 0; i < order.length - 1; i++) {
        const currentKey = order[i]
        const nextKey = order[i + 1]
        if (currentKey && nextKey) {
          const currentPriority = FRAME_PRIORITY[currentKey]
          const nextPriority = FRAME_PRIORITY[nextKey]
          expect(currentPriority).toBeLessThanOrEqual(nextPriority)
        }
      }
    })

    it('should have ENVIRONMENT_CAPTURE first (lowest priority number)', () => {
      const order = getFramePriorityOrder()
      expect(order[0]).toBe('ENVIRONMENT_CAPTURE')
    })

    it('should have STATS last (highest priority number)', () => {
      const order = getFramePriorityOrder()
      expect(order[order.length - 1]).toBe('STATS')
    })

    it('should include all FRAME_PRIORITY keys', () => {
      const order = getFramePriorityOrder()
      const allKeys = Object.keys(FRAME_PRIORITY)

      for (const key of allKeys) {
        expect(order).toContain(key)
      }
    })
  })

  describe('FRAME_PRIORITY consistency', () => {
    it('should have correct execution order: environment → skybox → black hole → camera/renderers → post effects → stats', () => {
      // Environment and skybox capture run first
      expect(FRAME_PRIORITY.ENVIRONMENT_CAPTURE).toBeLessThan(FRAME_PRIORITY.SKYBOX_CAPTURE)

      // Skybox must complete before black hole reads envMap
      expect(FRAME_PRIORITY.SKYBOX_CAPTURE).toBeLessThan(FRAME_PRIORITY.BLACK_HOLE_UNIFORMS)

      // Black hole uniforms before default priority
      expect(FRAME_PRIORITY.BLACK_HOLE_UNIFORMS).toBeLessThan(FRAME_PRIORITY.CAMERA)
      expect(FRAME_PRIORITY.BLACK_HOLE_UNIFORMS).toBeLessThan(FRAME_PRIORITY.RENDERERS)

      // Renderer uniforms after camera update
      expect(FRAME_PRIORITY.CAMERA).toBeLessThan(FRAME_PRIORITY.RENDERER_UNIFORMS)

      // Post effects after all renderer updates
      expect(FRAME_PRIORITY.RENDERER_UNIFORMS).toBeLessThan(FRAME_PRIORITY.POST_EFFECTS)

      // Stats always last
      expect(FRAME_PRIORITY.POST_EFFECTS).toBeLessThan(FRAME_PRIORITY.STATS)
    })

    it('should have CAMERA, ANIMATION, and RENDERERS at default priority (0)', () => {
      expect(FRAME_PRIORITY.CAMERA).toBe(0)
      expect(FRAME_PRIORITY.ANIMATION).toBe(0)
      expect(FRAME_PRIORITY.RENDERERS).toBe(0)
    })
  })
})
