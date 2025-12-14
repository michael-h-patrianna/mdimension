import { useRef, useLayoutEffect, useMemo } from 'react';
import { Vector2, InstancedInterleavedBuffer, InstancedBufferAttribute, Matrix4, Color } from 'three';
import { extend, useThree, useFrame, type ThreeElement } from '@react-three/fiber';
import { LineSegments2 } from 'three-stdlib';
import { LineMaterial } from 'three-stdlib';
import { LineSegmentsGeometry } from 'three-stdlib';

import type { VectorND } from '@/lib/math/types';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { composeRotations } from '@/lib/math/rotation';
import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection';
import { matrixToGPUUniforms } from '@/lib/shaders/transforms/ndTransform';

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

// Maximum extra dimensions (beyond XYZ + W) - matches PolytopeScene
const MAX_EXTRA_DIMS = 7;

/**
 * Build the N-D transformation GLSL function for injection into LineMaterial
 *
 * Uses packed vec4 attributes to stay within WebGL's ~16 attribute limit:
 * - instanceStartExtraA: (W, Extra0, Extra1, Extra2)
 * - instanceStartExtraB: (Extra3, Extra4, Extra5, Extra6)
 * - instanceEndExtraA: (W, Extra0, Extra1, Extra2)
 * - instanceEndExtraB: (Extra3, Extra4, Extra5, Extra6)
 */
function buildNDTransformGLSL(): string {
  return `
    // N-D Transformation uniforms
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];

    // Extra dimension attributes for line start/end (packed into vec4s)
    // ExtraA: (W, Extra0, Extra1, Extra2)
    // ExtraB: (Extra3, Extra4, Extra5, Extra6)
    attribute vec4 instanceStartExtraA;
    attribute vec4 instanceStartExtraB;
    attribute vec4 instanceEndExtraA;
    attribute vec4 instanceEndExtraB;

    vec3 transformNDPoint(vec3 pos, vec4 extraA, vec4 extraB) {
      // Unpack: extraA = (W, Extra0, Extra1, Extra2), extraB = (Extra3, Extra4, Extra5, Extra6)
      float scaledInputs[11];
      scaledInputs[0] = pos.x * uScale4D.x;
      scaledInputs[1] = pos.y * uScale4D.y;
      scaledInputs[2] = pos.z * uScale4D.z;
      scaledInputs[3] = extraA.x * uScale4D.w;           // W
      scaledInputs[4] = extraA.y * uExtraScales[0];      // Extra0
      scaledInputs[5] = extraA.z * uExtraScales[1];      // Extra1
      scaledInputs[6] = extraA.w * uExtraScales[2];      // Extra2
      scaledInputs[7] = extraB.x * uExtraScales[3];      // Extra3
      scaledInputs[8] = extraB.y * uExtraScales[4];      // Extra4
      scaledInputs[9] = extraB.z * uExtraScales[5];      // Extra5
      scaledInputs[10] = extraB.w * uExtraScales[6];     // Extra6

      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      vec3 projected;
      if (uProjectionType == 0) {
        projected = rotated.xyz;
      } else {
        float effectiveDepth = rotated.w;
        for (int j = 0; j < 11; j++) {
          if (j < uDimension) {
            effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
          }
        }
        float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
        effectiveDepth /= normFactor;
        float factor = 1.0 / (uProjectionDistance - effectiveDepth);
        projected = rotated.xyz * factor;
      }

      return projected;
    }
  `;
}

export interface FatWireframeProps {
  /** N-dimensional vertices */
  vertices: VectorND[];
  /** Edge connections as pairs of vertex indices */
  edges: [number, number][];
  /** Current dimension of the object (default: 3) */
  dimension?: number;
  /** Color of the lines */
  color: string;
  /** Opacity (0-1) */
  opacity?: number;
  /** Line thickness in pixels */
  thickness?: number;
}

/**
 * GPU-accelerated fat wireframe renderer with N-D transformation support.
 *
 * Uses LineMaterial from three-stdlib for thick line rendering, with custom
 * shader injection to support N-dimensional rotation and perspective projection.
 *
 * @param props - FatWireframe configuration
 */
