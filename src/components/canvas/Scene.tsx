/**
 * Scene Component
 *
 * Provides the Three.js scene foundation with lighting, camera, post-processing,
 * and ground plane. Delegates all object rendering to UnifiedRenderer.
 *
 * Architecture:
 * - Scene: Lighting, camera, effects, ground plane
 * - UnifiedRenderer: Routes to appropriate high-performance renderer
 */

import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Vector3D } from '@/lib/math/types'
import type { Face } from '@/lib/geometry/faces'
import type { NdGeometry, ObjectType } from '@/lib/geometry/types'
import { UnifiedRenderer } from './renderers/UnifiedRenderer'
import { CameraController } from './CameraController'
import { SceneLighting } from './environment/SceneLighting'
import { PostProcessing } from './environment/PostProcessing'
import { GroundPlane } from './environment/GroundPlane'
import { LightGizmoManager } from './gizmos/LightGizmoManager'
import { useVisualStore } from '@/stores/visualStore'

/**
 * Props for the Scene component.
 */
export interface SceneProps {
  /** Generated geometry containing vertices, edges, and metadata */
  geometry: NdGeometry
  /** Current dimension of the object */
  dimension: number
  /** Type of object being rendered */
  objectType: ObjectType
  /** Detected faces for surface rendering */
  faces?: Face[]
  /** Per-face depth values for palette coloring */
  faceDepths?: number[]
  /** Per-point colors for point cloud rendering */
  pointColors?: string[]
  /** 3D projected vertices for ground plane positioning */
  projectedVertices?: Vector3D[]
  /** Enable auto-rotation (default: false) */
  autoRotate?: boolean
  /** Overall opacity (default: 1.0) */
  opacity?: number
  /**
   * Minimum bounding radius for ground plane positioning.
   * Used when raymarched objects need to be accounted for.
   */
  minBoundingRadius?: number
}

/**
 * Main Three.js scene component.
 *
 * Provides the scene foundation and delegates rendering to UnifiedRenderer.
 * All object rendering uses useFrame for high-performance animation.
 */
export const Scene = React.memo(function Scene({
  geometry,
  dimension,
  objectType,
  faces,
  faceDepths,
  pointColors,
  projectedVertices,
  autoRotate = false,
  opacity = 1.0,
  minBoundingRadius,
}: SceneProps) {
  // Get environment settings with shallow comparison
  const {
    activeWalls,
    groundPlaneOffset,
    groundPlaneOpacity,
    groundPlaneReflectivity,
    groundPlaneColor,
    groundPlaneType,
    groundPlaneSizeScale,
    showGroundGrid,
    groundGridColor,
    groundGridSpacing,
    groundMaterialRoughness,
    groundMaterialMetalness,
    groundMaterialEnvMapIntensity,
    showAxisHelper,
  } = useVisualStore(
    useShallow((state) => ({
      activeWalls: state.activeWalls,
      groundPlaneOffset: state.groundPlaneOffset,
      groundPlaneOpacity: state.groundPlaneOpacity,
      groundPlaneReflectivity: state.groundPlaneReflectivity,
      groundPlaneColor: state.groundPlaneColor,
      groundPlaneType: state.groundPlaneType,
      groundPlaneSizeScale: state.groundPlaneSizeScale,
      showGroundGrid: state.showGroundGrid,
      groundGridColor: state.groundGridColor,
      groundGridSpacing: state.groundGridSpacing,
      groundMaterialRoughness: state.groundMaterialRoughness,
      groundMaterialMetalness: state.groundMaterialMetalness,
      groundMaterialEnvMapIntensity: state.groundMaterialEnvMapIntensity,
      showAxisHelper: state.showAxisHelper,
    }))
  )

  return (
    <>
      {/* Scene lighting from visual store */}
      <SceneLighting />

      {/* Light gizmos for manipulating lights */}
      <LightGizmoManager />

      {/* Post-processing effects (bloom) */}
      <PostProcessing />

      {/* Camera controls */}
      <CameraController autoRotate={autoRotate} />

      {/* Environment walls with optional grid overlay */}
      <GroundPlane
        vertices={projectedVertices}
        offset={groundPlaneOffset}
        opacity={groundPlaneOpacity}
        reflectivity={groundPlaneReflectivity}
        activeWalls={activeWalls}
        minBoundingRadius={minBoundingRadius}
        color={groundPlaneColor}
        surfaceType={groundPlaneType}
        sizeScale={groundPlaneSizeScale}
        showGrid={showGroundGrid}
        gridColor={groundGridColor}
        gridSpacing={groundGridSpacing}
        roughness={groundMaterialRoughness}
        metalness={groundMaterialMetalness}
        envMapIntensity={groundMaterialEnvMapIntensity}
      />

      {/* Axis helper for orientation reference */}
      {showAxisHelper && <axesHelper args={[5]} />}

      {/* Unified renderer for all object types */}
      <UnifiedRenderer
        geometry={geometry}
        dimension={dimension}
        objectType={objectType}
        faces={faces}
        faceDepths={faceDepths}
        pointColors={pointColors}
        opacity={opacity}
      />
    </>
  )
})
