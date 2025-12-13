import { useRef, useLayoutEffect, useMemo } from 'react';
import { Vector2, InstancedInterleavedBuffer } from 'three';
import { extend, useThree, type ThreeElement } from '@react-three/fiber';
import { LineSegments2 } from 'three-stdlib';
import { LineMaterial } from 'three-stdlib';
import { LineSegmentsGeometry } from 'three-stdlib';

// Extend Three.js elements for R3F
extend({ LineSegments2, LineMaterial, LineSegmentsGeometry });

// Add types for the extended elements (R3F v9 syntax)
declare module '@react-three/fiber' {
  interface ThreeElements {
    lineSegments2: ThreeElement<typeof LineSegments2>;
    lineMaterial: ThreeElement<typeof LineMaterial>;
    lineSegmentsGeometry: ThreeElement<typeof LineSegmentsGeometry>;
  }
}

/**
 * Internal attributes structure for LineSegmentsGeometry.
 * Three.js uses InstancedInterleavedBuffer for line segment positions.
 */
interface LineSegmentsWithInstanceBuffer {
  instanceStart: {
    data: InstancedInterleavedBuffer;
  };
}

/**
 * Type guard to check if geometry has instance buffer attributes.
 */
function hasInstanceBuffer(
  attrs: LineSegmentsGeometry['attributes']
): attrs is LineSegmentsGeometry['attributes'] & LineSegmentsWithInstanceBuffer {
  const internal = attrs as Partial<LineSegmentsWithInstanceBuffer>;
  return (
    internal.instanceStart !== undefined &&
    internal.instanceStart.data !== undefined &&
    internal.instanceStart.data instanceof InstancedInterleavedBuffer
  );
}

export interface FatWireframeProps {
  vertices: number[][]; // [x, y, z] arrays
  edges: [number, number][];
  color: string;
  opacity?: number;
  thickness?: number;
}

/**
 *
 * @param root0
 * @param root0.vertices
 * @param root0.edges
 * @param root0.color
 * @param root0.opacity
 * @param root0.thickness
 */
export function FatWireframe({
  vertices,
  edges,
  color,
  opacity = 1.0,
  thickness = 2,
}: FatWireframeProps) {
  const { size } = useThree();
  const materialRef = useRef<LineMaterial>(null);
  const meshRef = useRef<LineSegments2>(null);
  // Reusable Vector2 for resolution updates (avoids allocation on every size change)
  const resolutionRef = useRef(new Vector2());

  // Initialize geometry (topology)
  // Geometry object is created once; positions are updated in useLayoutEffect when edges/vertices change.
  const geometry = useMemo(() => {
    return new LineSegmentsGeometry();
  }, []);

  // Update geometry positions every frame
  useLayoutEffect(() => {
    if (!vertices || vertices.length === 0 || !edges || edges.length === 0) return;

    const segmentCount = edges.length;
    const positionCount = segmentCount * 6; // 2 points * 3 coords per segment

    // Check if we can reuse the existing buffer
    // LineSegmentsGeometry uses an InstancedInterleavedBuffer for instanceStart/instanceEnd
    let targetBuffer: Float32Array;
    let needsResize = true;
    let instanceBuffer: InstancedInterleavedBuffer | null = null;

    if (hasInstanceBuffer(geometry.attributes)) {
      const bufferData = geometry.attributes.instanceStart.data;
      if (bufferData.array.length === positionCount) {
        targetBuffer = bufferData.array as Float32Array;
        instanceBuffer = bufferData;
        needsResize = false;
      } else {
        targetBuffer = new Float32Array(positionCount);
      }
    } else {
      targetBuffer = new Float32Array(positionCount);
    }

    // Fill buffer
    let i = 0;
    let invalidEdgeCount = 0;
    for (const [start, end] of edges) {
      const v1 = vertices[start];
      const v2 = vertices[end];
      if (v1 && v2) {
        targetBuffer[i++] = v1[0] ?? 0;
        targetBuffer[i++] = v1[1] ?? 0;
        targetBuffer[i++] = v1[2] ?? 0;

        targetBuffer[i++] = v2[0] ?? 0;
        targetBuffer[i++] = v2[1] ?? 0;
        targetBuffer[i++] = v2[2] ?? 0;
      } else {
        // Invalid edge - use degenerate line (zero-length) to maintain buffer alignment
        invalidEdgeCount++;
        targetBuffer[i++] = 0;
        targetBuffer[i++] = 0;
        targetBuffer[i++] = 0;
        targetBuffer[i++] = 0;
        targetBuffer[i++] = 0;
        targetBuffer[i++] = 0;
      }
    }

    // Warn once per render if invalid edges were detected (dev only)
    if (invalidEdgeCount > 0 && import.meta.env.DEV) {
      console.warn(
        `FatWireframe: ${invalidEdgeCount} edge(s) reference non-existent vertices (vertices.length=${vertices.length})`
      );
    }

    if (needsResize) {
      // Allocate new buffer via setPositions
      geometry.setPositions(targetBuffer);
    } else if (instanceBuffer) {
      // Update existing buffer in-place
      instanceBuffer.needsUpdate = true;
      geometry.computeBoundingSphere();
    }

  }, [vertices, edges, geometry]);

  // Update material resolution (reuses Vector2 instance to avoid allocation)
  useLayoutEffect(() => {
    if (materialRef.current) {
      resolutionRef.current.set(size.width, size.height);
      materialRef.current.resolution = resolutionRef.current;
    }
  }, [size]);

  return (
    <lineSegments2 ref={meshRef} geometry={geometry}>
      <lineMaterial
        ref={materialRef}
        color={color}
        linewidth={thickness}
        opacity={opacity}
        transparent={opacity < 1}
        dashed={false}
        alphaToCoverage={true} // Improves transparency
        depthTest={true}
        depthWrite={opacity >= 1}
      />
    </lineSegments2>
  );
}
