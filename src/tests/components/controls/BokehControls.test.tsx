import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BokehControls } from '@/components/sidebar/PostProcessing/BokehControls';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { POST_PROCESSING_INITIAL_STATE } from '@/stores/slices/postProcessingSlice';
import {
  DEFAULT_BOKEH_FOCUS_MODE,
  DEFAULT_BOKEH_BLUR_METHOD,
  DEFAULT_BOKEH_WORLD_FOCUS_DISTANCE,
  DEFAULT_BOKEH_WORLD_FOCUS_RANGE,
  DEFAULT_BOKEH_SCALE,
  DEFAULT_BOKEH_SMOOTH_TIME,
  DEFAULT_BOKEH_SHOW_DEBUG,
} from '@/stores/defaults/visualDefaults';

describe('BokehControls', () => {
  beforeEach(() => {
    // Reset visual store before each test
    usePostProcessingStore.setState(POST_PROCESSING_INITIAL_STATE);
  });

  it('should render enable bokeh toggle', () => {
    render(<BokehControls />);
    expect(screen.getByText('Depth of Field')).toBeInTheDocument();
  });

  it('should toggle bokeh enabled state', async () => {
    const user = userEvent.setup();
    render(<BokehControls />);

    const toggleButton = screen.getByText('Depth of Field');

    // Initially disabled (default state)
    expect(usePostProcessingStore.getState().bokehEnabled).toBe(false);

    // Click to enable
    await user.click(toggleButton);
    expect(usePostProcessingStore.getState().bokehEnabled).toBe(true);

    // Click to disable
    await user.click(toggleButton);
    expect(usePostProcessingStore.getState().bokehEnabled).toBe(false);
  });

  it('should not show controls when bokeh is disabled', () => {
    usePostProcessingStore.getState().setBokehEnabled(false);
    render(<BokehControls />);

    expect(screen.queryByText('Focus Mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Focus Range')).not.toBeInTheDocument();
    expect(screen.queryByText('Blur Intensity')).not.toBeInTheDocument();
  });

  it('should show controls when bokeh is enabled', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    expect(screen.getByText('Focus Mode')).toBeInTheDocument();
    expect(screen.getByText('Focus Range')).toBeInTheDocument();
    expect(screen.getByText('Blur Intensity')).toBeInTheDocument();
    expect(screen.getByText('Show Focus Point')).toBeInTheDocument();
  });

  it('should show Focus Speed slider in auto-center mode', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehFocusMode('auto-center');
    render(<BokehControls />);

    expect(screen.getByText('Focus Speed')).toBeInTheDocument();
    expect(screen.queryByText('Focus Distance')).not.toBeInTheDocument();
  });

  it('should show Focus Speed slider in auto-mouse mode', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehFocusMode('auto-mouse');
    render(<BokehControls />);

    expect(screen.getByText('Focus Speed')).toBeInTheDocument();
    expect(screen.queryByText('Focus Distance')).not.toBeInTheDocument();
  });

  it('should show Focus Distance slider in manual mode', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehFocusMode('manual');
    render(<BokehControls />);

    expect(screen.getByText('Focus Distance')).toBeInTheDocument();
    expect(screen.queryByText('Focus Speed')).not.toBeInTheDocument();
  });

  it('should render focus mode selector with correct label', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const focusModeLabel = screen.getByText('Focus Mode');
    expect(focusModeLabel).toBeInTheDocument();
  });

  it('should render focus range slider with correct label', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const focusRangeLabel = screen.getByText('Focus Range');
    expect(focusRangeLabel).toBeInTheDocument();
  });

  it('should render blur intensity slider with correct label', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const blurIntensityLabel = screen.getByText('Blur Intensity');
    expect(blurIntensityLabel).toBeInTheDocument();
  });

  it('should update focus mode value in store', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehFocusMode('manual');

    expect(usePostProcessingStore.getState().bokehFocusMode).toBe('manual');
  });

  it('should update world focus distance value in store', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehWorldFocusDistance(25);

    expect(usePostProcessingStore.getState().bokehWorldFocusDistance).toBe(25);
  });

  it('should update world focus range value in store', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehWorldFocusRange(15);

    expect(usePostProcessingStore.getState().bokehWorldFocusRange).toBe(15);
  });

  it('should update bokeh scale value in store', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehScale(2.5);

    expect(usePostProcessingStore.getState().bokehScale).toBe(2.5);
  });

  it('should update smooth time value in store', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehSmoothTime(1.0);

    expect(usePostProcessingStore.getState().bokehSmoothTime).toBe(1.0);
  });

  it('should update show debug value in store', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehShowDebug(true);

    expect(usePostProcessingStore.getState().bokehShowDebug).toBe(true);
  });

  it('should clamp world focus distance to valid range', () => {
    // Test below minimum
    usePostProcessingStore.getState().setBokehWorldFocusDistance(0);
    expect(usePostProcessingStore.getState().bokehWorldFocusDistance).toBe(1);

    // Test above maximum (max is 50)
    usePostProcessingStore.getState().setBokehWorldFocusDistance(100);
    expect(usePostProcessingStore.getState().bokehWorldFocusDistance).toBe(50);
  });

  it('should clamp world focus range to valid range', () => {
    // Test below minimum (min is 1)
    usePostProcessingStore.getState().setBokehWorldFocusRange(0);
    expect(usePostProcessingStore.getState().bokehWorldFocusRange).toBe(1);

    // Test above maximum (max is 100)
    usePostProcessingStore.getState().setBokehWorldFocusRange(150);
    expect(usePostProcessingStore.getState().bokehWorldFocusRange).toBe(100);
  });

  it('should clamp bokeh scale to valid range', () => {
    // Test below minimum
    usePostProcessingStore.getState().setBokehScale(-1);
    expect(usePostProcessingStore.getState().bokehScale).toBe(0);

    // Test above maximum (max is 3)
    usePostProcessingStore.getState().setBokehScale(5);
    expect(usePostProcessingStore.getState().bokehScale).toBe(3);
  });

  it('should clamp smooth time to valid range', () => {
    // Test below minimum
    usePostProcessingStore.getState().setBokehSmoothTime(-1);
    expect(usePostProcessingStore.getState().bokehSmoothTime).toBe(0);

    // Test above maximum
    usePostProcessingStore.getState().setBokehSmoothTime(5);
    expect(usePostProcessingStore.getState().bokehSmoothTime).toBe(2);
  });

  it('should reset to default values', () => {
    // Set custom values
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehFocusMode('manual');
    usePostProcessingStore.getState().setBokehBlurMethod('disc');
    usePostProcessingStore.getState().setBokehWorldFocusDistance(40);
    usePostProcessingStore.getState().setBokehWorldFocusRange(20);
    usePostProcessingStore.getState().setBokehScale(2.5);
    usePostProcessingStore.getState().setBokehSmoothTime(1.5);
    usePostProcessingStore.getState().setBokehShowDebug(true);

    // Reset
    usePostProcessingStore.setState(POST_PROCESSING_INITIAL_STATE);

    // Verify defaults
    expect(usePostProcessingStore.getState().bokehEnabled).toBe(false);
    expect(usePostProcessingStore.getState().bokehFocusMode).toBe(DEFAULT_BOKEH_FOCUS_MODE);
    expect(usePostProcessingStore.getState().bokehBlurMethod).toBe(DEFAULT_BOKEH_BLUR_METHOD);
    expect(usePostProcessingStore.getState().bokehWorldFocusDistance).toBe(DEFAULT_BOKEH_WORLD_FOCUS_DISTANCE);
    expect(usePostProcessingStore.getState().bokehWorldFocusRange).toBe(DEFAULT_BOKEH_WORLD_FOCUS_RANGE);
    expect(usePostProcessingStore.getState().bokehScale).toBe(DEFAULT_BOKEH_SCALE);
    expect(usePostProcessingStore.getState().bokehSmoothTime).toBe(DEFAULT_BOKEH_SMOOTH_TIME);
    expect(usePostProcessingStore.getState().bokehShowDebug).toBe(DEFAULT_BOKEH_SHOW_DEBUG);
  });

  it('should apply custom className', () => {
    const { container } = render(<BokehControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should change focus mode via select dropdown', async () => {
    const user = userEvent.setup();
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    // Get the select element
    const select = screen.getByTestId('bokeh-focus-mode');
    expect(select).toBeInTheDocument();

    // Change to manual mode
    await user.selectOptions(select, 'manual');
    expect(usePostProcessingStore.getState().bokehFocusMode).toBe('manual');

    // Change to auto-mouse mode
    await user.selectOptions(select, 'auto-mouse');
    expect(usePostProcessingStore.getState().bokehFocusMode).toBe('auto-mouse');
  });

  it('should render blur method selector when bokeh is enabled', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    expect(screen.getByText('Blur Method')).toBeInTheDocument();
    expect(screen.getByTestId('bokeh-blur-method')).toBeInTheDocument();
  });

  it('should change blur method via select dropdown', async () => {
    const user = userEvent.setup();
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const select = screen.getByTestId('bokeh-blur-method');
    expect(select).toBeInTheDocument();

    // Change to disc
    await user.selectOptions(select, 'disc');
    expect(usePostProcessingStore.getState().bokehBlurMethod).toBe('disc');

    // Change to jittered
    await user.selectOptions(select, 'jittered');
    expect(usePostProcessingStore.getState().bokehBlurMethod).toBe('jittered');

    // Change to separable
    await user.selectOptions(select, 'separable');
    expect(usePostProcessingStore.getState().bokehBlurMethod).toBe('separable');

    // Change to hexagonal
    await user.selectOptions(select, 'hexagonal');
    expect(usePostProcessingStore.getState().bokehBlurMethod).toBe('hexagonal');
  });

  it('should update blur method value in store', () => {
    usePostProcessingStore.getState().setBokehEnabled(true);
    usePostProcessingStore.getState().setBokehBlurMethod('jittered');

    expect(usePostProcessingStore.getState().bokehBlurMethod).toBe('jittered');
  });

  it('should toggle show debug via switch', async () => {
    const user = userEvent.setup();
    usePostProcessingStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const showFocusPointSwitch = screen.getByText('Show Focus Point');

    // Initially false
    expect(usePostProcessingStore.getState().bokehShowDebug).toBe(false);

    // Click to enable
    await user.click(showFocusPointSwitch);
    expect(usePostProcessingStore.getState().bokehShowDebug).toBe(true);

    // Click to disable
    await user.click(showFocusPointSwitch);
    expect(usePostProcessingStore.getState().bokehShowDebug).toBe(false);
  });
});
