/**
 * Tests for ObjectTypeSelector component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectTypeSelector } from '@/components/controls/ObjectTypeSelector';
import { useGeometryStore } from '@/stores/geometryStore';

describe('ObjectTypeSelector', () => {
  beforeEach(() => {
    // Reset store before each test
    useGeometryStore.getState().reset();
  });

  it('should render with label', () => {
    render(<ObjectTypeSelector />);

    expect(screen.getByText('Object Type')).toBeInTheDocument();
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
});
