/**
 * Extended Object State Management using Zustand
 *
 * Manages parameters for all object types including:
 * - Polytopes (hypercube, simplex, cross-polytope) - scale configuration
 * - Hypersphere (surface/solid point clouds)
 * - Root Systems (A, D, E8 polytopes)
 * - Clifford Torus (flat torus on S^3)
 * - Mandelbrot Set (n-dimensional fractal)
 *
 * The unified configuration ensures visual consistency across all object types.
 *
 * @see docs/prd/extended-objects.md
 * @see docs/research/nd-extended-objects-guide.md
 */

import { create } from 'zustand';
import type {
  PolytopeConfig,
  HypersphereConfig,
  HypersphereMode,
  RootSystemConfig,
  RootSystemType,
  CliffordTorusConfig,
  CliffordTorusEdgeMode,
  CliffordTorusMode,
  MandelbrotConfig,
  MandelbrotColorMode,
  MandelbrotEdgeMode,
  MandelbrotPalette,
  MandelbrotQualityPreset,
  MandelbrotRenderStyle,
} from '@/lib/geometry/extended/types';
import {
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_HYPERSPHERE_CONFIG,
  DEFAULT_ROOT_SYSTEM_CONFIG,
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_MANDELBROT_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
} from '@/lib/geometry/extended/types';

// ============================================================================
// State Interface
// ============================================================================

interface ExtendedObjectState {
  // --- Polytope State (for unified scale control) ---
  polytope: PolytopeConfig;

  // --- Hypersphere State ---
  hypersphere: HypersphereConfig;

  // --- Root System State ---
  rootSystem: RootSystemConfig;

  // --- Clifford Torus State ---
  cliffordTorus: CliffordTorusConfig;

  // --- Mandelbrot State ---
  mandelbrot: MandelbrotConfig;

  // --- Polytope Actions ---
  setPolytopeScale: (scale: number) => void;

  // --- Hypersphere Actions ---
  setHypersphereMode: (mode: HypersphereMode) => void;
  setHypersphereSampleCount: (count: number) => void;
  setHypersphereRadius: (radius: number) => void;
  setHypersphereWireframeEnabled: (enabled: boolean) => void;
  setHypersphereNeighborCount: (count: number) => void;

  // --- Root System Actions ---
  setRootSystemType: (type: RootSystemType) => void;
  setRootSystemScale: (scale: number) => void;

  // --- Clifford Torus Actions ---
  setCliffordTorusMode: (mode: CliffordTorusMode) => void;
  setCliffordTorusRadius: (radius: number) => void;
  setCliffordTorusResolutionU: (resolution: number) => void;
  setCliffordTorusResolutionV: (resolution: number) => void;
  setCliffordTorusEdgeMode: (mode: CliffordTorusEdgeMode) => void;
  setCliffordTorusK: (k: number) => void;
  setCliffordTorusStepsPerCircle: (steps: number) => void;

  // --- Mandelbrot Actions ---
  setMandelbrotMaxIterations: (value: number) => void;
  setMandelbrotEscapeRadius: (value: number) => void;
  setMandelbrotQualityPreset: (preset: MandelbrotQualityPreset) => void;
  setMandelbrotResolution: (value: number) => void;
  setMandelbrotVisualizationAxes: (axes: [number, number, number]) => void;
  setMandelbrotVisualizationAxis: (index: 0 | 1 | 2, dimIndex: number) => void;
  setMandelbrotParameterValue: (dimIndex: number, value: number) => void;
  setMandelbrotParameterValues: (values: number[]) => void;
  resetMandelbrotParameters: () => void;
  setMandelbrotCenter: (center: number[]) => void;
  setMandelbrotExtent: (extent: number) => void;
  fitMandelbrotToView: () => void;
  setMandelbrotColorMode: (mode: MandelbrotColorMode) => void;
  setMandelbrotPalette: (palette: MandelbrotPalette) => void;
  setMandelbrotCustomPalette: (palette: { start: string; mid: string; end: string }) => void;
  setMandelbrotInvertColors: (invert: boolean) => void;
  setMandelbrotInteriorColor: (color: string) => void;
  setMandelbrotPaletteCycles: (cycles: number) => void;
  setMandelbrotRenderStyle: (style: MandelbrotRenderStyle) => void;
  setMandelbrotPointSize: (size: number) => void;
  setMandelbrotIsosurfaceThreshold: (threshold: number) => void;
  setMandelbrotEdgeMode: (mode: MandelbrotEdgeMode) => void;
  initializeMandelbrotForDimension: (dimension: number) => void;
  getMandelbrotConfig: () => MandelbrotConfig;

