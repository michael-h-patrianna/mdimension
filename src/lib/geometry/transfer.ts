/**
 * Types and utilities for efficient geometry transfer between workers and main thread.
 * 
 * Uses TypedArrays and Transferable objects to minimize serialization overhead.
 */

import type { PolytopeGeometry, PolytopeType, GeometryMetadata } from './types'
import { createVector } from '@/lib/math'

/**
 * Transfer-optimized representation of PolytopeGeometry.
 * Uses flat TypedArrays instead of arrays of arrays.
 */
export interface TransferablePolytopeGeometry {
  /** Flattened vertex positions [v0_d0, v0_d1, ..., v1_d0, v1_d1, ...] */
  vertices: Float64Array
  /** Flattened edge indices [e0_start, e0_end, e1_start, e1_end, ...] */
  edges: Uint32Array
  /** Dimensionality of the vertices */
  dimension: number
  /** Type of polytope */
  type: PolytopeType
  /** Metadata (copied, not transferred) */
  metadata?: GeometryMetadata
}

/**
 * Flattens a PolytopeGeometry into a TransferablePolytopeGeometry.
 * 
 * @param geometry Source geometry
 * @returns Object containing the transferable geometry and the buffers to transfer
 */
export function flattenGeometry(geometry: PolytopeGeometry): {
  transferable: TransferablePolytopeGeometry
  buffers: ArrayBuffer[]
} {
  const { vertices, edges, dimension, type, metadata } = geometry
  
  // Flatten vertices
  const numVertices = vertices.length
  const flatVertices = new Float64Array(numVertices * dimension)
  for (let i = 0; i < numVertices; i++) {
    const v = vertices[i]!
    for (let d = 0; d < dimension; d++) {
      flatVertices[i * dimension + d] = v[d] ?? 0
    }
  }

  // Flatten edges
  const numEdges = edges.length
  const flatEdges = new Uint32Array(numEdges * 2)
  for (let i = 0; i < numEdges; i++) {
    const e = edges[i]!
    flatEdges[i * 2] = e[0]
    flatEdges[i * 2 + 1] = e[1]
  }

  return {
    transferable: {
      vertices: flatVertices,
      edges: flatEdges,
      dimension,
      type,
      metadata
    },
    buffers: [flatVertices.buffer, flatEdges.buffer]
  }
}

/**
 * Inflates a TransferablePolytopeGeometry back into a PolytopeGeometry.
 *
 * @param transferable Transferable geometry received from worker
 * @returns Standard PolytopeGeometry
 * @throws Error if data is corrupted or indices are out of bounds
 */
export function inflateGeometry(transferable: TransferablePolytopeGeometry): PolytopeGeometry {
  const { vertices: flatVertices, edges: flatEdges, dimension, type, metadata } = transferable

  // Validate input
  if (dimension < 1) {
    throw new Error(`Invalid dimension ${dimension}, must be >= 1`)
  }

  if (flatVertices.length % dimension !== 0) {
    throw new Error(
      `Vertex data corruption: buffer length ${flatVertices.length} is not divisible by dimension ${dimension}`
    )
  }

  if (flatEdges.length % 2 !== 0) {
    throw new Error(
      `Edge data corruption: buffer length ${flatEdges.length} is not divisible by 2`
    )
  }

  // Reconstruct vertices with bounds checking
  const numVertices = flatVertices.length / dimension
  const vertices = new Array(numVertices)
  for (let i = 0; i < numVertices; i++) {
    const v = createVector(dimension)
    for (let d = 0; d < dimension; d++) {
      const idx = i * dimension + d
      const value = flatVertices[idx]
      if (value === undefined) {
        throw new Error(`Vertex data corruption: index ${idx} out of bounds`)
      }
      v[d] = value
    }
    vertices[i] = v
  }

  // Reconstruct edges with bounds checking
  const numEdges = flatEdges.length / 2
  const edges = new Array(numEdges)
  for (let i = 0; i < numEdges; i++) {
    const idx0 = i * 2
    const idx1 = i * 2 + 1
    const v0 = flatEdges[idx0]
    const v1 = flatEdges[idx1]

    if (v0 === undefined || v1 === undefined) {
      throw new Error(`Edge data corruption: edge ${i} indices out of bounds`)
    }

    // Validate edge indices reference valid vertices
    if (v0 >= numVertices || v1 >= numVertices) {
      throw new Error(
        `Edge data corruption: edge ${i} references vertex ${Math.max(v0, v1)} but only ${numVertices} vertices exist`
      )
    }

    edges[i] = [v0, v1]
  }

  return {
    vertices,
    edges,
    dimension,
    type,
    metadata
  }
}
