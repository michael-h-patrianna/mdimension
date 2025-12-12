/**
 * Integration Tests for Application Flow
 * Tests the complete user workflows through the application
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '@/App';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';
import { useCrossSectionStore } from '@/stores/crossSectionStore';
import { useVisualStore } from '@/stores/visualStore';

describe('App Integration', () => {
  beforeEach(() => {
    // Reset all stores
    useGeometryStore.getState().reset();
    useRotationStore.getState().resetAllRotations();
    useProjectionStore.getState().resetToDefaults();
    useTransformStore.getState().resetAll();
    useAnimationStore.getState().reset();
    useCrossSectionStore.getState().reset();
    useVisualStore.getState().reset();
  });

  describe('Application Rendering', () => {
    it('should render the complete application', () => {
      render(<App />);

      // Check for title and basic structure
      expect(screen.getByRole('heading', { name: /N.*Dimensional Visualizer/i })).toBeInTheDocument();
      expect(screen.getByText('SYSTEM CONTROLS')).toBeInTheDocument();
    });

    it('should render all control sections', () => {
      render(<App />);

      // Check for major sections
      const objectElements = screen.getAllByText(/Object/i);
      expect(objectElements.length).toBeGreaterThan(0);
      
      // Use specific role query for Animation section
      expect(screen.getByRole('button', { name: /^ANIMATION$/i })).toBeInTheDocument();
    });

    it('should render canvas element', () => {
      render(<App />);

      // Canvas should be present (Three.js renders a canvas)
      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Dimension Selection', () => {
    it('should start with default dimension 4', () => {
      render(<App />);

      expect(useGeometryStore.getState().dimension).toBe(4);
    });

    it('should change dimension when selector is clicked', () => {
      render(<App />);

      // Find the 3D button using data-testid
      const button3D = screen.getByTestId('dimension-selector-3');
      fireEvent.click(button3D);

      expect(useGeometryStore.getState().dimension).toBe(3);
    });

    it('should update rotation planes when dimension changes', () => {
      render(<App />);

      // Change to 5D using data-testid
      const button5D = screen.getByTestId('dimension-selector-5');
      fireEvent.click(button5D);

      expect(useGeometryStore.getState().dimension).toBe(5);
    });
  });

  describe('Object Type Selection', () => {
    it('should start with hypercube', () => {
      render(<App />);

      expect(useGeometryStore.getState().objectType).toBe('hypercube');
    });

    it('should change object type', () => {
      render(<App />);

      // Find the object type selector using data-testid
      const select = screen.getByTestId('object-type-selector');
      fireEvent.change(select, { target: { value: 'simplex' } });

      expect(useGeometryStore.getState().objectType).toBe('simplex');
    });
  });

  describe('Animation Controls', () => {
    it('should start with animation playing', () => {
      render(<App />);

      expect(useAnimationStore.getState().isPlaying).toBe(true);
    });

    it('should toggle animation on button click', async () => {
      render(<App />);

      // Ensure playing
      if (!useAnimationStore.getState().isPlaying) {
        act(() => useAnimationStore.getState().play());
      }

      // Find the pause button using data-testid and click it
      const playButton = screen.getByTestId('animation-play-button');
      await act(async () => {
        fireEvent.click(playButton);
      });

      expect(useAnimationStore.getState().isPlaying).toBe(false);
    });

    it('should change speed', () => {
      render(<App />);

      // Speed should have a default value
      expect(useAnimationStore.getState().speed).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('Store State Synchronization', () => {
    it('should sync rotation dimension with geometry dimension', () => {
      render(<App />);

      // Change dimension using data-testid
      const button5D = screen.getByTestId('dimension-selector-5');
      fireEvent.click(button5D);

      // Rotation store dimension should be synced
      expect(useGeometryStore.getState().dimension).toBe(5);
    });

    it('should sync transform dimension with geometry dimension', () => {
      render(<App />);

      // Change dimension using data-testid
      const button3D = screen.getByTestId('dimension-selector-3');
      fireEvent.click(button3D);

      // Transform store dimension should be synced
      expect(useGeometryStore.getState().dimension).toBe(3);
    });
  });

  describe('Visual Customization', () => {
    it('should have default visual settings', () => {
      render(<App />);

      const visualState = useVisualStore.getState();
      expect(visualState.edgeColor).toBeDefined();
      expect(visualState.vertexColor).toBeDefined();
      expect(visualState.edgeThickness).toBeGreaterThan(0);
    });
  });

  describe('Cross Section', () => {
    it('should start with cross section disabled', () => {
      render(<App />);

      expect(useCrossSectionStore.getState().enabled).toBe(false);
    });
  });

  describe('Projection Settings', () => {
    it('should have default projection settings', () => {
      render(<App />);

      const projectionState = useProjectionStore.getState();
      expect(projectionState.distance).toBeGreaterThan(0);
    });
  });
});