  // --- Reset Action ---
  reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useExtendedObjectStore = create<ExtendedObjectState>((set, get) => ({
  // --- Initial State ---
  polytope: { ...DEFAULT_POLYTOPE_CONFIG },
  hypersphere: { ...DEFAULT_HYPERSPHERE_CONFIG },
  rootSystem: { ...DEFAULT_ROOT_SYSTEM_CONFIG },
  cliffordTorus: { ...DEFAULT_CLIFFORD_TORUS_CONFIG },
  mandelbrot: { ...DEFAULT_MANDELBROT_CONFIG },

  // --- Polytope Actions ---
  setPolytopeScale: (scale: number) => {
    // Same range as hypersphere radius for consistency (0.5-3.0)
    const clampedScale = Math.max(0.5, Math.min(3.0, scale));
    set((state) => ({
      polytope: { ...state.polytope, scale: clampedScale },
    }));
  },

  // --- Hypersphere Actions ---
  setHypersphereMode: (mode: HypersphereMode) => {
    set((state) => ({
      hypersphere: { ...state.hypersphere, mode },
    }));
  },

  setHypersphereSampleCount: (count: number) => {
    const clampedCount = Math.max(200, Math.min(10000, Math.floor(count)));
    set((state) => ({
      hypersphere: { ...state.hypersphere, sampleCount: clampedCount },
    }));
  },

  setHypersphereRadius: (radius: number) => {
    const clampedRadius = Math.max(0.5, Math.min(3.0, radius));
    set((state) => ({
      hypersphere: { ...state.hypersphere, radius: clampedRadius },
    }));
  },

  setHypersphereWireframeEnabled: (enabled: boolean) => {
    set((state) => ({
      hypersphere: { ...state.hypersphere, wireframeEnabled: enabled },
    }));
  },

  setHypersphereNeighborCount: (count: number) => {
    const clampedCount = Math.max(2, Math.min(10, Math.floor(count)));
    set((state) => ({
      hypersphere: { ...state.hypersphere, neighborCount: clampedCount },
    }));
  },

  // --- Root System Actions ---
  setRootSystemType: (type: RootSystemType) => {
    set((state) => ({
      rootSystem: { ...state.rootSystem, rootType: type },
    }));
  },

  setRootSystemScale: (scale: number) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, scale));
    set((state) => ({
      rootSystem: { ...state.rootSystem, scale: clampedScale },
    }));
  },

