/**
 * Tests for ShearControls component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShearControls } from '@/components/controls/ShearControls';
import { useTransformStore } from '@/stores/transformStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('ShearControls', () => {
  beforeEach(() => {
    useTransformStore.getState().resetAll();
    useGeometryStore.getState().reset();
  });

  it('should render shear plane sliders', () => {
    render(<ShearControls />);

    // 4D should have XY, XZ, YZ, XW, YW, ZW shears
    expect(screen.getByText('XY')).toBeInTheDocument();
    expect(screen.getByText('XZ')).toBeInTheDocument();
    expect(screen.getByText('YZ')).toBeInTheDocument();
    expect(screen.getByText('XW')).toBeInTheDocument();
    expect(screen.getByText('YW')).toBeInTheDocument();
    expect(screen.getByText('ZW')).toBeInTheDocument();
  });

  it('should render reset button', () => {
    render(<ShearControls />);
    expect(screen.getByRole('button', { name: /reset shears/i })).toBeInTheDocument();
  });

  it('should group shear planes by dimension', () => {
    render(<ShearControls />);

    expect(screen.getByText('3D Shears')).toBeInTheDocument();
    expect(screen.getByText('4th Dimension (W)')).toBeInTheDocument();
  });

  it('should show 5D shear planes when dimension is 5', () => {
    useGeometryStore.getState().setDimension(5);
    render(<ShearControls />);

    expect(screen.getByText('5th Dimension (V)')).toBeInTheDocument();
    expect(screen.getByText('XV')).toBeInTheDocument();
  });

  it('should hide W shears when dimension is 3', () => {
    useGeometryStore.getState().setDimension(3);
    render(<ShearControls />);

    expect(screen.getByText('XY')).toBeInTheDocument();
    expect(screen.queryByText('XW')).not.toBeInTheDocument();
    expect(screen.queryByText('4th Dimension (W)')).not.toBeInTheDocument();
  });

  it('should update shear when slider changes', () => {
    render(<ShearControls />);

    // Find XY slider (first slider after info text)
    const sliders = screen.getAllByRole('slider');
    const xySlider = sliders[0]!;

    fireEvent.change(xySlider, { target: { value: '0.5' } });

    expect(useTransformStore.getState().shears.get('XY')).toBe(0.5);
  });

  it('should reset all shears when reset button is clicked', () => {
    useTransformStore.getState().setShear('XY', 0.5);
    useTransformStore.getState().setShear('XW', 1.0);
    render(<ShearControls />);

    const resetButton = screen.getByRole('button', { name: /reset shears/i });
    fireEvent.click(resetButton);

    expect(useTransformStore.getState().shears.size).toBe(0);
  });

  it('should disable reset button when no shears are set', () => {
    render(<ShearControls />);

    const resetButton = screen.getByRole('button', { name: /reset shears/i });
    expect(resetButton).toBeDisabled();
  });

  it('should enable reset button when shears are set', () => {
    useTransformStore.getState().setShear('XY', 0.5);
    render(<ShearControls />);

    const resetButton = screen.getByRole('button', { name: /reset shears/i });
    expect(resetButton).not.toBeDisabled();
  });

  it('should render info text', () => {
    render(<ShearControls />);
    expect(screen.getByText(/skew the object/i)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<ShearControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
