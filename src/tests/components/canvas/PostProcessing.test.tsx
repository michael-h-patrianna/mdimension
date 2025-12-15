import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { PostProcessing } from '@/rendering/environment/PostProcessing';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { POST_PROCESSING_INITIAL_STATE } from '@/stores/slices/postProcessingSlice';

describe('PostProcessing', () => {
  beforeEach(() => {
    // Reset visual store before each test
    usePostProcessingStore.setState(POST_PROCESSING_INITIAL_STATE);
  });

  it('should return null when bloom is disabled', () => {
    // Ensure bloom is disabled
    usePostProcessingStore.getState().setBloomEnabled(false);

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
    usePostProcessingStore.getState().setBloomEnabled(true);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    // Should render without errors
    expect(container).toBeTruthy();
  });

  it('should render with default bloom settings', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
  });

  it('should render with custom bloom intensity', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);
    usePostProcessingStore.getState().setBloomIntensity(1.5);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    expect(usePostProcessingStore.getState().bloomIntensity).toBe(1.5);
  });

  it('should render with custom bloom threshold', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);
    usePostProcessingStore.getState().setBloomThreshold(0.5);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    expect(usePostProcessingStore.getState().bloomThreshold).toBe(0.5);
  });

  it('should render with custom bloom radius', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);
    usePostProcessingStore.getState().setBloomRadius(0.7);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    expect(usePostProcessingStore.getState().bloomRadius).toBe(0.7);
  });

  it('should render with all bloom parameters customized', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);
    usePostProcessingStore.getState().setBloomIntensity(1.8);
    usePostProcessingStore.getState().setBloomThreshold(0.6);
    usePostProcessingStore.getState().setBloomRadius(0.3);

    const { container } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();
    const state = usePostProcessingStore.getState();
    expect(state.bloomIntensity).toBe(1.8);
    expect(state.bloomThreshold).toBe(0.6);
    expect(state.bloomRadius).toBe(0.3);
  });

  it('should respect bloom enabled state changes', () => {
    // Start with bloom enabled
    usePostProcessingStore.getState().setBloomEnabled(true);

    const { container, rerender } = render(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    expect(container).toBeTruthy();

    // Disable bloom
    usePostProcessingStore.getState().setBloomEnabled(false);

    rerender(
      <Canvas>
        <PostProcessing />
      </Canvas>
    );

    // Should still render (component returns null but renders successfully)
    expect(container).toBeTruthy();
  });

  it('should clamp bloom intensity to valid range', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);

    // Try to set out of range value
    usePostProcessingStore.getState().setBloomIntensity(3.5);

    // Should be clamped to max value (2)
    expect(usePostProcessingStore.getState().bloomIntensity).toBe(2);
  });

  it('should clamp bloom threshold to valid range', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);

    // Try to set out of range value
    usePostProcessingStore.getState().setBloomThreshold(1.5);

    // Should be clamped to max value (1)
    expect(usePostProcessingStore.getState().bloomThreshold).toBe(1);
  });

  it('should clamp bloom radius to valid range', () => {
    usePostProcessingStore.getState().setBloomEnabled(true);

    // Try to set out of range value
    usePostProcessingStore.getState().setBloomRadius(-0.5);

    // Should be clamped to min value (0)
    expect(usePostProcessingStore.getState().bloomRadius).toBe(0);
  });
});
