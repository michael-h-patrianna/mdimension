/**
 * Types and interfaces for Wythoff polytope generation.
 *
 * @see https://en.wikipedia.org/wiki/Wythoff_construction
 */

import type { VectorND } from '@/lib/math'
import type { PolytopeGeometry } from '../types'

/**
 * Wythoff symbol specifies which vertices are "ringed" in the Coxeter-Dynkin diagram.
 */
export type WythoffSymbol = boolean[]

/**
 * Symmetry group type for Wythoff construction
 * - A: Simplex symmetry (An) - n! symmetry operations
 * - B: Hypercube/Orthoplex symmetry (Bn/Cn) - 2^n * n! symmetry operations
 * - D: Demihypercube symmetry (Dn) - 2^(n-1) * n! symmetry operations
 */
export type WythoffSymmetryGroup = 'A' | 'B' | 'D'

/**
 * Preset Wythoff polytope types with descriptive names
 */
export type WythoffPreset =
  | 'regular' // Regular polytope (first node ringed)
  | 'rectified' // Rectified (second node ringed)
  | 'truncated' // Truncated (first two nodes ringed)
  | 'cantellated' // Cantellated (first and third nodes ringed)
  | 'runcinated' // Runcinated (first and last nodes ringed)
  | 'omnitruncated' // All nodes ringed
  | 'custom' // Custom Wythoff symbol

/**
 * Configuration for Wythoff polytope generation
 */
export interface WythoffPolytopeConfig {
  /** Symmetry group (A, B, or D) */
  symmetryGroup: WythoffSymmetryGroup
  /** Preset type or custom */
  preset: WythoffPreset
  /** Custom Wythoff symbol (only used when preset is 'custom') */
  customSymbol: boolean[]
  /** Scale factor for the polytope */
  scale: number
  /** Snub variant (alternated omnitruncation) - only for some configurations */
  snub: boolean
}

/**
 * Default Wythoff polytope configuration
 */
export const DEFAULT_WYTHOFF_POLYTOPE_CONFIG: WythoffPolytopeConfig = {
  symmetryGroup: 'B',
  preset: 'regular',
  customSymbol: [],
  scale: 2.0,
  snub: false,
}

/**
 * Result type for Wythoff polytope generation with warnings.
 * Use this when you need to know if limits were reached during generation.
 */
export interface WythoffGenerationResult {
  /** The generated polytope geometry */
  geometry: PolytopeGeometry
  /** Warning messages about limits reached during generation */
  warnings: string[]
}

/**
 * Collector for warnings during polytope generation.
 * Thread-safe: each generation creates its own instance.
 */
export class WarningCollector {
  private warnings: string[] = []

  /**
   * Add a warning message
   * @param message
   */
  add(message: string): void {
    this.warnings.push(message)
  }

  /**
   * Get all collected warnings (returns a copy)
   * @returns Array of warning messages
   */
  get(): string[] {
    return [...this.warnings]
  }

  /**
   * Check if any warnings were collected
   * @returns True if warnings exist
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0
  }

  /**
   * Clear all warnings
   */
  clear(): void {
    this.warnings = []
  }
}

/**
 * Internal result type for vertex/edge/face generation
 */
export interface PolytopeData {
  vertices: VectorND[]
  edges: [number, number][]
  faces: number[][] // Each face is a list of vertex indices (triangles or quads)
}

/**
 * Get human-readable name for a Wythoff preset
 *
 * @param preset - The Wythoff preset type
 * @param symmetryGroup - The symmetry group (A, B, or D)
 * @param dimension - The dimension of the polytope
 * @returns Human-readable name for the configuration
 */
export function getWythoffPresetName(
  preset: WythoffPreset,
  symmetryGroup: WythoffSymmetryGroup,
  dimension: number
): string {
  const baseNames: Record<WythoffPreset, string> = {
    regular: 'Regular',
    rectified: 'Rectified',
    truncated: 'Truncated',
    cantellated: 'Cantellated',
    runcinated: 'Runcinated',
    omnitruncated: 'Omnitruncated',
    custom: 'Custom',
  }

  const groupNames: Record<WythoffSymmetryGroup, string> = {
    A: 'Simplex',
    B: 'Hypercube',
    D: 'Demihypercube',
  }

  return `${baseNames[preset]} ${dimension}D ${groupNames[symmetryGroup]}`
}
