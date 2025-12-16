/**
 * Unified Renderer Entry Point
 *
 * Single component that determines render mode and delegates to the appropriate
 * high-performance useFrame-based renderer.
 *
 * Render modes:
 * - polytope: Traditional polytopes (hypercube, simplex, cross-polytope) with faces/edges/vertices
 * - raymarch-mandelbrot: Raymarched 3D-11D surfaces (unified Hyperbulb for all dimensions)
 *
 * All renderers use useFrame for transformations, reading from stores via getState()
 * to bypass React's render cycle completely during animation.
 */

import type { Face } from '@/lib/geometry/faces';
import type { NdGeometry, ObjectType } from '@/lib/geometry/types';
import { determineRenderMode as determineRenderModeFromRegistry } from '@/lib/geometry/registry';
import { useAppearanceStore } from '@/stores/appearanceStore';
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import HyperbulbMesh from './Hyperbulb/HyperbulbMesh';
import KaliMesh from './Kali/KaliMesh';
import QuaternionJuliaMesh from './QuaternionJulia/QuaternionJuliaMesh';
import { PolytopeScene } from './Polytope';

/**
 * Render mode types
 */
export type RenderMode = 'polytope' | 'raymarch-mandelbrot' | 'raymarch-quaternion-julia' | 'raymarch-kali' | 'none';

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
 *
 * Uses the registry to determine rendering capabilities for each object type.
 *
 * @param geometry - The geometry being rendered
 * @param objectType - Type of object being rendered
 * @param dimension - Current dimension
 * @param facesVisible - Whether faces are visible
 * @returns The appropriate render mode
 */
export function determineRenderMode(
  geometry: NdGeometry,
  objectType: ObjectType,
  dimension: number,
  facesVisible: boolean
): RenderMode {
  // Use registry-based determination
  const mode = determineRenderModeFromRegistry(objectType, dimension, facesVisible);

  // If registry returns 'polytope', verify we have vertices
  if (mode === 'polytope' && geometry.vertices.length === 0) {
    return 'none';
  }

  return mode;
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
  const facesVisible = useAppearanceStore(
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

      {/* Raymarched 3D-11D Quaternion Julia */}
      {renderMode === 'raymarch-quaternion-julia' && <QuaternionJuliaMesh />}

      {/* Raymarched 3D-11D Kali reciprocal fractal */}
      {renderMode === 'raymarch-kali' && <KaliMesh />}
    </>
  );
});
