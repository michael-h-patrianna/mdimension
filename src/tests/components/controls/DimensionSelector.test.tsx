/**
 * Tests for DimensionSelector component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DimensionSelector } from '@/components/controls/DimensionSelector';
import { useGeometryStore } from '@/stores/geometryStore';

describe('DimensionSelector', () => {
  beforeEach(() => {
    // Reset store before each test
    useGeometryStore.getState().reset();
  });

  it('should render all dimension options (3D, 4D, 5D, 6D)', () => {
    render(<DimensionSelector />);

    expect(screen.getByRole('radio', { name: '3D' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4D' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '5D' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '6D' })).toBeInTheDocument();
  });

  it('should have 4D selected by default', () => {
    render(<DimensionSelector />);

    const button4D = screen.getByRole('radio', { name: '4D' });
    expect(button4D).toHaveAttribute('aria-checked', 'true');
  });

  it('should highlight the current dimension', () => {
    // Set dimension to 5
    useGeometryStore.getState().setDimension(5);

    render(<DimensionSelector />);

    const button5D = screen.getByRole('radio', { name: '5D' });
    expect(button5D).toHaveAttribute('aria-checked', 'true');

    const button4D = screen.getByRole('radio', { name: '4D' });
    expect(button4D).toHaveAttribute('aria-checked', 'false');
  });

  it('should call setDimension when clicking a dimension option', () => {
    render(<DimensionSelector />);

    const button3D = screen.getByRole('radio', { name: '3D' });
    fireEvent.click(button3D);

    expect(useGeometryStore.getState().dimension).toBe(3);
  });

  it('should update selection when dimension changes', () => {
    render(<DimensionSelector />);

    // Click 6D
    fireEvent.click(screen.getByRole('radio', { name: '6D' }));
    expect(screen.getByRole('radio', { name: '6D' })).toHaveAttribute('aria-checked', 'true');

    // Click 3D
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '6D' })).toHaveAttribute('aria-checked', 'false');
  });

  it('should display rotation planes count', () => {
    render(<DimensionSelector />);

    // 4D has 6 rotation planes: 4 * 3 / 2 = 6
    expect(screen.getByText(/4D space has 6 rotation planes/)).toBeInTheDocument();
  });

  it('should update rotation planes count when dimension changes', () => {
    render(<DimensionSelector />);

    // Change to 5D - should have 10 rotation planes: 5 * 4 / 2 = 10
    fireEvent.click(screen.getByRole('radio', { name: '5D' }));
    expect(screen.getByText(/5D space has 10 rotation planes/)).toBeInTheDocument();

    // Change to 3D - should have 3 rotation planes: 3 * 2 / 2 = 3
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(screen.getByText(/3D space has 3 rotation planes/)).toBeInTheDocument();
  });

  it('should be disableable', () => {
    render(<DimensionSelector disabled />);

    const buttons = screen.getAllByRole('radio');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('should render label', () => {
    render(<DimensionSelector />);

    expect(screen.getByText('Dimension')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<DimensionSelector className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
