/**
 * PointCloudRenderer Component
 *
 * Optimized renderer for point cloud geometries (root systems, Clifford torus, sampled manifolds).
 * Uses InstancedMesh for efficient rendering of large numbers of points.
 *
 * Key differences from PolytopeRenderer:
 * - Optimized for larger point counts (1000+)
 * - Configurable point size independent of vertex size
 * - Simpler rendering (no edges by default)
 * - Billboard-style points for better visibility
 *
 * Visual settings integration:
 * - Respects shaderType from visualStore (wireframe, surface)
 * - Uses edgeColor and edgeThickness from store
 */

import { useMemo, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  SphereGeometry,
  MeshStandardMaterial,
  Object3D,
  Color,
  InstancedMesh as ThreeInstancedMesh,
} from 'three';
import type { Vector3D } from '@/lib/math/types';
import { useVisualStore } from '@/stores/visualStore';
import {
  DEFAULT_BASE_VERTEX_SIZE,
  DEFAULT_MATERIAL_ROUGHNESS,
  DEFAULT_MATERIAL_METALNESS,
} from '@/lib/shaders/constants';
import { NativeWireframe } from './NativeWireframe';
import { FatWireframe } from './FatWireframe';

/**
 * Props for the PointCloudRenderer component.
 */
export interface PointCloudRendererProps {
  /** 3D projected points to render */
  vertices: Vector3D[];
  /** Color of the points (uses vertex color from store if not provided) */
  pointColor?: string;
  /**
   * Per-point colors - when provided, overrides pointColor for each point.
   * Used for Mandelbrot visualization where each point has a unique color
   * based on escape time.
   */
  pointColors?: string[];
  /**
   * Size of the points (default: DEFAULT_BASE_VERTEX_SIZE = 0.04).
   * This matches PolytopeRenderer's baseline for visual consistency.
   * When using useVertexSize hook, density scaling is automatically applied.
   */
  pointSize?: number;
  /** Overall opacity (default: 1.0) */
  opacity?: number;
}

/**
 * Shared sphere geometry for point instances.
 * Matches PolytopeRenderer's sphere quality (16x16) for visual consistency.
 */
const POINT_GEOMETRY = new SphereGeometry(1, 16, 16);

/**
 * Renders a point cloud using InstancedMesh for efficient GPU rendering.
 *
 * Optimized for:
 * - Large point counts (1000-10000 points)
 * - Consistent performance regardless of point count
 * - Memory efficiency through instancing
 *
 * @param props - PointCloudRenderer configuration
 * @param props.vertices
 * @param props.pointColor
 * @param props.pointSize
 * @param props.opacity
 * @returns InstancedMesh containing all points
 *
 * @example
 * ```tsx
 * // Render a point cloud
 * <PointCloudRenderer
 *   vertices={projectedVertices}
 *   pointColor="#00FF88"
 *   pointSize={0.015}
 *   opacity={0.9}
 * />
 * ```
 */
export function PointCloudRenderer({
  vertices,
  pointColor: propPointColor,
  pointColors,
  pointSize = DEFAULT_BASE_VERTEX_SIZE,
  opacity = 1.0,
}: PointCloudRendererProps) {
  const instancedMeshRef = useRef<ThreeInstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);
  const tempColor = useMemo(() => new Color(), []);

  // Get vertex color from store if not provided via props
  const storeVertexColor = useVisualStore(
    useShallow((state) => state.vertexColor)
  );

  const pointColor = propPointColor ?? storeVertexColor;

  /**
   * Create material - recreate only when visual properties change.
   * Note: Shader settings (wireframe, surface) don't apply here
   * since this renderer only handles points without edges. Use PointCloudWithEdges
   * for edge rendering with shader support.
   */
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(pointColor),
      transparent: opacity < 1,
      opacity: opacity,
      roughness: DEFAULT_MATERIAL_ROUGHNESS,
      metalness: DEFAULT_MATERIAL_METALNESS,
    });
  }, [pointColor, opacity]);

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

  // Update instance matrices and colors when vertices/colors change
  useEffect(() => {
    if (!instancedMeshRef.current) return;

    const mesh = instancedMeshRef.current;
    const count = Math.min(vertices.length, mesh.count);

    // Update positions and scales
    for (let i = 0; i < count; i++) {
      const vertex = vertices[i]!;
      tempObject.position.set(vertex[0], vertex[1], vertex[2]);
      tempObject.scale.set(pointSize, pointSize, pointSize);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Update per-instance colors if provided
    if (pointColors && pointColors.length > 0) {
      for (let i = 0; i < count; i++) {
        const colorHex = pointColors[i] ?? pointColor;
        tempColor.set(colorHex);
        mesh.setColorAt(i, tempColor);
      }
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }

    mesh.count = count;
  }, [vertices, pointSize, tempObject, pointColors, pointColor, tempColor]);

  // Don't render if no vertices
  if (vertices.length === 0) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[POINT_GEOMETRY, material, vertices.length]}
      frustumCulled={false}
    />
  );
}

