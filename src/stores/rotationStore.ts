/**
 * Rotation state management using Zustand
 * Manages n-dimensional rotation angles
 */

import { create } from 'zustand';
import { getRotationPlanes } from '@/lib/math/rotation';
import { MAX_DIMENSION, MIN_DIMENSION } from './geometryStore';

/** Minimum rotation angle in radians (0 degrees) */
export const MIN_ROTATION = 0;

/** Maximum rotation angle in radians (360 degrees) */
export const MAX_ROTATION = 2 * Math.PI;

export interface RotationState {
  /** Map of plane name (e.g. "XY") to rotation angle in radians */
  rotations: Map<string, number>;
  
  /** Current dimension */
  dimension: number;

  /** Set rotation for a specific plane */
  setRotation: (plane: string, angle: number) => void;
  
  /** Update multiple rotations at once (optimized for animation) */
  updateRotations: (updates: Map<string, number>) => void;
  
  /** Reset all rotations to 0 */
  resetAllRotations: () => void;
  
  /** Update state when dimension changes */
  setDimension: (dimension: number) => void;
}

/**
 * Normalizes an angle to [0, 2π)
 * @param angle
 */
function normalizeAngle(angle: number): number {
  let normalized = angle % (2 * Math.PI);
  if (normalized < 0) {
    normalized += 2 * Math.PI;
  }
  return normalized;
}

export const useRotationStore = create<RotationState>((set) => ({
  rotations: new Map(),
  dimension: 4,

  setRotation: (plane: string, angle: number) => {
    set((state) => {
      // Only set rotation if plane is valid for current dimension
      const validPlanes = new Set(getRotationPlanes(state.dimension).map(p => p.name));
      if (!validPlanes.has(plane)) {
        return state; // Ignore invalid plane
      }
      const newRotations = new Map(state.rotations);
      newRotations.set(plane, normalizeAngle(angle));
      return { rotations: newRotations };
    });
  },

  updateRotations: (updates: Map<string, number>) => {
    set((state) => {
      // Filter updates to only include valid planes for current dimension
      const validPlanes = new Set(getRotationPlanes(state.dimension).map(p => p.name));
      const newRotations = new Map(state.rotations);
      for (const [plane, angle] of updates.entries()) {
        if (validPlanes.has(plane)) {
          newRotations.set(plane, normalizeAngle(angle));
        }
      }
      return { rotations: newRotations };
    });
  },

  resetAllRotations: () => {
    set({ rotations: new Map() });
  },

  setDimension: (dimension: number) => {
    if (dimension < MIN_DIMENSION || dimension > MAX_DIMENSION) {
      return;
    }

    set((state) => {
      // Filter rotations to only include valid planes for new dimension
      const validPlanes = new Set(getRotationPlanes(dimension).map(p => p.name));
      const newRotations = new Map<string, number>();
      
      for (const [plane, angle] of state.rotations.entries()) {
        if (validPlanes.has(plane)) {
          newRotations.set(plane, angle);
        }
      }

      return {
        dimension,
        rotations: newRotations,
      };
    });
  },
}));
