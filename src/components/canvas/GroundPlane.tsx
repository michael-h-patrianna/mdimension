/**
 * Ground Plane Component
 *
 * Renders a reflective ground plane below the polytope for visual depth.
 * Features:
 * - DoubleSide rendering (visible from above and below)
 * - Reflective material with configurable reflectivity
 * - Shadow receiving for realistic lighting
 * - Dynamic positioning based on object bounds
 * - Grid overlay for spatial reference
 *
 * @example
 * ```tsx
 * <GroundPlane
 *   vertices={projectedVertices}
 *   offset={0.5}
 *   opacity={0.3}
 *   reflectivity={0.4}
 * />
 * ```
 */

import { useMemo, useRef, useEffect, memo } from 'react';
import { DoubleSide, PlaneGeometry } from 'three';
import { Grid, MeshReflectorMaterial } from '@react-three/drei';
import type { Vector3D } from '@/lib/math/types';

/**
 * Props for the GroundPlane component
 */
export interface GroundPlaneProps {
  /** 3D projected vertices to calculate bounds from */
  vertices?: Vector3D[];
  /** Additional offset below the lowest point (default: 0.5) */
  offset?: number;
  /** Plane opacity (default: 0.3) */
  opacity?: number;
  /** Reflectivity strength (default: 0.4) */
  reflectivity?: number;
  /** Whether the plane is visible (default: true) */
  visible?: boolean;
}

/**
 * Calculate the Y position for the ground plane based on object's bounding sphere.
 * Uses the maximum distance from origin to ensure stable positioning during rotation.
 * The result is rounded to prevent jitter from small vertex position changes.
 *
 * @param vertices - Array of 3D vertices
 * @param offset - Additional distance below the bounding sphere
 * @returns Y position for the ground plane (stable during rotation)
 */
function calculateGroundY(vertices: Vector3D[] | undefined, offset: number): number {
  if (!vertices || vertices.length === 0) {
    // Default position when no vertices
    return -2;
  }

  // Calculate bounding sphere radius (max distance from origin)
  // This gives a stable position that doesn't change during rotation
  let maxRadius = 0;
  for (const v of vertices) {
    const dist = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (dist > maxRadius) {
      maxRadius = dist;
    }
  }

  // Round to nearest 0.25 to prevent jitter from small position changes
  const roundedRadius = Math.ceil(maxRadius * 4) / 4;

  // Position plane below the bounding sphere
  return -roundedRadius - offset;
}

/**
 * Calculate appropriate plane size based on object extents.
 *
 * @param vertices - Array of 3D vertices
 * @returns Size for the ground plane (width/depth)
 */
function calculatePlaneSize(vertices: Vector3D[] | undefined): number {
  if (!vertices || vertices.length === 0) {
    return 20;
  }

  // Find bounding box in X and Z
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const v of vertices) {
    if (v[0] < minX) minX = v[0];
    if (v[0] > maxX) maxX = v[0];
    if (v[2] < minZ) minZ = v[2];
    if (v[2] > maxZ) maxZ = v[2];
  }

  // Calculate max extent and add padding
  const extentX = maxX - minX;
  const extentZ = maxZ - minZ;
  const maxExtent = Math.max(extentX, extentZ, 4);

  // Return size with generous padding for visual appeal
  return Math.max(maxExtent * 3, 10);
}

/**
 * Internal reflective surface component - memoized to prevent re-renders during animation.
 * MeshReflectorMaterial creates expensive render targets that leak if recreated frequently.
 */
const ReflectiveSurface = memo(function ReflectiveSurface({
  geometry,
  opacity,
  reflectivity,
}: {
  geometry: PlaneGeometry;
  opacity: number;
  reflectivity: number;
}) {
  // Track material ref for cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materialRef = useRef<any>(null);

  // Dispose render targets on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (materialRef.current) {
        // MeshReflectorMaterial has internal FBOs that need disposal
        materialRef.current.dispose();
        materialRef.current = null;
      }
    };
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={geometry}>
      <MeshReflectorMaterial
        ref={materialRef}
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={reflectivity}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#101010"
        metalness={0.5}
        transparent
        opacity={opacity}
        side={DoubleSide}
        mirror={0}
      />
    </mesh>
  );
});

/**
 * Renders a reflective ground plane with grid overlay.
 *
 * The plane automatically positions itself below the object and scales
 * to provide adequate visual coverage. Features DoubleSide rendering
 * so it's visible from both above and below the plane.
 *
 * @param props - Component props
 * @returns Ground plane mesh with reflective material and grid overlay
 */
export function GroundPlane({
  vertices,
  offset = 0.5,
  opacity = 0.3,
  reflectivity = 0.4,
  visible = true,
}: GroundPlaneProps) {
  // Calculate position and size based on vertex count (not positions)
  // This ensures stability during rotation while still adapting to object changes
  const vertexCount = vertices?.length ?? 0;

  const groundY = useMemo(
    () => calculateGroundY(vertices, offset),
    // Only recalculate when vertex count or offset changes, not during rotation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertexCount, offset]
  );

  const planeSize = useMemo(
    () => calculatePlaneSize(vertices),
    // Only recalculate when vertex count changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertexCount]
  );

  // Create plane geometry - only recreate when size changes
  const geometry = useMemo(() => {
    return new PlaneGeometry(planeSize, planeSize);
  }, [planeSize]);

  // Dispose previous geometry when new one is created
  const geometryRef = useRef<PlaneGeometry | null>(null);
  useEffect(() => {
    if (geometryRef.current && geometryRef.current !== geometry) {
      geometryRef.current.dispose();
    }
    geometryRef.current = geometry;

    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
        geometryRef.current = null;
      }
    };
  }, [geometry]);

  if (!visible) {
    return null;
  }

  return (
    <group position={[0, groundY, 0]}>
      {/* Reflective ground surface - memoized to prevent render target leaks */}
      <ReflectiveSurface
        geometry={geometry}
        opacity={opacity}
        reflectivity={reflectivity}
      />

      {/* Grid overlay for spatial reference */}
      <Grid
        args={[planeSize, planeSize]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#3a3a3a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#5a5a5a"
        fadeDistance={planeSize * 0.8}
        fadeStrength={1}
        followCamera={false}
        side={DoubleSide}
        position={[0, 0.001, 0]}
      />
    </group>
  );
}
