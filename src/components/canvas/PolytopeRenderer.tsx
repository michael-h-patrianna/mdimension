import { useMemo, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  SphereGeometry,
  MeshStandardMaterial,
  Object3D,
  Color,
  InstancedMesh as ThreeInstancedMesh,
} from 'three'
import type { Vector3D } from '@/lib/math/types'
import { useVisualStore } from '@/stores/visualStore'
import {
  DEFAULT_EMISSIVE_INTENSITY,
  DEFAULT_MATERIAL_ROUGHNESS,
  DEFAULT_MATERIAL_METALNESS,
  VERTEX_SIZE_DIVISOR,
} from '@/lib/shaders/constants'
import { NativeWireframe } from './NativeWireframe'
import { FatWireframe } from './FatWireframe'

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
 * Shared sphere geometry for all vertex instances.
 * Created once and reused across all vertices.
 */
const SHARED_SPHERE_GEOMETRY = new SphereGeometry(1, 16, 16);

/**
 * Component to render vertices using InstancedMesh for memory efficiency.
 * Uses a single shared geometry and material for all vertex spheres.
 * @param root0
 * @param root0.vertices
 * @param root0.vertexColor
 * @param root0.vertexSize
 * @param root0.opacity
 */
function VertexInstances({
  vertices,
  vertexColor,
  vertexSize,
  opacity,
}: {
  vertices: Vector3D[]
  vertexColor: string
  vertexSize: number
  opacity: number
}) {
  const instancedMeshRef = useRef<ThreeInstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);

  // Create shared material - only recreate when visual properties change
  // Uses shared constants for visual consistency with PointCloudRenderer
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(vertexColor),
      emissive: new Color(vertexColor),
      emissiveIntensity: DEFAULT_EMISSIVE_INTENSITY,
      transparent: opacity < 1,
      opacity: opacity,
      roughness: DEFAULT_MATERIAL_ROUGHNESS,
      metalness: DEFAULT_MATERIAL_METALNESS,
    });
  }, [vertexColor, opacity]);

  // Dispose material on change or unmount
  const materialRef = useRef<MeshStandardMaterial | null>(null);
  useEffect(() => {
    if (materialRef.current && materialRef.current !== material) {
      materialRef.current.dispose();
    }
    materialRef.current = material;

    return () => {
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
    };
  }, [material]);

  // Update instance matrices when vertices change
  useEffect(() => {
    if (!instancedMeshRef.current) return;

    const mesh = instancedMeshRef.current;

    vertices.forEach((vertex, i) => {
      tempObject.position.set(vertex[0], vertex[1], vertex[2]);
      tempObject.scale.set(vertexSize, vertexSize, vertexSize);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = vertices.length;
  }, [vertices, vertexSize, tempObject]);

  // Don't render if no vertices
  if (vertices.length === 0) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[SHARED_SPHERE_GEOMETRY, material, vertices.length]}
      frustumCulled={false}
    />
  );
}

/**
 * Renders edges using either NativeWireframe (1px, fast) or FatWireframe (thick, heavy)
 * @param root0
 * @param root0.vertices
 * @param root0.edges
 * @param root0.color
 * @param root0.opacity
 * @param root0.thickness
 */
function Wireframe({
  vertices,
  edges,
  color,
  opacity,
  thickness,
}: {
  vertices: Vector3D[];
  edges: [number, number][];
  color: string;
  opacity: number;
  thickness: number;
}) {
  if (thickness > 1) {
    return (
      <FatWireframe
        vertices={vertices}
        edges={edges}
        color={color}
        opacity={opacity}
        thickness={thickness}
      />
    );
  }
  return (
    <NativeWireframe
      vertices={vertices}
      edges={edges}
      color={color}
      opacity={opacity}
      thickness={thickness}
    />
  );
}

/**
 * Renders a polytope geometry as Three.js objects.
 *
 * This component visualizes n-dimensional objects projected into 3D space by rendering:
 * - Vertices as small spheres with slight emissive glow (using InstancedMesh for efficiency)
 * - Edges as cylindrical tubes connecting vertices
 * - Optional semi-transparent faces
 *
 * The component is optimized for performance by:
 * - Using InstancedMesh for vertices (single geometry shared across all vertices)
 * - Using NativeWireframe or FatWireframe for edges based on thickness
 * - Properly disposing Three.js resources on unmount
 *
 * @param props - PolytopeRenderer configuration
 * @param props.vertices
 * @param props.edges
 * @param props.edgeColor
 * @param props.edgeThickness
 * @param props.vertexColor
 * @param props.vertexSize
 * @param props.showVertices
 * @param props.opacity
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
 * - Uses InstancedMesh for vertices to prevent geometry allocation per vertex
 * - Uses NativeWireframe to render edges using a single BufferGeometry with reusable buffers
 * - Vertex spheres have slight emissive property for better visibility
 * - Supports dynamic updates to vertices and edges
 */
export function PolytopeRenderer({
  vertices,
  edges,
  edgeColor: propEdgeColor,
  edgeThickness: propEdgeThickness,
  vertexColor: propVertexColor,
  vertexSize: propVertexSize,
  showVertices: propShowVertices,
  opacity = 1.0,
}: PolytopeRendererProps) {
  // Get visual settings from store with shallow comparison (props override store values)
  const {
    storeEdgeColor,
    storeEdgeThickness,
    storeVertexColor,
    storeVertexSize,
    storeVertexVisible,
    edgesVisible,
  } = useVisualStore(
    useShallow((state) => ({
      storeEdgeColor: state.edgeColor,
      storeEdgeThickness: state.edgeThickness,
      storeVertexColor: state.vertexColor,
      storeVertexSize: state.vertexSize,
      storeVertexVisible: state.vertexVisible,
      edgesVisible: state.edgesVisible,
    }))
  );

  // Use props if provided, otherwise use store values
  const edgeColor = propEdgeColor ?? storeEdgeColor;
  const edgeThickness = propEdgeThickness ?? storeEdgeThickness;
  const vertexColor = propVertexColor ?? storeVertexColor;
  // Convert from store value (1-10) to scale using shared constant
  const vertexSize = propVertexSize ?? (storeVertexSize / VERTEX_SIZE_DIVISOR);
  const showVertices = propShowVertices ?? storeVertexVisible;

  return (
    <group>
      {/* Render edges using Wireframe wrapper - controlled by edgesVisible toggle */}
      {edgesVisible && (
        <Wireframe
          vertices={vertices}
          edges={edges}
          color={edgeColor}
          opacity={opacity}
          thickness={edgeThickness}
        />
      )}

      {/* Render vertices using InstancedMesh for memory efficiency */}
      {showVertices && vertices.length > 0 && (
        <VertexInstances
          vertices={vertices}
          vertexColor={vertexColor}
          vertexSize={vertexSize}
          opacity={opacity}
        />
      )}
    </group>
  )
}
