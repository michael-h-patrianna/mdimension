/**
 * Tests for ShadowsSection component
 *
 * Tests centralized shadow controls for all object types:
 * - Basic rendering and no-lights state
 * - Object type switching (SDF, Volumetric, Polytope)
 * - Shadow toggle behavior
 * - Disabled state styling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShadowsSection } from '@/components/sections/Shadows/ShadowsSection';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { LIGHTING_INITIAL_STATE } from '@/stores/slices/lightingSlice';
import type { LightSource } from '@/rendering/lights/types';

/**
 * Helper to create lighting state with at least one enabled light
 */
function createLightsWithOneEnabled(): LightSource[] {
  const lights = LIGHTING_INITIAL_STATE.lights;
  // Enable the first light
  return lights.map((light, index) =>
    index === 0 ? { ...light, enabled: true } : light
  );
}

describe('ShadowsSection', () => {
  beforeEach(() => {
    // Reset stores before each test
    useGeometryStore.getState().reset();
    useExtendedObjectStore.getState().reset();
    useLightingStore.setState(LIGHTING_INITIAL_STATE);
  });

  describe('Basic Rendering', () => {
    it('should render section with correct title and data-testid', () => {
      render(<ShadowsSection defaultOpen />);
      expect(screen.getByTestId('section-shadows')).toBeInTheDocument();
      expect(screen.getByText('Shadows')).toBeInTheDocument();
    });

    it('should show "Add lights to enable shadows" message when no lights enabled', () => {
      // Disable all lights
      useLightingStore.setState({
        ...LIGHTING_INITIAL_STATE,
        lights: LIGHTING_INITIAL_STATE.lights.map((light) => ({
          ...light,
          enabled: false,
        })),
      });

      render(<ShadowsSection defaultOpen />);
      expect(screen.getByText('Add lights to enable shadows.')).toBeInTheDocument();
    });

    it('should show shadow controls when lights are enabled', () => {
      useLightingStore.setState({
        ...LIGHTING_INITIAL_STATE,
        lights: createLightsWithOneEnabled(),
      });

      render(<ShadowsSection defaultOpen />);
      expect(screen.getByTestId('shadow-enabled-toggle')).toBeInTheDocument();
      expect(screen.getByText('Enable Shadows')).toBeInTheDocument();
    });

    it('should accept defaultOpen prop for expansion state', () => {
      useLightingStore.setState({
        ...LIGHTING_INITIAL_STATE,
        lights: createLightsWithOneEnabled(),
      });

      // Test with defaultOpen=true - should be expanded
      render(<ShadowsSection defaultOpen={true} />);
      expect(screen.getByTestId('section-shadows')).toBeInTheDocument();
      const header = screen.getByTestId('section-shadows-header');
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Object Type Switching', () => {
    beforeEach(() => {
      // Enable lights for all object type tests
      useLightingStore.setState({
        ...LIGHTING_INITIAL_STATE,
        lights: createLightsWithOneEnabled(),
      });
    });

    it('should show SDF controls (Quality, Softness) for mandelbulb', () => {
      useGeometryStore.getState().setObjectType('mandelbulb');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.getByText('Raymarched Shadows')).toBeInTheDocument();
      expect(screen.getByTestId('shadow-quality-select')).toBeInTheDocument();
      expect(screen.getByTestId('shadow-softness-slider')).toBeInTheDocument();
      expect(screen.getByText(/SDF Raymarched/)).toBeInTheDocument();
    });

    it('should show SDF controls for quaternion-julia', () => {
      useGeometryStore.getState().setObjectType('quaternion-julia');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.getByText('Raymarched Shadows')).toBeInTheDocument();
      expect(screen.getByTestId('shadow-quality-select')).toBeInTheDocument();
      expect(screen.getByTestId('shadow-softness-slider')).toBeInTheDocument();
    });

    it('should show Volumetric controls (Strength, Steps) for schroedinger', () => {
      useGeometryStore.getState().setObjectType('schroedinger');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.getByText('Volumetric Self-Shadowing')).toBeInTheDocument();
      expect(screen.getByTestId('schroedinger-shadow-strength')).toBeInTheDocument();
      expect(screen.getByTestId('schroedinger-shadow-steps')).toBeInTheDocument();
      expect(screen.getByText(/Volumetric \(Schrödinger\)/)).toBeInTheDocument();
    });

    it('should show Shadow Map controls (Bias, Blur) for polytope', () => {
      useGeometryStore.getState().setObjectType('wythoff-polytope');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.getByText('Shadow Map Settings')).toBeInTheDocument();
      expect(screen.getByTestId('shadow-map-bias')).toBeInTheDocument();
      expect(screen.getByTestId('shadow-map-blur')).toBeInTheDocument();
      expect(screen.getByText(/Shadow Maps/)).toBeInTheDocument();
    });

    it('should not show SDF controls when object is schroedinger', () => {
      useGeometryStore.getState().setObjectType('schroedinger');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.queryByText('Raymarched Shadows')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shadow-quality-select')).not.toBeInTheDocument();
    });

    it('should not show Volumetric controls when object is mandelbulb', () => {
      useGeometryStore.getState().setObjectType('mandelbulb');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.queryByText('Volumetric Self-Shadowing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('schroedinger-shadow-strength')).not.toBeInTheDocument();
    });

    it('should not show Shadow Map controls when object is SDF fractal', () => {
      useGeometryStore.getState().setObjectType('mandelbulb');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.queryByText('Shadow Map Settings')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shadow-map-bias')).not.toBeInTheDocument();
    });
  });

  describe('Shadow Toggle Behavior', () => {
    beforeEach(() => {
      // Enable lights
      useLightingStore.setState({
        ...LIGHTING_INITIAL_STATE,
        lights: createLightsWithOneEnabled(),
        shadowEnabled: false,
      });
    });

    it('should toggle global shadowEnabled for SDF fractals', () => {
      useGeometryStore.getState().setObjectType('mandelbulb');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      const toggle = screen.getByTestId('shadow-enabled-toggle');
      expect(useLightingStore.getState().shadowEnabled).toBe(false);

      fireEvent.click(toggle);
      expect(useLightingStore.getState().shadowEnabled).toBe(true);
    });

    it('should toggle schroedingerShadowsEnabled for schroedinger', () => {
      useGeometryStore.getState().setObjectType('schroedinger');
      useGeometryStore.getState().setDimension(4);
      useExtendedObjectStore.getState().setSchroedingerShadowsEnabled(false);

      render(<ShadowsSection defaultOpen />);

      const toggle = screen.getByTestId('shadow-enabled-toggle');
      expect(useExtendedObjectStore.getState().schroedinger.shadowsEnabled).toBe(false);

      fireEvent.click(toggle);
      expect(useExtendedObjectStore.getState().schroedinger.shadowsEnabled).toBe(true);
    });

    it('should toggle global shadowEnabled for polytopes', () => {
      useGeometryStore.getState().setObjectType('wythoff-polytope');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      const toggle = screen.getByTestId('shadow-enabled-toggle');
      expect(useLightingStore.getState().shadowEnabled).toBe(false);

      fireEvent.click(toggle);
      expect(useLightingStore.getState().shadowEnabled).toBe(true);
    });
  });

  describe('Disabled State', () => {
    beforeEach(() => {
      // Enable lights
      useLightingStore.setState({
        ...LIGHTING_INITIAL_STATE,
        lights: createLightsWithOneEnabled(),
        shadowEnabled: false,
      });
    });

    it('should show disabled styling when shadows are off for SDF fractals', () => {
      useGeometryStore.getState().setObjectType('mandelbulb');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      // Find the container with disabled styling
      const settingsContainer = screen.getByTestId('shadow-animation-mode-select').closest('.space-y-4');
      expect(settingsContainer).toHaveClass('opacity-50');
      expect(settingsContainer).toHaveClass('pointer-events-none');
    });

    it('should remove disabled styling when shadows are enabled', () => {
      useGeometryStore.getState().setObjectType('mandelbulb');
      useGeometryStore.getState().setDimension(4);
      useLightingStore.setState({
        ...useLightingStore.getState(),
        shadowEnabled: true,
      });

      render(<ShadowsSection defaultOpen />);

      const settingsContainer = screen.getByTestId('shadow-animation-mode-select').closest('.space-y-4');
      expect(settingsContainer).not.toHaveClass('opacity-50');
      expect(settingsContainer).not.toHaveClass('pointer-events-none');
    });

    it('should show disabled styling for schroedinger when shadows are off', () => {
      useGeometryStore.getState().setObjectType('schroedinger');
      useGeometryStore.getState().setDimension(4);
      useExtendedObjectStore.getState().setSchroedingerShadowsEnabled(false);

      render(<ShadowsSection defaultOpen />);

      const settingsContainer = screen.getByTestId('shadow-animation-mode-select').closest('.space-y-4');
      expect(settingsContainer).toHaveClass('opacity-50');
    });
  });

  describe('Animation Mode Control', () => {
    beforeEach(() => {
      useLightingStore.setState({
        ...LIGHTING_INITIAL_STATE,
        lights: createLightsWithOneEnabled(),
        shadowEnabled: true,
      });
    });

    it('should render animation mode select for all object types', () => {
      useGeometryStore.getState().setObjectType('mandelbulb');
      useGeometryStore.getState().setDimension(4);

      render(<ShadowsSection defaultOpen />);

      expect(screen.getByTestId('shadow-animation-mode-select')).toBeInTheDocument();
      expect(screen.getByText('Animation Quality')).toBeInTheDocument();
    });
  });
});
