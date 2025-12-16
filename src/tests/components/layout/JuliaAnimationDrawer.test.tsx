/**
 * Tests for JuliaAnimationDrawer component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JuliaAnimationDrawer } from '@/components/layout/TimelineControls/JuliaAnimationDrawer';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('JuliaAnimationDrawer', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    useGeometryStore.getState().setDimension(3);
    useGeometryStore.getState().setObjectType('quaternion-julia');
  });

  it('should render Julia constant animation controls', () => {
    render(<JuliaAnimationDrawer />);
    expect(screen.getByText('Julia Constant Path')).toBeInTheDocument();
  });

  it('should render Power Morphing controls', () => {
    render(<JuliaAnimationDrawer />);
    expect(screen.getByText('Power Morphing')).toBeInTheDocument();
  });

  it('should have correct test ids', () => {
    render(<JuliaAnimationDrawer />);
    expect(screen.getByTestId('julia-animation-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-juliaConstant')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-powerAnimation')).toBeInTheDocument();
  });

  it('should not show Origin Drift for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<JuliaAnimationDrawer />);
    expect(screen.queryByText('Origin Drift')).not.toBeInTheDocument();
  });

  it('should show Origin Drift for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<JuliaAnimationDrawer />);
    expect(screen.getByText('Origin Drift')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-originDrift')).toBeInTheDocument();
  });

  it('should not show Dimension Mixing for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<JuliaAnimationDrawer />);
    expect(screen.queryByText('Dimension Mixing')).not.toBeInTheDocument();
  });

  it('should show Dimension Mixing for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<JuliaAnimationDrawer />);
    expect(screen.getByText('Dimension Mixing')).toBeInTheDocument();
    expect(screen.getByTestId('animation-panel-dimensionMix')).toBeInTheDocument();
  });

  it('should render toggle buttons for each animation system', () => {
    useGeometryStore.getState().setDimension(4);
    render(<JuliaAnimationDrawer />);

    // Each system has a toggle button with "OFF" initially
    const offButtons = screen.getAllByText('OFF');
    expect(offButtons.length).toBeGreaterThanOrEqual(4); // juliaConstant, power, originDrift, dimensionMix
  });

  it('should toggle Julia constant animation', () => {
    render(<JuliaAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle julia constant animation/i });
    expect(toggleBtn).toBeInTheDocument();

    // Initially off
    expect(useExtendedObjectStore.getState().quaternionJulia.juliaConstantAnimation.enabled).toBe(false);

    // Click to enable
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().quaternionJulia.juliaConstantAnimation.enabled).toBe(true);
  });

  it('should toggle Power Morphing', () => {
    render(<JuliaAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle power morphing/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().quaternionJulia.powerAnimation.enabled).toBe(true);
  });

  it('should toggle Origin Drift for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<JuliaAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle origin drift/i });
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().quaternionJulia.originDriftEnabled).toBe(true);
  });

  it('should toggle Dimension Mixing for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    render(<JuliaAnimationDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle dimension mixing/i });
    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().quaternionJulia.dimensionMixEnabled).toBe(true);
  });

  it('should render amplitude and frequency sliders for Julia constant animation', () => {
    render(<JuliaAnimationDrawer />);

    // Check for slider labels
    const amplitudeLabels = screen.getAllByText('Amplitude');
    const frequencyLabels = screen.getAllByText('Frequency');

    expect(amplitudeLabels.length).toBeGreaterThanOrEqual(1);
    expect(frequencyLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('should render all 4 systems for 4D+ dimension', () => {
    useGeometryStore.getState().setDimension(5);
    render(<JuliaAnimationDrawer />);

    expect(screen.getByText('Julia Constant Path')).toBeInTheDocument();
    expect(screen.getByText('Power Morphing')).toBeInTheDocument();
    expect(screen.getByText('Origin Drift')).toBeInTheDocument();
    expect(screen.getByText('Dimension Mixing')).toBeInTheDocument();
  });
});
