/**
 * Ground Plane Component
 *
 * Renders environment walls around the polytope for visual depth.
 * Features:
 * - Multiple wall positions: floor, back, left, right, top
 * - Two surface types: 'two-sided' (visible from both sides) or 'plane' (single-sided)
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
 *   activeWalls={['floor', 'back']}
 *   color="#101010"
 *   surfaceType="two-sided"
 *   showGrid={true}
 *   gridColor="#3a3a3a"
 *   gridSpacing={1}
 * />
 * ```
 */

import type { Vector3D } from '@/lib/math/types';
import { RENDER_LAYERS } from '@/rendering/core/layers';
import type { GroundPlaneType, WallPosition } from '@/stores/defaults/visualDefaults';
import { Grid, Instance, Instances } from '@react-three/drei';
import { useCallback, useMemo } from 'react';
import { Color, DoubleSide, FrontSide, Object3D } from 'three';

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
  /** Which walls are currently active/visible */
  activeWalls?: WallPosition[];
  /**
   * Minimum bounding radius to consider for positioning.
   * Used when external objects (like raymarched Mandelbulb) need to be
   * accounted for even if they don't contribute to vertices array.
   */
  minBoundingRadius?: number;
  /** Surface color (default: '#101010') */
  color?: string;
  /** Surface type: 'two-sided' (visible from both sides) or 'plane' (single-sided) */
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
  /** Size scale multiplier (1-5, 1 = auto-calculated minimum) */
  sizeScale?: number;
}

/**
 * Calculate the wall distance based on object's bounding sphere.
 * Uses the maximum distance from origin to ensure stable positioning during rotation.
 * The result is rounded to prevent jitter from small vertex position changes.
 *
 * @param vertices - Array of 3D vertices
 * @param offset - Additional distance from the bounding sphere
 * @param minBoundingRadius - Minimum radius to consider (for external objects like raymarched Mandelbulb)
 * @returns Distance for wall positioning (positive value)
 */
function calculateWallDistance(
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
  // This ensures walls account for external objects (e.g., raymarched Mandelbulb)
  if (minBoundingRadius !== undefined && minBoundingRadius > maxRadius) {
    maxRadius = minBoundingRadius;
  }

  // Default distance when no vertices and no minBoundingRadius
  if (maxRadius === 0) {
    return 2;
  }

  // Round to nearest 0.25 to prevent jitter from small position changes
  const roundedRadius = Math.ceil(maxRadius * 4) / 4;

  // Return distance from origin
  return roundedRadius + offset;
}

/**
 * Calculate appropriate plane size based on object extents.
 *
 * @param vertices - Array of 3D vertices
 * @returns Size for the wall surfaces (width/depth)
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

/** Configuration for a single wall */
interface WallConfig {
  position: [number, number, number];
  surfaceRotation: [number, number, number];
  gridRotation: [number, number, number];
  /** Offset for grid to prevent z-fighting (in direction of wall normal) */
  gridOffset: [number, number, number];
}

/**
 * Offset to prevent z-fighting between grid and surface.
 */
const Z_OFFSET = 0.02;

/**
 * Get wall configuration for a given wall position and distance.
 *
 * PlaneGeometry default: XY plane, normal +Z
 * drei Grid default: XZ plane (horizontal), normal -Y (faces down)
 *
 * @param wall - Wall position type
 * @param distance - Distance from origin
 * @returns Wall configuration with position and rotations
 */
function getWallConfig(wall: WallPosition, distance: number): WallConfig {
  switch (wall) {
    case 'floor':
      // Floor at y=-distance, horizontal, facing up
      // Surface: rotate -90° around X to lay flat (XY -> XZ, normal +Z -> +Y)
      // Grid: flip 180° around X to face up (normal -Y -> +Y)
      // Grid offset: +Y (up, toward interior)
      return {
        position: [0, -distance, 0],
        surfaceRotation: [-Math.PI / 2, 0, 0],
        gridRotation: [Math.PI, 0, 0],
        gridOffset: [0, Z_OFFSET, 0],
      };
    case 'top':
      // Ceiling at y=+distance, horizontal, facing down
      // Surface: rotate +90° around X (XY -> XZ, normal +Z -> -Y)
      // Grid: default faces down, no rotation needed
      // Grid offset: -Y (down, toward interior)
      return {
        position: [0, distance, 0],
        surfaceRotation: [Math.PI / 2, 0, 0],
        gridRotation: [0, 0, 0],
        gridOffset: [0, -Z_OFFSET, 0],
      };
    case 'back':
      // Back wall at z=-distance, vertical (XY plane), facing +Z
      // Surface: no rotation needed (already XY, normal +Z)
      // Grid: rotate -90° around X to stand vertical (XZ -> XY, normal -Y -> +Z)
      // Grid offset: +Z (forward, toward interior)
      return {
        position: [0, 0, -distance],
        surfaceRotation: [0, 0, 0],
        gridRotation: [-Math.PI / 2, 0, 0],
        gridOffset: [0, 0, Z_OFFSET],
      };
    case 'left':
      // Left wall at x=-distance, vertical (YZ plane), facing +X
      // Surface: rotate +90° around Y (XY -> YZ, normal +Z -> +X)
      // Grid: rotate to be vertical in YZ plane facing +X
      // Grid offset: +X (right, toward interior)
      return {
        position: [-distance, 0, 0],
        surfaceRotation: [0, Math.PI / 2, 0],
        gridRotation: [0, 0, Math.PI / 2],
        gridOffset: [Z_OFFSET, 0, 0],
      };
    case 'right':
      // Right wall at x=+distance, vertical (YZ plane), facing -X
      // Surface: rotate -90° around Y (XY -> YZ, normal +Z -> -X)
      // Grid: rotate to be vertical in YZ plane facing -X
      // Grid offset: -X (left, toward interior)
      return {
        position: [distance, 0, 0],
        surfaceRotation: [0, -Math.PI / 2, 0],
        gridRotation: [0, 0, -Math.PI / 2],
        gridOffset: [-Z_OFFSET, 0, 0],
      };
    default:
      return {
        position: [0, -distance, 0],
        surfaceRotation: [-Math.PI / 2, 0, 0],
        gridRotation: [Math.PI, 0, 0],
        gridOffset: [0, Z_OFFSET, 0],
      };
  }
}

