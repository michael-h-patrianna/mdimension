/**
 * Tests for Visual Store FPS Actions
 *
 * Tests the maxFps state and setMaxFps action in the UI slice.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_FPS,
  MAX_MAX_FPS,
  MIN_MAX_FPS,
} from '@/stores/defaults/visualDefaults'
import { useVisualStore } from '@/stores/visualStore'

describe('Visual Store - FPS Actions', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useVisualStore.getState().reset()
  })

  afterEach(() => {
    // Clean up after each test
    useVisualStore.getState().reset()
  })

  describe('Initial State', () => {
    it('should have default maxFps value of 60', () => {
      const state = useVisualStore.getState()
      expect(state.maxFps).toBe(DEFAULT_MAX_FPS)
      expect(state.maxFps).toBe(60)
    })
  })

  describe('setMaxFps', () => {
    it('should set maxFps to a valid value', () => {
      useVisualStore.getState().setMaxFps(30)
      expect(useVisualStore.getState().maxFps).toBe(30)
    })

    it('should set maxFps to minimum value (15)', () => {
      useVisualStore.getState().setMaxFps(15)
      expect(useVisualStore.getState().maxFps).toBe(MIN_MAX_FPS)
      expect(useVisualStore.getState().maxFps).toBe(15)
    })

    it('should set maxFps to maximum value (120)', () => {
      useVisualStore.getState().setMaxFps(120)
      expect(useVisualStore.getState().maxFps).toBe(MAX_MAX_FPS)
      expect(useVisualStore.getState().maxFps).toBe(120)
    })

    it('should clamp value below minimum to 15', () => {
      useVisualStore.getState().setMaxFps(5)
      expect(useVisualStore.getState().maxFps).toBe(MIN_MAX_FPS)
    })

    it('should clamp value above maximum to 120', () => {
      useVisualStore.getState().setMaxFps(200)
      expect(useVisualStore.getState().maxFps).toBe(MAX_MAX_FPS)
    })

    it('should clamp negative values to minimum', () => {
      useVisualStore.getState().setMaxFps(-30)
      expect(useVisualStore.getState().maxFps).toBe(MIN_MAX_FPS)
    })

    it('should handle boundary value at minimum', () => {
      useVisualStore.getState().setMaxFps(14)
      expect(useVisualStore.getState().maxFps).toBe(MIN_MAX_FPS)

      useVisualStore.getState().setMaxFps(15)
      expect(useVisualStore.getState().maxFps).toBe(15)

      useVisualStore.getState().setMaxFps(16)
      expect(useVisualStore.getState().maxFps).toBe(16)
    })

    it('should handle boundary value at maximum', () => {
      useVisualStore.getState().setMaxFps(119)
      expect(useVisualStore.getState().maxFps).toBe(119)

      useVisualStore.getState().setMaxFps(120)
      expect(useVisualStore.getState().maxFps).toBe(120)

      useVisualStore.getState().setMaxFps(121)
      expect(useVisualStore.getState().maxFps).toBe(MAX_MAX_FPS)
    })
  })

  describe('reset', () => {
    it('should reset maxFps to default value', () => {
      // Change from default
      useVisualStore.getState().setMaxFps(90)
      expect(useVisualStore.getState().maxFps).toBe(90)

      // Reset
      useVisualStore.getState().reset()
      expect(useVisualStore.getState().maxFps).toBe(DEFAULT_MAX_FPS)
    })
  })
})
