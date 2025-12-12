/**
 * Tests for ScaleControls component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScaleControls } from '@/components/controls/ScaleControls';
import { useTransformStore } from '@/stores/transformStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('ScaleControls', () => {
  beforeEach(() => {
    act(() => {
      useTransformStore.getState().resetAll();
      useGeometryStore.getState().reset();
    });
  });

  it('should render uniform scale slider', () => {
    render(<ScaleControls />);
    expect(screen.getByText('Uniform Scale')).toBeInTheDocument();
  });

  it('should render lock toggle button', () => {
    render(<ScaleControls />);
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();
  });

  it('should render per-axis scale sliders for current dimension', () => {
    render(<ScaleControls />);

    // 4D default - should have X, Y, Z, W
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('should render reset button', () => {
    render(<ScaleControls />);
    expect(screen.getByRole('button', { name: /reset scale/i })).toBeInTheDocument();
  });

  it('should show correct number of axis sliders for dimension', () => {
    // Test with 3D
    act(() => {
      useGeometryStore.getState().setDimension(3);
    });
    const { rerender } = render(<ScaleControls />);

    // 3D should have X, Y, Z (but not W)
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.queryByText('W')).not.toBeInTheDocument();

    // Test with 5D
    act(() => {
      useGeometryStore.getState().setDimension(5);
    });
    rerender(<ScaleControls />);

    expect(screen.getByText('V')).toBeInTheDocument();
  });

  it('should toggle lock state when lock button is clicked', () => {
    render(<ScaleControls />);

    const lockButton = screen.getByRole('button', { name: /locked/i });
    expect(lockButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(lockButton);
    expect(screen.getByRole('button', { name: /unlocked/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('should have per-axis sliders disabled when locked', () => {
    render(<ScaleControls />);

    // When locked (default), per-axis sliders should be disabled
    const sliders = screen.getAllByRole('slider');
    // First slider is uniform, rest are per-axis
    const perAxisSliders = sliders.slice(1);
    perAxisSliders.forEach((slider) => {
      expect(slider).toBeDisabled();
    });
  });

  it('should enable per-axis sliders when unlocked', () => {
    useTransformStore.getState().setScaleLocked(false);
    render(<ScaleControls />);

    const sliders = screen.getAllByRole('slider');
    const perAxisSliders = sliders.slice(1);
    perAxisSliders.forEach((slider) => {
      expect(slider).not.toBeDisabled();
    });
  });

  it('should disable uniform scale slider when unlocked', () => {
    useTransformStore.getState().setScaleLocked(false);
    render(<ScaleControls />);

    const uniformSlider = screen.getAllByRole('slider')[0]!;
    expect(uniformSlider).toBeDisabled();
  });

  it('should enable uniform scale slider when locked', () => {
    useTransformStore.getState().setScaleLocked(true);
    render(<ScaleControls />);

    const uniformSlider = screen.getAllByRole('slider')[0]!;
    expect(uniformSlider).not.toBeDisabled();
  });

  it('should update uniform scale when slider changes', () => {
    render(<ScaleControls />);

    const uniformSlider = screen.getAllByRole('slider')[0]!;
    fireEvent.change(uniformSlider, { target: { value: '2' } });

    expect(useTransformStore.getState().uniformScale).toBe(2);
  });

  it('should call resetScale when reset button is clicked', () => {
    useTransformStore.getState().setUniformScale(2.5);
    render(<ScaleControls />);

    const resetButton = screen.getByRole('button', { name: /reset scale/i });
    fireEvent.click(resetButton);

    expect(useTransformStore.getState().uniformScale).toBe(1);
  });

  it('should show warning for extreme scale values', () => {
    useTransformStore.getState().setUniformScale(0.15);
    render(<ScaleControls />);

    expect(screen.getByText(/extreme scaling/i)).toBeInTheDocument();
  });

  it('should not show warning for normal scale values', () => {
    render(<ScaleControls />);
    expect(screen.queryByText(/extreme scaling/i)).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<ScaleControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
