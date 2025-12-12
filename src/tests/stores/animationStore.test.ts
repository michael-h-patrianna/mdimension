/**
 * Tests for animationStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useAnimationStore,
  MIN_SPEED,
  MAX_SPEED,
  DEFAULT_SPEED,
  BASE_ROTATION_RATE,
} from '@/stores/animationStore';

describe('animationStore', () => {
  beforeEach(() => {
    useAnimationStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should be playing by default', () => {
      expect(useAnimationStore.getState().isPlaying).toBe(true);
    });

    it('should have default speed of 1.0', () => {
      expect(useAnimationStore.getState().speed).toBe(DEFAULT_SPEED);
    });

    it('should have direction of 1 (clockwise)', () => {
      expect(useAnimationStore.getState().direction).toBe(1);
    });

    it('should have default animating planes', () => {
      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.size).toBe(3);
      expect(planes.has('XY')).toBe(true);
      expect(planes.has('YZ')).toBe(true);
      expect(planes.has('ZW')).toBe(true);
    });

    it('should have isoclinic mode disabled', () => {
      expect(useAnimationStore.getState().isoclinicMode).toBe(false);
    });
  });

  describe('play/pause/toggle', () => {
    it('should set isPlaying to true on play', () => {
      useAnimationStore.getState().play();
      expect(useAnimationStore.getState().isPlaying).toBe(true);
    });

    it('should set isPlaying to false on pause', () => {
      useAnimationStore.getState().play();
      useAnimationStore.getState().pause();
      expect(useAnimationStore.getState().isPlaying).toBe(false);
    });

    it('should toggle isPlaying', () => {
      useAnimationStore.getState().toggle();
      expect(useAnimationStore.getState().isPlaying).toBe(false);
      useAnimationStore.getState().toggle();
      expect(useAnimationStore.getState().isPlaying).toBe(true);
    });
  });

  describe('setSpeed', () => {
    it('should set speed to valid value', () => {
      useAnimationStore.getState().setSpeed(2.5);
      expect(useAnimationStore.getState().speed).toBe(2.5);
    });

    it('should clamp speed below minimum', () => {
      useAnimationStore.getState().setSpeed(0.01);
      expect(useAnimationStore.getState().speed).toBe(MIN_SPEED);
    });

    it('should clamp speed above maximum', () => {
      useAnimationStore.getState().setSpeed(10);
      expect(useAnimationStore.getState().speed).toBe(MAX_SPEED);
    });
  });

  describe('toggleDirection', () => {
    it('should toggle direction from 1 to -1', () => {
      useAnimationStore.getState().toggleDirection();
      expect(useAnimationStore.getState().direction).toBe(-1);
    });

    it('should toggle direction from -1 to 1', () => {
      useAnimationStore.getState().toggleDirection();
      useAnimationStore.getState().toggleDirection();
      expect(useAnimationStore.getState().direction).toBe(1);
    });
  });

  describe('togglePlane', () => {
    it('should add plane to animating set', () => {
      useAnimationStore.getState().togglePlane('XZ');
      expect(useAnimationStore.getState().animatingPlanes.has('XZ')).toBe(true);
    });

    it('should remove plane from animating set', () => {
      useAnimationStore.getState().togglePlane('XY');
      expect(useAnimationStore.getState().animatingPlanes.has('XY')).toBe(false);
    });
  });

  describe('setPlaneAnimating', () => {
    it('should add plane when animating is true', () => {
      useAnimationStore.getState().setPlaneAnimating('XW', true);
      expect(useAnimationStore.getState().animatingPlanes.has('XW')).toBe(true);
    });

    it('should remove plane when animating is false', () => {
      useAnimationStore.getState().setPlaneAnimating('XW', true);
      useAnimationStore.getState().setPlaneAnimating('XW', false);
      expect(useAnimationStore.getState().animatingPlanes.has('XW')).toBe(false);
    });
  });

  describe('animateAll', () => {
    it('should add all planes for given dimension', () => {
      useAnimationStore.getState().animateAll(4);
      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.has('XY')).toBe(true);
      expect(planes.has('XZ')).toBe(true);
      expect(planes.has('YZ')).toBe(true);
      expect(planes.has('XW')).toBe(true);
      expect(planes.has('YW')).toBe(true);
      expect(planes.has('ZW')).toBe(true);
      expect(planes.size).toBe(6);
    });

    it('should start playing', () => {
      useAnimationStore.getState().animateAll(4);
      expect(useAnimationStore.getState().isPlaying).toBe(true);
    });

    it('should handle 3D correctly', () => {
      useAnimationStore.getState().animateAll(3);
      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.size).toBe(3);
      expect(planes.has('XY')).toBe(true);
      expect(planes.has('XZ')).toBe(true);
      expect(planes.has('YZ')).toBe(true);
    });
  });

  describe('stopAll', () => {
    it('should clear all animating planes', () => {
      useAnimationStore.getState().animateAll(4);
      useAnimationStore.getState().stopAll();
      expect(useAnimationStore.getState().animatingPlanes.size).toBe(0);
    });

    it('should stop playing', () => {
      useAnimationStore.getState().animateAll(4);
      useAnimationStore.getState().stopAll();
      expect(useAnimationStore.getState().isPlaying).toBe(false);
    });
  });

  describe('setIsoclinicMode', () => {
    it('should enable isoclinic mode and add XY and ZW', () => {
      useAnimationStore.getState().setIsoclinicMode(true);
      expect(useAnimationStore.getState().isoclinicMode).toBe(true);
      expect(useAnimationStore.getState().animatingPlanes.has('XY')).toBe(true);
      expect(useAnimationStore.getState().animatingPlanes.has('ZW')).toBe(true);
    });

    it('should disable isoclinic mode', () => {
      useAnimationStore.getState().setIsoclinicMode(true);
      useAnimationStore.getState().setIsoclinicMode(false);
      expect(useAnimationStore.getState().isoclinicMode).toBe(false);
    });
  });

  describe('getRotationDelta', () => {
    it('should calculate correct delta at default speed', () => {
      const delta = useAnimationStore.getState().getRotationDelta(1000); // 1 second
      expect(delta).toBeCloseTo(BASE_ROTATION_RATE);
    });

    it('should scale delta with speed', () => {
      useAnimationStore.getState().setSpeed(2);
      const delta = useAnimationStore.getState().getRotationDelta(1000);
      expect(delta).toBeCloseTo(BASE_ROTATION_RATE * 2);
    });

    it('should reverse delta with direction', () => {
      useAnimationStore.getState().toggleDirection();
      const delta = useAnimationStore.getState().getRotationDelta(1000);
      expect(delta).toBeCloseTo(-BASE_ROTATION_RATE);
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      useAnimationStore.getState().play();
      useAnimationStore.getState().setSpeed(3);
      useAnimationStore.getState().toggleDirection();
      useAnimationStore.getState().animateAll(4);
      useAnimationStore.getState().setIsoclinicMode(true);

      useAnimationStore.getState().reset();

      expect(useAnimationStore.getState().isPlaying).toBe(true);
      expect(useAnimationStore.getState().speed).toBe(DEFAULT_SPEED);
      expect(useAnimationStore.getState().direction).toBe(1);
      
      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.size).toBe(3);
      expect(planes.has('XY')).toBe(true);
      expect(planes.has('YZ')).toBe(true);
      expect(planes.has('ZW')).toBe(true);
      
      expect(useAnimationStore.getState().isoclinicMode).toBe(false);
    });
  });

  describe('setDimension', () => {
    it('should filter out invalid planes when dimension decreases', () => {
      // Simulate the bug: animate 10D planes, then switch to 6D
      useAnimationStore.getState().animateAll(10);
      const planesBefore = useAnimationStore.getState().animatingPlanes;
      expect(planesBefore.has('XA6')).toBe(true); // Valid in 10D
      expect(planesBefore.has('XA7')).toBe(true);
      expect(planesBefore.size).toBe(45); // 10D has 45 rotation planes

      // Switch to 6D - should filter out invalid planes
      useAnimationStore.getState().setDimension(6);
      const planesAfter = useAnimationStore.getState().animatingPlanes;

      // Should only have 6D planes (15 planes)
      expect(planesAfter.size).toBe(15);
      expect(planesAfter.has('XY')).toBe(true);
      expect(planesAfter.has('XU')).toBe(true); // U is axis 5, valid in 6D
      expect(planesAfter.has('XA6')).toBe(false); // A6 is axis 6, invalid in 6D
      expect(planesAfter.has('XA7')).toBe(false);
    });

    it('should keep valid planes when dimension decreases', () => {
      // Clear defaults first
      useAnimationStore.getState().stopAll();
      
      // Add specific planes
      useAnimationStore.getState().togglePlane('XY');
      useAnimationStore.getState().togglePlane('XZ');
      useAnimationStore.getState().togglePlane('XW');

      useAnimationStore.getState().setDimension(4);

      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.has('XY')).toBe(true);
      expect(planes.has('XZ')).toBe(true);
      expect(planes.has('XW')).toBe(true);
    });

    it('should remove 4D planes when switching to 3D', () => {
      useAnimationStore.getState().animateAll(4);
      expect(useAnimationStore.getState().animatingPlanes.has('XW')).toBe(true);

      useAnimationStore.getState().setDimension(3);

      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.size).toBe(3); // Only XY, XZ, YZ
      expect(planes.has('XW')).toBe(false);
      expect(planes.has('YW')).toBe(false);
      expect(planes.has('ZW')).toBe(false);
    });

    it('should handle switching from 11D to 4D', () => {
      useAnimationStore.getState().animateAll(11);
      expect(useAnimationStore.getState().animatingPlanes.size).toBe(55); // 11D has 55 planes

      useAnimationStore.getState().setDimension(4);

      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.size).toBe(6); // 4D has 6 planes
    });

    it('should not affect isPlaying state', () => {
      useAnimationStore.getState().animateAll(10);
      expect(useAnimationStore.getState().isPlaying).toBe(true);

      useAnimationStore.getState().setDimension(4);

      expect(useAnimationStore.getState().isPlaying).toBe(true);
    });
  });
});
