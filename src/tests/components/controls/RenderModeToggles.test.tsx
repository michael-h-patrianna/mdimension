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
    it('should render three toggle buttons: Vertices, Edges, Faces', () => {
      render(<RenderModeToggles />);

      expect(screen.getByText('Vertices')).toBeInTheDocument();
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

  describe('Vertices Toggle', () => {
    it('should toggle vertices visibility when clicked', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setVertexVisible(true);
      render(<RenderModeToggles />);

      const verticesToggle = screen.getByTestId('toggle-vertices');

      // Click to toggle off
      await user.click(verticesToggle);
      expect(useVisualStore.getState().vertexVisible).toBe(false);

      // Click to toggle on again
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

    it('should disable faces toggle for hypersphere', () => {
      useGeometryStore.getState().setObjectType('hypersphere');
      render(<RenderModeToggles />);

      const facesToggle = screen.getByTestId('toggle-faces');
      expect(facesToggle).toBeDisabled();
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
      // Start with hypercube and faces ON
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setFacesVisible(true);

      const { rerender } = render(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(true);

      // Switch to hypersphere (incompatible)
      act(() => {
        useGeometryStore.getState().setObjectType('hypersphere');
      });
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
      act(() => {
        useGeometryStore.getState().setObjectType('hypersphere');
      });
      rerender(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(false);

      // Switch back to hypercube (compatible) - faces should restore
      act(() => {
        useGeometryStore.getState().setObjectType('hypercube');
      });
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
      act(() => {
        useGeometryStore.getState().setObjectType('hypersphere');
      });
      rerender(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(false);

      // Switch back to hypercube - faces should stay OFF (user's manual choice)
      act(() => {
        useGeometryStore.getState().setObjectType('hypercube');
      });
      rerender(<RenderModeToggles />);
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });
  });

  describe('Mandelbrot Mutual Exclusivity', () => {
    it('should disable faces when switching to mandelbrot 3D+ with both vertices and faces enabled', async () => {
      // Start with hypercube dimension 4 with both vertices and faces ON
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setVertexVisible(true);
      useVisualStore.getState().setFacesVisible(true);

      const { rerender } = render(<RenderModeToggles />);
      expect(useVisualStore.getState().vertexVisible).toBe(true);
      expect(useVisualStore.getState().facesVisible).toBe(true);

      // Switch to mandelbrot (3D+)
      act(() => {
        useGeometryStore.getState().setObjectType('mandelbrot');
      });
      rerender(<RenderModeToggles />);

      // Vertices should stay ON, faces should be auto-disabled (mutual exclusivity)
      expect(useVisualStore.getState().vertexVisible).toBe(true);
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });

    it('should keep faces enabled when switching to mandelbrot 3D+ with only faces enabled', async () => {
      // Start with hypercube with only faces ON
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setVertexVisible(false);
      useVisualStore.getState().setFacesVisible(true);
      useVisualStore.getState().setEdgesVisible(false);

      const { rerender } = render(<RenderModeToggles />);

      // Switch to mandelbrot
      act(() => {
        useGeometryStore.getState().setObjectType('mandelbrot');
      });
      rerender(<RenderModeToggles />);

      // Faces should stay ON since vertices are OFF (no conflict)
      expect(useVisualStore.getState().facesVisible).toBe(true);
      expect(useVisualStore.getState().vertexVisible).toBe(false);
    });

    it('should disable vertices when enabling faces for mandelbrot 3D+', async () => {
      const user = userEvent.setup();

      useGeometryStore.getState().setDimension(3);
      useGeometryStore.getState().setObjectType('mandelbrot');
      useVisualStore.getState().setVertexVisible(true);
      useVisualStore.getState().setFacesVisible(false);

      render(<RenderModeToggles />);

      // Enable faces
      const facesToggle = screen.getByTestId('toggle-faces');
      await user.click(facesToggle);

      // Faces ON should disable vertices (mutual exclusivity)
      expect(useVisualStore.getState().facesVisible).toBe(true);
      expect(useVisualStore.getState().vertexVisible).toBe(false);
    });

    it('should disable faces when enabling vertices for mandelbrot 3D+', async () => {
      const user = userEvent.setup();

      useGeometryStore.getState().setDimension(3);
      useGeometryStore.getState().setObjectType('mandelbrot');
      useVisualStore.getState().setVertexVisible(false);
      useVisualStore.getState().setFacesVisible(true);

      render(<RenderModeToggles />);

      // Enable vertices
      const verticesToggle = screen.getByTestId('toggle-vertices');
      await user.click(verticesToggle);

      // Vertices ON should disable faces (mutual exclusivity)
      expect(useVisualStore.getState().vertexVisible).toBe(true);
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });

    it('should not enforce mutual exclusivity for non-mandelbrot objects', async () => {
      const user = userEvent.setup();

      // Hypercube doesn't have mutual exclusivity
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setVertexVisible(true);
      useVisualStore.getState().setFacesVisible(false);

      render(<RenderModeToggles />);

      // Enable faces - both should be allowed for hypercube
      const facesToggle = screen.getByTestId('toggle-faces');
      await user.click(facesToggle);

      // Both can be ON for non-mandelbrot objects
      expect(useVisualStore.getState().facesVisible).toBe(true);
      expect(useVisualStore.getState().vertexVisible).toBe(true);
    });
  });

  describe('Render Mode Fallback', () => {
    it('should auto-enable vertices when switching to mandelbrot with only edges enabled', async () => {
      // Start with hypercube with only edges ON
      useGeometryStore.getState().setDimension(4);
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setVertexVisible(false);
      useVisualStore.getState().setEdgesVisible(true);
      useVisualStore.getState().setFacesVisible(false);

      const { rerender } = render(<RenderModeToggles />);
      expect(useVisualStore.getState().edgesVisible).toBe(true);
      expect(useVisualStore.getState().vertexVisible).toBe(false);
      expect(useVisualStore.getState().facesVisible).toBe(false);

      // Switch to mandelbrot (edges not supported)
      act(() => {
        useGeometryStore.getState().setObjectType('mandelbrot');
      });
      rerender(<RenderModeToggles />);

      // Edges should be auto-disabled, vertices should auto-enable as fallback
      expect(useVisualStore.getState().edgesVisible).toBe(false);
      expect(useVisualStore.getState().vertexVisible).toBe(true);
    });

    it('should auto-enable vertices when all render modes are manually disabled', async () => {
      useGeometryStore.getState().setObjectType('hypercube');

      const { rerender } = render(<RenderModeToggles />);

      // Manually disable all modes via store
      act(() => {
        useVisualStore.getState().setVertexVisible(false);
        useVisualStore.getState().setEdgesVisible(false);
        useVisualStore.getState().setFacesVisible(false);
      });
      rerender(<RenderModeToggles />);

      // At least one mode must be active - vertices should auto-enable
      expect(useVisualStore.getState().vertexVisible).toBe(true);
    });

    it('should not auto-enable vertices if at least one mode is already active', async () => {
      useGeometryStore.getState().setObjectType('hypercube');
      useVisualStore.getState().setVertexVisible(false);
      useVisualStore.getState().setEdgesVisible(false);
      useVisualStore.getState().setFacesVisible(true);

      render(<RenderModeToggles />);

      // Faces is ON, so vertices should not auto-enable
      expect(useVisualStore.getState().vertexVisible).toBe(false);
      expect(useVisualStore.getState().facesVisible).toBe(true);
    });
  });

  describe('Toggle State Persistence', () => {
    it('should persist vertices toggle state across rerenders', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setVertexVisible(true);
      const { rerender } = render(<RenderModeToggles />);

      const verticesToggle = screen.getByTestId('toggle-vertices');
      await user.click(verticesToggle);

      expect(useVisualStore.getState().vertexVisible).toBe(false);

      rerender(<RenderModeToggles />);

      expect(useVisualStore.getState().vertexVisible).toBe(false);
    });

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
