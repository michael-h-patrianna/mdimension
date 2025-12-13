/**
 * Unified Renderer Entry Point
 *
 * Single component that determines render mode and delegates to the appropriate
 * high-performance useFrame-based renderer.
 *
 * Render modes:
 * - polytope: Traditional polytopes (hypercube, simplex, cross-polytope) with faces/edges/vertices
 * - pointcloud: Point cloud objects (hypersphere, root system, Clifford torus, Mandelbrot points)
 * - raymarch: Raymarched 3D surfaces (Mandelbulb at 3D, Hyperbulb at 4D+)
 *
 * All renderers use useFrame for transformations, reading from stores via getState()
 * to bypass React's render cycle completely during animation.
 */

import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Face } from '@/lib/geometry/faces';
import type { NdGeometry, ObjectType } from '@/lib/geometry/types';
import { PolytopeScene } from '../scenes/PolytopeScene';
import { PointCloudScene } from '../scenes/PointCloudScene';
import MandelbulbMesh from './Mandelbulb/MandelbulbMesh';
import HyperbulbMesh from './Hyperbulb/HyperbulbMesh';
import { useVisualStore } from '@/stores/visualStore';

/**
 * Render mode types
 */
export type RenderMode = 'polytope' | 'pointcloud' | 'raymarch-3d' | 'raymarch-4d+' | 'none';

/**
 * Props for UnifiedRenderer
 */
export interface UnifiedRendererProps {
  /** Generated geometry containing vertices, edges, and metadata */
  geometry: NdGeometry;
  /** Current dimension of the object */
  dimension: number;
  /** Type of object being rendered */
  objectType: ObjectType;
  /** Detected faces for surface rendering (polytopes only) */
  faces?: Face[];
  /** Per-face depth values for palette coloring (polytopes only) */
  faceDepths?: number[];
  /** Per-point colors for Mandelbrot visualization */
  pointColors?: string[];
  /** Overall opacity (default: 1.0) */
  opacity?: number;
}

/**
 * Determines the appropriate render mode based on object type and settings
 */
export function determineRenderMode(
  geometry: NdGeometry,
  objectType: ObjectType,
  dimension: number,
  facesVisible: boolean
): RenderMode {
  // Mandelbrot with faces visible uses raymarching
  if (objectType === 'mandelbrot' && facesVisible) {
    if (dimension === 3) return 'raymarch-3d';
    if (dimension >= 4) return 'raymarch-4d+';
  }

  // Point clouds use PointCloudScene
  if (geometry.isPointCloud) {
    return 'pointcloud';
  }

  // Traditional polytopes use PolytopeScene
  if (geometry.vertices.length > 0) {
    return 'polytope';
  }

  return 'none';
}

/**
 * Unified renderer that delegates to appropriate high-performance renderer.
 *
 * Benefits:
 * - Single entry point for all rendering
 * - Clean separation of render modes
 * - All renderers use useFrame for zero React re-renders during animation
 * - Consistent architecture across object types
 */
export const UnifiedRenderer = React.memo(function UnifiedRenderer({
  geometry,
  dimension,
  objectType,
  faces = [],
  faceDepths = [],
  pointColors,
  opacity = 1.0,
}: UnifiedRendererProps) {
  // Get facesVisible from store to determine raymarch mode
  const facesVisible = useVisualStore(
    useShallow((state) => state.facesVisible)
  );

  // Determine render mode
  const renderMode = useMemo(() => {
    return determineRenderMode(geometry, objectType, dimension, facesVisible);
  }, [geometry, objectType, dimension, facesVisible]);

  // Prepare edges
  const edges = useMemo(() => {
    return geometry.edges as [number, number][];
  }, [geometry.edges]);

  return (
    <>
      {/* Polytope rendering (hypercube, simplex, cross-polytope) */}
      {renderMode === 'polytope' && (
        <PolytopeScene
          baseVertices={geometry.vertices}
          edges={edges}
          faces={faces}
          dimension={dimension}
          faceDepths={faceDepths}
          opacity={opacity}
        />
      )}

      {/* Point cloud rendering (hypersphere, root system, Clifford torus, Mandelbrot points) */}
      {renderMode === 'pointcloud' && (
        <PointCloudScene
          baseVertices={geometry.vertices}
          dimension={dimension}
          edges={edges}
          pointColors={pointColors}
          opacity={opacity}
        />
      )}

      {/* Raymarched 3D Mandelbulb surface */}
      {renderMode === 'raymarch-3d' && <MandelbulbMesh />}

      {/* Raymarched 4D+ Hyperbulb surface */}
      {renderMode === 'raymarch-4d+' && <HyperbulbMesh />}
    </>
  );
});
