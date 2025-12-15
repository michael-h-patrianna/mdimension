/**
 * Unified Renderer Entry Point
 *
 * Single component that determines render mode and delegates to the appropriate
 * high-performance useFrame-based renderer.
 *
 * Render modes:
 * - polytope: Traditional polytopes (hypercube, simplex, cross-polytope) with faces/edges/vertices
 * - raymarch-mandelbrot: Raymarched 3D-11D surfaces (unified Hyperbulb for all dimensions)
 * - raymarch-mandelbox: Raymarched 3D-11D Mandelbox fractals
 * - raymarch-menger: Raymarched 3D-11D Menger sponge fractals
 *
 * All renderers use useFrame for transformations, reading from stores via getState()
 * to bypass React's render cycle completely during animation.
 */

import type { Face } from '@/lib/geometry/faces';
import type { NdGeometry, ObjectType } from '@/lib/geometry/types';
import { useVisualStore } from '@/stores/visualStore';
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import HyperbulbMesh from './Hyperbulb/HyperbulbMesh';
import MandelboxMesh from './Mandelbox/MandelboxMesh';
import MengerMesh from './Menger/MengerMesh';
import { PolytopeScene } from './Polytope';

/**
 * Render mode types
 */
export type RenderMode = 'polytope' |'raymarch-mandelbrot' | 'raymarch-mandelbox' | 'raymarch-menger' | 'none';

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
 * @param geometry
 * @param objectType
 * @param dimension
 * @param facesVisible
 */
export function determineRenderMode(
  geometry: NdGeometry,
  objectType: ObjectType,
  dimension: number,
  facesVisible: boolean
): RenderMode {
  // Mandelbox uses raymarching when faces are visible (no point cloud fallback)
  // Edges toggle controls fresnel rim lighting within MandelboxMesh
  // Vertices are disabled for mandelbox
  if (objectType === 'mandelbox' && dimension >= 3) {
    return facesVisible ? 'raymarch-mandelbox' : 'none';
  }

  // Menger uses raymarching when faces are visible (no point cloud fallback)
  // Similar to Mandelbox - edges toggle controls fresnel rim lighting
  if (objectType === 'menger' && dimension >= 3) {
    return facesVisible ? 'raymarch-menger' : 'none';
  }

  // Mandelbrot/Hyperbulb with faces visible uses raymarching (3D-11D unified)
  if (objectType === 'mandelbrot' && facesVisible && dimension >= 3) {
    return 'raymarch-mandelbrot';
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

      {/* Raymarched 3D-11D Mandelbulb/Hyperbulb surface (unified renderer) */}
      {renderMode === 'raymarch-mandelbrot' && <HyperbulbMesh />}

      {/* Raymarched 3D-11D Mandelbox surface */}
      {renderMode === 'raymarch-mandelbox' && <MandelboxMesh />}

      {/* Raymarched 3D-11D Menger Sponge */}
      {renderMode === 'raymarch-menger' && <MengerMesh />}
    </>
  );
});
