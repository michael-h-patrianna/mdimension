/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    it('should render three toggle buttons: Vertices, Edges, Faces', () => {
      render(<RenderModeToggles />);

      expect(screen.getByText('Vertices')).toBeInTheDocument();
      expect(screen.getByText('Edges')).toBeInTheDocument();
      expect(screen.getByText('Faces')).toBeInTheDocument();
    });

    it('should have correct default toggle states: Vertices ON, Edges ON, Faces OFF', () => {
      render(<RenderModeToggles />);

      // Check store state
      expect(useVisualStore.getState().vertexVisible).toBe(true);
      expect(useVisualStore.getState().edgesVisible).toBe(true);
      expect(useVisualStore.getState().facesVisible).toBe(false);
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

  describe('Vertices Toggle', () => {
    it('should toggle vertices visibility when clicked', async () => {
      const user = userEvent.setup();
      render(<RenderModeToggles />);

      const verticesToggle = screen.getByTestId('toggle-vertices');

      // Initially visible (default)
      expect(useVisualStore.getState().vertexVisible).toBe(true);

      // Click to hide
      await user.click(verticesToggle);
      expect(useVisualStore.getState().vertexVisible).toBe(false);

      // Click to show again
      await user.click(verticesToggle);
      expect(useVisualStore.getState().vertexVisible).toBe(true);
    });

    it('should have correct aria-label', () => {
      render(<RenderModeToggles />);

      const verticesToggle = screen.getByTestId('toggle-vertices');
      expect(verticesToggle).toHaveAttribute('aria-label', 'Toggle vertex visibility');
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
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');

      // Initially hidden (default)
      expect(useVisualStore.getState().facesVisible).toBe(false);

      // Click to show
      await user.click(facesToggle);
      expect(useVisualStore.getState().facesVisible).toBe(true);

      // Click to hide again
      await user.click(facesToggle);
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });

    it('should auto-set shaderType to surface when faces enabled', async () => {
      const user = userEvent.setup();
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');

      // Enable faces
      await user.click(facesToggle);
      expect(useVisualStore.getState().shaderType).toBe('surface');
    });

    it('should auto-set shaderType to wireframe when faces disabled', async () => {
      const user = userEvent.setup();
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');

      // Enable faces first
      await user.click(facesToggle);
      expect(useVisualStore.getState().shaderType).toBe('surface');

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

    it('should disable faces toggle for hypersphere', () => {
      useGeometryStore.getState().setObjectType('hypersphere');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).toBeDisabled();
    });

    it('should disable faces toggle for clifford-torus', () => {
      // Set dimension to 4 (required for clifford-torus)
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('clifford-torus');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).toBeDisabled();
    });

    it('should disable faces toggle for mandelbrot', () => {
      useGeometryStore.getState().setObjectType('mandelbrot');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).toBeDisabled();
    });

    it('should show tooltip when faces toggle is disabled', () => {
      useGeometryStore.getState().setObjectType('hypersphere');
      render(<RenderModeToggles />);

      // The wrapper div should have the title attribute
      const facesToggle = screen.getByTestId('toggle-faces');
      const wrapper = facesToggle.closest('div[title]');
      expect(wrapper).toHaveAttribute('title', 'Faces not available for this object type');
    });

    it('should not show tooltip when faces toggle is enabled', () => {
      useGeometryStore.getState().setObjectType('hypercube');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      const wrapper = facesToggle.closest('div');
      // When faces are supported, the wrapper div should not have a title attribute
      expect(wrapper?.getAttribute('title')).toBeNull();
    });

    it('should auto-disable faces when switching to incompatible object', async () => {
      const user = userEvent.setup();
      // Start with hypercube and faces ON
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setFacesVisible(true);

      const { rerender } = render(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(true);

      // Switch to hypersphere (incompatible)
      useGeometryStore.getState().setObjectType('hypersphere');
      rerender(<RenderModeToggles />);

      // Faces should be auto-disabled
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });

    it('should auto-restore faces when switching back to compatible object', async () => {
      // Start with hypercube and faces ON
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setFacesVisible(true);

      const { rerender } = render(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(true);

      // Switch to hypersphere (incompatible) - faces auto-disabled
      useGeometryStore.getState().setObjectType('hypersphere');
      rerender(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(false);

      // Switch back to hypercube (compatible) - faces should restore
      useGeometryStore.getState().setObjectType('hypercube');
      rerender(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(true);
    });

    it('should not auto-restore faces if they were manually off before switch', async () => {
      // Start with hypercube and faces OFF (manual choice)
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setFacesVisible(false);

      const { rerender } = render(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(false);

      // Switch to hypersphere (incompatible)
      useGeometryStore.getState().setObjectType('hypersphere');
      rerender(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(false);

      // Switch back to hypercube - faces should stay OFF (user's manual choice)
      useGeometryStore.getState().setObjectType('hypercube');
      rerender(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });
  });

  describe('Toggle State Persistence', () => {
    it('should persist vertices toggle state across rerenders', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<RenderModeToggles />);

      const verticesToggle = screen.getByTestId('toggle-vertices');
      await user.click(verticesToggle);

      expect(useVisualStore.getState().vertexVisible).toBe(false);

      rerender(<RenderModeToggles />);

      expect(useVisualStore.getState().vertexVisible).toBe(false);
    });

    it('should persist edges toggle state across rerenders', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<RenderModeToggles />);

      const edgesToggle = screen.getByTestId('toggle-edges');
      await user.click(edgesToggle);

      expect(useVisualStore.getState().edgesVisible).toBe(false);

      rerender(<RenderModeToggles />);

      expect(useVisualStore.getState().edgesVisible).toBe(false);
    });

    it('should persist faces toggle state across rerenders', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      await user.click(facesToggle);

      expect(useVisualStore.getState().facesVisible).toBe(true);

      rerender(<RenderModeToggles />);

      expect(useVisualStore.getState().facesVisible).toBe(true);
    });
  });
});
