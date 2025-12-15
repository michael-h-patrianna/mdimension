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
import { useUIStore } from '@/stores/uiStore';
import { UI_INITIAL_STATE } from '@/stores/slices/uiSlice';

describe('uiStore.fps', () => {
  beforeEach(() => {
    useUIStore.setState(UI_INITIAL_STATE);
  });

  afterEach(() => {
    useUIStore.setState(UI_INITIAL_STATE)
  })

  describe('Initial State', () => {
    it('should have default maxFps value of 60', () => {
      const state = useUIStore.getState()
      expect(state.maxFps).toBe(DEFAULT_MAX_FPS)
      expect(state.maxFps).toBe(60)
    })
  })

  describe('setMaxFps', () => {
    it('should set maxFps to a valid value', () => {
      useUIStore.getState().setMaxFps(30)
      expect(useUIStore.getState().maxFps).toBe(30)
    })

    it('should set maxFps to minimum value (15)', () => {
      useUIStore.getState().setMaxFps(15)
      expect(useUIStore.getState().maxFps).toBe(MIN_MAX_FPS)
      expect(useUIStore.getState().maxFps).toBe(15)
    })

    it('should set maxFps to maximum value (120)', () => {
      useUIStore.getState().setMaxFps(120)
      expect(useUIStore.getState().maxFps).toBe(MAX_MAX_FPS)
      expect(useUIStore.getState().maxFps).toBe(120)
    })

    it('should clamp value below minimum to 15', () => {
      useUIStore.getState().setMaxFps(5)
      expect(useUIStore.getState().maxFps).toBe(MIN_MAX_FPS)
    })

    it('should clamp value above maximum to 120', () => {
      useUIStore.getState().setMaxFps(200)
      expect(useUIStore.getState().maxFps).toBe(MAX_MAX_FPS)
    })

    it('should clamp negative values to minimum', () => {
      useUIStore.getState().setMaxFps(-30)
      expect(useUIStore.getState().maxFps).toBe(MIN_MAX_FPS)
    })

    it('should handle boundary value at minimum', () => {
      useUIStore.getState().setMaxFps(14)
      expect(useUIStore.getState().maxFps).toBe(MIN_MAX_FPS)

      useUIStore.getState().setMaxFps(15)
      expect(useUIStore.getState().maxFps).toBe(15)

      useUIStore.getState().setMaxFps(16)
      expect(useUIStore.getState().maxFps).toBe(16)
    })

    it('should handle boundary value at maximum', () => {
      useUIStore.getState().setMaxFps(119)
      expect(useUIStore.getState().maxFps).toBe(119)

      useUIStore.getState().setMaxFps(120)
      expect(useUIStore.getState().maxFps).toBe(120)

      useUIStore.getState().setMaxFps(121)
      expect(useUIStore.getState().maxFps).toBe(MAX_MAX_FPS)
    })
  })

  describe('reset', () => {
    it('should reset maxFps to default value', () => {
      // Change from default
      useUIStore.getState().setMaxFps(90)
      expect(useUIStore.getState().maxFps).toBe(90)

      // Reset
      useUIStore.setState(UI_INITIAL_STATE)
      expect(useUIStore.getState().maxFps).toBe(DEFAULT_MAX_FPS)
    })
  })
})
