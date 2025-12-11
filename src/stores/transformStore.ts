/**
 * Transform state management using Zustand
 * Manages scale, shear, and translation transformations
 */

import { create } from 'zustand';
import type { MatrixND, VectorND } from '@/lib/math/types';
import {
  createScaleMatrix,
  createShearMatrix,
  createIdentityMatrix,
} from '@/lib/math';

/** Minimum scale value */
export const MIN_SCALE = 0.1;

/** Maximum scale value */
export const MAX_SCALE = 3.0;

/** Default scale value */
export const DEFAULT_SCALE = 1.0;

/** Scale warning threshold (low) */
export const SCALE_WARNING_LOW = 0.2;

/** Scale warning threshold (high) */
export const SCALE_WARNING_HIGH = 2.5;

/** Minimum shear value */
export const MIN_SHEAR = -2.0;

/** Maximum shear value */
export const MAX_SHEAR = 2.0;

/** Default shear value */
export const DEFAULT_SHEAR = 0;

/** Minimum translation value */
export const MIN_TRANSLATION = -5.0;

/** Maximum translation value */
export const MAX_TRANSLATION = 5.0;

/** Default translation value */
export const DEFAULT_TRANSLATION = 0;

interface TransformState {
  // Scale
  uniformScale: number;
  perAxisScale: number[];
  scaleLocked: boolean;

  // Shear
  shears: Map<string, number>; // "XY" -> amount

  // Translation
  translation: number[];

  // Current dimension (for generating correct sized arrays)
  dimension: number;

  // Scale actions
  setUniformScale: (value: number) => void;
  setAxisScale: (axis: number, value: number) => void;
  setScaleLocked: (locked: boolean) => void;
  resetScale: () => void;
  getScaleMatrix: () => MatrixND;
  isScaleExtreme: () => boolean;

  // Shear actions
  setShear: (plane: string, amount: number) => void;
  resetShear: (plane: string) => void;
  resetAllShears: () => void;
  getShearMatrix: () => MatrixND;

  // Translation actions
  setTranslation: (axis: number, value: number) => void;
  resetTranslation: () => void;
  center: () => void;
  getTranslationVector: () => VectorND;

  // General actions
  setDimension: (dimension: number) => void;
  resetAll: () => void;
}

/**
 * Clamps a scale value to valid range
 */
function clampScale(value: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
}

/**
 * Clamps a shear value to valid range
 */
function clampShear(value: number): number {
  return Math.max(MIN_SHEAR, Math.min(MAX_SHEAR, value));
}

/**
 * Clamps a translation value to valid range
 */
function clampTranslation(value: number): number {
  return Math.max(MIN_TRANSLATION, Math.min(MAX_TRANSLATION, value));
}

/**
 * Creates default per-axis scale array for given dimension
 */
function createDefaultScales(dimension: number): number[] {
  return new Array(dimension).fill(DEFAULT_SCALE);
}

/**
 * Creates default translation array for given dimension
 */
function createDefaultTranslation(dimension: number): number[] {
  return new Array(dimension).fill(DEFAULT_TRANSLATION);
}

/**
 * Axis naming for any dimension
 * X, Y, Z, W, V, U for first 6, then A6, A7, A8... for higher
 */
const AXIS_NAMES = ['X', 'Y', 'Z', 'W', 'V', 'U'];

/**
 * Parses a single axis name to its index
 */
function parseAxisName(name: string): number {
  const index = AXIS_NAMES.indexOf(name);
  if (index !== -1) {
    return index;
  }
  // Handle A6, A7, A8... format
  if (name.startsWith('A')) {
    const num = parseInt(name.slice(1), 10);
    if (!isNaN(num) && num >= AXIS_NAMES.length) {
      return num;
    }
  }
  return -1;
}

/**
 * Parses a plane name like "XY" or "A6A7" to axis indices [0, 1]
 */
function parsePlaneToAxes(plane: string): [number, number] {
  // Try two-character format first (XY, XZ, etc.)
  if (plane.length === 2) {
    const axis1 = parseAxisName(plane[0]!);
    const axis2 = parseAxisName(plane[1]!);
    if (axis1 !== -1 && axis2 !== -1) {
      return [axis1, axis2];
    }
  }

  // Try split by capital letter for formats like "A6A7"
  const parts = plane.match(/[A-Z][0-9]*/g);
  if (parts && parts.length === 2) {
    const axis1 = parseAxisName(parts[0]!);
    const axis2 = parseAxisName(parts[1]!);
    if (axis1 !== -1 && axis2 !== -1) {
      return [axis1, axis2];
    }
  }

  throw new Error(`Invalid plane name: ${plane}`);
}

