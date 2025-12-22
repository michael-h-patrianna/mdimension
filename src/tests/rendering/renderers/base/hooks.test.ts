/**
 * Tests for shared renderer base hooks.
 *
 * Note: These tests focus on the hook exports and types rather than
 * full integration testing, since hooks require React rendering context.
 * Integration tests would be done via Playwright E2E tests.
 */

import {
  getFramePriorityOrder,
  getFramePriorityValue,
  isFramePriorityKey,
  useFramePriority,
  useFramePriorityValue,
  useLayerAssignment,
  useQualityTracking,
  useRotationUpdates,
  useVolumetricLayerAssignment,
} from '@/rendering/renderers/base'
import { describe, expect, it } from 'vitest'

describe('base/hooks exports', () => {
  describe('useQualityTracking', () => {
    it('should be exported as a function', () => {
      expect(typeof useQualityTracking).toBe('function')
    })
  })

  describe('useRotationUpdates', () => {
    it('should be exported as a function', () => {
      expect(typeof useRotationUpdates).toBe('function')
    })
  })

  describe('useLayerAssignment', () => {
    it('should be exported as a function', () => {
      expect(typeof useLayerAssignment).toBe('function')
    })
  })

  describe('useVolumetricLayerAssignment', () => {
    it('should be exported as a function', () => {
      expect(typeof useVolumetricLayerAssignment).toBe('function')
    })
  })

  describe('useFramePriority', () => {
    it('should be exported as a function', () => {
      expect(typeof useFramePriority).toBe('function')
    })
  })

  describe('useFramePriorityValue', () => {
    it('should be exported as a function', () => {
      expect(typeof useFramePriorityValue).toBe('function')
    })
  })

  describe('isFramePriorityKey', () => {
    it('should be exported as a function', () => {
      expect(typeof isFramePriorityKey).toBe('function')
    })
  })

  describe('getFramePriorityValue', () => {
    it('should be exported as a function', () => {
      expect(typeof getFramePriorityValue).toBe('function')
    })
  })

  describe('getFramePriorityOrder', () => {
    it('should be exported as a function', () => {
      expect(typeof getFramePriorityOrder).toBe('function')
    })
  })
})
