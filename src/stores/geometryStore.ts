/**
 * Geometry state management using Zustand
 * Manages the current dimension and object type for the visualizer
 */

import { create } from 'zustand';
import type { PolytopeType } from '@/lib/geometry/types';

/** Minimum supported dimension */
export const MIN_DIMENSION = 3;

/** Maximum supported dimension */
export const MAX_DIMENSION = 11;

/** Default dimension (4D tesseract) */
export const DEFAULT_DIMENSION = 4;

/** Default object type */
export const DEFAULT_OBJECT_TYPE: PolytopeType = 'hypercube';

interface GeometryState {
  /** Current dimension (3-6) */
  dimension: number;
  /** Current object type */
  objectType: PolytopeType;

  // Actions
  setDimension: (dimension: number) => void;
  setObjectType: (type: PolytopeType) => void;
  reset: () => void;
}

/**
 * Clamps a dimension value to the valid range [MIN_DIMENSION, MAX_DIMENSION]
 */
function clampDimension(dim: number): number {
  return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.floor(dim)));
}

/**
 * Validates that a polytope type is supported
 */
function isValidPolytopeType(type: string): type is PolytopeType {
  return type === 'hypercube' || type === 'simplex' || type === 'cross-polytope';
}

export const useGeometryStore = create<GeometryState>((set) => ({
  dimension: DEFAULT_DIMENSION,
  objectType: DEFAULT_OBJECT_TYPE,

  setDimension: (dimension: number) => {
    const clampedDimension = clampDimension(dimension);
    set({ dimension: clampedDimension });
  },

  setObjectType: (type: PolytopeType) => {
    if (!isValidPolytopeType(type)) {
      throw new Error(`Invalid polytope type: ${type}`);
    }
    set({ objectType: type });
  },

  reset: () => {
    set({
      dimension: DEFAULT_DIMENSION,
      objectType: DEFAULT_OBJECT_TYPE,
    });
  },
}));