export const useTransformStore = create<TransformState>((set, get) => ({
  // Initial state
  uniformScale: DEFAULT_SCALE,
  perAxisScale: createDefaultScales(4),
  scaleLocked: true,
  shears: new Map(),
  translation: createDefaultTranslation(4),
  dimension: 4,

  // Scale actions
  setUniformScale: (value: number) => {
    const clamped = clampScale(value);
    set((state) => {
      if (state.scaleLocked) {
        // When locked, update all per-axis scales too
        return {
          uniformScale: clamped,
          perAxisScale: new Array(state.dimension).fill(clamped),
        };
      }
      return { uniformScale: clamped };
    });
  },

  setAxisScale: (axis: number, value: number) => {
    const clamped = clampScale(value);
    set((state) => {
      if (axis < 0 || axis >= state.dimension) {
        return state;
      }

      const newScales = [...state.perAxisScale];
      newScales[axis] = clamped;

      if (state.scaleLocked) {
        // When locked, update uniform and all axes
        return {
          uniformScale: clamped,
          perAxisScale: new Array(state.dimension).fill(clamped),
        };
      }

      return { perAxisScale: newScales };
    });
  },

  setScaleLocked: (locked: boolean) => {
    set((state) => {
      if (locked) {
        // When locking, sync all axes to uniform scale
        return {
          scaleLocked: true,
          perAxisScale: new Array(state.dimension).fill(state.uniformScale),
        };
      }
      return { scaleLocked: false };
    });
  },

  resetScale: () => {
    set((state) => ({
      uniformScale: DEFAULT_SCALE,
      perAxisScale: createDefaultScales(state.dimension),
    }));
  },

  getScaleMatrix: () => {
    const state = get();
    return createScaleMatrix(state.dimension, state.perAxisScale);
  },

  isScaleExtreme: () => {
    const state = get();
    return state.perAxisScale.some(
      (s) => s < SCALE_WARNING_LOW || s > SCALE_WARNING_HIGH
    );
  },

  // Shear actions
  setShear: (plane: string, amount: number) => {
    const clamped = clampShear(amount);
    set((state) => {
      const newShears = new Map(state.shears);
      if (Math.abs(clamped) < 1e-6) {
        newShears.delete(plane);
      } else {
        newShears.set(plane, clamped);
      }
      return { shears: newShears };
    });
  },

  resetShear: (plane: string) => {
    set((state) => {
      const newShears = new Map(state.shears);
      newShears.delete(plane);
      return { shears: newShears };
    });
  },

  resetAllShears: () => {
    set({ shears: new Map() });
  },

  getShearMatrix: () => {
    const state = get();
    const shearEntries = Array.from(state.shears.entries());

    if (shearEntries.length === 0) {
      return createIdentityMatrix(state.dimension);
    }

    // Compose all shear matrices
    let result = createIdentityMatrix(state.dimension);
    for (const [plane, amount] of shearEntries) {
      try {
        const [axis1, axis2] = parsePlaneToAxes(plane);
        if (axis1 < state.dimension && axis2 < state.dimension) {
          const shearMatrix = createShearMatrix(state.dimension, axis1, axis2, amount);
          // Simple composition - multiply matrices
          const newResult: MatrixND = [];
          for (let i = 0; i < state.dimension; i++) {
            newResult[i] = [];
            for (let j = 0; j < state.dimension; j++) {
              let sum = 0;
              for (let k = 0; k < state.dimension; k++) {
                sum += result[i]![k]! * shearMatrix[k]![j]!;
              }
              newResult[i]![j] = sum;
            }
          }
          result = newResult;
        }
      } catch {
        // Skip invalid planes
      }
    }

    return result;
  },

  // Translation actions
  setTranslation: (axis: number, value: number) => {
    const clamped = clampTranslation(value);
    set((state) => {
      if (axis < 0 || axis >= state.dimension) {
        return state;
      }

      const newTranslation = [...state.translation];
      newTranslation[axis] = clamped;
      return { translation: newTranslation };
    });
  },

  resetTranslation: () => {
    set((state) => ({
      translation: createDefaultTranslation(state.dimension),
    }));
  },

  center: () => {
    set((state) => ({
      translation: createDefaultTranslation(state.dimension),
    }));
  },

  getTranslationVector: () => {
    return get().translation;
  },

  // General actions
  setDimension: (dimension: number) => {
    if (dimension < 3 || dimension > 6) {
      return;
    }

    set((state) => {
      // Preserve existing values where possible, extend or truncate as needed
      const newPerAxisScale = createDefaultScales(dimension);
      for (let i = 0; i < Math.min(dimension, state.perAxisScale.length); i++) {
        newPerAxisScale[i] = state.perAxisScale[i]!;
      }

      const newTranslation = createDefaultTranslation(dimension);
      for (let i = 0; i < Math.min(dimension, state.translation.length); i++) {
        newTranslation[i] = state.translation[i]!;
      }

      // Filter shears to only include valid planes for new dimension
      const newShears = new Map<string, number>();
      for (const [plane, amount] of state.shears.entries()) {
        try {
          const [axis1, axis2] = parsePlaneToAxes(plane);
          if (axis1 < dimension && axis2 < dimension) {
            newShears.set(plane, amount);
          }
        } catch {
          // Skip invalid planes
        }
      }

      return {
        dimension,
        perAxisScale: newPerAxisScale,
        translation: newTranslation,
        shears: newShears,
      };
    });
  },

  resetAll: () => {
    set((state) => ({
      uniformScale: DEFAULT_SCALE,
      perAxisScale: createDefaultScales(state.dimension),
      scaleLocked: true,
      shears: new Map(),
      translation: createDefaultTranslation(state.dimension),
    }));
  },
}));
