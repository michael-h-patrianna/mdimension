/**
 * Tests for PropertiesPanel component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertiesPanel } from '@/components/controls/PropertiesPanel';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';

describe('PropertiesPanel', () => {
  beforeEach(() => {
    useGeometryStore.getState().reset();
    useRotationStore.getState().resetAllRotations();
    useRotationStore.getState().setDimension(4);
  });

  it('should render object type', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText('Hypercube')).toBeInTheDocument();
  });

  it('should render dimension info', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText('4D (Tesseract)')).toBeInTheDocument();
  });

  it('should render vertices label', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText('Vertices:')).toBeInTheDocument();
  });

  it('should render edges label', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText('Edges:')).toBeInTheDocument();
  });

  it('should render rotation planes label', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText('Rotation planes:')).toBeInTheDocument();
  });

  it('should render counts section header', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText('Counts')).toBeInTheDocument();
  });

  it('should update when dimension changes', () => {
    const { rerender } = render(<PropertiesPanel />);

    useGeometryStore.getState().setDimension(3);
    rerender(<PropertiesPanel />);

    expect(screen.getByText('3D (Cube)')).toBeInTheDocument();
  });

  it('should update when object type changes', () => {
    const { rerender } = render(<PropertiesPanel />);

    useGeometryStore.getState().setObjectType('simplex');
    rerender(<PropertiesPanel />);

    expect(screen.getByText('Simplex')).toBeInTheDocument();
  });

  it('should show active rotations when present', () => {
    useRotationStore.getState().setRotation('XY', Math.PI / 4);
    render(<PropertiesPanel />);

    expect(screen.getByText('Active Rotations')).toBeInTheDocument();
    expect(screen.getByText(/XY: 45°/)).toBeInTheDocument();
  });

  it('should not show active rotations section when no rotations', () => {
    render(<PropertiesPanel />);
    expect(screen.queryByText('Active Rotations')).not.toBeInTheDocument();
  });

  it('should toggle vertex coordinates display', () => {
    render(<PropertiesPanel />);

    // Click to expand
    fireEvent.click(screen.getByText(/Vertex Coordinates/));

    // Should show coordinate headers in the table
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('should apply custom className', () => {
    const { container } = render(<PropertiesPanel className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
