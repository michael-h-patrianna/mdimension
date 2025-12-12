/**
 * Geometry state management using Zustand
 *
 * Manages the current dimension and object type for the visualizer.
 * Supports both traditional polytopes and extended objects.
 *
 * @see docs/prd/extended-objects.md
 */

import { create } from 'zustand';
import type { ObjectType } from '@/lib/geometry/types';
import { isPolytopeType, isExtendedObjectType } from '@/lib/geometry/types';

/** Minimum supported dimension */
export const MIN_DIMENSION = 3;

/** Maximum supported dimension */
export const MAX_DIMENSION = 11;

/** Default dimension (4D tesseract) */
export const DEFAULT_DIMENSION = 4;

/** Default object type */
export const DEFAULT_OBJECT_TYPE: ObjectType = 'hypercube';

/**
 * Dimension constraints for certain object types
 */
export const DIMENSION_CONSTRAINTS: Record<string, { min?: number; exact?: number }> = {
  'clifford-torus': { min: 4 },
  'root-system': {}, // D_n requires min 4, E8 requires exact 8 - handled in root system config
};

interface GeometryState {
  /** Current dimension (3-11) */
  dimension: number;
  /** Current object type */
  objectType: ObjectType;

  // Actions
  setDimension: (dimension: number) => void;
  setObjectType: (type: ObjectType) => void;
  reset: () => void;
}

/**
 * Clamps a dimension value to the valid range [MIN_DIMENSION, MAX_DIMENSION]
 * @param dim
 */
function clampDimension(dim: number): number {
  return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.floor(dim)));
}

/**
 * Validates that an object type is supported
 * @param type
 */
function isValidObjectType(type: string): type is ObjectType {
  return isPolytopeType(type as ObjectType) || isExtendedObjectType(type as ObjectType);
}

/**
 * Checks if an object type is valid for a given dimension
 *
 * @param type - Object type to check
 * @param dimension - Current dimension
 * @returns Object with valid flag and fallback type if invalid
 */
export function validateObjectTypeForDimension(
  type: ObjectType,
  dimension: number
): { valid: boolean; fallbackType?: ObjectType; message?: string } {
  // Clifford torus requires dimension >= 4
  if (type === 'clifford-torus' && dimension < 4) {
    return {
      valid: false,
      fallbackType: 'hypercube',
      message: 'Clifford Torus requires dimension >= 4',
    };
  }

  return { valid: true };
}

/**
 * Gets the fallback object type when current type is invalid for dimension
 * @param type
 * @param dimension
 */
function getFallbackObjectType(type: ObjectType, dimension: number): ObjectType {
  const validation = validateObjectTypeForDimension(type, dimension);
  return validation.valid ? type : (validation.fallbackType ?? 'hypercube');
}

export const useGeometryStore = create<GeometryState>((set, get) => ({
  dimension: DEFAULT_DIMENSION,
  objectType: DEFAULT_OBJECT_TYPE,

  setDimension: (dimension: number) => {
    const clampedDimension = clampDimension(dimension);
    const currentType = get().objectType;

    // Check if current object type is still valid for new dimension
    const newType = getFallbackObjectType(currentType, clampedDimension);

    set({
      dimension: clampedDimension,
      objectType: newType,
    });
  },

  setObjectType: (type: ObjectType) => {
    if (!isValidObjectType(type)) {
      throw new Error(`Invalid object type: ${type}`);
    }

    const currentDimension = get().dimension;
    const validation = validateObjectTypeForDimension(type, currentDimension);

    if (!validation.valid) {
      // Don't allow setting invalid type - keep current
      console.warn(`Object type ${type} is not valid for dimension ${currentDimension}: ${validation.message}`);
      return;
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
