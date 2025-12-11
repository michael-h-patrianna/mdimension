import { Grid } from '@react-three/drei'
import type { Vector3D } from '@/lib/math/types'
import { PolytopeRenderer } from './PolytopeRenderer'
import { CameraController } from './CameraController'

/**
 * Props for the Scene component.
 */
export interface SceneProps {
  /** 3D projected vertices to render */
  vertices?: Vector3D[]
  /** Edge connections between vertices */
  edges?: [number, number][]
  /** Whether to show the grid helper (default: false) */
  showGrid?: boolean
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
 * - Optional grid helper for spatial reference
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
 *     showGrid
 *     autoRotate
 *   />
 * </Canvas>
 * ```
 *
 * @remarks
 * - Ambient light (intensity 0.4) provides base illumination
 * - Directional light (intensity 0.8) creates depth and shadows
 * - Dark background (#0F0F1A) enhances visibility of colored edges
 * - Grid helper is optional and toggleable
 * - Camera controls support mouse/touch interaction
 * - Performance optimized for 60 FPS
 */
export function Scene({
  vertices,
  edges,
  showGrid = false,
  autoRotate = false,
  opacity = 1.0,
  crossSectionVertices,
  crossSectionEdges,
}: SceneProps) {
  return (
    <>
      {/* Lighting setup */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />

      {/* Camera controls */}
      <CameraController autoRotate={autoRotate} />

      {/* Optional grid helper */}
      {showGrid && (
        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#6e6e6e"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#9d9d9d"
          fadeDistance={25}
          fadeStrength={1}
          followCamera={false}
        />
      )}

      {/* Render polytope geometry if provided */}
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
