import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Vector3D } from '@/lib/math/types'
import { useVisualStore } from '@/stores/visualStore'
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
  /** Opacity of the faces (default: 0.15) */
  faceOpacity?: number
  /** Overall opacity for the entire polytope (default: 1.0) */
  opacity?: number
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
 * - Edges as cylindrical tubes connecting vertices
 * - Optional semi-transparent faces
 *
 * The component is optimized for performance by:
 * - Using NativeWireframe or FatWireframe for edges based on thickness
 * - Properly disposing Three.js resources on unmount
 *
 * @param props - PolytopeRenderer configuration
 * @param props.vertices
 * @param props.edges
 * @param props.edgeColor
 * @param props.edgeThickness
 * @param props.opacity
 * @returns Three.js mesh group containing edges
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
 * />
 * ```
 *
 * @remarks
 * - Uses NativeWireframe to render edges using a single BufferGeometry with reusable buffers
 * - Supports dynamic updates to vertices and edges
 */
export const PolytopeRenderer = React.memo(function PolytopeRenderer({
  vertices,
  edges,
  edgeColor: propEdgeColor,
  edgeThickness: propEdgeThickness,
  opacity = 1.0,
}: PolytopeRendererProps) {
  // Get visual settings from store with shallow comparison (props override store values)
  const {
    storeEdgeColor,
    storeEdgeThickness,
    edgesVisible,
  } = useVisualStore(
    useShallow((state) => ({
      storeEdgeColor: state.edgeColor,
      storeEdgeThickness: state.edgeThickness,
      edgesVisible: state.edgesVisible,
    }))
  );

  // Use props if provided, otherwise use store values
  const edgeColor = propEdgeColor ?? storeEdgeColor;
  const edgeThickness = propEdgeThickness ?? storeEdgeThickness;

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
    </group>
  )
});
