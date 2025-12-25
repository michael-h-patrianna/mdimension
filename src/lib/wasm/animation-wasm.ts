/**
 * WASM Animation Service
 *
 * Provides high-performance WASM functions for the animation loop.
 * Initializes asynchronously and falls back to JS implementations
 * if WASM is not yet ready.
 *
 * Functions:
 * - composeRotationsWasm: Compose rotation matrices from plane names and angles
 * - projectVerticesWasm: Project nD vertices to 3D positions
 * - multiplyMatrixVectorWasm: Matrix-vector multiplication
 * - applyRotationWasm: Apply rotation matrix to vertices
 */

import type { MatrixND, VectorND } from '@/lib/math/types'

// WASM module types
interface WasmModule {
  // Phase 1: Animation operations
  compose_rotations_wasm: (
    dimension: number,
    plane_names: string[],
    angles: Float64Array | number[]
  ) => Float64Array
  project_vertices_wasm: (
    flat_vertices: Float64Array,
    dimension: number,
    projection_distance: number
  ) => Float32Array
  project_edges_wasm: (
    flat_vertices: Float64Array,
    dimension: number,
    flat_edges: Uint32Array,
    projection_distance: number
  ) => Float32Array
  multiply_matrix_vector_wasm: (
    matrix: Float64Array,
    vector: Float64Array,
    dimension: number
  ) => Float64Array
  apply_rotation_wasm: (
    flat_vertices: Float64Array,
    dimension: number,
    rotation_matrix: Float64Array
  ) => Float64Array
  // Phase 2: Matrix and vector operations
  multiply_matrices_wasm: (a: Float64Array, b: Float64Array, dimension: number) => Float64Array
  dot_product_wasm: (a: Float64Array, b: Float64Array) => number
  magnitude_wasm: (v: Float64Array) => number
  normalize_vector_wasm: (v: Float64Array) => Float64Array
  subtract_vectors_wasm: (a: Float64Array, b: Float64Array) => Float64Array
  distance_wasm: (a: Float64Array, b: Float64Array) => number
  distance_squared_wasm: (a: Float64Array, b: Float64Array) => number
}

// ============================================================================
// WASM Service State
// ============================================================================

let wasmModule: WasmModule | null = null
let wasmInitPromise: Promise<void> | null = null
let wasmReady = false
let wasmError: Error | null = null

/**
 * Initialize the WASM module for animation operations.
 * Call this once at app startup to enable WASM acceleration.
 * Safe to call multiple times - subsequent calls are no-ops.
 *
 * @returns Promise that resolves when WASM is ready
 */
export async function initAnimationWasm(): Promise<void> {
  // Already initialized
  if (wasmReady) {
    return
  }

  // Already initializing
  if (wasmInitPromise) {
    return wasmInitPromise
  }

  wasmInitPromise = (async () => {
    // Skip WASM loading in test environment
    if (import.meta.env.MODE === 'test' || typeof process !== 'undefined') {
      wasmError = new Error('WASM disabled in test environment')
      return
    }

    try {
      // Dynamic import - the module path must be a literal for Vite's analysis
      const wasm = await import('mdimension-core')

      await wasm.default()
      wasm.start()

      // Store the module for synchronous access
      wasmModule = wasm as unknown as WasmModule
      wasmReady = true

      if (import.meta.env.DEV) {
        console.log('[AnimationWASM] Initialized successfully')
      }
    } catch (err) {
      wasmError = err instanceof Error ? err : new Error(String(err))
      if (import.meta.env.DEV) {
        console.warn('[AnimationWASM] Initialization failed, using JS fallback:', wasmError.message)
      }
    }
  })()

  return wasmInitPromise
}

/**
 * Check if WASM is ready for use.
 * @returns true if WASM is initialized and ready
 */
export function isAnimationWasmReady(): boolean {
  return wasmReady
}

/**
 * Get the initialization error if any.
 * @returns Error if initialization failed, null otherwise
 */
export function getWasmError(): Error | null {
  return wasmError
}

// ============================================================================
// WASM-Accelerated Functions
// ============================================================================

