/**
 * Polytope Slice Store Tests
 *
 * Tests for the polytope animation state management in extendedObjectStore.
 *
 * Simple Vertex Modulation:
 * - Uses facetOffset* properties for amplitude, frequency, and bias
 * - Sine/cosine displacement with dimension-aware phase offsets
 *
 * @see src/stores/slices/geometry/polytopeSlice.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';

describe('polytopeSlice', () => {
  beforeEach(() => {
    // Reset store to defaults
    useExtendedObjectStore.getState().reset();
  });

  afterEach(() => {
    useExtendedObjectStore.getState().reset();
  });

  describe('Vertex Modulation Actions', () => {
    it('setPolytopeFacetOffsetEnabled toggles modulation', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeFacetOffsetEnabled(true);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(true);

      store.setPolytopeFacetOffsetEnabled(false);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(false);
    });

    it('setPolytopeFacetOffsetAmplitude clamps value to [0, 1]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeFacetOffsetAmplitude(0.5);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetAmplitude).toBe(0.5);

      store.setPolytopeFacetOffsetAmplitude(-0.1);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetAmplitude).toBe(0.0);

      store.setPolytopeFacetOffsetAmplitude(1.5);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetAmplitude).toBe(1.0);
    });

    it('setPolytopeFacetOffsetFrequency clamps value to [0.01, 0.20]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeFacetOffsetFrequency(0.10);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetFrequency).toBe(0.10);

      store.setPolytopeFacetOffsetFrequency(0.001);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetFrequency).toBe(0.01);

      store.setPolytopeFacetOffsetFrequency(1.0);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetFrequency).toBe(0.20);
    });

    it('setPolytopeFacetOffsetPhaseSpread clamps value to [0, 1]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeFacetOffsetPhaseSpread(0.5);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetPhaseSpread).toBe(0.5);

      store.setPolytopeFacetOffsetPhaseSpread(-0.2);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetPhaseSpread).toBe(0.0);

      store.setPolytopeFacetOffsetPhaseSpread(1.5);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetPhaseSpread).toBe(1.0);
    });

    it('setPolytopeFacetOffsetBias clamps value to [0, 1]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeFacetOffsetBias(0.5);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetBias).toBe(0.5);

      store.setPolytopeFacetOffsetBias(-0.2);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetBias).toBe(0.0);

      store.setPolytopeFacetOffsetBias(1.5);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetBias).toBe(1.0);
    });
  });

  describe('Store reset', () => {
    it('resets modulation values to defaults', () => {
      const store = useExtendedObjectStore.getState();

      // Set various values
      store.setPolytopeFacetOffsetEnabled(false);
      store.setPolytopeFacetOffsetAmplitude(0.8);
      store.setPolytopeFacetOffsetFrequency(0.15);

      // Verify values were set
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(false);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetAmplitude).toBe(0.8);

      // Reset
      store.reset();

      // Verify reset to defaults
      const { polytope } = useExtendedObjectStore.getState();
      expect(polytope.facetOffsetEnabled).toBe(true); // Enabled by default
      expect(polytope.facetOffsetAmplitude).toBe(0.2); // Default amplitude
      expect(polytope.facetOffsetFrequency).toBe(0.01); // Default frequency
    });
  });

  describe('Preset save/load compatibility', () => {
    it('saves all modulation config fields', () => {
      const store = useExtendedObjectStore.getState();

      // Set various modulation values
      store.setPolytopeFacetOffsetEnabled(true);
      store.setPolytopeFacetOffsetAmplitude(0.5);
      store.setPolytopeFacetOffsetFrequency(0.1);
      store.setPolytopeFacetOffsetPhaseSpread(0.3);
      store.setPolytopeFacetOffsetBias(0.7);

      // Get the state for saving
      const stateToSave = useExtendedObjectStore.getState().polytope;

      // Verify all expected fields are present
      expect(stateToSave).toHaveProperty('facetOffsetEnabled', true);
      expect(stateToSave).toHaveProperty('facetOffsetAmplitude', 0.5);
      expect(stateToSave).toHaveProperty('facetOffsetFrequency', 0.1);
      expect(stateToSave).toHaveProperty('facetOffsetPhaseSpread', 0.3);
      expect(stateToSave).toHaveProperty('facetOffsetBias', 0.7);
    });
  });
});











