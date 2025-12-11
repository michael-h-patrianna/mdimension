/**
 * Tests for TranslationControls component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranslationControls } from '@/components/controls/TranslationControls';
import { useTransformStore } from '@/stores/transformStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('TranslationControls', () => {
  beforeEach(() => {
    useTransformStore.getState().resetAll();
    useGeometryStore.getState().reset();
  });

  it('should render translation sliders for each axis', () => {
    render(<TranslationControls />);

    // 4D default - should have X, Y, Z, W
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('should render center button', () => {
    render(<TranslationControls />);
    expect(screen.getByRole('button', { name: /center object/i })).toBeInTheDocument();
  });

  it('should show correct number of axis sliders for dimension', () => {
    // Test with 3D
    useGeometryStore.getState().setDimension(3);
    const { rerender } = render(<TranslationControls />);

    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.queryByText('W')).not.toBeInTheDocument();

    // Test with 5D
    useGeometryStore.getState().setDimension(5);
    rerender(<TranslationControls />);

    expect(screen.getByText('V')).toBeInTheDocument();
  });

  it('should update translation when slider changes', () => {
    render(<TranslationControls />);

    const sliders = screen.getAllByRole('slider');
    const xSlider = sliders[0]!;

    fireEvent.change(xSlider, { target: { value: '2' } });

    expect(useTransformStore.getState().translation[0]).toBe(2);
  });

  it('should center object when center button is clicked', () => {
    useTransformStore.getState().setTranslation(0, 2);
    useTransformStore.getState().setTranslation(1, -1);
    render(<TranslationControls />);

    const centerButton = screen.getByRole('button', { name: /center object/i });
    fireEvent.click(centerButton);

    expect(useTransformStore.getState().translation.every((t) => t === 0)).toBe(true);
  });

  it('should disable center button when all translations are zero', () => {
    render(<TranslationControls />);

    const centerButton = screen.getByRole('button', { name: /center object/i });
    expect(centerButton).toBeDisabled();
  });

  it('should enable center button when translations are non-zero', () => {
    useTransformStore.getState().setTranslation(0, 2);
    render(<TranslationControls />);

    const centerButton = screen.getByRole('button', { name: /center object/i });
    expect(centerButton).not.toBeDisabled();
  });

  it('should render info text about W translation', () => {
    render(<TranslationControls />);
    expect(screen.getByText(/W translation affects/i)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<TranslationControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