  // --- Clifford Torus Actions ---
  setCliffordTorusMode: (mode: CliffordTorusMode) => {
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, mode },
    }));
  },

  setCliffordTorusRadius: (radius: number) => {
    const clampedRadius = Math.max(0.5, Math.min(3.0, radius));
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, radius: clampedRadius },
    }));
  },

  setCliffordTorusResolutionU: (resolution: number) => {
    const clampedResolution = Math.max(8, Math.min(128, Math.floor(resolution)));
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, resolutionU: clampedResolution },
    }));
  },

  setCliffordTorusResolutionV: (resolution: number) => {
    const clampedResolution = Math.max(8, Math.min(128, Math.floor(resolution)));
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, resolutionV: clampedResolution },
    }));
  },

  setCliffordTorusEdgeMode: (mode: CliffordTorusEdgeMode) => {
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, edgeMode: mode },
    }));
  },

  setCliffordTorusK: (k: number) => {
    // k must be at least 1 (for a circle), no upper limit here - validated at generation time
    const clampedK = Math.max(1, Math.floor(k));
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, k: clampedK },
    }));
  },

  setCliffordTorusStepsPerCircle: (steps: number) => {
    // Reasonable range: 4-64 steps per circle (total points = steps^k)
    const clampedSteps = Math.max(4, Math.min(64, Math.floor(steps)));
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, stepsPerCircle: clampedSteps },
    }));
  },

  // --- Mandelbrot Actions ---
  setMandelbrotMaxIterations: (value: number) => {
    const clampedValue = Math.max(10, Math.min(500, Math.floor(value)));
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, maxIterations: clampedValue },
    }));
  },

  setMandelbrotEscapeRadius: (value: number) => {
    const clampedValue = Math.max(2.0, Math.min(10.0, value));
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, escapeRadius: clampedValue },
    }));
  },

  setMandelbrotQualityPreset: (preset: MandelbrotQualityPreset) => {
    const settings = MANDELBROT_QUALITY_PRESETS[preset];
    set((state) => ({
      mandelbrot: {
        ...state.mandelbrot,
        qualityPreset: preset,
        maxIterations: settings.maxIterations,
        resolution: settings.resolution,
      },
    }));
  },

  setMandelbrotResolution: (value: number) => {
    // Valid resolutions: 16, 24, 32, 48, 64, 96, 128
    const validResolutions = [16, 24, 32, 48, 64, 96, 128];
    const closest = validResolutions.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, resolution: closest },
    }));
  },

  setMandelbrotVisualizationAxes: (axes: [number, number, number]) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, visualizationAxes: axes },
    }));
  },

  setMandelbrotVisualizationAxis: (index: 0 | 1 | 2, dimIndex: number) => {
    const current = [...get().mandelbrot.visualizationAxes] as [number, number, number];
    current[index] = dimIndex;
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, visualizationAxes: current },
    }));
  },

  setMandelbrotParameterValue: (dimIndex: number, value: number) => {
    const values = [...get().mandelbrot.parameterValues];
    // Clamp to reasonable range for Mandelbrot exploration
    const clampedValue = Math.max(-2.0, Math.min(2.0, value));
    values[dimIndex] = clampedValue;
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, parameterValues: values },
    }));
  },

  setMandelbrotParameterValues: (values: number[]) => {
    const clampedValues = values.map(v => Math.max(-2.0, Math.min(2.0, v)));
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, parameterValues: clampedValues },
    }));
  },

  resetMandelbrotParameters: () => {
    const len = get().mandelbrot.parameterValues.length;
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, parameterValues: new Array(len).fill(0) },
    }));
  },

  setMandelbrotCenter: (center: number[]) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, center },
    }));
  },

  setMandelbrotExtent: (extent: number) => {
    const clampedExtent = Math.max(0.001, Math.min(10.0, extent));
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, extent: clampedExtent },
    }));
  },

  fitMandelbrotToView: () => {
    const centerLen = get().mandelbrot.center.length;
    set((state) => ({
      mandelbrot: {
        ...state.mandelbrot,
        center: new Array(centerLen).fill(0),
        extent: 2.5,
      },
    }));
  },

  setMandelbrotColorMode: (mode: MandelbrotColorMode) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, colorMode: mode },
    }));
  },

  setMandelbrotPalette: (palette: MandelbrotPalette) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, palette },
    }));
  },

  setMandelbrotCustomPalette: (palette: { start: string; mid: string; end: string }) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, customPalette: palette },
    }));
  },

  setMandelbrotInvertColors: (invert: boolean) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, invertColors: invert },
    }));
  },

  setMandelbrotInteriorColor: (color: string) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, interiorColor: color },
    }));
  },

  setMandelbrotPaletteCycles: (cycles: number) => {
    const clampedCycles = Math.max(1, Math.min(20, Math.floor(cycles)));
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, paletteCycles: clampedCycles },
    }));
  },

  setMandelbrotRenderStyle: (style: MandelbrotRenderStyle) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, renderStyle: style },
    }));
  },

  setMandelbrotPointSize: (size: number) => {
    const clampedSize = Math.max(1, Math.min(20, size));
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, pointSize: clampedSize },
    }));
  },

  setMandelbrotIsosurfaceThreshold: (threshold: number) => {
    const clampedThreshold = Math.max(0.0, Math.min(1.0, threshold));
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, isosurfaceThreshold: clampedThreshold },
    }));
  },

  setMandelbrotEdgeMode: (mode: MandelbrotEdgeMode) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, edgeMode: mode },
    }));
  },

  initializeMandelbrotForDimension: (dimension: number) => {
    const paramCount = Math.max(0, dimension - 3);
    set((state) => ({
      mandelbrot: {
        ...state.mandelbrot,
        parameterValues: new Array(paramCount).fill(0),
        center: new Array(dimension).fill(0),
        visualizationAxes: [0, 1, 2],
      },
    }));
  },

  getMandelbrotConfig: (): MandelbrotConfig => {
    return { ...get().mandelbrot };
  },

  // --- Reset Action ---
  reset: () => {
    set({
      polytope: { ...DEFAULT_POLYTOPE_CONFIG },
      hypersphere: { ...DEFAULT_HYPERSPHERE_CONFIG },
      rootSystem: { ...DEFAULT_ROOT_SYSTEM_CONFIG },
      cliffordTorus: { ...DEFAULT_CLIFFORD_TORUS_CONFIG },
      mandelbrot: { ...DEFAULT_MANDELBROT_CONFIG },
    });
  },
}));
