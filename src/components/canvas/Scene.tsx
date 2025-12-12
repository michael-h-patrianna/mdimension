import { useShallow } from 'zustand/react/shallow'
import type { Vector3D } from '@/lib/math/types'
import type { Face } from '@/lib/geometry/faces'
import { PolytopeRenderer } from './PolytopeRenderer'
import { FaceRenderer } from './FaceRenderer'
import { CameraController } from './CameraController'
import { SceneLighting } from './SceneLighting'
import { PostProcessing } from './PostProcessing'
import { GroundPlane } from './GroundPlane'
import { useVisualStore } from '@/stores/visualStore'

/**
 * Props for the Scene component.
 */
export interface SceneProps {
  /** 3D projected vertices to render */
  vertices?: Vector3D[]
  /** Edge connections between vertices */
  edges?: [number, number][]
  /** Detected faces for surface rendering (PRD Story 2) */
  faces?: Face[]
  /** Background color (default: #0F0F1A) */
  backgroundColor?: string
  /** Enable auto-rotation (default: false) */
  autoRotate?: boolean
  /** Opacity of the main polytope (default: 1.0) */
  opacity?: number
  /** Cross-section vertices (optional) */
  crossSectionVertices?: Vector3D[]
  /** Cross-section edges (optional) */
  crossSectionEdges?: [number, number][]
}

/**
 * Main Three.js scene component with lighting and rendering setup.
 *
 * This component provides the foundational 3D scene for rendering n-dimensional
 * objects. It includes:
 * - Ambient and directional lighting for proper 3D visualization
 * - Reflective ground plane with grid overlay (toggleable via visual store)
 * - Dark background optimized for visualizing colored geometry
 * - Camera controls with smooth interaction
 * - PolytopeRenderer for displaying geometry
 *
 * The scene is optimized for 60 FPS performance and provides a consistent
 * visual environment for all polytope visualizations.
 *
 * @param props - Scene configuration
 * @returns Complete 3D scene with lighting, controls, and geometry
 *
 * @example
 * ```tsx
 * // Basic scene with default settings
 * <Canvas>
 *   <Scene />
 * </Canvas>
 * ```
 *
 * @example
 * ```tsx
 * // Scene with custom geometry
 * const vertices: Vector3D[] = [
 *   [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
 *   [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
 * ]
 * const edges: [number, number][] = [
 *   [0, 1], [1, 2], [2, 3], [3, 0],
 *   [4, 5], [5, 6], [6, 7], [7, 4],
 *   [0, 4], [1, 5], [2, 6], [3, 7]
 * ]
 *
 * <Canvas>
 *   <Scene
 *     vertices={vertices}
 *     edges={edges}
 *     autoRotate
 *   />
 * </Canvas>
 * ```
 *
 * @remarks
 * - Ambient light (intensity 0.4) provides base illumination
 * - Directional light (intensity 0.8) creates depth and shadows
 * - Dark background (#0F0F1A) enhances visibility of colored edges
 * - Ground plane is toggleable via visual store settings
 * - Camera controls support mouse/touch interaction
 * - Performance optimized for 60 FPS
 */
export function Scene({
  vertices,
  edges,
  faces,
  autoRotate = false,
  opacity = 1.0,
  crossSectionVertices,
  crossSectionEdges,
}: SceneProps) {
  // Get all visual settings with shallow comparison to prevent unnecessary re-renders
  const {
    shaderType,
    faceColor,
    shaderSettings,
    showGroundPlane,
    groundPlaneOffset,
    groundPlaneOpacity,
    groundPlaneReflectivity,
  } = useVisualStore(
    useShallow((state) => ({
      shaderType: state.shaderType,
      faceColor: state.faceColor,
      shaderSettings: state.shaderSettings,
      showGroundPlane: state.showGroundPlane,
      groundPlaneOffset: state.groundPlaneOffset,
      groundPlaneOpacity: state.groundPlaneOpacity,
      groundPlaneReflectivity: state.groundPlaneReflectivity,
    }))
  );

  // Determine if we should render faces (Surface shader only)
  const shouldRenderFaces = shaderType === 'surface' && faces && faces.length > 0 && vertices;

  // Get surface shader settings
  const surfaceSettings = shaderSettings.surface;

  return (
    <>
      {/* Scene lighting from visual store */}
      <SceneLighting />

      {/* Post-processing effects (bloom) */}
      <PostProcessing />

      {/* Camera controls */}
      <CameraController autoRotate={autoRotate} />

      {/* Reflective ground plane with grid overlay */}
      <GroundPlane
        vertices={vertices}
        offset={groundPlaneOffset}
        opacity={groundPlaneOpacity}
        reflectivity={groundPlaneReflectivity}
        visible={showGroundPlane}
      />

      {/* Render faces when Surface shader is selected (PRD Story 2) */}
      {shouldRenderFaces && (
        <FaceRenderer
          vertices={vertices}
          faces={faces}
          color={faceColor}
          opacity={surfaceSettings.faceOpacity}
          specularIntensity={surfaceSettings.specularIntensity}
          specularPower={surfaceSettings.specularPower}
        />
      )}

      {/* Render polytope edges and vertices */}
      {vertices && edges && (
        <PolytopeRenderer vertices={vertices} edges={edges} opacity={opacity} />
      )}

      {/* Render cross-section if provided */}
      {crossSectionVertices && crossSectionEdges && crossSectionVertices.length > 0 && (
        <PolytopeRenderer
          vertices={crossSectionVertices}
          edges={crossSectionEdges}
          edgeColor="#FF6B00"
          vertexColor="#FFAA00"
          vertexSize={0.06}
        />
      )}
    </>
  )
}
