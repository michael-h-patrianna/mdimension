/**
 * Cosine Gradient Palette Presets
 *
 * Pre-configured coefficient sets for common color palettes.
 * Based on Inigo Quilez's cosine palette technique.
 *
 * @see https://iquilezles.org/articles/palettes/
 * @see docs/prd/advanced-color-system.md
 */

import type {
  ColorAlgorithm,
  CosineCoefficients,
  DistributionSettings,
} from './types';

/**
 * Preset keys for type safety
 */
export type PresetKey =
  | 'rainbow'
  | 'sunset'
  | 'ocean'
  | 'fire'
  | 'forest'
  | 'neon'
  | 'pastel'
  | 'grayscale'
  | 'ice'
  | 'magma'
  | 'aurora'
  | 'candy';

/**
 * Built-in cosine palette coefficient presets.
 * Each preset defines a unique color gradient.
 */
export const COSINE_PRESETS: Record<PresetKey, CosineCoefficients> = {
  rainbow: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  sunset: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.1, 0.2],
  },
  ocean: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.3, 0.2, 0.2],
  },
  fire: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 0.7, 0.4],
    d: [0.0, 0.15, 0.2],
  },
  forest: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.3, 0.5, 0.25],
  },
  neon: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [2.0, 1.0, 0.0],
    d: [0.5, 0.2, 0.25],
  },
  pastel: {
    a: [0.8, 0.8, 0.8],
    b: [0.2, 0.2, 0.2],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  grayscale: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [0.0, 0.0, 0.0],
    d: [0.0, 0.0, 0.0],
  },
  ice: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.5, 0.6, 0.7],
  },
  magma: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 0.8, 0.6],
    d: [0.0, 0.05, 0.15],
  },
  aurora: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.4, 0.6, 0.3],
  },
  candy: {
    a: [0.7, 0.7, 0.7],
    b: [0.3, 0.3, 0.3],
    c: [1.5, 1.0, 0.5],
    d: [0.0, 0.2, 0.5],
  },
} as const;

/**
 * Preset option type for dropdown menus.
 */
export interface PresetOption {
  value: string;
  label: string;
  coefficients: CosineCoefficients;
}

/**
 * Preset options for UI dropdown.
 */
export const COSINE_PRESET_OPTIONS: PresetOption[] = [
  { value: 'rainbow', label: 'Rainbow', coefficients: COSINE_PRESETS.rainbow },
  { value: 'sunset', label: 'Sunset', coefficients: COSINE_PRESETS.sunset },
  { value: 'ocean', label: 'Ocean', coefficients: COSINE_PRESETS.ocean },
  { value: 'fire', label: 'Fire', coefficients: COSINE_PRESETS.fire },
  { value: 'forest', label: 'Forest', coefficients: COSINE_PRESETS.forest },
  { value: 'neon', label: 'Neon', coefficients: COSINE_PRESETS.neon },
  { value: 'pastel', label: 'Pastel', coefficients: COSINE_PRESETS.pastel },
  { value: 'grayscale', label: 'Grayscale', coefficients: COSINE_PRESETS.grayscale },
  { value: 'ice', label: 'Ice', coefficients: COSINE_PRESETS.ice },
  { value: 'magma', label: 'Magma', coefficients: COSINE_PRESETS.magma },
  { value: 'aurora', label: 'Aurora', coefficients: COSINE_PRESETS.aurora },
  { value: 'candy', label: 'Candy', coefficients: COSINE_PRESETS.candy },
];

/**
 * Full color preset including algorithm and distribution settings.
 */
export interface ColorPreset {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Color algorithm to use */
  algorithm: ColorAlgorithm;
  /** Cosine palette coefficients */
  coefficients: CosineCoefficients;
  /** Distribution settings */
  distribution: DistributionSettings;
  /** Whether this is a built-in preset (cannot be deleted) */
  isBuiltIn: boolean;
}

/**
 * Built-in full presets with algorithm and distribution.
 */
export const BUILT_IN_PRESETS: ColorPreset[] = [
  {
    id: 'rainbow',
    name: 'Rainbow',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.rainbow,
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.sunset,
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.ocean,
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'fire-intense',
    name: 'Fire (Intense)',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.fire,
    distribution: { power: 0.7, cycles: 1.5, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'forest',
    name: 'Forest',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.forest,
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'neon-cycling',
    name: 'Neon (Cycling)',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.neon,
    distribution: { power: 1.0, cycles: 2.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'pastel-soft',
    name: 'Pastel (Soft)',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.pastel,
    distribution: { power: 0.5, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.grayscale,
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'ice-deep',
    name: 'Ice (Deep)',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.ice,
    distribution: { power: 1.5, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'magma-hot',
    name: 'Magma (Hot)',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.magma,
    distribution: { power: 0.8, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.aurora,
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  {
    id: 'candy-pop',
    name: 'Candy Pop',
    algorithm: 'cosine',
    coefficients: COSINE_PRESETS.candy,
    distribution: { power: 1.0, cycles: 1.5, offset: 0.25 },
    isBuiltIn: true,
  },
  // LCH-based presets
  {
    id: 'lch-smooth',
    name: 'LCH Smooth',
    algorithm: 'lch',
    coefficients: COSINE_PRESETS.rainbow, // Unused for LCH
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  // Normal-based presets
  {
    id: 'normal-rainbow',
    name: 'Normal Rainbow',
    algorithm: 'normal',
    coefficients: COSINE_PRESETS.rainbow,
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  // Monochromatic preset (uses base color)
  {
    id: 'monochromatic',
    name: 'Monochromatic',
    algorithm: 'monochromatic',
    coefficients: COSINE_PRESETS.rainbow, // Unused for monochromatic
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
  // Analogous preset (uses base color)
  {
    id: 'analogous',
    name: 'Analogous',
    algorithm: 'analogous',
    coefficients: COSINE_PRESETS.rainbow, // Unused for analogous
    distribution: { power: 1.0, cycles: 1.0, offset: 0.0 },
    isBuiltIn: true,
  },
];

/**
 * Get a preset by ID.
 */
export function getPresetById(id: string): ColorPreset | undefined {
  return BUILT_IN_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get default preset for a given algorithm.
 */
export function getDefaultPresetForAlgorithm(
  algorithm: ColorAlgorithm
): ColorPreset {
  const preset = BUILT_IN_PRESETS.find((p) => p.algorithm === algorithm);
  // BUILT_IN_PRESETS is guaranteed to have at least one element
  return preset ?? BUILT_IN_PRESETS[0]!;
}
