import { useShallow } from 'zustand/react/shallow'
import type { Vector3D } from '@/lib/math/types'
import type { Face } from '@/lib/geometry/faces'
import { PolytopeRenderer } from './PolytopeRenderer'
import { PointCloudRenderer, PointCloudWithEdges } from './PointCloudRenderer'
import { FaceRenderer } from './FaceRenderer'
import { CameraController } from './CameraController'
import { SceneLighting } from './SceneLighting'
import { PostProcessing } from './PostProcessing'
import { GroundPlane } from './GroundPlane'
import { useVisualStore } from '@/stores/visualStore'
import { useVertexSize } from '@/hooks/useVertexSize'

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
  /** Enable auto-rotation (default: false) */
  autoRotate?: boolean
  /** Opacity of the main polytope (default: 1.0) */
  opacity?: number
  /** Cross-section vertices (optional) */
  crossSectionVertices?: Vector3D[]
  /** Cross-section edges (optional) */
  crossSectionEdges?: [number, number][]
  /** Whether this is a point cloud (uses PointCloudRenderer) */
  isPointCloud?: boolean
  /**
   * Per-point colors for point cloud rendering.
   * Used for Mandelbrot visualization where each point has a unique color
   * derived from escape time and the user's vertex color.
   */
  pointColors?: string[]
  /**
   * Minimum bounding radius for ground plane positioning.
   * Used when external objects (like raymarched Mandelbulb) need to be
   * accounted for in ground plane calculations.
   */
  minBoundingRadius?: number
  /**
   * Per-face depth values for palette color variation.
   * Derived from higher-dimension (W+) coordinates or Y-coordinate fallback.
   */
  faceDepths?: number[]
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
 * @param props.vertices
 * @param props.edges
 * @param props.faces
 * @param props.autoRotate
 * @param props.opacity
 * @param props.crossSectionVertices
 * @param props.crossSectionEdges
 * @param props.isPointCloud
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
  isPointCloud = false,
  pointColors,
  minBoundingRadius,
  faceDepths,
}: SceneProps) {
  // Get all visual settings with shallow comparison to prevent unnecessary re-renders
  const {
    vertexVisible,
    facesVisible,
    faceColor,
    shaderSettings,
    showGroundPlane,
    groundPlaneOffset,
    groundPlaneOpacity,
    groundPlaneReflectivity,
    colorMode,
  } = useVisualStore(
    useShallow((state) => ({
      vertexVisible: state.vertexVisible,
      facesVisible: state.facesVisible,
      faceColor: state.faceColor,
      shaderSettings: state.shaderSettings,
      showGroundPlane: state.showGroundPlane,
      groundPlaneOffset: state.groundPlaneOffset,
      groundPlaneOpacity: state.groundPlaneOpacity,
      groundPlaneReflectivity: state.groundPlaneReflectivity,
      colorMode: state.colorMode,
    }))
  );

  // Determine if we should render faces (controlled by facesVisible toggle, not for point clouds)
  const shouldRenderFaces = !isPointCloud && facesVisible && faces && faces.length > 0 && vertices;

  // Get surface shader settings
  const surfaceSettings = shaderSettings.surface;

  // Calculate vertex/point size based on vertex count using custom hook
  const adjustedVertexSize = useVertexSize(vertices?.length ?? 0);
  const crossSectionVertexSize = useVertexSize(crossSectionVertices?.length ?? 0);

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
        minBoundingRadius={minBoundingRadius}
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
          faceDepths={faceDepths}
          colorMode={colorMode}
        />
      )}

      {/* Render based on geometry type */}
      {vertices && (
        isPointCloud ? (
          // Point cloud rendering (hyperspheres, sampled manifolds, Mandelbrot)
          // Uses same adjustedVertexSize as polytopes for visual consistency
          // PointCloudWithEdges handles visibility toggles internally
          // pointColors enables per-point coloring for Mandelbrot visualization
          edges && edges.length > 0 ? (
            <PointCloudWithEdges
              vertices={vertices}
              edges={edges}
              pointSize={adjustedVertexSize}
              opacity={opacity}
              pointColors={pointColors}
            />
          ) : (
            // Standalone point cloud (no edges) - respect Vertices toggle
            vertexVisible && (
              <PointCloudRenderer
                vertices={vertices}
                pointSize={adjustedVertexSize}
                opacity={opacity}
                pointColors={pointColors}
              />
            )
          )
        ) : (
          // Traditional polytope rendering (with density-adjusted vertex size)
          edges && (
            <PolytopeRenderer
              vertices={vertices}
              edges={edges}
              opacity={opacity}
              vertexSize={adjustedVertexSize}
            />
          )
        )
      )}

      {/* Render cross-section if provided */}
      {/* Uses distinctive orange/gold colors to differentiate from main object */}
      {/* Vertex size scales with user settings using same density formula */}
      {/* Opacity matches main object to maintain visual hierarchy */}
      {crossSectionVertices && crossSectionEdges && crossSectionVertices.length > 0 && (
        <PolytopeRenderer
          vertices={crossSectionVertices}
          edges={crossSectionEdges}
          edgeColor="#FF6B00"
          vertexColor="#FFAA00"
          vertexSize={crossSectionVertexSize}
          opacity={opacity}
        />
      )}
    </>
  )
}
