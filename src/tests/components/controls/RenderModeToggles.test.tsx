/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenderModeToggles } from '@/components/controls/RenderModeToggles';
import { useVisualStore } from '@/stores/visualStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('RenderModeToggles', () => {
  beforeEach(() => {
    // Reset stores before each test
    useVisualStore.getState().reset();
    useGeometryStore.getState().reset();
  });

  describe('Initial Display', () => {
    it('should render two toggle buttons: Edges, Faces', () => {
      render(<RenderModeToggles />);

      expect(screen.getByText('Edges')).toBeInTheDocument();
      expect(screen.getByText('Faces')).toBeInTheDocument();
    });

    it('should display all toggles in a row', () => {
      render(<RenderModeToggles />);

      const container = screen.getByTestId('render-mode-toggles');
      expect(container).toHaveClass('flex');
    });

    it('should apply custom className', () => {
      render(<RenderModeToggles className="custom-class" />);

      const container = screen.getByTestId('render-mode-toggles');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Edges Toggle', () => {
    it('should toggle edges visibility when clicked', async () => {
      const user = userEvent.setup();
      render(<RenderModeToggles />);

      const edgesToggle = screen.getByTestId('toggle-edges');

      // Initially visible (default)
      expect(useVisualStore.getState().edgesVisible).toBe(true);

      // Click to hide
      await user.click(edgesToggle);
      expect(useVisualStore.getState().edgesVisible).toBe(false);

      // Click to show again
      await user.click(edgesToggle);
      expect(useVisualStore.getState().edgesVisible).toBe(true);
    });

    it('should have correct aria-label', () => {
      render(<RenderModeToggles />);

      const edgesToggle = screen.getByTestId('toggle-edges');
      expect(edgesToggle).toHaveAttribute('aria-label', 'Toggle edge visibility');
    });
  });

  describe('Faces Toggle', () => {
    it('should toggle faces visibility when clicked', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setFacesVisible(false);
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');

      // Click to toggle on
      await user.click(facesToggle);
      expect(useVisualStore.getState().facesVisible).toBe(true);

      // Click to toggle off again
      await user.click(facesToggle);
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });

    it('should auto-set shaderType to surface when faces enabled', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setFacesVisible(false);
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');

      // Enable faces
      await user.click(facesToggle);
      expect(useVisualStore.getState().shaderType).toBe('surface');
    });

    it('should auto-set shaderType to wireframe when faces disabled', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setFacesVisible(true);
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');

      // Disable faces
      await user.click(facesToggle);
      expect(useVisualStore.getState().shaderType).toBe('wireframe');
    });

    it('should have correct aria-label', () => {
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).toHaveAttribute('aria-label', 'Toggle face visibility');
    });
  });

  describe('Object Compatibility for Faces', () => {
    it('should enable faces toggle for hypercube', () => {
      useGeometryStore.getState().setObjectType('hypercube');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).not.toBeDisabled();
    });

    it('should enable faces toggle for simplex', () => {
      useGeometryStore.getState().setObjectType('simplex');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).not.toBeDisabled();
    });

    it('should enable faces toggle for cross-polytope', () => {
      useGeometryStore.getState().setObjectType('cross-polytope');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).not.toBeDisabled();
    });

    it('should enable faces toggle for root-system', () => {
      useGeometryStore.getState().setObjectType('root-system');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).not.toBeDisabled();
    });

    it('should enable faces toggle for clifford-torus', () => {
      // Set dimension to 4 (required for clifford-torus)
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('clifford-torus');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).not.toBeDisabled();
    });

    it('should enable faces toggle for mandelbrot (raymarching mode)', () => {
      useGeometryStore.getState().setDimension(3);
      useGeometryStore.getState().setObjectType('mandelbrot');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).not.toBeDisabled();
    });

    it('should not show tooltip when faces toggle is enabled', () => {
      useGeometryStore.getState().setObjectType('hypercube');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      const wrapper = facesToggle.closest('div');
      // When faces are supported, the wrapper div should not have a title attribute
      expect(wrapper?.getAttribute('title')).toBeNull();
    });

  });

  describe('Render Mode Fallback', () => {
    it('should auto-enable edges when all render modes are manually disabled', async () => {
      useGeometryStore.getState().setObjectType('hypercube');

      const { rerender } = render(<RenderModeToggles />);

      // Manually disable all modes via store
      act(() => {
        useVisualStore.getState().setEdgesVisible(false);
        useVisualStore.getState().setFacesVisible(false);
      });
      rerender(<RenderModeToggles />);

      // At least one mode must be active - edges should auto-enable
      expect(useVisualStore.getState().edgesVisible).toBe(true);
    });

    it('should not auto-enable edges if at least one mode is already active', async () => {
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setEdgesVisible(false);
      useVisualStore.getState().setFacesVisible(true);

      render(<RenderModeToggles />);

      // Faces is ON, so edges should not auto-enable
      expect(useVisualStore.getState().edgesVisible).toBe(false);
      expect(useVisualStore.getState().facesVisible).toBe(true);
    });
  });

  describe('Toggle State Persistence', () => {
    it('should persist edges toggle state across rerenders', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setEdgesVisible(true);
      const { rerender } = render(<RenderModeToggles />);

      const edgesToggle = screen.getByTestId('toggle-edges');
      await user.click(edgesToggle);

      expect(useVisualStore.getState().edgesVisible).toBe(false);

      rerender(<RenderModeToggles />);

      expect(useVisualStore.getState().edgesVisible).toBe(false);
    });

    it('should persist faces toggle state across rerenders', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setFacesVisible(false);
      const { rerender } = render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      await user.click(facesToggle);

      expect(useVisualStore.getState().facesVisible).toBe(true);

      rerender(<RenderModeToggles />);

      expect(useVisualStore.getState().facesVisible).toBe(true);
    });
  });
});
