/**
 * Tests for HyperbulbAnimationDrawer component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HyperbulbAnimationDrawer } from '@/components/layout/TimelineControls/HyperbulbAnimationDrawer';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('HyperbulbAnimationDrawer', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    useGeometryStore.getState().setDimension(3);
    useGeometryStore.getState().setObjectType('mandelbrot');
  });

  it('should render Power Animation controls', () => {
    render(<HyperbulbAnimationDrawer />);
    expect(screen.getByText('Power Animation')).toBeInTheDocument();
  });

  it('should render Phase Shifts controls', () => {
    render(<HyperbulbAnimationDrawer />);
    expect(screen.getByText('Phase Shifts')).toBeInTheDocument();
  });

  it('should render Julia Morphing controls', () => {
    render(<HyperbulbAnimationDrawer />);
    expect(screen.getByText('Julia Morphing')).toBeInTheDocument();
  });

  it('should have correct test ids', () => {
    render(<HyperbulbAnimationDrawer />);
    expect(screen.getByTestId('hyperbulb-animation-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-powerAnimation')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-phaseShifts')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-juliaMorphing')).toBeInTheDocument();
  });

  it('should not show Slice Animation for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<HyperbulbAnimationDrawer />);
    expect(screen.queryByText('Slice Animation')).not.toBeInTheDocument();
  });

  it('should show Slice Animation for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<HyperbulbAnimationDrawer />);
    expect(screen.getByText('Slice Animation')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-sliceAnimation')).toBeInTheDocument();
  });

  it('should render toggle buttons for each animation system', () => {
    render(<HyperbulbAnimationDrawer />);

    // Each system has a toggle button with "OFF" initially
    const offButtons = screen.getAllByText('OFF');
    expect(offButtons.length).toBeGreaterThanOrEqual(3); // power, phase, julia
  });

  it('should toggle Power Animation', () => {
    render(<HyperbulbAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle power animation/i });
    expect(toggleBtn).toBeInTheDocument();

    // Initially off
    expect(useExtendedObjectStore.getState().mandelbrot.powerAnimationEnabled).toBe(false);

    // Click to enable
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().mandelbrot.powerAnimationEnabled).toBe(true);
  });

  it('should toggle Phase Shifts', () => {
    render(<HyperbulbAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle phase shifts/i });
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().mandelbrot.phaseShiftEnabled).toBe(true);
  });

  it('should toggle Julia Morphing', () => {
    render(<HyperbulbAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle julia morphing/i });
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().mandelbrot.juliaModeEnabled).toBe(true);
  });

  it('should toggle Slice Animation for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<HyperbulbAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle slice animation/i });
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().mandelbrot.sliceAnimationEnabled).toBe(true);
  });

  it('should render min/max/speed sliders for Power Animation', () => {
    render(<HyperbulbAnimationDrawer />);

    // Power Animation has Min, Max, Speed
    expect(screen.getByText('Min')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();

    // Multiple Speed labels (power and phase have speed)
    const speedLabels = screen.getAllByText('Speed');
    expect(speedLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('should render amplitude sliders', () => {
    render(<HyperbulbAnimationDrawer />);

    // Phase Shifts and potentially others have Amplitude
    const amplitudeLabels = screen.getAllByText('Amplitude');
    expect(amplitudeLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('should render radius slider for Julia Morphing', () => {
    render(<HyperbulbAnimationDrawer />);
    expect(screen.getByText('Radius')).toBeInTheDocument();
  });

  it('should render all 4 systems for 4D+ dimension', () => {
    useGeometryStore.getState().setDimension(4);
    render(<HyperbulbAnimationDrawer />);

    expect(screen.getByText('Power Animation')).toBeInTheDocument();
    expect(screen.getByText('Phase Shifts')).toBeInTheDocument();
    expect(screen.getByText('Julia Morphing')).toBeInTheDocument();
    expect(screen.getByText('Slice Animation')).toBeInTheDocument();
  });

  it('should have disabled state styling when animation is off', () => {
    render(<HyperbulbAnimationDrawer />);

    // Power animation is off, its parameter container should have opacity-50
    const powerPanel = screen.getByTestId('animation-panel-powerAnimation');
    const paramContainer = powerPanel.querySelector('.opacity-50');
    expect(paramContainer).toBeInTheDocument();
  });
});
