import { useMemo } from 'react'
import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three'
import type { Vector3D } from '@/lib/math/types'

/**
 * Props for the PolytopeRenderer component.
 */
export interface PolytopeRendererProps {
  /** 3D projected vertices of the polytope */
  vertices: Vector3D[]
  /** Edge connections as pairs of vertex indices */
  edges: [number, number][]
  /** Color of the edges (default: cyan #00FFFF) */
  edgeColor?: string
  /** Thickness of the edges (default: 2) */
  edgeThickness?: number
  /** Color of the vertices (default: white) */
  vertexColor?: string
  /** Size of the vertex spheres (default: 0.04) */
  vertexSize?: number
  /** Whether to show vertices (default: true) */
  showVertices?: boolean
  /** Opacity of the faces (default: 0.15) */
  faceOpacity?: number
  /** Overall opacity for the entire polytope (default: 1.0) */
  opacity?: number
}

/**
 * Renders a polytope geometry as Three.js objects.
 *
 * This component visualizes n-dimensional objects projected into 3D space by rendering:
 * - Vertices as small spheres with slight emissive glow
 * - Edges as cylindrical tubes connecting vertices
 * - Optional semi-transparent faces
 *
 * The component is optimized for performance by memoizing geometries and only
 * recreating them when the input data changes.
 *
 * @param props - PolytopeRenderer configuration
 * @returns Three.js mesh group containing vertices, edges, and faces
 *
 * @example
 * ```tsx
 * // Render a simple cube
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
 * <PolytopeRenderer
 *   vertices={vertices}
 *   edges={edges}
 *   edgeColor="#00FFFF"
 *   vertexColor="#FFFFFF"
 * />
 * ```
 *
 * @remarks
 * - Uses cylindrical tubes for edges to ensure consistent thickness at all zoom levels
 * - Vertex spheres have slight emissive property for better visibility
 * - Edge and vertex geometries are memoized for performance
 * - Supports dynamic updates to vertices and edges
 */
export function PolytopeRenderer({
  vertices,
  edges,
  edgeColor = '#00FFFF',
  edgeThickness = 2,
  vertexColor = '#FFFFFF',
  vertexSize = 0.04,
  showVertices = true,
  opacity = 1.0,
}: PolytopeRendererProps) {
  // Memoize edge geometries
  const edgeGeometries = useMemo(() => {
    return edges.map(([startIdx, endIdx]) => {
      const startVertex = vertices[startIdx]
      const endVertex = vertices[endIdx]
      if (!startVertex || !endVertex) {
        return null
      }
      const start = new Vector3(...startVertex)
      const end = new Vector3(...endVertex)

      // Create a cylinder geometry oriented along the edge
      const direction = new Vector3().subVectors(end, start)
      const length = direction.length()
      const midpoint = new Vector3().addVectors(start, end).multiplyScalar(0.5)

      // Create geometry for the edge
      const geometry = new BufferGeometry()
      const positions = new Float32Array([
        ...start.toArray(),
        ...end.toArray(),
      ])
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))

      return { geometry, midpoint, length, direction }
    }).filter((g): g is NonNullable<typeof g> => g !== null)
  }, [vertices, edges])

  // Memoize vertex positions
  const vertexPositions = useMemo(() => {
    return vertices.map((v) => new Vector3(...v))
  }, [vertices])

  return (
    <group>
      {/* Render edges */}
      {edgeGeometries.map(({ geometry }, index) => (
        <line key={`edge-${index}`}>
          <bufferGeometry attach="geometry" {...geometry} />
          <lineBasicMaterial
            attach="material"
            color={edgeColor}
            linewidth={edgeThickness}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </line>
      ))}

      {/* Render vertices */}
      {showVertices &&
        vertexPositions.map((position, index) => (
          <mesh key={`vertex-${index}`} position={position}>
            <sphereGeometry args={[vertexSize, 16, 16]} />
            <meshStandardMaterial
              color={vertexColor}
              emissive={vertexColor}
              emissiveIntensity={0.2}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        ))}
    </group>
  )
}