export function FatWireframe({
  vertices,
  edges,
  dimension = 3,
  color,
  opacity = 1.0,
  thickness = 2,
}: FatWireframeProps) {
  const { size } = useThree();
  const materialRef = useRef<LineMaterial>(null);
  const meshRef = useRef<LineSegments2>(null);
  // Reusable Vector2 for resolution updates (avoids allocation on every size change)
  const resolutionRef = useRef(new Vector2());
  // Track if shader has been compiled with our modifications
  const shaderCompiledRef = useRef(false);

  // Initialize geometry (topology)
  // Geometry object is created once; positions are updated in useLayoutEffect when edges/vertices change.
  const geometry = useMemo(() => {
    return new LineSegmentsGeometry();
  }, []);

  // Create material with onBeforeCompile for N-D transformation
  const material = useMemo(() => {
    // Convert color string to hex number for LineMaterial
    const colorHex = new Color(color).getHex();
    const mat = new LineMaterial({
      color: colorHex,
      linewidth: thickness,
      transparent: opacity < 1,
      opacity: opacity,
      dashed: false,
      alphaToCoverage: true,
      depthTest: true,
      depthWrite: opacity >= 1,
    });

    // Add N-D uniforms to the material
    mat.uniforms.uRotationMatrix4D = { value: new Matrix4() };
    mat.uniforms.uDimension = { value: dimension };
    mat.uniforms.uScale4D = { value: [1, 1, 1, 1] };
    mat.uniforms.uExtraScales = { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) };
    mat.uniforms.uExtraRotationCols = { value: new Float32Array(MAX_EXTRA_DIMS * 4) };
    mat.uniforms.uDepthRowSums = { value: new Float32Array(11) };
    mat.uniforms.uProjectionDistance = { value: DEFAULT_PROJECTION_DISTANCE };
    mat.uniforms.uProjectionType = { value: 1 };

    // Inject N-D transformation into vertex shader
    mat.onBeforeCompile = (shader) => {
      // Add our uniforms to the shader
      Object.assign(shader.uniforms, mat.uniforms);

      // Inject N-D transformation code at the beginning of vertex shader
      shader.vertexShader = buildNDTransformGLSL() + shader.vertexShader;

      // Replace instanceStart usage with transformed version
      shader.vertexShader = shader.vertexShader.replace(
        'vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
        `vec3 ndStart = transformNDPoint(instanceStart, instanceStartExtraA, instanceStartExtraB);
        vec4 start = modelViewMatrix * vec4( ndStart, 1.0 );`
      );

      // Replace instanceEnd usage with transformed version
      shader.vertexShader = shader.vertexShader.replace(
        'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
        `vec3 ndEnd = transformNDPoint(instanceEnd, instanceEndExtraA, instanceEndExtraB);
        vec4 end = modelViewMatrix * vec4( ndEnd, 1.0 );`
      );

      shaderCompiledRef.current = true;
    };

    return mat;
  }, [color, thickness, opacity, dimension]);

  // Update material ref when material changes
  useLayoutEffect(() => {
    if (materialRef.current !== material) {
      // Material was recreated, need to force shader recompilation
      shaderCompiledRef.current = false;
    }
  }, [material]);

  // Update geometry positions and extra dimension attributes
  useLayoutEffect(() => {
    if (!vertices || vertices.length === 0 || !edges || edges.length === 0) return;

    const segmentCount = edges.length;
    const positionCount = segmentCount * 6; // 2 points * 3 coords per segment

    // Check if we can reuse the existing buffer
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

    // Prepare packed extra dimension buffers (vec4s)
    // ExtraA: (W, Extra0, Extra1, Extra2)
    // ExtraB: (Extra3, Extra4, Extra5, Extra6)
    const startExtraA = new Float32Array(segmentCount * 4);
    const startExtraB = new Float32Array(segmentCount * 4);
    const endExtraA = new Float32Array(segmentCount * 4);
    const endExtraB = new Float32Array(segmentCount * 4);

    // Fill buffers
    let posIdx = 0;
    let invalidEdgeCount = 0;
    for (let edgeIdx = 0; edgeIdx < edges.length; edgeIdx++) {
      const [startVertIdx, endVertIdx] = edges[edgeIdx]!;
      const v1 = vertices[startVertIdx];
      const v2 = vertices[endVertIdx];
      const extraIdx = edgeIdx * 4;

      if (v1 && v2) {
        // XYZ positions
        targetBuffer[posIdx++] = v1[0] ?? 0;
        targetBuffer[posIdx++] = v1[1] ?? 0;
        targetBuffer[posIdx++] = v1[2] ?? 0;
        targetBuffer[posIdx++] = v2[0] ?? 0;
        targetBuffer[posIdx++] = v2[1] ?? 0;
        targetBuffer[posIdx++] = v2[2] ?? 0;

        // Pack start extra dimensions into vec4s
        // ExtraA: (W, Extra0, Extra1, Extra2)
        startExtraA[extraIdx + 0] = v1[3] ?? 0;  // W
        startExtraA[extraIdx + 1] = v1[4] ?? 0;  // Extra0
        startExtraA[extraIdx + 2] = v1[5] ?? 0;  // Extra1
        startExtraA[extraIdx + 3] = v1[6] ?? 0;  // Extra2
        // ExtraB: (Extra3, Extra4, Extra5, Extra6)
        startExtraB[extraIdx + 0] = v1[7] ?? 0;  // Extra3
        startExtraB[extraIdx + 1] = v1[8] ?? 0;  // Extra4
        startExtraB[extraIdx + 2] = v1[9] ?? 0;  // Extra5
        startExtraB[extraIdx + 3] = v1[10] ?? 0; // Extra6

        // Pack end extra dimensions into vec4s
        endExtraA[extraIdx + 0] = v2[3] ?? 0;  // W
        endExtraA[extraIdx + 1] = v2[4] ?? 0;  // Extra0
        endExtraA[extraIdx + 2] = v2[5] ?? 0;  // Extra1
        endExtraA[extraIdx + 3] = v2[6] ?? 0;  // Extra2
        endExtraB[extraIdx + 0] = v2[7] ?? 0;  // Extra3
        endExtraB[extraIdx + 1] = v2[8] ?? 0;  // Extra4
        endExtraB[extraIdx + 2] = v2[9] ?? 0;  // Extra5
        endExtraB[extraIdx + 3] = v2[10] ?? 0; // Extra6
      } else {
        // Invalid edge - use degenerate line
        invalidEdgeCount++;
        targetBuffer[posIdx++] = 0;
        targetBuffer[posIdx++] = 0;
        targetBuffer[posIdx++] = 0;
        targetBuffer[posIdx++] = 0;
        targetBuffer[posIdx++] = 0;
        targetBuffer[posIdx++] = 0;

        // Zero out extra dimensions
        for (let i = 0; i < 4; i++) {
          startExtraA[extraIdx + i] = 0;
          startExtraB[extraIdx + i] = 0;
          endExtraA[extraIdx + i] = 0;
          endExtraB[extraIdx + i] = 0;
        }
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

    // Set packed extra dimension attributes as instanced buffer attributes (vec4s)
    geometry.setAttribute('instanceStartExtraA', new InstancedBufferAttribute(startExtraA, 4));
    geometry.setAttribute('instanceStartExtraB', new InstancedBufferAttribute(startExtraB, 4));
    geometry.setAttribute('instanceEndExtraA', new InstancedBufferAttribute(endExtraA, 4));
    geometry.setAttribute('instanceEndExtraB', new InstancedBufferAttribute(endExtraB, 4));

  }, [vertices, edges, geometry]);

  // Update material resolution (reuses Vector2 instance to avoid allocation)
  useLayoutEffect(() => {
    resolutionRef.current.set(size.width, size.height);
    material.resolution = resolutionRef.current;
  }, [size, material]);

  // Update N-D uniforms every frame from stores
  useFrame(() => {
    if (!material.uniforms.uRotationMatrix4D) return;

    // Read current state from stores
    const rotations = useRotationStore.getState().rotations;
    const { uniformScale, perAxisScale } = useTransformStore.getState();
    const projectionType = useProjectionStore.getState().type;

    // Build scales array
    const scales: number[] = [];
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale);
    }

    // Compute rotation matrix and GPU data
    const rotationMatrix = composeRotations(dimension, rotations);
    const gpuData = matrixToGPUUniforms(rotationMatrix, dimension);

    // Calculate safe projection distance
    const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1;
    let maxEffectiveDepth = 0;
    if (vertices.length > 0 && vertices[0]!.length > 3) {
      for (const vertex of vertices) {
        let sum = 0;
        for (let d = 3; d < vertex.length; d++) {
          sum += vertex[d]!;
        }
        const effectiveDepth = sum / normalizationFactor;
        maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth);
      }
    }
    const projectionDistance = Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + 2.0);

    // Update uniforms
    const u = material.uniforms;
    (u.uRotationMatrix4D!.value as Matrix4).copy(gpuData.rotationMatrix4D);
    u.uDimension!.value = dimension;
    u.uScale4D!.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1];

    const extraScales = u.uExtraScales!.value as Float32Array;
    for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
      extraScales[i] = scales[i + 4] ?? 1;
    }

    (u.uExtraRotationCols!.value as Float32Array).set(gpuData.extraRotationCols);
    (u.uDepthRowSums!.value as Float32Array).set(gpuData.depthRowSums);
    u.uProjectionDistance!.value = projectionDistance;
    u.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0;
  });

  return (
    <lineSegments2 ref={meshRef} geometry={geometry} material={material} />
  );
}
