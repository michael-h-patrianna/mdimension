/**
 * Ground Plane Component
 *
 * Renders a ground plane below the polytope for visual depth.
 * Features:
 * - Two surface types: 'two-sided' (visible from above and below) or 'plane' (single-sided, transparent from below)
 * - Configurable surface color
 * - Optional grid overlay with customizable color and spacing
 * - Shadow receiving for realistic lighting
 * - Dynamic positioning based on object bounds
 *
 * @example
 * ```tsx
 * <GroundPlane
 *   vertices={projectedVertices}
 *   offset={0.5}
 *   opacity={0.3}
 *   reflectivity={0.4}
 *   color="#101010"
 *   surfaceType="two-sided"
 *   showGrid={true}
 *   gridColor="#3a3a3a"
 *   gridSpacing={1}
 * />
 * ```
 */

import { useMemo } from 'react';
import { FrontSide, DoubleSide, Color } from 'three';
import { Grid } from '@react-three/drei';
import type { Vector3D } from '@/lib/math/types';
import type { GroundPlaneType } from '@/stores/visualStore';

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
  /**
   * Minimum bounding radius to consider for positioning.
   * Used when external objects (like raymarched Mandelbulb) need to be
   * accounted for even if they don't contribute to vertices array.
   */
  minBoundingRadius?: number;
  /** Surface color (default: '#101010') */
  color?: string;
  /** Surface type: 'two-sided' (visible from above and below) or 'plane' (single-sided, transparent from below) */
  surfaceType?: GroundPlaneType;
  /** Whether to show the grid overlay (default: true) */
  showGrid?: boolean;
  /** Grid line color (default: '#3a3a3a') */
  gridColor?: string;
  /** Grid cell spacing (default: 1) */
  gridSpacing?: number;
  /** Material roughness (0-1, lower = shinier) */
  roughness?: number;
  /** Material metalness (0-1, higher = more metallic) */
  metalness?: number;
  /** Environment map intensity (0-1) */
  envMapIntensity?: number;
}

/**
 * Calculate the Y position for the ground plane based on object's bounding sphere.
 * Uses the maximum distance from origin to ensure stable positioning during rotation.
 * The result is rounded to prevent jitter from small vertex position changes.
 *
 * @param vertices - Array of 3D vertices
 * @param offset - Additional distance below the bounding sphere
 * @param minBoundingRadius - Minimum radius to consider (for external objects like raymarched Mandelbulb)
 * @returns Y position for the ground plane (stable during rotation)
 */
function calculateGroundY(
  vertices: Vector3D[] | undefined,
  offset: number,
  minBoundingRadius?: number
): number {
  // Calculate bounding sphere radius from vertices (max distance from origin)
  // This gives a stable position that doesn't change during rotation
  let maxRadius = 0;
  if (vertices && vertices.length > 0) {
    for (const v of vertices) {
      const dist = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (dist > maxRadius) {
        maxRadius = dist;
      }
    }
  }

  // Use the larger of calculated radius and minimum bounding radius
  // This ensures ground plane accounts for external objects (e.g., raymarched Mandelbulb)
  if (minBoundingRadius !== undefined && minBoundingRadius > maxRadius) {
    maxRadius = minBoundingRadius;
  }

  // Default position when no vertices and no minBoundingRadius
  if (maxRadius === 0) {
    return -2;
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
 * Lighten a hex color by a percentage for grid section lines.
 *
 * @param hex - Hex color string (e.g., '#3a3a3a')
 * @param percent - Amount to lighten (0-100)
 * @returns Lightened hex color
 */
function lightenColor(hex: string, percent: number): string {
  const color = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  hsl.l = Math.min(1, hsl.l + percent / 100);
  color.setHSL(hsl.h, hsl.s, hsl.l);
  return '#' + color.getHexString();
}

/** Material props shared by both surface types */
interface SurfaceMaterialProps {
  size: number;
  color: string;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
}

/**
 * Single-sided plane surface - only visible from above.
 */
function PlaneSurface({
  size,
  color,
  roughness,
  metalness,
  envMapIntensity,
}: SurfaceMaterialProps) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color={color}
        side={FrontSide}
        roughness={roughness}
        metalness={metalness}
        envMapIntensity={envMapIntensity}
      />
    </mesh>
  );
}

