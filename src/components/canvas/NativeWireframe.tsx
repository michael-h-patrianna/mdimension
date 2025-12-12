import { useRef, useLayoutEffect, useMemo, useEffect } from 'react';
import { BufferGeometry, BufferAttribute, Color, LineBasicMaterial } from 'three';

export interface NativeWireframeProps {
  vertices: number[][]; // [x, y, z] arrays
  edges: [number, number][];
  color: string;
  opacity?: number;
  thickness?: number; // Ignored for native WebGL lines, kept for API compatibility
}

/**
 *
 * @param root0
 * @param root0.vertices
 * @param root0.edges
 * @param root0.color
 * @param root0.opacity
 */
export function NativeWireframe({
  vertices,
  edges,
  color,
  opacity = 1.0,
}: NativeWireframeProps) {
  // Re-use position buffer attribute to avoid allocation every frame
  const positionAttrRef = useRef<BufferAttribute | null>(null);

  // Initialize geometry with indices when topology changes
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const indices: number[] = [];
    for (const [start, end] of edges) {
      indices.push(start, end);
    }
    geo.setIndex(indices);
    // Reset attribute ref when geometry changes
    positionAttrRef.current = null;
    return geo;
  }, [edges]);

  // Update geometry positions every frame - REUSE buffer attribute to prevent memory leak
  useLayoutEffect(() => {
    if (!vertices || vertices.length === 0) return;

    const vertexCount = vertices.length;
    const requiredSize = vertexCount * 3;

    // Check if we need to create or resize the buffer attribute
    const existingAttr = positionAttrRef.current;

    if (!existingAttr || existingAttr.array.length !== requiredSize) {
      // Only create new buffer when size changes (rare - topology change)
      const positions = new Float32Array(requiredSize);
      const newAttr = new BufferAttribute(positions, 3);
      newAttr.setUsage(35048); // THREE.DynamicDrawUsage for frequent updates
      positionAttrRef.current = newAttr;
      geometry.setAttribute('position', newAttr);
    }

    // Get the reusable buffer and update positions in-place
    const attr = positionAttrRef.current!;
    const positions = attr.array as Float32Array;

    // Copy vertices to buffer
    for (let i = 0; i < vertexCount; i++) {
      const v = vertices[i]!;
      positions[i * 3] = v[0] ?? 0;
      positions[i * 3 + 1] = v[1] ?? 0;
      positions[i * 3 + 2] = v[2] ?? 0;
    }

    // Signal Three.js to upload updated data to GPU
    attr.needsUpdate = true;

    // Bounding sphere update is needed for frustum culling
    geometry.computeBoundingSphere();

  }, [vertices, geometry]);

  // Material cleanup
  const materialRef = useRef<LineBasicMaterial | null>(null);
  const material = useMemo(() => {
    return new LineBasicMaterial({
      color: new Color(color),
      transparent: opacity < 1,
      opacity: opacity,
    });
  }, [color, opacity]);

  useEffect(() => {
    if (materialRef.current && materialRef.current !== material) {
      materialRef.current.dispose();
    }
    materialRef.current = material;
    return () => {
      materialRef.current?.dispose();
    };
  }, [material]);

  return (
    <lineSegments geometry={geometry} material={material} frustumCulled={false} />
  );
}
