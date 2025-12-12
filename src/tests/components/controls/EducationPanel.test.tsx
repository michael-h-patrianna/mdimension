/**
 * Tests for EducationPanel component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EducationPanel } from '@/components/controls/EducationPanel';
import { useGeometryStore } from '@/stores/geometryStore';

describe('EducationPanel', () => {
  beforeEach(() => {
    useGeometryStore.getState().reset();
  });

  it('should render education panel', () => {
    render(<EducationPanel />);
    // Should have dimension info section (default is 4D)
    expect(screen.getByText('4D Space')).toBeInTheDocument();
  });

  it('should display dimension info for current dimension', () => {
    render(<EducationPanel />);
    expect(screen.getByText('4D Space')).toBeInTheDocument();
    expect(
      screen.getByText(/Four-dimensional space extends 3D space/i)
    ).toBeInTheDocument();
  });

  it('should display polytope info for current object type', () => {
    render(<EducationPanel />);
    expect(screen.getByText('Hypercube')).toBeInTheDocument();
    expect(
      screen.getByText(/n-dimensional analog of a cube/i)
    ).toBeInTheDocument();
  });

  it('should display projection info', () => {
    render(<EducationPanel />);
    expect(screen.getByText('Projection')).toBeInTheDocument();
    expect(
      screen.getByText(/Projection reduces higher-dimensional/i)
    ).toBeInTheDocument();
  });

  it('should display rotation info', () => {
    render(<EducationPanel />);
    expect(screen.getByText('Rotation')).toBeInTheDocument();
    expect(
      screen.getByText(/rotations occur in planes/i)
    ).toBeInTheDocument();
  });

  it('should update when dimension changes', () => {
    const { rerender } = render(<EducationPanel />);
    expect(screen.getByText('4D Space')).toBeInTheDocument();

    act(() => {
      useGeometryStore.getState().setDimension(5);
    });
    rerender(<EducationPanel />);

    expect(screen.getByText('5D Space')).toBeInTheDocument();
  });

  it('should update when object type changes', () => {
    const { rerender } = render(<EducationPanel />);
    expect(screen.getByText('Hypercube')).toBeInTheDocument();

    act(() => {
      useGeometryStore.getState().setObjectType('simplex');
    });
    rerender(<EducationPanel />);

    expect(screen.getByText('Simplex')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<EducationPanel className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should display properties list', () => {
    render(<EducationPanel />);
    expect(screen.getByText('Properties:')).toBeInTheDocument();
  });

  it('should display examples list', () => {
    render(<EducationPanel />);
    expect(screen.getByText('Examples:')).toBeInTheDocument();
  });
});
