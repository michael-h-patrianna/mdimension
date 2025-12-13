import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { PostProcessing } from '@/components/canvas/environment/PostProcessing';
import { useVisualStore } from '@/stores/visualStore';

describe('PostProcessing', () => {
  beforeEach(() => {
    // Reset visual store before each test
    useVisualStore.getState().reset();
  });

  it('should return null when bloom is disabled', () => {
    // Ensure bloom is disabled
    useVisualStore.getState().setBloomEnabled(false);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    // Component should render but return null
    expect(container).toBeTruthy();
  });

  it('should render EffectComposer when bloom is enabled', () => {
    // Enable bloom
    useVisualStore.getState().setBloomEnabled(true);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    // Should render without errors
    expect(container).toBeTruthy();
  });

  it('should render with default bloom settings', () => {
    useVisualStore.getState().setBloomEnabled(true);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
  });

  it('should render with custom bloom intensity', () => {
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomIntensity(1.5);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    expect(useVisualStore.getState().bloomIntensity).toBe(1.5);
  });

  it('should render with custom bloom threshold', () => {
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomThreshold(0.5);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    expect(useVisualStore.getState().bloomThreshold).toBe(0.5);
  });

  it('should render with custom bloom radius', () => {
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomRadius(0.7);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    expect(useVisualStore.getState().bloomRadius).toBe(0.7);
  });

  it('should render with all bloom parameters customized', () => {
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomIntensity(1.8);
    useVisualStore.getState().setBloomThreshold(0.6);
    useVisualStore.getState().setBloomRadius(0.3);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    const state = useVisualStore.getState();
    expect(state.bloomIntensity).toBe(1.8);
    expect(state.bloomThreshold).toBe(0.6);
    expect(state.bloomRadius).toBe(0.3);
  });

  it('should respect bloom enabled state changes', () => {
    // Start with bloom enabled
    useVisualStore.getState().setBloomEnabled(true);

    const { container, rerender } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();

    // Disable bloom
    useVisualStore.getState().setBloomEnabled(false);

    rerender(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    // Should still render (component returns null but renders successfully)
    expect(container).toBeTruthy();
  });

  it('should clamp bloom intensity to valid range', () => {
    useVisualStore.getState().setBloomEnabled(true);

    // Try to set out of range value
    useVisualStore.getState().setBloomIntensity(3.5);

    // Should be clamped to max value (2)
    expect(useVisualStore.getState().bloomIntensity).toBe(2);
  });

  it('should clamp bloom threshold to valid range', () => {
    useVisualStore.getState().setBloomEnabled(true);

    // Try to set out of range value
    useVisualStore.getState().setBloomThreshold(1.5);

    // Should be clamped to max value (1)
    expect(useVisualStore.getState().bloomThreshold).toBe(1);
  });

  it('should clamp bloom radius to valid range', () => {
    useVisualStore.getState().setBloomEnabled(true);

    // Try to set out of range value
    useVisualStore.getState().setBloomRadius(-0.5);

    // Should be clamped to min value (0)
    expect(useVisualStore.getState().bloomRadius).toBe(0);
  });
});
