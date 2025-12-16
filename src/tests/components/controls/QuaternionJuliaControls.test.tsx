/**
 * Tests for QuaternionJuliaControls component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QuaternionJuliaControls } from '@/components/sections/Geometry/QuaternionJuliaControls';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { DEFAULT_QUATERNION_JULIA_CONFIG } from '@/lib/geometry/extended/types';

describe('QuaternionJuliaControls', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    // Set dimension to 3 (minimum for quaternion-julia)
    useGeometryStore.getState().setDimension(3);
    useGeometryStore.getState().setObjectType('quaternion-julia');
  });

  it('should render Julia Constant controls', () => {
    render(<QuaternionJuliaControls />);
    expect(screen.getByText('Julia Constant (c)')).toBeInTheDocument();
  });

  it('should render Julia constant component sliders', () => {
    render(<QuaternionJuliaControls />);
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('should render power control', () => {
    render(<QuaternionJuliaControls />);
    // Use getAllByText since there are multiple Power-related labels (Power label, Custom Power)
    const powerElements = screen.getAllByText(/Power/i);
    expect(powerElements.length).toBeGreaterThan(0);
  });

  it('should render power presets', () => {
    render(<QuaternionJuliaControls />);
    expect(screen.getByText('Quadratic')).toBeInTheDocument();
    expect(screen.getByText('Cubic')).toBeInTheDocument();
    expect(screen.getByText('Quartic')).toBeInTheDocument();
    expect(screen.getByText('Octave')).toBeInTheDocument();
  });

  it('should render quality preset selector', () => {
    render(<QuaternionJuliaControls />);
    expect(screen.getByText('Quality Preset')).toBeInTheDocument();
  });

  it('should render max iterations slider', () => {
    render(<QuaternionJuliaControls />);
    expect(screen.getByText('Max Iterations')).toBeInTheDocument();
  });

  it('should render bailout radius slider', () => {
    render(<QuaternionJuliaControls />);
    expect(screen.getByText('Bailout Radius')).toBeInTheDocument();
  });

  it('should render scale slider', () => {
    render(<QuaternionJuliaControls />);
    // There's exactly one "Scale" label for this slider
    const scaleElements = screen.getAllByText('Scale');
    expect(scaleElements.length).toBeGreaterThan(0);
  });

  it('should render rendering info', () => {
    render(<QuaternionJuliaControls />);
    expect(screen.getByText('Rendering: GPU Ray Marching')).toBeInTheDocument();
  });

  it('should display dimension info correctly for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<QuaternionJuliaControls />);
    // The info text is rendered as a template literal
    expect(screen.getByText(/Quaternion Julia fractal/)).toBeInTheDocument();
  });

  it('should not show slice parameters for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<QuaternionJuliaControls />);
    expect(screen.queryByText(/Slice Parameters/)).not.toBeInTheDocument();
  });

  it('should show slice parameters for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    useExtendedObjectStore.getState().setQuaternionJuliaParameterValues([0]);
    render(<QuaternionJuliaControls />);
    expect(screen.getByText(/Slice Parameters/)).toBeInTheDocument();
    expect(screen.getByText('Dim 4')).toBeInTheDocument();
  });

  it('should show multiple slice parameters for 5D', () => {
    useGeometryStore.getState().setDimension(5);
    useExtendedObjectStore.getState().setQuaternionJuliaParameterValues([0, 0]);
    render(<QuaternionJuliaControls />);
    expect(screen.getByText(/Slice Parameters/)).toBeInTheDocument();
    expect(screen.getByText('Dim 4')).toBeInTheDocument();
    expect(screen.getByText('Dim 5')).toBeInTheDocument();
  });

  it('should update Julia constant value in store', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaConstant([0.5, -0.3, 0.2, 0.1]);
    expect(useExtendedObjectStore.getState().quaternionJulia.juliaConstant).toEqual([0.5, -0.3, 0.2, 0.1]);
  });

  it('should update power value in store', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaPower(4);
    expect(useExtendedObjectStore.getState().quaternionJulia.power).toBe(4);
  });

  it('should update max iterations value in store', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaMaxIterations(128);
    expect(useExtendedObjectStore.getState().quaternionJulia.maxIterations).toBe(128);
  });

  it('should update bailout radius value in store', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaBailoutRadius(8.0);
    expect(useExtendedObjectStore.getState().quaternionJulia.bailoutRadius).toBe(8.0);
  });

  it('should update scale value in store', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaScale(3.0);
    expect(useExtendedObjectStore.getState().quaternionJulia.scale).toBe(3.0);
  });

  it('should clamp power value to valid range', () => {
    // Test below minimum (2)
    useExtendedObjectStore.getState().setQuaternionJuliaPower(1);
    expect(useExtendedObjectStore.getState().quaternionJulia.power).toBe(2);

    // Test above maximum (8)
    useExtendedObjectStore.getState().setQuaternionJuliaPower(10);
    expect(useExtendedObjectStore.getState().quaternionJulia.power).toBe(8);
  });

  it('should clamp max iterations value to valid range', () => {
    // Test below minimum (8)
    useExtendedObjectStore.getState().setQuaternionJuliaMaxIterations(5);
    expect(useExtendedObjectStore.getState().quaternionJulia.maxIterations).toBe(8);

    // Test above maximum (512)
    useExtendedObjectStore.getState().setQuaternionJuliaMaxIterations(600);
    expect(useExtendedObjectStore.getState().quaternionJulia.maxIterations).toBe(512);
  });

  it('should clamp bailout radius value to valid range', () => {
    // Test below minimum (2.0)
    useExtendedObjectStore.getState().setQuaternionJuliaBailoutRadius(1.0);
    expect(useExtendedObjectStore.getState().quaternionJulia.bailoutRadius).toBe(2.0);

    // Test above maximum (16.0)
    useExtendedObjectStore.getState().setQuaternionJuliaBailoutRadius(20.0);
    expect(useExtendedObjectStore.getState().quaternionJulia.bailoutRadius).toBe(16.0);
  });

  it('should clamp scale value to valid range', () => {
    // Test below minimum (0.5)
    useExtendedObjectStore.getState().setQuaternionJuliaScale(0.1);
    expect(useExtendedObjectStore.getState().quaternionJulia.scale).toBe(0.5);

    // Test above maximum (5.0)
    useExtendedObjectStore.getState().setQuaternionJuliaScale(10.0);
    expect(useExtendedObjectStore.getState().quaternionJulia.scale).toBe(5.0);
  });

  it('should reset to default values', () => {
    // Set custom values
    useExtendedObjectStore.getState().setQuaternionJuliaConstant([0.1, 0.1, 0.1, 0.1]);
    useExtendedObjectStore.getState().setQuaternionJuliaPower(6);
    useExtendedObjectStore.getState().setQuaternionJuliaMaxIterations(128);
    useExtendedObjectStore.getState().setQuaternionJuliaBailoutRadius(8.0);

    // Reset
    useExtendedObjectStore.getState().reset();

    // Verify defaults
    expect(useExtendedObjectStore.getState().quaternionJulia).toEqual(DEFAULT_QUATERNION_JULIA_CONFIG);
  });

  it('should apply custom className', () => {
    const { container } = render(<QuaternionJuliaControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should display dimension info correctly for different dimensions', () => {
    // Test 3D
    act(() => {
      useGeometryStore.getState().setDimension(3);
    });
    const { rerender } = render(<QuaternionJuliaControls />);
    expect(screen.getByText(/3D Quaternion Julia fractal/)).toBeInTheDocument();

    // Test 6D
    act(() => {
      useGeometryStore.getState().setDimension(6);
    });
    rerender(<QuaternionJuliaControls />);
    expect(screen.getByText(/6D Quaternion Julia fractal/)).toBeInTheDocument();
  });

  it('should apply quality preset correctly', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaQualityPreset('high');
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.maxIterations).toBe(128);
    expect(config.surfaceThreshold).toBe(0.001);
    expect(config.maxRaymarchSteps).toBe(256);
  });
});
