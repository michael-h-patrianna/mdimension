/**
 * Integration Tests for State Management
 * Tests the interaction between different stores
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';
import { useCrossSectionStore } from '@/stores/crossSectionStore';
import { useVisualStore } from '@/stores/visualStore';

describe('State Management Integration', () => {
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

  describe('Geometry Store', () => {
    it('should maintain dimension bounds', () => {
      const store = useGeometryStore.getState();

      store.setDimension(12); // Above max (11)
      expect(useGeometryStore.getState().dimension).toBe(11);

      store.setDimension(1); // Below min (2)
      expect(useGeometryStore.getState().dimension).toBe(2);

      store.setDimension(2); // Valid (now minimum)
      expect(useGeometryStore.getState().dimension).toBe(2);

      store.setDimension(5); // Valid
      expect(useGeometryStore.getState().dimension).toBe(5);
    });

    it('should switch between object types', () => {
      const store = useGeometryStore.getState();

      store.setObjectType('simplex');
      expect(useGeometryStore.getState().objectType).toBe('simplex');

      store.setObjectType('cross-polytope');
      expect(useGeometryStore.getState().objectType).toBe('cross-polytope');

      store.setObjectType('hypercube');
      expect(useGeometryStore.getState().objectType).toBe('hypercube');
    });
  });

  describe('Rotation Store', () => {
    it('should handle dimension changes', () => {
      const store = useRotationStore.getState();

      store.setDimension(4);
      store.setRotation('XW', Math.PI / 4);

      expect(useRotationStore.getState().rotations.get('XW')).toBe(Math.PI / 4);
    });

    it('should compose rotations correctly', () => {
      const store = useRotationStore.getState();
      store.setDimension(4);

      store.setRotation('XY', Math.PI / 6);
      store.setRotation('XW', Math.PI / 4);

      const matrix = store.getComposedRotationMatrix();

      // Matrix should be 4x4
      expect(matrix.length).toBe(4);
      matrix.forEach((row) => {
        expect(row.length).toBe(4);
      });
    });

    it('should reset all rotations', () => {
      const store = useRotationStore.getState();
      store.setDimension(4);

      store.setRotation('XY', Math.PI / 6);
      store.setRotation('XW', Math.PI / 4);

      store.resetAllRotations();

      // All rotations should be cleared
      const rotations = useRotationStore.getState().rotations;
      rotations.forEach((angle) => {
        expect(angle).toBe(0);
      });
    });
  });

  describe('Transform Store', () => {
    it('should handle scale transformations', () => {
      const store = useTransformStore.getState();
      store.setDimension(4);

      store.setUniformScale(2.0);
      expect(useTransformStore.getState().uniformScale).toBe(2.0);

      const scaleMatrix = store.getScaleMatrix();
      // Diagonal should be 2.0
      expect(scaleMatrix[0]![0]).toBe(2.0);
      expect(scaleMatrix[1]![1]).toBe(2.0);
      expect(scaleMatrix[2]![2]).toBe(2.0);
      expect(scaleMatrix[3]![3]).toBe(2.0);
    });

    it('should handle shear transformations', () => {
      const store = useTransformStore.getState();
      store.setDimension(4);

      store.setShear('XY', 0.5);
      expect(useTransformStore.getState().shears.get('XY')).toBe(0.5);

      const shearMatrix = store.getShearMatrix();
      // Should have shear value in the right place
      expect(shearMatrix.length).toBe(4);
    });

    it('should handle translation', () => {
      const store = useTransformStore.getState();
      store.setDimension(4);

      store.setTranslation(0, 1.5);
      store.setTranslation(1, -0.5);

      const translation = store.getTranslationVector();
      expect(translation[0]).toBe(1.5);
      expect(translation[1]).toBe(-0.5);
    });

    it('should reset all transformations', () => {
      const store = useTransformStore.getState();
      store.setDimension(4);

      store.setUniformScale(2.0);
      store.setShear('XY', 0.5);
      store.setTranslation(0, 1.5);

      store.resetAll();

      expect(useTransformStore.getState().uniformScale).toBe(1);
    });
  });

      describe('Animation Store', () => {
        it('should toggle play state', () => {
          const store = useAnimationStore.getState();
  
          expect(store.isPlaying).toBe(true);
  
          store.toggle();
          expect(useAnimationStore.getState().isPlaying).toBe(false);
        });
  
        it('should clamp speed within bounds', () => {
          const store = useAnimationStore.getState();
  
          store.setSpeed(10);
          expect(useAnimationStore.getState().speed).toBe(5);
  
          store.setSpeed(-5);
          expect(useAnimationStore.getState().speed).toBe(0.1);
        });
  
        it('should toggle direction', () => {
          const store = useAnimationStore.getState();
          const initialDirection = store.direction;
  
          store.toggleDirection();
          expect(useAnimationStore.getState().direction).toBe(-initialDirection);
        });
  
        it('should manage animating planes', () => {
          const store = useAnimationStore.getState();
          
          // Stop all first to clear planes
          store.stopAll();
          expect(useAnimationStore.getState().animatingPlanes.size).toBe(0);
  
          store.togglePlane('XY');
          expect(useAnimationStore.getState().animatingPlanes.has('XY')).toBe(true);
  
          store.togglePlane('XW');
          expect(useAnimationStore.getState().animatingPlanes.has('XW')).toBe(true);
        });
      });
  describe('Projection Store', () => {
    it('should update projection distance', () => {
      const store = useProjectionStore.getState();

      store.setDistance(8);
      expect(useProjectionStore.getState().distance).toBe(8);
    });

    it('should reset to defaults', () => {
      const store = useProjectionStore.getState();

      store.setDistance(10);
      store.resetToDefaults();

      // Should be back to default (4.0)
      expect(useProjectionStore.getState().distance).toBe(4);
    });
  });

  describe('Cross Section Store', () => {
    it('should toggle cross section', () => {
      const store = useCrossSectionStore.getState();

      expect(store.enabled).toBe(false);

      store.setEnabled(true);
      expect(useCrossSectionStore.getState().enabled).toBe(true);
    });

    it('should update slice position', () => {
      const store = useCrossSectionStore.getState();

      store.setSliceW(0.75);
      expect(useCrossSectionStore.getState().sliceW).toBe(0.75);
    });
  });

  describe('Visual Store', () => {
    it('should update colors', () => {
      const store = useVisualStore.getState();

      store.setEdgeColor('#ff0000');
      expect(useVisualStore.getState().edgeColor).toBe('#ff0000');

      store.setVertexColor('#00ff00');
      expect(useVisualStore.getState().vertexColor).toBe('#00ff00');
    });

    it('should update thickness', () => {
      const store = useVisualStore.getState();

      store.setEdgeThickness(3);
      expect(useVisualStore.getState().edgeThickness).toBe(3);

      store.setVertexSize(5);
      expect(useVisualStore.getState().vertexSize).toBe(5);
    });

    it('should apply presets', () => {
      const store = useVisualStore.getState();

      store.applyPreset('neon');
      const state = useVisualStore.getState();
      expect(state.edgeColor).toBeDefined();
    });
  });

  describe('Cross-Store Interactions', () => {
    it('should maintain consistent state across multiple operations', () => {
      // Simulate a typical user workflow
      useGeometryStore.getState().setDimension(5);
      useGeometryStore.getState().setObjectType('simplex');

      useRotationStore.getState().setDimension(5);
      useRotationStore.getState().setRotation('XY', Math.PI / 4);
      useRotationStore.getState().setRotation('XW', Math.PI / 6);

      useTransformStore.getState().setDimension(5);
      useTransformStore.getState().setUniformScale(1.5);

      useAnimationStore.getState().play();
      useAnimationStore.getState().togglePlane('XY');

      // Verify all states are consistent
      expect(useGeometryStore.getState().dimension).toBe(5);
      expect(useGeometryStore.getState().objectType).toBe('simplex');
      expect(useRotationStore.getState().rotations.get('XY')).toBe(Math.PI / 4);
      expect(useTransformStore.getState().uniformScale).toBe(1.5);
      expect(useAnimationStore.getState().isPlaying).toBe(true);
    });
  });
});