/** Height of the two-sided box surface */
const TWO_SIDED_HEIGHT = 0.01;

/**
 * Two-sided surface using a thin box - visible from both above and below
 * with proper normals for correct lighting on both sides.
 */
function TwoSidedSurface({
  size,
  color,
  roughness,
  metalness,
  envMapIntensity,
}: SurfaceMaterialProps) {
  // Thin box to simulate a two-sided plane with proper normals on both faces
  // Position offset so top face is at y=0 (aligned with grid)
  return (
    <mesh receiveShadow position={[0, -TWO_SIDED_HEIGHT / 2, 0]}>
      <boxGeometry args={[size, TWO_SIDED_HEIGHT, size]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        envMapIntensity={envMapIntensity}
      />
    </mesh>
  );
}

/**
 * Renders a ground plane with optional grid overlay.
 *
 * The plane automatically positions itself below the object and scales
 * to provide adequate visual coverage. Supports two surface types:
 * - 'two-sided': DoubleSide rendering, visible from above and below (default)
 * - 'plane': Single-sided rendering, transparent when viewed from below
 *
 * @param props - Component props
 * @param props.vertices - 3D vertices to calculate bounds from
 * @param props.offset - Distance below object's lowest point
 * @param props.opacity - Surface opacity
 * @param props.reflectivity - Reflection strength (reflective mode only)
 * @param props.visible - Whether the surface is visible
 * @param props.minBoundingRadius - Minimum radius for positioning
 * @param props.color - Surface color
 * @param props.surfaceType - 'two-sided' or 'plane'
 * @param props.showGrid - Whether to show grid overlay
 * @param props.gridColor - Grid line color
 * @param props.gridSpacing - Grid cell size
 * @returns Ground plane mesh with optional grid overlay
 */
export function GroundPlane({
  vertices,
  offset = 0.5,
  opacity = 0.3,
  reflectivity = 0.4,
  visible = true,
  minBoundingRadius,
  color = '#101010',
  surfaceType = 'two-sided',
  showGrid = true,
  gridColor = '#3a3a3a',
  gridSpacing = 1,
  roughness = 0.3,
  metalness = 0.5,
  envMapIntensity = 0.5,
}: GroundPlaneProps) {
  // Calculate position and size based on vertex count (not positions)
  // This ensures stability during rotation while still adapting to object changes
  const vertexCount = vertices?.length ?? 0;

  const groundY = useMemo(
    () => calculateGroundY(vertices, offset, minBoundingRadius),
    // Only recalculate when vertex count, offset, or minBoundingRadius changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertexCount, offset, minBoundingRadius]
  );

  const planeSize = useMemo(
    () => calculatePlaneSize(vertices),
    // Only recalculate when vertex count changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertexCount]
  );

  // Calculate grid section color (lighter version of grid color)
  const sectionColor = useMemo(
    () => lightenColor(gridColor, 15),
    [gridColor]
  );

  if (!visible) {
    return null;
  }

  return (
    <group position={[0, groundY, 0]}>
      {/* Ground surface - either two-sided box or single-sided plane */}
      {surfaceType === 'two-sided' ? (
        <TwoSidedSurface
          size={planeSize}
          color={color}
          roughness={roughness}
          metalness={metalness}
          envMapIntensity={envMapIntensity}
        />
      ) : (
        <PlaneSurface
          size={planeSize}
          color={color}
          roughness={roughness}
          metalness={metalness}
          envMapIntensity={envMapIntensity}
        />
      )}

      {/* Optional grid overlay for spatial reference */}
      {showGrid && (
        <Grid
          args={[planeSize, planeSize]}
          cellSize={gridSpacing}
          cellThickness={0.5}
          cellColor={gridColor}
          sectionSize={gridSpacing * 5}
          sectionThickness={1}
          sectionColor={sectionColor}
          fadeDistance={planeSize * 0.8}
          fadeStrength={1}
          followCamera={false}
          side={surfaceType === 'two-sided' ? DoubleSide : FrontSide}
          position={[0, 0.001, 0]}
        />
      )}
    </group>
  );
}
