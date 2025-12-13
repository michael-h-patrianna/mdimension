/**
 * Tests for MandelboxControls component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MandelboxControls } from '@/components/sidebar/Geometry/MandelboxControls';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { DEFAULT_MANDELBOX_CONFIG } from '@/lib/geometry/extended/types';

describe('MandelboxControls', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    // Set dimension to 3 (minimum for mandelbox)
    useGeometryStore.getState().setDimension(3);
    useGeometryStore.getState().setObjectType('mandelbox');
  });

  it('should render scale control', () => {
    render(<MandelboxControls />);
    // Use getAllByText since there are multiple Scale-related labels
    const scaleElements = screen.getAllByText(/Scale/i);
    expect(scaleElements.length).toBeGreaterThan(0);
  });

  it('should render scale presets', () => {
    render(<MandelboxControls />);
    expect(screen.getByText('Sharp')).toBeInTheDocument();
    expect(screen.getByText('Classic')).toBeInTheDocument();
    expect(screen.getByText('Soft')).toBeInTheDocument();
    expect(screen.getByText('Inverted')).toBeInTheDocument();
  });

  it('should render folding limit slider', () => {
    render(<MandelboxControls />);
    expect(screen.getByText('Folding Limit')).toBeInTheDocument();
  });

  it('should render sphere fold radii controls', () => {
    render(<MandelboxControls />);
    expect(screen.getByText('Sphere Fold Radii')).toBeInTheDocument();
    expect(screen.getByText('Min Radius')).toBeInTheDocument();
    expect(screen.getByText('Fixed Radius')).toBeInTheDocument();
  });

  it('should render max iterations slider', () => {
    render(<MandelboxControls />);
    expect(screen.getByText('Max Iterations')).toBeInTheDocument();
  });

  it('should render escape radius slider', () => {
    render(<MandelboxControls />);
    expect(screen.getByText('Escape Radius')).toBeInTheDocument();
  });

  it('should render rendering info', () => {
    render(<MandelboxControls />);
    expect(screen.getByText('Rendering: GPU Ray Marching')).toBeInTheDocument();
    expect(screen.getByText('3D Mandelbox fractal')).toBeInTheDocument();
  });

  it('should not show slice parameters for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<MandelboxControls />);
    expect(screen.queryByText(/Slice Parameters/)).not.toBeInTheDocument();
  });

  it('should show slice parameters for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    useExtendedObjectStore.getState().initializeMandelboxForDimension(4);
    render(<MandelboxControls />);
    expect(screen.getByText(/Slice Parameters/)).toBeInTheDocument();
    expect(screen.getByText('Dim 4')).toBeInTheDocument();
  });

  it('should show multiple slice parameters for 5D', () => {
    useGeometryStore.getState().setDimension(5);
    useExtendedObjectStore.getState().initializeMandelboxForDimension(5);
    render(<MandelboxControls />);
    expect(screen.getByText(/Slice Parameters/)).toBeInTheDocument();
    expect(screen.getByText('Dim 4')).toBeInTheDocument();
    expect(screen.getByText('Dim 5')).toBeInTheDocument();
  });

  it('should update scale value in store', () => {
    useExtendedObjectStore.getState().setMandelboxScale(-2.0);
    expect(useExtendedObjectStore.getState().mandelbox.scale).toBe(-2.0);
  });

  it('should update folding limit value in store', () => {
    useExtendedObjectStore.getState().setMandelboxFoldingLimit(1.5);
    expect(useExtendedObjectStore.getState().mandelbox.foldingLimit).toBe(1.5);
  });

  it('should update min radius value in store', () => {
    useExtendedObjectStore.getState().setMandelboxMinRadius(0.7);
    expect(useExtendedObjectStore.getState().mandelbox.minRadius).toBe(0.7);
  });

  it('should update fixed radius value in store', () => {
    useExtendedObjectStore.getState().setMandelboxFixedRadius(1.5);
    expect(useExtendedObjectStore.getState().mandelbox.fixedRadius).toBe(1.5);
  });

  it('should update max iterations value in store', () => {
    useExtendedObjectStore.getState().setMandelboxMaxIterations(75);
    expect(useExtendedObjectStore.getState().mandelbox.maxIterations).toBe(75);
  });

  it('should update escape radius value in store', () => {
    useExtendedObjectStore.getState().setMandelboxEscapeRadius(50.0);
    expect(useExtendedObjectStore.getState().mandelbox.escapeRadius).toBe(50.0);
  });

  it('should clamp scale value to valid range', () => {
    // Test below minimum (-3.0)
    useExtendedObjectStore.getState().setMandelboxScale(-5.0);
    expect(useExtendedObjectStore.getState().mandelbox.scale).toBe(-3.0);

    // Test above maximum (3.0)
    useExtendedObjectStore.getState().setMandelboxScale(5.0);
    expect(useExtendedObjectStore.getState().mandelbox.scale).toBe(3.0);
  });

  it('should clamp folding limit value to valid range', () => {
    // Test below minimum (0.5)
    useExtendedObjectStore.getState().setMandelboxFoldingLimit(0.1);
    expect(useExtendedObjectStore.getState().mandelbox.foldingLimit).toBe(0.5);

    // Test above maximum (2.0)
    useExtendedObjectStore.getState().setMandelboxFoldingLimit(5.0);
    expect(useExtendedObjectStore.getState().mandelbox.foldingLimit).toBe(2.0);
  });

  it('should clamp max iterations value to valid range', () => {
    // Test below minimum (10)
    useExtendedObjectStore.getState().setMandelboxMaxIterations(5);
    expect(useExtendedObjectStore.getState().mandelbox.maxIterations).toBe(10);

    // Test above maximum (100)
    useExtendedObjectStore.getState().setMandelboxMaxIterations(200);
    expect(useExtendedObjectStore.getState().mandelbox.maxIterations).toBe(100);
  });

  it('should reset to default values', () => {
    // Set custom values
    useExtendedObjectStore.getState().setMandelboxScale(-2.5);
    useExtendedObjectStore.getState().setMandelboxFoldingLimit(1.8);
    useExtendedObjectStore.getState().setMandelboxMinRadius(0.8);
    useExtendedObjectStore.getState().setMandelboxMaxIterations(75);

    // Reset
    useExtendedObjectStore.getState().reset();

    // Verify defaults
    expect(useExtendedObjectStore.getState().mandelbox).toEqual(DEFAULT_MANDELBOX_CONFIG);
  });

  it('should apply custom className', () => {
    const { container } = render(<MandelboxControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should display dimension info correctly for different dimensions', () => {
    // Test 3D
    useGeometryStore.getState().setDimension(3);
    const { rerender } = render(<MandelboxControls />);
    expect(screen.getByText('3D Mandelbox fractal')).toBeInTheDocument();

    // Test 6D
    useGeometryStore.getState().setDimension(6);
    rerender(<MandelboxControls />);
    expect(screen.getByText('6D Mandelbox fractal')).toBeInTheDocument();
  });
});
