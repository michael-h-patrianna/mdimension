/**
 * Tests for Visual Store FPS Actions
 *
 * Tests the maxFps state and setMaxFps action in the UI slice.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_FPS,
  DEFAULT_SHOW_DEPTH_BUFFER,
  DEFAULT_SHOW_NORMAL_BUFFER,
  DEFAULT_SHOW_TEMPORAL_DEPTH_BUFFER,
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

describe('uiStore.bufferVisualization', () => {
  beforeEach(() => {
    useUIStore.setState(UI_INITIAL_STATE);
  });

  afterEach(() => {
    useUIStore.setState(UI_INITIAL_STATE)
  })

  describe('Initial State', () => {
    it('should have all buffer visualizations disabled by default', () => {
      const state = useUIStore.getState()
      expect(state.showDepthBuffer).toBe(DEFAULT_SHOW_DEPTH_BUFFER)
      expect(state.showNormalBuffer).toBe(DEFAULT_SHOW_NORMAL_BUFFER)
      expect(state.showTemporalDepthBuffer).toBe(DEFAULT_SHOW_TEMPORAL_DEPTH_BUFFER)
      expect(state.showDepthBuffer).toBe(false)
      expect(state.showNormalBuffer).toBe(false)
      expect(state.showTemporalDepthBuffer).toBe(false)
    })
  })

  describe('Mutual Exclusivity', () => {
    it('enabling showDepthBuffer should disable other buffer visualizations', () => {
      // First enable normal buffer
      useUIStore.getState().setShowNormalBuffer(true)
      expect(useUIStore.getState().showNormalBuffer).toBe(true)

      // Enable depth buffer - should disable normal buffer
      useUIStore.getState().setShowDepthBuffer(true)
      const state = useUIStore.getState()
      expect(state.showDepthBuffer).toBe(true)
      expect(state.showNormalBuffer).toBe(false)
      expect(state.showTemporalDepthBuffer).toBe(false)
    })

    it('enabling showNormalBuffer should disable other buffer visualizations', () => {
      // First enable depth buffer
      useUIStore.getState().setShowDepthBuffer(true)
      expect(useUIStore.getState().showDepthBuffer).toBe(true)

      // Enable normal buffer - should disable depth buffer
      useUIStore.getState().setShowNormalBuffer(true)
      const state = useUIStore.getState()
      expect(state.showDepthBuffer).toBe(false)
      expect(state.showNormalBuffer).toBe(true)
      expect(state.showTemporalDepthBuffer).toBe(false)
    })

    it('enabling showTemporalDepthBuffer should disable other buffer visualizations', () => {
      // First enable depth and normal buffers
      useUIStore.getState().setShowDepthBuffer(true)
      useUIStore.getState().setShowNormalBuffer(true) // This also disables depth
      expect(useUIStore.getState().showNormalBuffer).toBe(true)

      // Enable temporal depth - should disable normal buffer
      useUIStore.getState().setShowTemporalDepthBuffer(true)
      const state = useUIStore.getState()
      expect(state.showDepthBuffer).toBe(false)
      expect(state.showNormalBuffer).toBe(false)
      expect(state.showTemporalDepthBuffer).toBe(true)
    })

    it('disabling a buffer should not affect other buffers', () => {
      // Enable depth buffer
      useUIStore.getState().setShowDepthBuffer(true)
      expect(useUIStore.getState().showDepthBuffer).toBe(true)

      // Disable depth buffer - others should remain false
      useUIStore.getState().setShowDepthBuffer(false)
      const state = useUIStore.getState()
      expect(state.showDepthBuffer).toBe(false)
      expect(state.showNormalBuffer).toBe(false)
      expect(state.showTemporalDepthBuffer).toBe(false)
    })
  })
})