/**
 * Compose multiple rotations using WASM if available.
 * Falls back to null if WASM is not ready (caller should use JS fallback).
 *
 * @param dimension - The dimensionality of the space
 * @param planeNames - Array of plane names (e.g., ["XY", "XW", "ZW"])
 * @param angles - Array of rotation angles in radians
 * @returns Flat rotation matrix as Float64Array, or null if WASM not ready
 */
export function composeRotationsWasm(
  dimension: number,
  planeNames: string[],
  angles: number[]
): Float64Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.compose_rotations_wasm(dimension, planeNames, angles)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] compose_rotations_wasm failed:', err)
    }
    return null
  }
}

/**
 * Project nD vertices to 3D using WASM if available.
 *
 * @param flatVertices - Flat array of vertex coordinates
 * @param dimension - Dimensionality of each vertex
 * @param projectionDistance - Distance from projection plane
 * @returns Float32Array of 3D positions, or null if WASM not ready
 */
export function projectVerticesWasm(
  flatVertices: Float64Array,
  dimension: number,
  projectionDistance: number
): Float32Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.project_vertices_wasm(flatVertices, dimension, projectionDistance)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] project_vertices_wasm failed:', err)
    }
    return null
  }
}

/**
 * Project edge pairs to 3D positions using WASM if available.
 *
 * @param flatVertices - Flat array of vertex coordinates
 * @param dimension - Dimensionality of each vertex
 * @param flatEdges - Flat array of edge indices [start0, end0, start1, end1, ...]
 * @param projectionDistance - Distance from projection plane
 * @returns Float32Array of edge positions, or null if WASM not ready
 */
export function projectEdgesWasm(
  flatVertices: Float64Array,
  dimension: number,
  flatEdges: Uint32Array,
  projectionDistance: number
): Float32Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.project_edges_wasm(flatVertices, dimension, flatEdges, projectionDistance)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] project_edges_wasm failed:', err)
    }
    return null
  }
}

/**
 * Multiply matrix by vector using WASM if available.
 *
 * @param matrix - Flat n×n matrix (row-major) as Float64Array
 * @param vector - Input vector as Float64Array
 * @param dimension - Matrix/vector dimension
 * @returns Result vector as Float64Array, or null if WASM not ready
 */
export function multiplyMatrixVectorWasm(
  matrix: Float64Array,
  vector: Float64Array,
  dimension: number
): Float64Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.multiply_matrix_vector_wasm(matrix, vector, dimension)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] multiply_matrix_vector_wasm failed:', err)
    }
    return null
  }
}

/**
 * Apply rotation matrix to vertices using WASM if available.
 *
 * @param flatVertices - Flat array of vertex coordinates
 * @param dimension - Dimensionality of each vertex
 * @param rotationMatrix - Flat rotation matrix (dimension × dimension)
 * @returns Rotated vertices as Float64Array, or null if WASM not ready
 */
export function applyRotationWasm(
  flatVertices: Float64Array,
  dimension: number,
  rotationMatrix: Float64Array
): Float64Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.apply_rotation_wasm(flatVertices, dimension, rotationMatrix)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] apply_rotation_wasm failed:', err)
    }
    return null
  }
}

// ============================================================================
// Phase 2: Matrix and Vector WASM Functions
// ============================================================================

/**
 * Multiply two matrices using WASM if available.
 *
 * @param a - First matrix (n×n, row-major) as Float64Array
 * @param b - Second matrix (n×n, row-major) as Float64Array
 * @param dimension - Matrix dimension
 * @returns Result matrix as Float64Array, or null if WASM not ready
 */
export function multiplyMatricesWasm(
  a: Float64Array,
  b: Float64Array,
  dimension: number
): Float64Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.multiply_matrices_wasm(a, b, dimension)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] multiply_matrices_wasm failed:', err)
    }
    return null
  }
}

/**
 * Compute dot product using WASM if available.
 *
 * @param a - First vector as Float64Array
 * @param b - Second vector as Float64Array
 * @returns Dot product value, or null if WASM not ready
 */
export function dotProductWasm(a: Float64Array, b: Float64Array): number | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.dot_product_wasm(a, b)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] dot_product_wasm failed:', err)
    }
    return null
  }
}

