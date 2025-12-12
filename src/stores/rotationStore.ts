/**
 * Rotation state management using Zustand
 * Manages rotation angles for all planes in n-dimensional space
 */

import { create } from 'zustand';
import { getRotationPlanes, composeRotations } from '@/lib/math';
import type { MatrixND } from '@/lib/math';

interface RotationState {
  dimension: number;
  rotations: Map<string, number>; // plane name -> angle in radians

  // Actions
  setDimension: (dimension: number) => void;
  setRotation: (plane: string, angleRadians: number) => void;
  updateRotations: (updates: Map<string, number>) => void;
  resetRotation: (plane: string) => void;
  resetAllRotations: () => void;

  // Computed
  getComposedRotationMatrix: () => MatrixND;
  getRotationDegrees: (plane: string) => number;
  getActivePlanes: () => string[]; // planes with non-zero rotation
}

export const useRotationStore = create<RotationState>((set, get) => ({
  dimension: 4, // Must match DEFAULT_DIMENSION from geometryStore
  rotations: new Map(),

  setDimension: (dimension: number) => {
    if (dimension < 2) {
      throw new Error('Dimension must be at least 2');
    }

    set((state) => {
      // Keep only rotations for planes that exist in the new dimension
      const validPlanes = new Set(getRotationPlanes(dimension).map((p) => p.name));
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

  setRotation: (plane: string, angleRadians: number) => {
    set((state) => {
      // Validate that this plane exists in the current dimension
      const validPlanes = getRotationPlanes(state.dimension);
      const isValidPlane = validPlanes.some((p) => p.name === plane);

      if (!isValidPlane) {
        throw new Error(
          `Invalid plane "${plane}" for ${state.dimension}D space`
        );
      }

      const newRotations = new Map(state.rotations);

      // Normalize angle to [0, 2π)
      const normalizedAngle = ((angleRadians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

      // Store the angle (even if zero, to allow tracking)
      newRotations.set(plane, normalizedAngle);

      return {
        rotations: newRotations,
      };
    });
  },

  updateRotations: (updates: Map<string, number>) => {
    set((state) => {
      const validPlanes = getRotationPlanes(state.dimension);
      const validPlaneNames = new Set(validPlanes.map(p => p.name));
      const newRotations = new Map(state.rotations);
      let changed = false;

      for (const [plane, angle] of updates.entries()) {
        if (validPlaneNames.has(plane)) {
          // Normalize angle
          const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          newRotations.set(plane, normalizedAngle);
          changed = true;
        }
      }

      return changed ? { rotations: newRotations } : {};
    });
  },

  resetRotation: (plane: string) => {
    set((state) => {
      const newRotations = new Map(state.rotations);
      newRotations.delete(plane);
      return {
        rotations: newRotations,
      };
    });
  },

  resetAllRotations: () => {
    set({
      rotations: new Map(),
    });
  },

  getComposedRotationMatrix: () => {
    const state = get();
    return composeRotations(state.dimension, state.rotations);
  },

  getRotationDegrees: (plane: string) => {
    const state = get();
    const angleRadians = state.rotations.get(plane) ?? 0;
    return (angleRadians * 180) / Math.PI;
  },

  getActivePlanes: () => {
    const state = get();
    const activePlanes: string[] = [];

    for (const [plane, angle] of state.rotations.entries()) {
      // Consider a plane active if its angle is non-zero (with small epsilon)
      if (Math.abs(angle) > 1e-6) {
        activePlanes.push(plane);
      }
    }

    return activePlanes;
  },
}));
