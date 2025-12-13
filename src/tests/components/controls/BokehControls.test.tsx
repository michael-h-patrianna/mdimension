import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BokehControls } from '@/components/sidebar/PostProcessing/BokehControls';
import {
  useVisualStore,
  DEFAULT_BOKEH_FOCUS,
  DEFAULT_BOKEH_APERTURE,
  DEFAULT_BOKEH_MAX_BLUR,
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

  it('should not show sliders when bokeh is disabled', () => {
    useVisualStore.getState().setBokehEnabled(false);
    render(<BokehControls />);

    expect(screen.queryByText('Focus')).not.toBeInTheDocument();
    expect(screen.queryByText('Aperture')).not.toBeInTheDocument();
    expect(screen.queryByText('Max Blur')).not.toBeInTheDocument();
  });

  it('should show sliders when bokeh is enabled', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('Aperture')).toBeInTheDocument();
    expect(screen.getByText('Max Blur')).toBeInTheDocument();
  });

  it('should render focus slider with correct label', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const focusLabel = screen.getByText('Focus');
    expect(focusLabel).toBeInTheDocument();
  });

  it('should render aperture slider with correct label', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const apertureLabel = screen.getByText('Aperture');
    expect(apertureLabel).toBeInTheDocument();
  });

  it('should render max blur slider with correct label', () => {
    useVisualStore.getState().setBokehEnabled(true);
    render(<BokehControls />);

    const maxBlurLabel = screen.getByText('Max Blur');
    expect(maxBlurLabel).toBeInTheDocument();
  });

  it('should update focus value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehFocus(5.0);

    expect(useVisualStore.getState().bokehFocus).toBe(5.0);
  });

  it('should update aperture value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehAperture(0.05);

    expect(useVisualStore.getState().bokehAperture).toBe(0.05);
  });

  it('should update max blur value in store', () => {
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehMaxBlur(0.05);

    expect(useVisualStore.getState().bokehMaxBlur).toBe(0.05);
  });

  it('should clamp focus value to valid range', () => {
    // Test below minimum
    useVisualStore.getState().setBokehFocus(0);
    expect(useVisualStore.getState().bokehFocus).toBe(0.1);

    // Test above maximum
    useVisualStore.getState().setBokehFocus(15);
    expect(useVisualStore.getState().bokehFocus).toBe(10);
  });

  it('should clamp aperture value to valid range', () => {
    // Test below minimum
    useVisualStore.getState().setBokehAperture(0);
    expect(useVisualStore.getState().bokehAperture).toBe(0.001);

    // Test above maximum
    useVisualStore.getState().setBokehAperture(0.5);
    expect(useVisualStore.getState().bokehAperture).toBe(0.1);
  });

  it('should clamp max blur value to valid range', () => {
    // Test below minimum
    useVisualStore.getState().setBokehMaxBlur(-0.1);
    expect(useVisualStore.getState().bokehMaxBlur).toBe(0);

    // Test above maximum
    useVisualStore.getState().setBokehMaxBlur(0.5);
    expect(useVisualStore.getState().bokehMaxBlur).toBe(0.1);
  });

  it('should reset to default values', () => {
    // Set custom values
    useVisualStore.getState().setBokehEnabled(true);
    useVisualStore.getState().setBokehFocus(5.0);
    useVisualStore.getState().setBokehAperture(0.05);
    useVisualStore.getState().setBokehMaxBlur(0.05);

    // Reset
    useVisualStore.getState().reset();

    // Verify defaults
    expect(useVisualStore.getState().bokehEnabled).toBe(false);
    expect(useVisualStore.getState().bokehFocus).toBe(DEFAULT_BOKEH_FOCUS);
    expect(useVisualStore.getState().bokehAperture).toBe(DEFAULT_BOKEH_APERTURE);
    expect(useVisualStore.getState().bokehMaxBlur).toBe(DEFAULT_BOKEH_MAX_BLUR);
  });

  it('should apply custom className', () => {
    const { container } = render(<BokehControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
