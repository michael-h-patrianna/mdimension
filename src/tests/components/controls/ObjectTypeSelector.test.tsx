/**
 * Tests for ObjectTypeSelector component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectTypeSelector } from '@/components/controls/ObjectTypeSelector';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';

describe('ObjectTypeSelector', () => {
  beforeEach(() => {
    // Reset stores before each test
    useGeometryStore.getState().reset();
    useRotationStore.getState().resetAllRotations();
  });

  it('should render with label', () => {
    render(<ObjectTypeSelector />);

    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('should render all object type options', () => {
    render(<ObjectTypeSelector />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Check that options exist
    const options = select.querySelectorAll('option');
    const optionValues = Array.from(options).map((o) => o.value);

    expect(optionValues).toContain('hypercube');
    expect(optionValues).toContain('simplex');
    expect(optionValues).toContain('cross-polytope');
  });

  it('should have hypercube selected by default', () => {
    render(<ObjectTypeSelector />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('hypercube');
  });

  it('should display description for hypercube', () => {
    render(<ObjectTypeSelector />);

    expect(screen.getByText(/n-cube/i)).toBeInTheDocument();
  });

  it('should call setObjectType when changing selection', () => {
    render(<ObjectTypeSelector />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'simplex' } });

    expect(useGeometryStore.getState().objectType).toBe('simplex');
  });

  it('should update description when type changes', () => {
    render(<ObjectTypeSelector />);

    const select = screen.getByRole('combobox');

    // Change to simplex
    fireEvent.change(select, { target: { value: 'simplex' } });
    expect(screen.getByText(/n-simplex/i)).toBeInTheDocument();

    // Change to cross-polytope
    fireEvent.change(select, { target: { value: 'cross-polytope' } });
    expect(screen.getByText(/n-orthoplex/i)).toBeInTheDocument();
  });

  it('should reflect current store state', () => {
    // Set initial state
    useGeometryStore.getState().setObjectType('cross-polytope');

    render(<ObjectTypeSelector />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('cross-polytope');
  });

  it('should be disableable', () => {
    render(<ObjectTypeSelector disabled />);

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(<ObjectTypeSelector className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should reset rotations when changing object type', () => {
    // Set up some rotation values
    useRotationStore.getState().setRotation('XY', Math.PI / 4);
    useRotationStore.getState().setRotation('XZ', Math.PI / 2);

    // Verify rotations are set
    const rotationsBefore = useRotationStore.getState().rotations;
    expect(rotationsBefore.get('XY')).toBeCloseTo(Math.PI / 4);
    expect(rotationsBefore.get('XZ')).toBeCloseTo(Math.PI / 2);

    render(<ObjectTypeSelector />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'simplex' } });

    // Verify rotations were reset
    const rotationsAfter = useRotationStore.getState().rotations;
    expect(rotationsAfter.size).toBe(0);
  });

  it('should reset rotations even when switching between extended object types', () => {
    // Set dimension to 3 for mandelbrot (which auto-switches to 3D)
    useGeometryStore.getState().setDimension(3);

    // Set up rotation values
    useRotationStore.getState().setRotation('XY', Math.PI);
    useRotationStore.getState().setRotation('XZ', Math.PI / 3);
    useRotationStore.getState().setRotation('YZ', Math.PI / 6);

    render(<ObjectTypeSelector />);

    const select = screen.getByRole('combobox');

    // Switch to hypersphere
    fireEvent.change(select, { target: { value: 'hypersphere' } });

    // Verify rotations were reset
    const rotationsAfter = useRotationStore.getState().rotations;
    expect(rotationsAfter.size).toBe(0);
  });
});
