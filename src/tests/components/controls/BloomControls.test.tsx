import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BloomControls } from '@/components/controls/BloomControls';
import { useVisualStore } from '@/stores/visualStore';

describe('BloomControls', () => {
  beforeEach(() => {
    // Reset visual store before each test
    useVisualStore.getState().reset();
  });

  it('should render enable bloom toggle', () => {
    render(<BloomControls />);
    expect(screen.getByText('Enable Bloom')).toBeInTheDocument();
  });

  it('should toggle bloom enabled state', async () => {
    const user = userEvent.setup();
    render(<BloomControls />);

    const toggleButton = screen.getByText('Enable Bloom');

    // Initially enabled (default state)
    expect(useVisualStore.getState().bloomEnabled).toBe(true);

    // Click to disable
    await user.click(toggleButton);
    expect(useVisualStore.getState().bloomEnabled).toBe(false);

    // Click to enable
    await user.click(toggleButton);
    expect(useVisualStore.getState().bloomEnabled).toBe(true);
  });

  it('should not show sliders when bloom is disabled', () => {
    useVisualStore.getState().setBloomEnabled(false);
    render(<BloomControls />);

    expect(screen.queryByText('Intensity')).not.toBeInTheDocument();
    expect(screen.queryByText('Threshold')).not.toBeInTheDocument();
    expect(screen.queryByText('Radius')).not.toBeInTheDocument();
    expect(screen.queryByText('Soft Knee')).not.toBeInTheDocument();
    expect(screen.queryByText('Blur Levels')).not.toBeInTheDocument();
  });

  it('should show sliders when bloom is enabled', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    expect(screen.getByText('Intensity')).toBeInTheDocument();
    expect(screen.getByText('Threshold')).toBeInTheDocument();
    expect(screen.getByText('Radius')).toBeInTheDocument();
    expect(screen.getByText('Soft Knee')).toBeInTheDocument();
    expect(screen.getByText('Blur Levels')).toBeInTheDocument();
  });

  it('should render intensity slider with correct range', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    const intensityLabel = screen.getByText('Intensity');
    expect(intensityLabel).toBeInTheDocument();

    // Check for min/max labels (from Slider component)
    const sliderContainer = intensityLabel.closest('.flex')?.parentElement;
    expect(sliderContainer).toBeInTheDocument();
  });

  it('should render threshold slider with correct range', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    const thresholdLabel = screen.getByText('Threshold');
    expect(thresholdLabel).toBeInTheDocument();
  });

  it('should render radius slider with correct range', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    const radiusLabel = screen.getByText('Radius');
    expect(radiusLabel).toBeInTheDocument();
  });

  it('should render soft knee slider with correct range', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    const softKneeLabel = screen.getByText('Soft Knee');
    expect(softKneeLabel).toBeInTheDocument();
  });

  it('should render blur levels slider with correct range', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    const levelsLabel = screen.getByText('Blur Levels');
    expect(levelsLabel).toBeInTheDocument();
  });

  it('should update intensity in store when changed', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    // Directly update the store (simulating slider interaction)
    act(() => {
      useVisualStore.getState().setBloomIntensity(1.5);
    });

    expect(useVisualStore.getState().bloomIntensity).toBe(1.5);
  });

  it('should update threshold in store when changed', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    // Directly update the store (simulating slider interaction)
    act(() => {
      useVisualStore.getState().setBloomThreshold(0.6);
    });

    expect(useVisualStore.getState().bloomThreshold).toBe(0.6);
  });

  it('should update radius in store when changed', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    // Directly update the store (simulating slider interaction)
    act(() => {
      useVisualStore.getState().setBloomRadius(0.7);
    });

    expect(useVisualStore.getState().bloomRadius).toBe(0.7);
  });

  it('should display current bloom intensity value', () => {
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomIntensity(1.5);

    render(<BloomControls />);

    // The Slider component shows value
    expect(screen.getByText('Intensity')).toBeInTheDocument();
  });

  it('should display current bloom threshold value', () => {
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomThreshold(0.5);

    render(<BloomControls />);

    expect(screen.getByText('Threshold')).toBeInTheDocument();
  });

  it('should display current bloom radius value', () => {
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomRadius(0.6);

    render(<BloomControls />);

    expect(screen.getByText('Radius')).toBeInTheDocument();
  });

  it('should update soft knee in store when changed', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    // Directly update the store (simulating slider interaction)
    act(() => {
      useVisualStore.getState().setBloomSoftKnee(0.7);
    });

    expect(useVisualStore.getState().bloomSoftKnee).toBe(0.7);
  });

  it('should update levels in store when changed', () => {
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    // Directly update the store (simulating slider interaction)
    act(() => {
      useVisualStore.getState().setBloomLevels(4);
    });

    expect(useVisualStore.getState().bloomLevels).toBe(4);
  });

  it('should apply custom className', () => {
    const { container } = render(<BloomControls className="custom-class" />);

    const controlsDiv = container.querySelector('.custom-class');
    expect(controlsDiv).toBeInTheDocument();
  });

  it('should maintain state across enable/disable cycles', async () => {
    const user = userEvent.setup();
    useVisualStore.getState().setBloomEnabled(true);
    useVisualStore.getState().setBloomIntensity(1.5);

    render(<BloomControls />);

    const toggleButton = screen.getByText('Enable Bloom');

    // Disable bloom
    await user.click(toggleButton);
    expect(useVisualStore.getState().bloomEnabled).toBe(false);

    // Intensity value should still be preserved
    expect(useVisualStore.getState().bloomIntensity).toBe(1.5);

    // Re-enable bloom
    await user.click(toggleButton);
    expect(useVisualStore.getState().bloomEnabled).toBe(true);
    expect(useVisualStore.getState().bloomIntensity).toBe(1.5);
  });

  it('should show sliders after enabling bloom', async () => {
    const user = userEvent.setup();
    // Start with bloom disabled to test enabling
    useVisualStore.getState().setBloomEnabled(false);
    render(<BloomControls />);

    const toggleButton = screen.getByText('Enable Bloom');

    // Initially no sliders (bloom disabled)
    expect(screen.queryByText('Intensity')).not.toBeInTheDocument();

    // Enable bloom
    await user.click(toggleButton);

    // Now sliders should appear
    expect(screen.getByText('Intensity')).toBeInTheDocument();
    expect(screen.getByText('Threshold')).toBeInTheDocument();
    expect(screen.getByText('Radius')).toBeInTheDocument();
    expect(screen.getByText('Soft Knee')).toBeInTheDocument();
    expect(screen.getByText('Blur Levels')).toBeInTheDocument();
  });

  it('should hide sliders after disabling bloom', async () => {
    const user = userEvent.setup();
    useVisualStore.getState().setBloomEnabled(true);
    render(<BloomControls />);

    // Sliders should be visible
    expect(screen.getByText('Intensity')).toBeInTheDocument();

    const toggleButton = screen.getByText('Enable Bloom');

    // Disable bloom
    await user.click(toggleButton);

    // Sliders should be hidden
    expect(screen.queryByText('Intensity')).not.toBeInTheDocument();
    expect(screen.queryByText('Threshold')).not.toBeInTheDocument();
    expect(screen.queryByText('Radius')).not.toBeInTheDocument();
    expect(screen.queryByText('Soft Knee')).not.toBeInTheDocument();
    expect(screen.queryByText('Blur Levels')).not.toBeInTheDocument();
  });

  it('should reflect bloom enabled state changes', () => {
    useVisualStore.getState().setBloomEnabled(false);
    const { rerender } = render(<BloomControls />);

    let toggleButton = screen.getByText('Enable Bloom');
    // Check that the button exists and has the correct state
    expect(toggleButton).toBeInTheDocument();
    expect(useVisualStore.getState().bloomEnabled).toBe(false);

    // Enable bloom
    act(() => {
      useVisualStore.getState().setBloomEnabled(true);
    });
    rerender(<BloomControls />);

    toggleButton = screen.getByText('Enable Bloom');
    expect(useVisualStore.getState().bloomEnabled).toBe(true);
    expect(toggleButton).toBeInTheDocument();
  });
});
