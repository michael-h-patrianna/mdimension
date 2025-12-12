/**
 * Face Renderer Component
 *
 * Renders filled faces of n-dimensional polytopes projected into 3D space.
 * Uses BufferGeometry for efficient face rendering with proper normal calculation.
 *
 * Features:
 * - Triangular and quadrilateral face support
 * - Per-face normal calculation for proper lighting
 * - DoubleSide rendering for n-dimensional objects
 * - Integration with SurfaceMaterial for Phong lighting + optional fresnel rim
 * - Memoized geometry for performance
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <FaceRenderer
 *     vertices={projectedVertices}
 *     faces={detectedFaces}
 *     color="#8800FF"
 *     opacity={0.6}
 *   />
 * </Canvas>
 * ```
 *
 * @see {@link detectFaces} for face detection from polytope edges
 * @see {@link createSurfaceMaterial} for surface material creation
 */

import { useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  Material,
  Mesh,
} from 'three';
import type { Vector3D } from '@/lib/math/types';
import type { Face } from '@/lib/geometry/faces';
import { createSurfaceMaterial } from '@/lib/shaders/materials';
import {
  DEFAULT_FACE_COLOR,
  DEFAULT_FACE_OPACITY,
  DEFAULT_FACE_SPECULAR_INTENSITY,
  DEFAULT_FACE_SPECULAR_POWER,
} from '@/lib/shaders/constants';
import { useVisualStore } from '@/stores/visualStore';

/**
 * Props for the FaceRenderer component
 */
export interface FaceRendererProps {
  /** 3D projected vertices of the polytope */
  vertices: Vector3D[];
  /** Array of faces with vertex indices */
  faces: Face[];
  /** Face color (hex string) */
  color?: string;
  /** Face opacity (0-1) */
  opacity?: number;
  /** Specular intensity for lighting */
  specularIntensity?: number;
  /** Specular power/shininess */
  specularPower?: number;
  /** Whether faces are visible */
  visible?: boolean;
}

/**
 * Renders filled faces of a polytope with proper lighting.
 *
 * Creates BufferGeometry from face definitions and renders them with
 * MeshPhongMaterial for realistic lighting. Supports both triangular
 * (3-vertex) and quadrilateral (4-vertex) faces.
 *
 * Optimized to use buffer updates instead of geometry recreation for 60 FPS performance.
 *
 * @param props - Component props
 * @param props.vertices
 * @param props.faces
 * @param props.color
 * @param props.opacity
 * @param props.specularIntensity
 * @param props.specularPower
 * @param props.visible
 * @returns Three.js mesh with face geometry
 */
