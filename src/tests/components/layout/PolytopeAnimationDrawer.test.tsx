/**
 * PolytopeAnimationDrawer Component Tests
 *
 * Tests for the polytope animation controls drawer in TimelineControls.
 * Tests cover the radial breathing modulation with amplitude, frequency, wave, and bias controls.
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

  it('renders modulation panel', () => {
    render(<PolytopeAnimationDrawer />);

    // Check for modulation panel
    expect(screen.getByTestId('animation-panel-modulation')).toBeDefined();
  });

  it('renders drawer container with correct test id', () => {
    render(<PolytopeAnimationDrawer />);
    expect(screen.getByTestId('polytope-animation-drawer')).toBeDefined();
  });

  describe('Vertex Modulation', () => {
    it('toggles modulation on/off', () => {
      render(<PolytopeAnimationDrawer />);

      const toggleButton = screen.getByRole('button', { name: /toggle vertex modulation/i });
      expect(toggleButton.textContent).toBe('ON'); // Enabled by default

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(false);

      fireEvent.click(toggleButton);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(true);
    });

    it('updates amplitude', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const amplitudeSlider = screen.getByLabelText('Modulation amplitude');
      fireEvent.change(amplitudeSlider, { target: { value: '0.5' } });

      expect(useExtendedObjectStore.getState().polytope.facetOffsetAmplitude).toBe(0.5);
    });

    it('updates frequency', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const frequencySlider = screen.getByLabelText('Modulation frequency');
      fireEvent.change(frequencySlider, { target: { value: '0.10' } });

      expect(useExtendedObjectStore.getState().polytope.facetOffsetFrequency).toBe(0.10);
    });

    it('updates wave', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const waveSlider = screen.getByLabelText('Modulation wave');
      fireEvent.change(waveSlider, { target: { value: '0.5' } });

      expect(useExtendedObjectStore.getState().polytope.facetOffsetPhaseSpread).toBe(0.5);
    });

    it('updates bias', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      });

      render(<PolytopeAnimationDrawer />);

      const biasSlider = screen.getByLabelText('Modulation bias');
      fireEvent.change(biasSlider, { target: { value: '0.7' } });

      expect(useExtendedObjectStore.getState().polytope.facetOffsetBias).toBe(0.7);
    });
  });

  describe('Control disabling', () => {
    it('disables controls when modulation is off', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: false },
      });

      render(<PolytopeAnimationDrawer />);

      // When modulation is disabled, the controls should have opacity-50 and pointer-events-none
      const modulationPanel = screen.getByTestId('animation-panel-modulation');
      const controlsContainer = modulationPanel.querySelector('.space-y-3:last-child');

      expect(controlsContainer?.className).toContain('opacity-50');
      expect(controlsContainer?.className).toContain('pointer-events-none');
    });

    it('enables controls when modulation is on', () => {
      render(<PolytopeAnimationDrawer />);

      // Enabled by default
      const modulationPanel = screen.getByTestId('animation-panel-modulation');
      const controlsContainer = modulationPanel.querySelector('.space-y-3:last-child');

      expect(controlsContainer?.className).not.toContain('opacity-50');
    });
  });
});
