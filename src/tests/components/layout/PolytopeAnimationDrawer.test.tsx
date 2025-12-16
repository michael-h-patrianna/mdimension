/**
 * PolytopeAnimationDrawer Component Tests
 *
 * Tests for the polytope animation controls drawer in TimelineControls.
 * Tests cover the three organic animation systems: Pulse, Flow, and Ripple.
 *
 * Organic Animation System:
 * - Pulse: Gentle breathing effect using layered sine waves
 * - Flow: Organic vertex drift creating flowing deformation
 * - Ripple: Smooth radial waves emanating from center
 *
 * @see src/components/layout/TimelineControls/PolytopeAnimationDrawer.tsx
 */

import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PolytopeAnimationDrawer } from '@/components/layout/TimelineControls/PolytopeAnimationDrawer';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { DEFAULT_POLYTOPE_CONFIG } from '@/lib/geometry/extended/types';

describe('PolytopeAnimationDrawer', () => {
  beforeEach(() => {
    // Reset store to defaults
    useExtendedObjectStore.setState({
      polytope: { ...DEFAULT_POLYTOPE_CONFIG },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all animation panels', () => {
    render(<PolytopeAnimationDrawer />);

    // Check for all animation panels (Pulse, Flow, Ripple)
    expect(screen.getByTestId('animation-panel-facetOffset')).toBeDefined();
    expect(screen.getByTestId('animation-panel-dualMorph')).toBeDefined();
    expect(screen.getByTestId('animation-panel-explode')).toBeDefined();
  });

  it('renders drawer container with correct test id', () => {
    render(<PolytopeAnimationDrawer />);
    expect(screen.getByTestId('polytope-animation-drawer')).toBeDefined();
  });

  describe('Pulse Animation (organic breathing)', () => {
    it('toggles pulse animation on/off', () => {
      render(<PolytopeAnimationDrawer />);

      const toggleButton = screen.getByRole('button', { name: /toggle pulse animation/i });
      expect(toggleButton.textContent).toBe('OFF');

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(true);

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(false);
    });

    it('updates pulse intensity', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const intensitySlider = screen.getByLabelText('Pulse intensity');
      fireEvent.change(intensitySlider, { target: { value: '0.5' } });

      expect(useExtendedObjectStore.getState().polytope.facetOffsetAmplitude).toBe(0.5);
    });
  });

  describe('Flow Animation (organic vertex drift)', () => {
    it('toggles flow animation on/off', () => {
      render(<PolytopeAnimationDrawer />);

      const toggleButton = screen.getByRole('button', { name: /toggle flow animation/i });
      expect(toggleButton.textContent).toBe('OFF');

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.dualMorphEnabled).toBe(true);

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.dualMorphEnabled).toBe(false);
    });

    it('updates flow intensity', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, dualMorphEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const intensitySlider = screen.getByLabelText('Flow intensity');
      fireEvent.change(intensitySlider, { target: { value: '0.5' } });

      expect(useExtendedObjectStore.getState().polytope.dualMorphT).toBe(0.5);
    });
  });

  describe('Ripple Animation (smooth radial waves)', () => {
    it('toggles ripple animation on/off', () => {
      render(<PolytopeAnimationDrawer />);

      const toggleButton = screen.getByRole('button', { name: /toggle ripple animation/i });
      expect(toggleButton.textContent).toBe('OFF');

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.explodeEnabled).toBe(true);

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.explodeEnabled).toBe(false);
    });

    it('updates ripple intensity', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, explodeEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const intensitySlider = screen.getByLabelText('Ripple intensity');
      fireEvent.change(intensitySlider, { target: { value: '0.7' } });

      expect(useExtendedObjectStore.getState().polytope.explodeMax).toBe(0.7);
    });
  });

  describe('Control disabling', () => {
    it('disables pulse controls when animation is off', () => {
      render(<PolytopeAnimationDrawer />);

      // When pulse is disabled, the controls should have opacity-50 and pointer-events-none
      const pulsePanel = screen.getByTestId('animation-panel-facetOffset');
      const controlsContainer = pulsePanel.querySelector('.space-y-3:last-child');

      expect(controlsContainer?.className).toContain('opacity-50');
      expect(controlsContainer?.className).toContain('pointer-events-none');
    });

    it('enables pulse controls when animation is on', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const pulsePanel = screen.getByTestId('animation-panel-facetOffset');
      const controlsContainer = pulsePanel.querySelector('.space-y-3:last-child');

      expect(controlsContainer?.className).not.toContain('opacity-50');
    });
  });
});
