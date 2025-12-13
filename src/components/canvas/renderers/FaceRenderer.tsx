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

import React, { useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  MeshPhongMaterial,
  Mesh,
} from 'three';
import type { Vector3D } from '@/lib/math/types';
import type { Face } from '@/lib/geometry/faces';
import { createPhongPaletteMaterial, updatePhongPaletteMaterial } from '@/lib/shaders/materials';
import type { ColorMode } from '@/lib/shaders/palette';
import {
  DEFAULT_FACE_COLOR,
  DEFAULT_FACE_OPACITY,
  DEFAULT_SPECULAR_INTENSITY,
  DEFAULT_SHININESS,
  useVisualStore,
} from '@/stores/visualStore';

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
  /** Shininess - controls specular highlight size (Three.js naming) */
  shininess?: number;
  /** Whether faces are visible */
  visible?: boolean;
  /** Per-face depth values for palette color variation (0-1 normalized) */
  faceDepths?: number[];
  /** Color mode for palette generation */
  colorMode?: ColorMode;
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
 * @param props.shininess
 * @param props.visible
 * @param props.faceDepths
 * @param props.colorMode
 * @returns Three.js mesh with face geometry
 */
export const FaceRenderer = React.memo(function FaceRenderer({
  vertices,
  faces,
  color = DEFAULT_FACE_COLOR,
  opacity = DEFAULT_FACE_OPACITY,
  // Props ignored - using store values for consistency with LightingControls
  specularIntensity: _specularIntensity = DEFAULT_SPECULAR_INTENSITY,
  shininess: _shininess = DEFAULT_SHININESS,
  visible = true,
  faceDepths = [],
  colorMode = 'monochromatic',
}: FaceRendererProps) {
  // Suppress unused variable warnings - props kept for API compatibility
  void _specularIntensity;
  void _shininess;
  // Get surface shader settings from store for fresnel support
  const shaderSettings = useVisualStore((state) => state.shaderSettings);
  const edgeColor = useVisualStore((state) => state.edgeColor);
  const surfaceSettings = shaderSettings.surface;
  // Get fresnel intensity from store (top-level, not in surfaceSettings)
  const fresnelIntensity = useVisualStore((state) => state.fresnelIntensity);

  // Get specular and tone mapping settings for material updates
  // Note: lightEnabled, lightColor, lightDirection, ambientIntensity, diffuseIntensity
  // are handled by scene lights (SceneLighting.tsx) - MeshPhongMaterial uses scene lights
  const storeSpecularIntensity = useVisualStore((state) => state.specularIntensity);
  const storeShininess = useVisualStore((state) => state.shininess);
  const specularColor = useVisualStore((state) => state.specularColor);
  const toneMappingEnabled = useVisualStore((state) => state.toneMappingEnabled);
  const toneMappingAlgorithm = useVisualStore((state) => state.toneMappingAlgorithm);
  const exposure = useVisualStore((state) => state.exposure);

  // Refs to track previous resources for cleanup
  const geometryRef = useRef<BufferGeometry | null>(null);
  const materialRef = useRef<MeshPhongMaterial | null>(null);
  const meshRef = useRef<Mesh>(null);

  // Reusable Vector3 objects for normal calculation (avoid allocation in render loop)
  const tempVectors = useRef({
    vA: new Vector3(),
    vB: new Vector3(),
    vC: new Vector3(),
    cb: new Vector3(),
    ab: new Vector3(),
  });

  // Create MeshPhongMaterial with custom shader injection
  // Uses Three.js native Phong lighting + onBeforeCompile for custom features
  // Only recreate when fresnelEnabled changes (all other properties updated via uniforms)
  const material = useMemo(() => {
    return createPhongPaletteMaterial({
      color: DEFAULT_FACE_COLOR, // Use defaults - will be updated immediately
      edgeColor: DEFAULT_FACE_COLOR,
      faceOpacity: DEFAULT_FACE_OPACITY,
      specularIntensity: DEFAULT_SPECULAR_INTENSITY,
      shininess: DEFAULT_SHININESS,
      fresnelEnabled: surfaceSettings.fresnelEnabled,
      colorMode: 'monochromatic',
    });
  }, [surfaceSettings.fresnelEnabled]); // Only recreate when fresnel toggle changes

  // Update material properties when visual settings change
  // MeshPhongMaterial uses scene lights (DirectionalLight, AmbientLight) for lighting
  // Custom uniforms (palette, fresnel, tone mapping) are updated via shader reference
  useLayoutEffect(() => {
    if (!material) return;

    // Update material properties - both native MeshPhongMaterial props and custom uniforms
    // Note: lightEnabled, lightColor, lightDirection, ambientIntensity, diffuseIntensity
    // are now handled by scene lights (SceneLighting.tsx)
    updatePhongPaletteMaterial(material, {
      // Color properties
      color,
      rimColor: edgeColor,
      opacity,
      colorMode,
      // Fresnel
      fresnelIntensity: surfaceSettings.fresnelEnabled ? fresnelIntensity : 0,
      // Specular (native MeshPhongMaterial properties)
      specularIntensity: storeSpecularIntensity,
      specularColor,
      shininess: storeShininess,
      // Tone mapping (custom uniforms)
      toneMappingEnabled,
      toneMappingAlgorithm,
      exposure,
    });
  }, [
    material,
    // Color properties
    color,
    edgeColor,
    opacity,
    colorMode,
    // Fresnel
    surfaceSettings.fresnelEnabled,
    fresnelIntensity,
    // Specular
    storeSpecularIntensity,
    specularColor,
    storeShininess,
    // Tone mapping
    toneMappingEnabled,
    toneMappingAlgorithm,
    exposure,
  ]);

  // Cleanup material on unmount or when recreated
  useEffect(() => {
    const currentMaterial = material;
    // Track for cleanup
    if (materialRef.current && materialRef.current !== currentMaterial) {
      materialRef.current.dispose();
    }
    materialRef.current = currentMaterial;

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
    // faceDepth attribute for palette color variation
    geo.setAttribute('faceDepth', new Float32BufferAttribute(new Float32Array(vertexCount), 1));

    return geo;
  }, [faces]);

  // Update geometry buffers every frame with new vertex positions
  useLayoutEffect(() => {
    if (!geometry || !vertices || vertices.length === 0) return;

    const positions = geometry.attributes.position!.array as Float32Array;
    const normals = geometry.attributes.normal!.array as Float32Array;
    const depths = geometry.attributes.faceDepth!.array as Float32Array;

    let idx = 0;
    let faceIdx = 0;
    // Use reusable Vector3 objects to avoid allocation every frame
    const { vA, vB, vC, cb, ab } = tempVectors.current;

    // Helper to set vertex data
    const setVertex = (vIdx: number, pIdx: number, nx: number, ny: number, nz: number, depth: number) => {
      const v = vertices[vIdx];
      if (!v) return;

      const i = pIdx * 3;
      positions[i] = v[0];
      positions[i + 1] = v[1];
      positions[i + 2] = v[2];

      normals[i] = nx;
      normals[i + 1] = ny;
      normals[i + 2] = nz;

      depths[pIdx] = depth;
    };

    for (const face of faces) {
      const vis = face.vertices;
      if (vis.length < 3) {
        faceIdx++;
        continue;
      }

      // Get face depth from faceDepths array, or use 0.5 as fallback
      const faceDepth = faceDepths[faceIdx] ?? 0.5;

      // Get vertices for normal calculation
      const v0 = vertices[vis[0]!];
      const v1 = vertices[vis[1]!];
      const v2 = vertices[vis[2]!];

      if (!v0 || !v1 || !v2) {
        faceIdx++;
        continue;
      }

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
        // Triangle - all vertices get same face depth
        setVertex(vis[0]!, idx++, nx, ny, nz, faceDepth);
        setVertex(vis[1]!, idx++, nx, ny, nz, faceDepth);
        setVertex(vis[2]!, idx++, nx, ny, nz, faceDepth);
      } else if (vis.length === 4) {
        // Quad -> 2 Triangles - all vertices get same face depth
        // Tri 1: 0, 1, 2
        setVertex(vis[0]!, idx++, nx, ny, nz, faceDepth);
        setVertex(vis[1]!, idx++, nx, ny, nz, faceDepth);
        setVertex(vis[2]!, idx++, nx, ny, nz, faceDepth);

        // Tri 2: 0, 2, 3
        setVertex(vis[0]!, idx++, nx, ny, nz, faceDepth);
        setVertex(vis[2]!, idx++, nx, ny, nz, faceDepth);
        setVertex(vis[3]!, idx++, nx, ny, nz, faceDepth);
      }

      faceIdx++;
    }

    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.normal!.needsUpdate = true;
    geometry.attributes.faceDepth!.needsUpdate = true;
    geometry.computeBoundingSphere();

  }, [vertices, faces, geometry, faceDepths]);

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
});
