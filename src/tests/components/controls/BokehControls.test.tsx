import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BokehControls } from '@/components/sidebar/PostProcessing/BokehControls';
import {
  useVisualStore,
  DEFAULT_BOKEH_FOCUS_MODE,
  DEFAULT_BOKEH_BLUR_METHOD,
  DEFAULT_BOKEH_WORLD_FOCUS_DISTANCE,
  DEFAULT_BOKEH_WORLD_FOCUS_RANGE,
  DEFAULT_BOKEH_SCALE,
  DEFAULT_BOKEH_SMOOTH_TIME,
  DEFAULT_BOKEH_SHOW_DEBUG,
} from '@/stores/visualStore';

describe('BokehControls', () => {
  beforeEach(() => {
    // Reset visual store before each test
    useVisualStore.getState().reset();
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
    expect(useVisualStore.getState().bokehEnabled).toBe(false);

    // Click to enable
    await user.click(toggleButton);
    expect(useVisualStore.getState().bokehEnabled).toBe(true);

    // Click to disable
    await user.click(toggleButton);
    expect(useVisualStore.getState().bokehEnabled).toBe(false);
  });

  it('should not show controls when bokeh is disabled', () => {
    useVisualStore.getState().setBokehEnabled(false);
    render(<BokehControls />);

    expect(screen.queryByText('Focus Mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Focus Range')).not.toBeInTheDocument();
    expect(screen.queryByText('Blur Intensity')).not.toBeInTheDocument();
  });

  it('should show controls when bokeh is enabled', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    expect(screen.getByText('Focus Mode')).toBeInTheDocument();
    expect(screen.getByText('Focus Range')).toBeInTheDocument();
    expect(screen.getByText('Blur Intensity')).toBeInTheDocument();
    expect(screen.getByText('Show Focus Point')).toBeInTheDocument();
  });

  it('should show Focus Speed slider in auto-center mode', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehFocusMode('auto-center');
    render(<BokehControls />);

    expect(screen.getByText('Focus Speed')).toBeInTheDocument();
    expect(screen.queryByText('Focus Distance')).not.toBeInTheDocument();
  });

  it('should show Focus Speed slider in auto-mouse mode', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehFocusMode('auto-mouse');
    render(<BokehControls />);

    expect(screen.getByText('Focus Speed')).toBeInTheDocument();
    expect(screen.queryByText('Focus Distance')).not.toBeInTheDocument();
  });

  it('should show Focus Distance slider in manual mode', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehFocusMode('manual');
    render(<BokehControls />);

    expect(screen.getByText('Focus Distance')).toBeInTheDocument();
    expect(screen.queryByText('Focus Speed')).not.toBeInTheDocument();
  });

  it('should render focus mode selector with correct label', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const focusModeLabel = screen.getByText('Focus Mode');
    expect(focusModeLabel).toBeInTheDocument();
  });

  it('should render focus range slider with correct label', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const focusRangeLabel = screen.getByText('Focus Range');
    expect(focusRangeLabel).toBeInTheDocument();
  });

  it('should render blur intensity slider with correct label', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const blurIntensityLabel = screen.getByText('Blur Intensity');
    expect(blurIntensityLabel).toBeInTheDocument();
  });

  it('should update focus mode value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehFocusMode('manual');

    expect(useVisualStore.getState().bokehFocusMode).toBe('manual');
  });

  it('should update world focus distance value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehWorldFocusDistance(25);

    expect(useVisualStore.getState().bokehWorldFocusDistance).toBe(25);
  });

  it('should update world focus range value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehWorldFocusRange(15);

    expect(useVisualStore.getState().bokehWorldFocusRange).toBe(15);
  });

  it('should update bokeh scale value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehScale(2.5);

    expect(useVisualStore.getState().bokehScale).toBe(2.5);
  });

  it('should update smooth time value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehSmoothTime(1.0);

    expect(useVisualStore.getState().bokehSmoothTime).toBe(1.0);
  });

  it('should update show debug value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehShowDebug(true);

    expect(useVisualStore.getState().bokehShowDebug).toBe(true);
  });

  it('should clamp world focus distance to valid range', () => {
    // Test below minimum
    useVisualStore.getState().setBokehWorldFocusDistance(0);
    expect(useVisualStore.getState().bokehWorldFocusDistance).toBe(1);

    // Test above maximum (max is 50)
    useVisualStore.getState().setBokehWorldFocusDistance(100);
    expect(useVisualStore.getState().bokehWorldFocusDistance).toBe(50);
  });

  it('should clamp world focus range to valid range', () => {
    // Test below minimum (min is 1)
    useVisualStore.getState().setBokehWorldFocusRange(0);
    expect(useVisualStore.getState().bokehWorldFocusRange).toBe(1);

    // Test above maximum (max is 100)
    useVisualStore.getState().setBokehWorldFocusRange(150);
    expect(useVisualStore.getState().bokehWorldFocusRange).toBe(100);
  });

  it('should clamp bokeh scale to valid range', () => {
    // Test below minimum
    useVisualStore.getState().setBokehScale(-1);
    expect(useVisualStore.getState().bokehScale).toBe(0);

    // Test above maximum (max is 3)
    useVisualStore.getState().setBokehScale(5);
    expect(useVisualStore.getState().bokehScale).toBe(3);
  });

  it('should clamp smooth time to valid range', () => {
    // Test below minimum
    useVisualStore.getState().setBokehSmoothTime(-1);
    expect(useVisualStore.getState().bokehSmoothTime).toBe(0);

    // Test above maximum
    useVisualStore.getState().setBokehSmoothTime(5);
    expect(useVisualStore.getState().bokehSmoothTime).toBe(2);
  });

  it('should reset to default values', () => {
    // Set custom values
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehFocusMode('manual');
    useVisualStore.getState().setBokehBlurMethod('disc');
    useVisualStore.getState().setBokehWorldFocusDistance(40);
    useVisualStore.getState().setBokehWorldFocusRange(20);
    useVisualStore.getState().setBokehScale(2.5);
    useVisualStore.getState().setBokehSmoothTime(1.5);
    useVisualStore.getState().setBokehShowDebug(true);

    // Reset
    useVisualStore.getState().reset();

    // Verify defaults
    expect(useVisualStore.getState().bokehEnabled).toBe(false);
    expect(useVisualStore.getState().bokehFocusMode).toBe(DEFAULT_BOKEH_FOCUS_MODE);
    expect(useVisualStore.getState().bokehBlurMethod).toBe(DEFAULT_BOKEH_BLUR_METHOD);
    expect(useVisualStore.getState().bokehWorldFocusDistance).toBe(DEFAULT_BOKEH_WORLD_FOCUS_DISTANCE);
    expect(useVisualStore.getState().bokehWorldFocusRange).toBe(DEFAULT_BOKEH_WORLD_FOCUS_RANGE);
    expect(useVisualStore.getState().bokehScale).toBe(DEFAULT_BOKEH_SCALE);
    expect(useVisualStore.getState().bokehSmoothTime).toBe(DEFAULT_BOKEH_SMOOTH_TIME);
    expect(useVisualStore.getState().bokehShowDebug).toBe(DEFAULT_BOKEH_SHOW_DEBUG);
  });

  it('should apply custom className', () => {
    const { container } = render(<BokehControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should change focus mode via select dropdown', async () => {
    const user = userEvent.setup();
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    // Get the select element
    const select = screen.getByTestId('bokeh-focus-mode');
    expect(select).toBeInTheDocument();

    // Change to manual mode
    await user.selectOptions(select, 'manual');
    expect(useVisualStore.getState().bokehFocusMode).toBe('manual');

    // Change to auto-mouse mode
    await user.selectOptions(select, 'auto-mouse');
    expect(useVisualStore.getState().bokehFocusMode).toBe('auto-mouse');
  });

  it('should render blur method selector when bokeh is enabled', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    expect(screen.getByText('Blur Method')).toBeInTheDocument();
    expect(screen.getByTestId('bokeh-blur-method')).toBeInTheDocument();
  });

  it('should change blur method via select dropdown', async () => {
    const user = userEvent.setup();
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const select = screen.getByTestId('bokeh-blur-method');
    expect(select).toBeInTheDocument();

    // Change to disc
    await user.selectOptions(select, 'disc');
    expect(useVisualStore.getState().bokehBlurMethod).toBe('disc');

    // Change to jittered
    await user.selectOptions(select, 'jittered');
    expect(useVisualStore.getState().bokehBlurMethod).toBe('jittered');

    // Change to separable
    await user.selectOptions(select, 'separable');
    expect(useVisualStore.getState().bokehBlurMethod).toBe('separable');

    // Change to hexagonal
    await user.selectOptions(select, 'hexagonal');
    expect(useVisualStore.getState().bokehBlurMethod).toBe('hexagonal');
  });

  it('should update blur method value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehBlurMethod('jittered');

    expect(useVisualStore.getState().bokehBlurMethod).toBe('jittered');
  });

  it('should toggle show debug via switch', async () => {
    const user = userEvent.setup();
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const showFocusPointSwitch = screen.getByText('Show Focus Point');

    // Initially false
    expect(useVisualStore.getState().bokehShowDebug).toBe(false);

    // Click to enable
    await user.click(showFocusPointSwitch);
    expect(useVisualStore.getState().bokehShowDebug).toBe(true);

    // Click to disable
    await user.click(showFocusPointSwitch);
    expect(useVisualStore.getState().bokehShowDebug).toBe(false);
  });
});