/**
 * Props for the PointCloudWithEdges component
 */
export interface PointCloudWithEdgesProps extends PointCloudRendererProps {
  /** Optional edge connections between points */
  edges?: [number, number][];
  /** Edge color (default: uses edgeColor from store) */
  edgeColor?: string;
  /** Edge thickness (default: uses edgeThickness from store) */
  edgeThickness?: number;
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
  // Use FatWireframe for thickness >= 1 (default is 2)
  // NativeWireframe is only used for sub-pixel lines (thickness < 1)
  if (thickness >= 1) {
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
 * Renders a point cloud with optional wireframe edges.
 *
 * Use this when you want to show both points and their connectivity
 * (e.g., k-NN wireframe on a point cloud).
 *
 * Respects visual settings from store:
 * - vertexVisible: Controls point visibility (Vertices toggle)
 * - edgesVisible: Controls edge visibility (Edges toggle)
 * - edgeColor/edgeThickness: Uses store values as defaults
 *
 * @param props - Configuration including edges
 * @param props.vertices
 * @param props.edges
 * @param props.pointColor
 * @param props.pointSize
 * @param props.opacity
 * @param props.edgeColor
 * @param props.edgeThickness
 * @returns Point cloud with optional wireframe overlay
 */
export function PointCloudWithEdges({
  vertices,
  edges,
  pointColor,
  pointColors,
  pointSize,
  opacity = 1.0,
  edgeColor: propEdgeColor,
  edgeThickness: propEdgeThickness,
}: PointCloudWithEdgesProps) {
  // Get visual settings from store with shallow comparison
  const {
    storeVertexColor,
    storeEdgeColor,
    storeEdgeThickness,
    vertexVisible,
    edgesVisible,
  } = useVisualStore(
    useShallow((state) => ({
      storeVertexColor: state.vertexColor,
      storeEdgeColor: state.edgeColor,
      storeEdgeThickness: state.edgeThickness,
      vertexVisible: state.vertexVisible,
      edgesVisible: state.edgesVisible,
    }))
  );

  // Use props if provided, otherwise use store values
  const edgeColor = propEdgeColor ?? storeEdgeColor;
  const edgeThickness = propEdgeThickness ?? storeEdgeThickness;
  const effectivePointColor = pointColor ?? storeVertexColor;

  // Get edge color for wireframe rendering
  const lineColor = useMemo(() => {
    return edgeColor;
  }, [edgeColor]);

  return (
    <group>
      {/* Render edges (controlled by Edges toggle) */}
      {edgesVisible && edges && edges.length > 0 && (
        <Wireframe
          vertices={vertices}
          edges={edges}
          color={lineColor}
          opacity={opacity}
          thickness={edgeThickness}
        />
      )}

      {/* Render points on top (controlled by Vertices toggle) */}
      {vertexVisible && (
        <PointCloudRenderer
          vertices={vertices}
          pointColor={effectivePointColor}
          pointColors={pointColors}
          pointSize={pointSize}
          opacity={opacity}
        />
      )}
    </group>
  );
}
