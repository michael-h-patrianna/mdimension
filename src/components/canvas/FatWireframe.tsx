import { useRef, useLayoutEffect, useMemo } from 'react';
import { Vector2, InstancedInterleavedBuffer } from 'three';
import { extend, ReactThreeFiber, useThree } from '@react-three/fiber';
import { LineSegments2 } from 'three-stdlib';
import { LineMaterial } from 'three-stdlib';
import { LineSegmentsGeometry } from 'three-stdlib';

// Extend Three.js elements for R3F
extend({ LineSegments2, LineMaterial, LineSegmentsGeometry });

// Add types for the extended elements
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      lineSegments2: ReactThreeFiber.Object3DNode<LineSegments2, typeof LineSegments2>;
      lineMaterial: ReactThreeFiber.MaterialNode<LineMaterial, typeof LineMaterial>;
      lineSegmentsGeometry: ReactThreeFiber.Object3DNode<LineSegmentsGeometry, typeof LineSegmentsGeometry>;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

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

  // Initialize geometry (topology)
  // We recreate geometry only when edges change, which is rare.
  const geometry = useMemo(() => {
    return new LineSegmentsGeometry();
  }, [edges]);

  // Update geometry positions every frame
  useLayoutEffect(() => {
    if (!vertices || vertices.length === 0 || !edges || edges.length === 0) return;

    const segmentCount = edges.length;
    const positionCount = segmentCount * 6; // 2 points * 3 coords per segment

    // Check if we can reuse the existing buffer
    // LineSegmentsGeometry uses an InstancedInterleavedBuffer for instanceStart/instanceEnd
    const attributes = geometry.attributes as unknown as {
      instanceStart?: { data: InstancedInterleavedBuffer };
    };

    let targetBuffer: Float32Array;
    let needsResize = true;

    if (
      attributes.instanceStart &&
      attributes.instanceStart.data &&
      attributes.instanceStart.data.array.length === positionCount
    ) {
      targetBuffer = attributes.instanceStart.data.array as Float32Array;
      needsResize = false;
    } else {
      targetBuffer = new Float32Array(positionCount);
    }
    
    // Fill buffer
    let i = 0;
    for (const [start, end] of edges) {
      const v1 = vertices[start];
      const v2 = vertices[end];
      if (v1 && v2) {
                targetBuffer[i++] = v1[0] ?? 0;
                targetBuffer[i++] = v1[1] ?? 0;
                targetBuffer[i++] = v1[2] ?? 0;
        
                targetBuffer[i++] = v2[0] ?? 0;
                targetBuffer[i++] = v2[1] ?? 0;
                targetBuffer[i++] = v2[2] ?? 0;      }
    }

    if (needsResize) {
      // Allocate new buffer via setPositions
      geometry.setPositions(targetBuffer);
    } else {
      // Update existing buffer in-place
      attributes.instanceStart!.data.needsUpdate = true;
      geometry.computeBoundingSphere();
    }

  }, [vertices, edges, geometry]);

  // Update material resolution
  useLayoutEffect(() => {
    if (materialRef.current) {
      materialRef.current.resolution = new Vector2(size.width, size.height);
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
