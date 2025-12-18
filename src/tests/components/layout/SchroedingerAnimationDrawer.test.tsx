/**
 * Tests for SchroedingerAnimationDrawer component
 *
 * Tests quantum wavefunction animation controls:
 * - Origin Drift animation
 * - Slice Animation (4D+ only)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchroedingerAnimationDrawer } from '@/components/layout/TimelineControls/SchroedingerAnimationDrawer';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('SchroedingerAnimationDrawer', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    useGeometryStore.getState().setDimension(3);
    useGeometryStore.getState().setObjectType('schroedinger');
  });

  it('should render Origin Drift controls', () => {
    render(<SchroedingerAnimationDrawer />);
    expect(screen.getByText('Origin Drift')).toBeInTheDocument();
  });

  it('should have correct test ids', () => {
    render(<SchroedingerAnimationDrawer />);
    expect(screen.getByTestId('schroedinger-animation-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-originDrift')).toBeInTheDocument();
  });

  it('should not show Dimensional Sweeps for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<SchroedingerAnimationDrawer />);
    expect(screen.queryByText('Dimensional Sweeps')).not.toBeInTheDocument();
  });

  it('should show Dimensional Sweeps for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<SchroedingerAnimationDrawer />);
    expect(screen.getByText('Dimensional Sweeps')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-sliceAnimation')).toBeInTheDocument();
  });

  it('should render toggle buttons for each animation system', () => {
    render(<SchroedingerAnimationDrawer />);

    // Each system has a toggle button with "OFF" initially
    const offButtons = screen.getAllByText('OFF');
    expect(offButtons.length).toBeGreaterThanOrEqual(1); // origin drift
  });

  it('should toggle Origin Drift', () => {
    render(<SchroedingerAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle origin drift/i });
    expect(toggleBtn).toBeInTheDocument();

    // Initially off
    expect(useExtendedObjectStore.getState().schroedinger.originDriftEnabled).toBe(false);

    // Click to enable
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().schroedinger.originDriftEnabled).toBe(true);
  });

  it('should toggle Slice Animation for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<SchroedingerAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle slice animation/i });
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().schroedinger.sliceAnimationEnabled).toBe(true);
  });

  it('should render amplitude/frequency/spread sliders for Origin Drift', () => {
    useGeometryStore.getState().setDimension(3); // Ensure 3D for single amplitude
    render(<SchroedingerAnimationDrawer />);

    // Origin Drift has Amplitude, Frequency, Spread (in 3D mode, only one Amplitude)
    const amplitudeLabels = screen.getAllByText('Amplitude');
    expect(amplitudeLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Frequency')).toBeInTheDocument();
    expect(screen.getByText('Spread')).toBeInTheDocument();
  });

  it('should render amplitude and speed sliders for Slice Animation in 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<SchroedingerAnimationDrawer />);

    // Slice Animation has Amplitude and Speed (multiple Amplitude labels)
    const amplitudeLabels = screen.getAllByText('Amplitude');
    expect(amplitudeLabels.length).toBeGreaterThanOrEqual(2); // origin drift + slice

    const speedLabels = screen.getAllByText('Speed');
    expect(speedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('should render both systems for 4D+ dimension', () => {
    useGeometryStore.getState().setDimension(4);
    render(<SchroedingerAnimationDrawer />);

    expect(screen.getByText('Origin Drift')).toBeInTheDocument();
    expect(screen.getByText('Dimensional Sweeps')).toBeInTheDocument();
  });

  it('should have disabled state styling when animation is off', () => {
    render(<SchroedingerAnimationDrawer />);

    // Origin drift is off, its parameter container should have opacity-50
    const originPanel = screen.getByTestId('animation-panel-originDrift');
    const paramContainer = originPanel.querySelector('.opacity-50');
    expect(paramContainer).toBeInTheDocument();
  });

});
