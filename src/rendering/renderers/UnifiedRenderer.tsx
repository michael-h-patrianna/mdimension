/**
 * Unified Renderer Entry Point
 *
 * Single component that determines render mode and delegates to the appropriate
 * high-performance useFrame-based renderer.
 *
 * Render modes:
 * - polytope: Traditional polytopes (hypercube, simplex, cross-polytope) with faces/edges/vertices
 * - raymarch-mandelbulb: Raymarched 3D-11D surfaces (unified Mandelbulb for all dimensions)
 *
 * All renderers use useFrame for transformations, reading from stores via getState()
 * to bypass React's render cycle completely during animation.
 */

import type { Face } from '@/lib/geometry/faces';
import type { NdGeometry, ObjectType } from '@/lib/geometry/types';
import { isWebGPURenderer } from '@/rendering/core/rendererUtils';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useThree } from '@react-three/fiber';
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BlackHoleMesh } from './BlackHole';
import { BlackHoleMeshTSL } from './BlackHole/tsl';
import MandelbulbMesh from './Mandelbulb/MandelbulbMesh';
import { MandelbulbMeshTSL } from './Mandelbulb/tsl';
import { PolytopeScene, PolytopeSceneTSL } from './Polytope';
import QuaternionJuliaMesh from './QuaternionJulia/QuaternionJuliaMesh';
import { JuliaMeshTSL } from './QuaternionJulia/tsl';
import SchroedingerMesh from './Schroedinger/SchroedingerMesh';
import { SchroedingerMeshTSL } from './Schroedinger/tsl';
import { determineRenderMode } from './utils';

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
  /** Overall opacity (default: 1.0) */
  opacity?: number;
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

  // Get renderer to determine which scene implementation to use
  // TSL components work with WebGPURenderer even when it falls back to WebGL
  const gl = useThree((state) => state.gl);

  // Check if the renderer is a WebGPURenderer (supports TSL node materials)
  // This is different from checking if the backend is WebGPU - TSL works even with WebGL fallback
  const useTSL = useMemo(() => {
    return isWebGPURenderer(gl);
  }, [gl]);

  // Determine render mode
  const renderMode = useMemo(
    () => determineRenderMode(geometry, objectType, dimension, facesVisible),
    [geometry, objectType, dimension, facesVisible]
  );

  // Type assertion for edges (no computation needed, just cast)
  const edges = geometry.edges as [number, number][];


  return (
    <>
      {/* Polytope rendering - use TSL scene for WebGPURenderer, GLSL scene for WebGLRenderer */}
      {renderMode === 'polytope' && useTSL && (
        <PolytopeSceneTSL
          baseVertices={geometry.vertices}
          edges={edges}
          faces={faces}
          dimension={dimension}
          faceDepths={faceDepths}
          opacity={opacity}
        />
      )}
      {renderMode === 'polytope' && !useTSL && (
        <PolytopeScene
          baseVertices={geometry.vertices}
          edges={edges}
          faces={faces}
          dimension={dimension}
          faceDepths={faceDepths}
          opacity={opacity}
        />
      )}

      {/* Raymarched 3D-11D Mandelbulb surface - use TSL for WebGPU, GLSL for WebGL */}
      {renderMode === 'raymarch-mandelbulb' && useTSL && <MandelbulbMeshTSL />}
      {renderMode === 'raymarch-mandelbulb' && !useTSL && <MandelbulbMesh />}

      {/* Raymarched 3D-11D Quaternion Julia - use TSL for WebGPU, GLSL for WebGL */}
      {renderMode === 'raymarch-quaternion-julia' && useTSL && <JuliaMeshTSL />}
      {renderMode === 'raymarch-quaternion-julia' && !useTSL && <QuaternionJuliaMesh />}

      {/* Raymarched 3D-11D Schroedinger - use TSL for WebGPU, GLSL for WebGL */}
      {renderMode === 'raymarch-schroedinger' && useTSL && <SchroedingerMeshTSL />}
      {renderMode === 'raymarch-schroedinger' && !useTSL && <SchroedingerMesh />}

      {/* Raymarched 3D-11D Black Hole - use TSL for WebGPU, GLSL for WebGL */}
      {renderMode === 'raymarch-blackhole' && useTSL && <BlackHoleMeshTSL />}
      {renderMode === 'raymarch-blackhole' && !useTSL && <BlackHoleMesh />}
    </>
  );
});
