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



  describe('setMaxFps', () => {
    it('should set maxFps to a valid value', () => {
      useUIStore.getState().setMaxFps(30)
      expect(useUIStore.getState().maxFps).toBe(30)
    })

    it('clamps to the allowed range', () => {
      const cases: Array<{ input: number; expected: number }> = [
        { input: MIN_MAX_FPS - 1, expected: MIN_MAX_FPS },
        { input: MIN_MAX_FPS, expected: MIN_MAX_FPS },
        { input: MIN_MAX_FPS + 1, expected: MIN_MAX_FPS + 1 },
        { input: MAX_MAX_FPS - 1, expected: MAX_MAX_FPS - 1 },
        { input: MAX_MAX_FPS, expected: MAX_MAX_FPS },
        { input: MAX_MAX_FPS + 1, expected: MAX_MAX_FPS },
        { input: -30, expected: MIN_MAX_FPS },
        { input: 999, expected: MAX_MAX_FPS },
      ]

      for (const { input, expected } of cases) {
        useUIStore.setState(UI_INITIAL_STATE)
        useUIStore.getState().setMaxFps(input)
        expect(useUIStore.getState().maxFps).toBe(expected)
      }
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