/** Props for a single wall grid overlay */
interface WallGridProps {
  wall: WallPosition;
  distance: number;
  size: number;
  surfaceType: GroundPlaneType;
  gridColor: string;
  gridSpacing: number;
  sectionColor: string;
}

/**
 * Renders the grid overlay for a single wall.
 * Currently kept as separate component since Grid is a complex shader mesh that isn't easily instanced.
 */
function WallGrid({
  wall,
  distance,
  size,
  surfaceType,
  gridColor,
  gridSpacing,
  sectionColor,
}: WallGridProps) {
  const config = getWallConfig(wall, distance);

  // Callback ref to set SKYBOX layer on Grid and all its children
  const setGridLayer = useCallback((obj: Object3D | null) => {
    if (obj) {
      obj.traverse((child) => {
        child.layers.set(RENDER_LAYERS.SKYBOX);
      });
    }
  }, []);

  return (
    <group position={config.position}>
      <group ref={setGridLayer}>
        <Grid
          args={[size, size]}
          rotation={config.gridRotation}
          cellSize={gridSpacing}
          cellThickness={0.5}
          cellColor={gridColor}
          sectionSize={gridSpacing * 5}
          sectionThickness={1}
          sectionColor={sectionColor}
          fadeDistance={size * 0.5}
          fadeStrength={2}
          followCamera={false}
          side={surfaceType === 'two-sided' ? DoubleSide : FrontSide}
          position={config.gridOffset}
        />
      </group>
    </group>
  );
}

/**
 * Renders environment walls with optional grid overlay.
 *
 * The walls automatically position themselves around the object and scale
 * to provide adequate visual coverage. Supports multiple wall positions
 * and two surface types.
 *
 * Uses instanced rendering for the wall surfaces to reduce draw calls.
 */
export function GroundPlane({
  vertices,
  offset = 0.5,
  opacity: _opacity = 0.3,
  reflectivity: _reflectivity = 0.4,
  activeWalls = ['floor'],
  minBoundingRadius,
  color = '#101010',
  surfaceType = 'two-sided',
  showGrid = true,
  gridColor = '#3a3a3a',
  gridSpacing = 1,
  roughness = 0.3,
  metalness = 0.5,
  envMapIntensity = 0.5,
  sizeScale = 1,
}: GroundPlaneProps) {
  // Calculate position and size based on vertex count (not positions)
  const vertexCount = vertices?.length ?? 0;

  const wallDistance = useMemo(
    () => calculateWallDistance(vertices, offset, minBoundingRadius),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertexCount, offset, minBoundingRadius]
  );

  const basePlaneSize = useMemo(
    () => calculatePlaneSize(vertices),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertexCount]
  );

  // Apply size scale to the base plane size
  const planeSize = basePlaneSize * sizeScale;

  // Calculate grid section color
  const sectionColor = useMemo(
    () => lightenColor(gridColor, 15),
    [gridColor]
  );

  // Don't render if no walls are active
  if (!activeWalls || activeWalls.length === 0) {
    return null;
  }

  // Determine material side
  const side = surfaceType === 'two-sided' ? DoubleSide : FrontSide;

  return (
    <>
      {/* 
        Instanced Wall Surfaces 
        Reduces N draw calls to 1 for the background planes
      */}
      <Instances range={activeWalls.length} receiveShadow>
        <planeGeometry args={[planeSize, planeSize]} />
        <meshStandardMaterial
          color={color}
          side={side}
          roughness={roughness}
          metalness={metalness}
          envMapIntensity={envMapIntensity}
        />

        {activeWalls.map((wall) => {
          const config = getWallConfig(wall, wallDistance);
          return (
            <Instance
              key={wall}
              position={config.position}
              rotation={config.surfaceRotation}
            />
          );
        })}
      </Instances>

      {/* 
        Grid Overlays 
        Rendered separately as Grid component handles its own complex shader
      */}
      {showGrid && activeWalls.map((wall) => (
        <WallGrid
          key={`grid-${wall}`}
          wall={wall}
          distance={wallDistance}
          size={planeSize}
          surfaceType={surfaceType}
          gridColor={gridColor}
          gridSpacing={gridSpacing}
          sectionColor={sectionColor}
        />
      ))}
    </>
  );
}
