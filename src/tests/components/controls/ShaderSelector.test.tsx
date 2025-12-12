/**
 * Tests for ShaderSelector component
 *
 * Validates shader selection functionality, visual state updates,
 * and integration with the visual store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShaderSelector } from '@/components/controls/ShaderSelector';
import { useVisualStore } from '@/stores/visualStore';
import { SHADER_DISPLAY_NAMES } from '@/lib/shaders/types';

describe('ShaderSelector', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useVisualStore.getState().reset();
  });

  it('should render all shader options', () => {
    render(<ShaderSelector />);

    // Check that all shader options are rendered
    expect(screen.getByText('Wireframe')).toBeInTheDocument();
    expect(screen.getByText('Dual Outline')).toBeInTheDocument();
    expect(screen.getByText('Surface')).toBeInTheDocument();
  });

  it('should render label', () => {
    render(<ShaderSelector />);

    expect(screen.getByText('Shader')).toBeInTheDocument();
  });

  it('should highlight the current selected shader', () => {
    render(<ShaderSelector />);

    // Default shader is 'surface'
    const surfaceButton = screen.getByTestId('shader-option-surface');
    expect(surfaceButton).toHaveClass('bg-accent/20');
    expect(surfaceButton).toHaveClass('text-accent');
    expect(surfaceButton).toHaveClass('border-accent/50');
  });

  it('should update selection when clicking a shader option', () => {
    render(<ShaderSelector />);

    // Click on Dual Outline shader
    const dualOutlineButton = screen.getByTestId('shader-option-dualOutline');
    fireEvent.click(dualOutlineButton);

    // Check that store was updated
    expect(useVisualStore.getState().shaderType).toBe('dualOutline');

    // Check that the button is now highlighted
    expect(dualOutlineButton).toHaveClass('bg-accent/20');
    expect(dualOutlineButton).toHaveClass('text-accent');
  });

  it('should switch between shader types correctly', () => {
    render(<ShaderSelector />);

    // Start with surface (default)
    expect(useVisualStore.getState().shaderType).toBe('surface');

    // Click Wireframe
    fireEvent.click(screen.getByTestId('shader-option-wireframe'));
    expect(useVisualStore.getState().shaderType).toBe('wireframe');

    // Click Dual Outline
    fireEvent.click(screen.getByTestId('shader-option-dualOutline'));
    expect(useVisualStore.getState().shaderType).toBe('dualOutline');

    // Click back to Surface
    fireEvent.click(screen.getByTestId('shader-option-surface'));
    expect(useVisualStore.getState().shaderType).toBe('surface');
  });

  it('should display correct shader names from constants', () => {
    render(<ShaderSelector />);

    // Verify display names match the type definitions
    expect(screen.getByText(SHADER_DISPLAY_NAMES.wireframe)).toBeInTheDocument();
    expect(screen.getByText(SHADER_DISPLAY_NAMES.dualOutline)).toBeInTheDocument();
    expect(screen.getByText(SHADER_DISPLAY_NAMES.surface)).toBeInTheDocument();
  });

  it('should show only one shader as selected at a time', () => {
    render(<ShaderSelector />);

    // Initially surface is selected
    const surfaceButton = screen.getByTestId('shader-option-surface');
    const wireframeButton = screen.getByTestId('shader-option-wireframe');

    expect(surfaceButton).toHaveClass('bg-accent/20');
    expect(wireframeButton).not.toHaveClass('bg-accent/20');

    // Click wireframe
    fireEvent.click(wireframeButton);

    // Now only wireframe should be highlighted
    expect(surfaceButton).not.toHaveClass('bg-accent/20');
    expect(wireframeButton).toHaveClass('bg-accent/20');
  });

  it('should have proper ARIA labels for accessibility', () => {
    render(<ShaderSelector />);

    expect(screen.getByLabelText('Select Wireframe shader')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Dual Outline shader')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Surface shader')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<ShaderSelector className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render color indicators for each shader', () => {
    render(<ShaderSelector />);

    // Each shader button should have a colored circle indicator
    const buttons = screen.getAllByRole('button');

    buttons.forEach((button) => {
      // Each button should have a span with background color (the color indicator)
      const colorIndicator = button.querySelector('span[aria-hidden="true"]');
      expect(colorIndicator).toBeInTheDocument();
      expect(colorIndicator).toHaveClass('rounded-full');
    });
  });

  it('should reflect initial shader type from store', () => {
    // Set a non-default shader type before rendering
    useVisualStore.getState().setShaderType('surface');

    render(<ShaderSelector />);

    const surfaceButton = screen.getByTestId('shader-option-surface');
    expect(surfaceButton).toHaveClass('bg-accent/20');
    expect(surfaceButton).toHaveClass('text-accent');
  });

  it('should render all three shader options', () => {
    render(<ShaderSelector />);

    // Should have exactly 3 shader buttons
    const shaderButtons = screen.getAllByRole('button');
    expect(shaderButtons).toHaveLength(3);
  });
});