/**
 * Compute magnitude using WASM if available.
 *
 * @param v - Input vector as Float64Array
 * @returns Magnitude value, or null if WASM not ready
 */
export function magnitudeWasm(v: Float64Array): number | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.magnitude_wasm(v)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] magnitude_wasm failed:', err)
    }
    return null
  }
}

/**
 * Normalize vector using WASM if available.
 *
 * @param v - Input vector as Float64Array
 * @returns Normalized vector as Float64Array, or null if WASM not ready
 */
export function normalizeVectorWasm(v: Float64Array): Float64Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.normalize_vector_wasm(v)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] normalize_vector_wasm failed:', err)
    }
    return null
  }
}

/**
 * Subtract vectors using WASM if available.
 *
 * @param a - First vector as Float64Array
 * @param b - Second vector as Float64Array
 * @returns Difference vector as Float64Array, or null if WASM not ready
 */
export function subtractVectorsWasm(a: Float64Array, b: Float64Array): Float64Array | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.subtract_vectors_wasm(a, b)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] subtract_vectors_wasm failed:', err)
    }
    return null
  }
}

/**
 * Compute distance using WASM if available.
 *
 * @param a - First point as Float64Array
 * @param b - Second point as Float64Array
 * @returns Distance value, or null if WASM not ready
 */
export function distanceWasm(a: Float64Array, b: Float64Array): number | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.distance_wasm(a, b)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] distance_wasm failed:', err)
    }
    return null
  }
}

/**
 * Compute squared distance using WASM if available.
 *
 * @param a - First point as Float64Array
 * @param b - Second point as Float64Array
 * @returns Squared distance value, or null if WASM not ready
 */
export function distanceSquaredWasm(a: Float64Array, b: Float64Array): number | null {
  if (!wasmReady || !wasmModule) {
    return null
  }

  try {
    return wasmModule.distance_squared_wasm(a, b)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AnimationWASM] distance_squared_wasm failed:', err)
    }
    return null
  }
}

// ============================================================================
// Helper Functions for Data Conversion
// ============================================================================

/**
 * Convert a MatrixND (Float32Array) to Float64Array for WASM input.
 * @param matrix - Input matrix as Float32Array
 * @returns Matrix as Float64Array
 */
export function matrixToFloat64(matrix: MatrixND): Float64Array {
  return new Float64Array(matrix)
}

/**
 * Convert Float64Array result back to MatrixND (Float32Array).
 * @param matrix - Input matrix as Float64Array
 * @returns Matrix as Float32Array
 */
export function float64ToMatrix(matrix: Float64Array): MatrixND {
  return new Float32Array(matrix)
}

/**
 * Convert a VectorND (number[]) to Float64Array for WASM input.
 * @param vector - Input vector as number[]
 * @returns Vector as Float64Array
 */
export function vectorToFloat64(vector: VectorND): Float64Array {
  return new Float64Array(vector)
}

/**
 * Convert Float64Array result back to VectorND (number[]).
 * @param vector - Input vector as Float64Array
 * @returns Vector as number[]
 */
export function float64ToVector(vector: Float64Array): VectorND {
  return Array.from(vector)
}

/**
 * Flatten 2D vertices array to Float64Array.
 * @param vertices - Array of vertex arrays
 * @returns Flat Float64Array
 */
export function flattenVertices(vertices: VectorND[]): Float64Array {
  if (vertices.length === 0) return new Float64Array(0)
  const dimension = vertices[0]!.length
  const flat = new Float64Array(vertices.length * dimension)
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!
    const offset = i * dimension
    for (let j = 0; j < dimension; j++) {
      flat[offset + j] = v[j]!
    }
  }
  return flat
}

/**
 * Flatten edge pairs to Uint32Array.
 * @param edges - Array of edge pairs
 * @returns Flat Uint32Array
 */
export function flattenEdges(edges: [number, number][]): Uint32Array {
  const flat = new Uint32Array(edges.length * 2)
  for (let i = 0; i < edges.length; i++) {
    flat[i * 2] = edges[i]![0]
    flat[i * 2 + 1] = edges[i]![1]
  }
  return flat
}
