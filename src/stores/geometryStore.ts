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
 * Note: Clifford Torus supports 3D (torus surface) and 4D+ (Clifford torus)
 */
export const DIMENSION_CONSTRAINTS: Record<string, { min?: number; exact?: number }> = {
  'root-system': { min: 3 }, // Root systems require at least 3D
  'quaternion-julia': { min: 3 }, // Raymarching requires 3D+
}

/**
 * Recommended dimensions for certain object types to get optimal visualization.
 * When switching to these object types, the dimension will auto-switch if needed.
 */
export const RECOMMENDED_DIMENSIONS: Record<string, { dimension?: number; reason: string }> = {
  'mandelbrot': {
    reason: 'Fractal structures reveal complex n-dimensional behavior',
  },
  'quaternion-julia': {
    reason: 'Quaternion algebra reveals 4D rotation symmetry',
  },
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
  return isPolytopeType(type) || isExtendedObjectType(type);
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
  // Root system requires dimension >= 3
  if (type === 'root-system' && dimension < 3) {
    return {
      valid: false,
      fallbackType: 'hypercube',
      message: 'Root System requires dimension >= 3',
    };
  }

    if (type === 'quaternion-julia' && dimension < 3) {
      return {
        isValid: false,
        message: 'Quaternion Julia requires dimension >= 3',
      }
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

    // Check if this object type has a recommended dimension
    const recommended = RECOMMENDED_DIMENSIONS[type];
    if (recommended && recommended.dimension !== undefined && currentDimension !== recommended.dimension) {
      // Auto-switch to recommended dimension for optimal visualization
      set({
        objectType: type,
        dimension: recommended.dimension,
      });
    } else {
      set({ objectType: type });
    }
  },

  reset: () => {
    set({
      dimension: DEFAULT_DIMENSION,
      objectType: DEFAULT_OBJECT_TYPE,
    });
  },
}));