export function FaceRenderer({
  vertices,
  faces,
  color = DEFAULT_FACE_COLOR,
  opacity = DEFAULT_FACE_OPACITY,
  specularIntensity = DEFAULT_FACE_SPECULAR_INTENSITY,
  specularPower = DEFAULT_FACE_SPECULAR_POWER,
  visible = true,
}: FaceRendererProps) {
  // Get surface shader settings from store for fresnel support
  const shaderSettings = useVisualStore((state) => state.shaderSettings);
  const edgeColor = useVisualStore((state) => state.edgeColor);
  const surfaceSettings = shaderSettings.surface;

  // Refs to track previous resources for cleanup
  const geometryRef = useRef<BufferGeometry | null>(null);
  const materialRef = useRef<Material | null>(null);
  const meshRef = useRef<Mesh>(null);

  // Reusable Vector3 objects for normal calculation (avoid allocation in render loop)
  const tempVectors = useRef({
    vA: new Vector3(),
    vB: new Vector3(),
    vC: new Vector3(),
    cb: new Vector3(),
    ab: new Vector3(),
  });

  // Create surface material with fresnel support based on settings
  const material = useMemo(() => {
    return createSurfaceMaterial({
      color,
      edgeColor, // Used as rim color for fresnel effect
      faceOpacity: opacity,
      specularIntensity,
      specularPower,
      fresnelEnabled: surfaceSettings.fresnelEnabled,
    });
  }, [color, edgeColor, opacity, specularIntensity, specularPower, surfaceSettings.fresnelEnabled]);

  // Dispose previous material when new one is created
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

  // Initialize geometry buffers based on topology (faces)
  // This only runs when the face structure changes (not during rotation)
  const geometry = useMemo(() => {
    if (faces.length === 0) return null;

    // Calculate total vertices required (triangulating quads)
    let vertexCount = 0;
    for (const face of faces) {
      if (face.vertices.length === 3) vertexCount += 3;
      else if (face.vertices.length === 4) vertexCount += 6; // 2 triangles
    }

    if (vertexCount === 0) return null;

    const geo = new BufferGeometry();
    // Allocate buffers
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3));
    geo.setAttribute('normal', new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3));

    return geo;
  }, [faces]);

  // Update geometry buffers every frame with new vertex positions
  useLayoutEffect(() => {
    if (!geometry || !vertices || vertices.length === 0) return;

    const positions = geometry.attributes.position!.array as Float32Array;
    const normals = geometry.attributes.normal!.array as Float32Array;

    let idx = 0;
    // Use reusable Vector3 objects to avoid allocation every frame
    const { vA, vB, vC, cb, ab } = tempVectors.current;

    // Helper to set vertex data
    const setVertex = (vIdx: number, pIdx: number, nx: number, ny: number, nz: number) => {
      const v = vertices[vIdx];
      if (!v) return;
      
      const i = pIdx * 3;
      positions[i] = v[0];
      positions[i + 1] = v[1];
      positions[i + 2] = v[2];

      normals[i] = nx;
      normals[i + 1] = ny;
      normals[i + 2] = nz;
    };

    for (const face of faces) {
      const vis = face.vertices;
      if (vis.length < 3) continue;

      // Get vertices for normal calculation
      const v0 = vertices[vis[0]!];
      const v1 = vertices[vis[1]!];
      const v2 = vertices[vis[2]!];

      if (!v0 || !v1 || !v2) continue;

      // Calculate normal: (v1-v0) x (v2-v0)
      vA.set(v0[0], v0[1], v0[2]);
      vB.set(v1[0], v1[1], v1[2]);
      vC.set(v2[0], v2[1], v2[2]);

      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      cb.cross(ab); // Normal vector (not normalized yet)

      // Normalize with check for degenerate triangles (zero area)
      const lenSq = cb.lengthSq();
      if (lenSq > 1e-12) {
        cb.multiplyScalar(1 / Math.sqrt(lenSq));
      } else {
        // Fallback for degenerate triangles to avoid NaNs
        cb.set(0, 0, 1);
      }

      const nx = cb.x;
      const ny = cb.y;
      const nz = cb.z;

      if (vis.length === 3) {
        // Triangle
        setVertex(vis[0]!, idx++, nx, ny, nz);
        setVertex(vis[1]!, idx++, nx, ny, nz);
        setVertex(vis[2]!, idx++, nx, ny, nz);
      } else if (vis.length === 4) {
        // Quad -> 2 Triangles
        // Tri 1: 0, 1, 2
        setVertex(vis[0]!, idx++, nx, ny, nz);
        setVertex(vis[1]!, idx++, nx, ny, nz);
        setVertex(vis[2]!, idx++, nx, ny, nz);
        
        // Tri 2: 0, 2, 3
        setVertex(vis[0]!, idx++, nx, ny, nz);
        setVertex(vis[2]!, idx++, nx, ny, nz);
        setVertex(vis[3]!, idx++, nx, ny, nz);
      }
    }

    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.normal!.needsUpdate = true;
    geometry.computeBoundingSphere();

  }, [vertices, faces, geometry]);

  // Dispose previous geometry when new one is created
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

  if (!visible || !geometry) {
    return null;
  }

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <primitive object={material} attach="material" />
    </mesh>
  );
}
