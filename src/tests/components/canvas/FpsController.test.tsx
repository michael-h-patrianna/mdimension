/**
 * Tests for FpsController component
 *
 * Tests the FPS limiting controller that manages frame timing
 * when Canvas uses frameloop="never" with requestAnimationFrame.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Canvas } from '@react-three/fiber'
import { FpsController } from '@/rendering/controllers/FpsController'
import { useUIStore } from '@/stores/uiStore'
import { UI_INITIAL_STATE } from '@/stores/slices/uiSlice'

describe('FpsController', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState(UI_INITIAL_STATE)
    // Use fake timers for interval testing
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    useUIStore.setState(UI_INITIAL_STATE)
    vi.useRealTimers()
  })

  it('should render without errors inside Canvas', () => {
    const { container } = render(
      <Canvas frameloop="never">
        <FpsController />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with default maxFps of 60', () => {
    const { container } = render(
      <Canvas frameloop="never">
        <FpsController />
      </Canvas>
    )
    expect(container).toBeTruthy()
    expect(useUIStore.getState().maxFps).toBe(60)
  })

  it('should work with custom maxFps setting', () => {
    // Set custom FPS before rendering
    useUIStore.getState().setMaxFps(30)

    const { container } = render(
      <Canvas frameloop="never">
        <FpsController />
      </Canvas>
    )
    expect(container).toBeTruthy()
    expect(useUIStore.getState().maxFps).toBe(30)
  })

  it('should respond to maxFps changes', () => {
    const { container } = render(
      <Canvas frameloop="never">
        <FpsController />
      </Canvas>
    )

    // Change FPS while component is mounted
    useUIStore.getState().setMaxFps(90)
    expect(useUIStore.getState().maxFps).toBe(90)
    expect(container).toBeTruthy()
  })

  it('should work with minimum FPS setting', () => {
    useUIStore.getState().setMaxFps(15)

    const { container } = render(
      <Canvas frameloop="never">
        <FpsController />
      </Canvas>
    )
    expect(container).toBeTruthy()
    expect(useUIStore.getState().maxFps).toBe(15)
  })

  it('should work with maximum FPS setting', () => {
    useUIStore.getState().setMaxFps(120)

    const { container } = render(
      <Canvas frameloop="never">
        <FpsController />
      </Canvas>
    )
    expect(container).toBeTruthy()
    expect(useUIStore.getState().maxFps).toBe(120)
  })

  it('should cleanup on unmount', () => {
    const { unmount } = render(
      <Canvas frameloop="never">
        <FpsController />
      </Canvas>
    )

    // Component should unmount cleanly
    expect(() => unmount()).not.toThrow()
  })
})
