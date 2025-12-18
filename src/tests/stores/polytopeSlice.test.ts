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
import { DEFAULT_POLYTOPE_CONFIG } from '@/lib/geometry/extended/types';

describe('polytopeSlice', () => {
  beforeEach(() => {
    // Reset store to defaults
    useExtendedObjectStore.getState().reset();
  });

  afterEach(() => {
    useExtendedObjectStore.getState().reset();
  });

  describe('Initial state', () => {
    it('has correct default values', () => {
      const { polytope } = useExtendedObjectStore.getState();

      expect(polytope.scale).toBe(DEFAULT_POLYTOPE_CONFIG.scale);
      expect(polytope.truncationEnabled).toBe(false);
      expect(polytope.truncationMode).toBe('vertexTruncate');
      expect(polytope.truncationT).toBe(0.0);
      expect(polytope.truncationMin).toBe(0.0);
      expect(polytope.truncationMax).toBe(0.5);
      expect(polytope.truncationSpeed).toBe(0.1);
      // Vertex modulation defaults (enabled by default)
      expect(polytope.facetOffsetEnabled).toBe(true);
      expect(polytope.facetOffsetAmplitude).toBe(0.2);
      expect(polytope.facetOffsetFrequency).toBe(0.01);
      expect(polytope.facetOffsetPhaseSpread).toBe(0.12);
      expect(polytope.facetOffsetBias).toBe(1.0);
      // Legacy animation properties (still in store)
      expect(polytope.dualMorphEnabled).toBe(false);
      expect(polytope.dualMorphT).toBe(0.3);
      expect(polytope.dualNormalize).toBe('unitSphere');
      expect(polytope.dualMorphSpeed).toBe(0.05);
      expect(polytope.explodeEnabled).toBe(false);
      expect(polytope.explodeFactor).toBe(0.0);
      expect(polytope.explodeSpeed).toBe(0.1);
      expect(polytope.explodeMax).toBe(0.3);
    });
  });

  describe('Truncation Animation Actions', () => {
    it('setPolytopeTruncationEnabled toggles truncation', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeTruncationEnabled(true);
      expect(useExtendedObjectStore.getState().polytope.truncationEnabled).toBe(true);

      store.setPolytopeTruncationEnabled(false);
      expect(useExtendedObjectStore.getState().polytope.truncationEnabled).toBe(false);
    });

    it('setPolytopeTruncationMode changes mode', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeTruncationMode('edgeTruncate');
      expect(useExtendedObjectStore.getState().polytope.truncationMode).toBe('edgeTruncate');

      store.setPolytopeTruncationMode('cantellate');
      expect(useExtendedObjectStore.getState().polytope.truncationMode).toBe('cantellate');

      store.setPolytopeTruncationMode('vertexTruncate');
      expect(useExtendedObjectStore.getState().polytope.truncationMode).toBe('vertexTruncate');
    });

    it('setPolytopeTruncationT clamps value to [0, 1]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeTruncationT(0.5);
      expect(useExtendedObjectStore.getState().polytope.truncationT).toBe(0.5);

      store.setPolytopeTruncationT(-0.5);
      expect(useExtendedObjectStore.getState().polytope.truncationT).toBe(0.0);

      store.setPolytopeTruncationT(1.5);
      expect(useExtendedObjectStore.getState().polytope.truncationT).toBe(1.0);
    });

    it('setPolytopeTruncationMin clamps value to [0, 0.5]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeTruncationMin(0.3);
      expect(useExtendedObjectStore.getState().polytope.truncationMin).toBe(0.3);

      store.setPolytopeTruncationMin(-0.1);
      expect(useExtendedObjectStore.getState().polytope.truncationMin).toBe(0.0);

      store.setPolytopeTruncationMin(0.8);
      expect(useExtendedObjectStore.getState().polytope.truncationMin).toBe(0.5);
    });

    it('setPolytopeTruncationMax clamps value to [0.5, 1.0]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeTruncationMax(0.7);
      expect(useExtendedObjectStore.getState().polytope.truncationMax).toBe(0.7);

      store.setPolytopeTruncationMax(0.3);
      expect(useExtendedObjectStore.getState().polytope.truncationMax).toBe(0.5);

      store.setPolytopeTruncationMax(1.5);
      expect(useExtendedObjectStore.getState().polytope.truncationMax).toBe(1.0);
    });

    it('setPolytopeTruncationSpeed clamps value to [0.01, 0.5]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeTruncationSpeed(0.25);
      expect(useExtendedObjectStore.getState().polytope.truncationSpeed).toBe(0.25);

      store.setPolytopeTruncationSpeed(0.001);
      expect(useExtendedObjectStore.getState().polytope.truncationSpeed).toBe(0.01);

      store.setPolytopeTruncationSpeed(1.0);
      expect(useExtendedObjectStore.getState().polytope.truncationSpeed).toBe(0.5);
    });
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

  describe('Legacy Dual Morph Actions', () => {
    it('setPolytopeDualMorphEnabled toggles dual morph', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeDualMorphEnabled(true);
      expect(useExtendedObjectStore.getState().polytope.dualMorphEnabled).toBe(true);

      store.setPolytopeDualMorphEnabled(false);
      expect(useExtendedObjectStore.getState().polytope.dualMorphEnabled).toBe(false);
    });

    it('setPolytopeDualMorphT clamps value to [0, 1]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeDualMorphT(0.5);
      expect(useExtendedObjectStore.getState().polytope.dualMorphT).toBe(0.5);

      store.setPolytopeDualMorphT(-0.5);
      expect(useExtendedObjectStore.getState().polytope.dualMorphT).toBe(0.0);

      store.setPolytopeDualMorphT(1.5);
      expect(useExtendedObjectStore.getState().polytope.dualMorphT).toBe(1.0);
    });

    it('setPolytopeDualNormalize changes mode', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeDualNormalize('inradius1');
      expect(useExtendedObjectStore.getState().polytope.dualNormalize).toBe('inradius1');

      store.setPolytopeDualNormalize('circumradius1');
      expect(useExtendedObjectStore.getState().polytope.dualNormalize).toBe('circumradius1');

      store.setPolytopeDualNormalize('unitSphere');
      expect(useExtendedObjectStore.getState().polytope.dualNormalize).toBe('unitSphere');
    });

    it('setPolytopeDualMorphSpeed clamps value to [0.01, 0.3]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeDualMorphSpeed(0.15);
      expect(useExtendedObjectStore.getState().polytope.dualMorphSpeed).toBe(0.15);

      store.setPolytopeDualMorphSpeed(0.001);
      expect(useExtendedObjectStore.getState().polytope.dualMorphSpeed).toBe(0.01);

      store.setPolytopeDualMorphSpeed(0.5);
      expect(useExtendedObjectStore.getState().polytope.dualMorphSpeed).toBe(0.3);
    });
  });

  describe('Legacy Explode Actions', () => {
    it('setPolytopeExplodeEnabled toggles explode', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeExplodeEnabled(true);
      expect(useExtendedObjectStore.getState().polytope.explodeEnabled).toBe(true);

      store.setPolytopeExplodeEnabled(false);
      expect(useExtendedObjectStore.getState().polytope.explodeEnabled).toBe(false);
    });

    it('setPolytopeExplodeFactor clamps value to [0, 1]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeExplodeFactor(0.5);
      expect(useExtendedObjectStore.getState().polytope.explodeFactor).toBe(0.5);

      store.setPolytopeExplodeFactor(-0.5);
      expect(useExtendedObjectStore.getState().polytope.explodeFactor).toBe(0.0);

      store.setPolytopeExplodeFactor(1.5);
      expect(useExtendedObjectStore.getState().polytope.explodeFactor).toBe(1.0);
    });

    it('setPolytopeExplodeSpeed clamps value to [0.01, 0.3]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeExplodeSpeed(0.15);
      expect(useExtendedObjectStore.getState().polytope.explodeSpeed).toBe(0.15);

      store.setPolytopeExplodeSpeed(0.001);
      expect(useExtendedObjectStore.getState().polytope.explodeSpeed).toBe(0.01);

      store.setPolytopeExplodeSpeed(0.5);
      expect(useExtendedObjectStore.getState().polytope.explodeSpeed).toBe(0.3);
    });

    it('setPolytopeExplodeMax clamps value to [0, 1]', () => {
      const store = useExtendedObjectStore.getState();

      store.setPolytopeExplodeMax(0.7);
      expect(useExtendedObjectStore.getState().polytope.explodeMax).toBe(0.7);

      store.setPolytopeExplodeMax(-0.1);
      expect(useExtendedObjectStore.getState().polytope.explodeMax).toBe(0.0);

      store.setPolytopeExplodeMax(1.5);
      expect(useExtendedObjectStore.getState().polytope.explodeMax).toBe(1.0);
    });
  });

  describe('Store reset', () => {
    it('resets all animation values to defaults', () => {
      const store = useExtendedObjectStore.getState();

      // Set various values
      store.setPolytopeTruncationEnabled(true);
      store.setPolytopeTruncationMode('cantellate');
      store.setPolytopeFacetOffsetEnabled(true);
      store.setPolytopeDualMorphEnabled(true);
      store.setPolytopeExplodeEnabled(true);

      // Verify values were set
      expect(useExtendedObjectStore.getState().polytope.truncationEnabled).toBe(true);
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(true);

      // Reset
      store.reset();

      // Verify reset to defaults
      const { polytope } = useExtendedObjectStore.getState();
      expect(polytope.truncationEnabled).toBe(false);
      expect(polytope.truncationMode).toBe('vertexTruncate');
      expect(polytope.facetOffsetEnabled).toBe(true); // Enabled by default
      expect(polytope.dualMorphEnabled).toBe(false);
      expect(polytope.explodeEnabled).toBe(false);
    });
  });

  describe('Preset save/load compatibility', () => {
    it('saves all animation config fields', () => {
      const store = useExtendedObjectStore.getState();

      // Set various animation values
      store.setPolytopeTruncationEnabled(true);
      store.setPolytopeTruncationMode('edgeTruncate');
      store.setPolytopeTruncationSpeed(0.2);
      store.setPolytopeFacetOffsetEnabled(true);
      store.setPolytopeFacetOffsetAmplitude(0.5);
      store.setPolytopeDualMorphEnabled(true);
      store.setPolytopeDualNormalize('inradius1');
      store.setPolytopeExplodeEnabled(true);
      store.setPolytopeExplodeMax(0.8);

      // Get the state for saving
      const stateToSave = useExtendedObjectStore.getState().polytope;

      // Verify all expected fields are present
      expect(stateToSave).toHaveProperty('truncationEnabled', true);
      expect(stateToSave).toHaveProperty('truncationMode', 'edgeTruncate');
      expect(stateToSave).toHaveProperty('truncationSpeed', 0.2);
      expect(stateToSave).toHaveProperty('facetOffsetEnabled', true);
      expect(stateToSave).toHaveProperty('facetOffsetAmplitude', 0.5);
      expect(stateToSave).toHaveProperty('dualMorphEnabled', true);
      expect(stateToSave).toHaveProperty('dualNormalize', 'inradius1');
      expect(stateToSave).toHaveProperty('explodeEnabled', true);
      expect(stateToSave).toHaveProperty('explodeMax', 0.8);
    });
  });
});




