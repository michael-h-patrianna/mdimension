/**
 * Unified Point Cloud Scene Component - GPU Accelerated
 *
 * High-performance renderer for point clouds using GPU shaders for N-dimensional transforms.
 * This eliminates CPU transformation overhead by:
 * 1. Storing base N-D vertices as shader attributes
 * 2. Performing rotation/scale/projection in vertex shader
 * 3. Only updating uniform values in useFrame (no buffer copies)
 *
 * Used for: Root Systems, Clifford Torus, Mandelbrot (point cloud mode)
 */

import { extend, useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedInterleavedBuffer,
  Matrix4,
  NormalBlending,
  ShaderMaterial,
  Vector2,
} from 'three';
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from 'three-stdlib';
import { useShallow } from 'zustand/react/shallow';

import { createScaleMatrix, multiplyMatrixVector } from '@/lib/math';
import { DEFAULT_PROJECTION_DISTANCE, projectEdgesToPositions } from '@/lib/math/projection';
import { composeRotations } from '@/lib/math/rotation';
import type { VectorND } from '@/lib/math/types';
import { VERTEX_SIZE_DIVISOR } from '@/lib/shaders/constants';
import { matrixToGPUUniforms } from '@/lib/shaders/transforms/ndTransform';
import { RENDER_LAYERS } from '@/lib/rendering/layers';
import { useProjectionStore } from '@/stores/projectionStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useVisualStore } from '@/stores/visualStore';
import {
  buildEdgeFragmentShader,
  buildEdgeVertexShader,
  buildPointFragmentShader,
  buildPointVertexShader,
  MAX_EXTRA_DIMS,
} from './index';

// Extend for fat lines
extend({ LineSegments2, LineMaterial, LineSegmentsGeometry });

// Type declarations for extended R3F elements
declare module '@react-three/fiber' {
  interface ThreeElements {
    lineSegments2: React.JSX.IntrinsicElements['mesh'] & { geometry?: LineSegmentsGeometry };
    lineMaterial: React.JSX.IntrinsicElements['meshBasicMaterial'] & {
      color?: string | Color;
      linewidth?: number;
      resolution?: Vector2;
      transparent?: boolean;
      opacity?: number;
      depthWrite?: boolean;
      dashed?: boolean;
      alphaToCoverage?: boolean;
      depthTest?: boolean;
    };
  }
}

/**
 * Props for PointCloudScene component
 */
export interface PointCloudSceneProps {
  /** Base (untransformed) vertices in N dimensions */
  baseVertices: VectorND[];
  /** Current dimension of the point cloud */
  dimension: number;
  /** Optional edge connections between points */
  edges?: [number, number][];
  /**
   * Per-point colors - when provided, each point gets a unique color.
   * Used for Mandelbrot visualization where each point has a color
   * based on escape time.
   */
  pointColors?: string[];
  /** Overall opacity (default: 1.0) */
  opacity?: number;
}

/**
 * Calculate safe projection distance based on vertex positions
 * @param vertices - The N-dimensional vertices
 * @param normalizationFactor - Factor based on dimension
 * @returns Safe projection distance that avoids singularities
 */
function calculateSafeProjectionDistance(
  vertices: VectorND[],
  normalizationFactor: number
): number {
  if (vertices.length === 0 || vertices[0]!.length <= 3) {
    return DEFAULT_PROJECTION_DISTANCE;
  }

  let maxEffectiveDepth = 0;
  for (const vertex of vertices) {
    let sum = 0;
    for (let d = 3; d < vertex.length; d++) {
      sum += vertex[d]!;
    }
    const effectiveDepth = sum / normalizationFactor;
    maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth);
  }

  const margin = 2.0;
  return Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + margin);
}

/**
 * Type guard for LineSegmentsGeometry with instance buffer
 */
interface LineSegmentsWithInstanceBuffer {
  instanceStart: {
    data: InstancedInterleavedBuffer;
  };
}

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

/**
 * Create GPU point shader material with full N-D transforms
 * @param pointColor - Color for the points
 * @param opacity - Material opacity
 * @param pointSize - Size of points
 * @returns Configured ShaderMaterial for point rendering
 */
function createPointShaderMaterial(
  pointColor: string,
  opacity: number,
  pointSize: number
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uRotationMatrix4D: { value: new Matrix4() },
      uDimension: { value: 4 },
      uScale4D: { value: [1, 1, 1, 1] },
      uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
      uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
      uDepthRowSums: { value: new Float32Array(11) },
      uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
      uProjectionType: { value: 1 },
      uPointColor: { value: new Color(pointColor) },
      uOpacity: { value: opacity },
      uPointSize: { value: pointSize },
      uUseVertexColors: { value: false },
    },
    vertexShader: buildPointVertexShader(),
    fragmentShader: buildPointFragmentShader(),
    transparent: true,
    depthWrite: opacity >= 1,
    blending: opacity < 1 ? AdditiveBlending : NormalBlending,
  });
}

/**
 * Create GPU edge shader material with full N-D transforms
 * @param edgeColor - Color for edges
 * @param opacity - Material opacity
 * @returns Configured ShaderMaterial for edge rendering
 */
function createEdgeShaderMaterial(edgeColor: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uRotationMatrix4D: { value: new Matrix4() },
      uDimension: { value: 4 },
      uScale4D: { value: [1, 1, 1, 1] },
      uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
      uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
      uDepthRowSums: { value: new Float32Array(11) },
      uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
      uProjectionType: { value: 1 },
      uEdgeColor: { value: new Color(edgeColor) },
      uOpacity: { value: opacity },
    },
    vertexShader: buildEdgeVertexShader(),
    fragmentShader: buildEdgeFragmentShader(),
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
  });
}

/**
 * GPU-accelerated point cloud renderer.
 * Transformations happen in vertex shaders - only uniforms updated per frame.
 */
export const PointCloudScene = React.memo(function PointCloudScene({
  baseVertices,
  dimension,
  edges = [],
  pointColors,
  opacity = 1.0,
}: PointCloudSceneProps) {
  const numVertices = baseVertices.length;
  const numEdges = edges.length;
  const { size } = useThree();

  // ============ REFS ============
  const groupRef = useRef<Group>(null);
  const pointMaterialRef = useRef<ShaderMaterial | null>(null);
  const edgeMaterialRef = useRef<ShaderMaterial | null>(null);
  const fatEdgeGeometryRef = useRef<LineSegmentsGeometry | null>(null);
  const fatLineMaterialRef = useRef<LineMaterial>(null);
  const resolutionRef = useRef(new Vector2());
  // Scratch rotation matrix to avoid allocation in useFrame
  const rotationMatrixRef = useRef<number[][] | null>(null);

  // Assign main object layer for depth-based effects (SSR, refraction, bokeh)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((obj) => {
        if (obj.layers) {
          obj.layers.set(RENDER_LAYERS.MAIN_OBJECT);
        }
      });
    }
  }, []);

  // Working buffer for fat line positions (CPU transformed)
  // Only stores transformedVertices - projection writes directly to Float32Array
  const workingBuffers = useRef<{
    transformedVertices: VectorND[];
  } | null>(null);

  useMemo(() => {
    workingBuffers.current = {
      transformedVertices: baseVertices.map(v => new Array(v.length).fill(0) as VectorND),
    };
  }, [baseVertices]);

  // ============ VISUAL SETTINGS ============
  const {
    edgesVisible,
    edgeColor,
    edgeThickness,
  } = useVisualStore(
    useShallow((state) => ({
      edgesVisible: state.edgesVisible,
      edgeColor: state.edgeColor,
      edgeThickness: state.edgeThickness,
    }))
  );

  // Use edge color as the point color and constants for vertex properties
  const vertexColor = edgeColor;
  const vertexSize = 4 / VERTEX_SIZE_DIVISOR; // Default vertex size of 4
  const vertexVisible = true; // Points are always visible in point cloud scenes
  const useFatLines = edgeThickness >= 1;

  // ============ GPU POINT GEOMETRY ============
  const pointGeometry = useMemo(() => {
    if (numVertices === 0) return null;

    const geo = new BufferGeometry();

    // Position (XYZ)
    const positions = new Float32Array(numVertices * 3);
    // Extra dimensions
    const extraDim0 = new Float32Array(numVertices);
    const extraDim1 = new Float32Array(numVertices);
    const extraDim2 = new Float32Array(numVertices);
    const extraDim3 = new Float32Array(numVertices);
    const extraDim4 = new Float32Array(numVertices);
    const extraDim5 = new Float32Array(numVertices);
    const extraDim6 = new Float32Array(numVertices);
    // Per-point colors
    const colors = new Float32Array(numVertices * 3);

    for (let i = 0; i < numVertices; i++) {
      const v = baseVertices[i]!;
      const i3 = i * 3;

      positions[i3] = v[0] ?? 0;
      positions[i3 + 1] = v[1] ?? 0;
      positions[i3 + 2] = v[2] ?? 0;

      extraDim0[i] = v[3] ?? 0;
      extraDim1[i] = v[4] ?? 0;
      extraDim2[i] = v[5] ?? 0;
      extraDim3[i] = v[6] ?? 0;
      extraDim4[i] = v[7] ?? 0;
      extraDim5[i] = v[8] ?? 0;
      extraDim6[i] = v[9] ?? 0;

      // Default white color
      colors[i3] = 1;
      colors[i3 + 1] = 1;
      colors[i3 + 2] = 1;
    }

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
    geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
    geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
    geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
    geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
    geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
    geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));
    geo.setAttribute('aColor', new Float32BufferAttribute(colors, 3));

    return geo;
  }, [numVertices, baseVertices]);

  // ============ GPU EDGE GEOMETRY (thin lines) ============
  const thinEdgeGeometry = useMemo(() => {
    if (numEdges === 0 || useFatLines) return null;

    const geo = new BufferGeometry();
    const positions = new Float32Array(numEdges * 2 * 3);
    const extraDim0 = new Float32Array(numEdges * 2);
    const extraDim1 = new Float32Array(numEdges * 2);
    const extraDim2 = new Float32Array(numEdges * 2);
    const extraDim3 = new Float32Array(numEdges * 2);
    const extraDim4 = new Float32Array(numEdges * 2);
    const extraDim5 = new Float32Array(numEdges * 2);
    const extraDim6 = new Float32Array(numEdges * 2);

    let idx = 0;
    for (const [a, b] of edges) {
      const vA = baseVertices[a];
      const vB = baseVertices[b];
      if (!vA || !vB) continue;

      // Vertex A
      positions[idx * 3] = vA[0] ?? 0;
      positions[idx * 3 + 1] = vA[1] ?? 0;
      positions[idx * 3 + 2] = vA[2] ?? 0;
      extraDim0[idx] = vA[3] ?? 0;
      extraDim1[idx] = vA[4] ?? 0;
      extraDim2[idx] = vA[5] ?? 0;
      extraDim3[idx] = vA[6] ?? 0;
      extraDim4[idx] = vA[7] ?? 0;
      extraDim5[idx] = vA[8] ?? 0;
      extraDim6[idx] = vA[9] ?? 0;
      idx++;

      // Vertex B
      positions[idx * 3] = vB[0] ?? 0;
      positions[idx * 3 + 1] = vB[1] ?? 0;
      positions[idx * 3 + 2] = vB[2] ?? 0;
      extraDim0[idx] = vB[3] ?? 0;
      extraDim1[idx] = vB[4] ?? 0;
      extraDim2[idx] = vB[5] ?? 0;
      extraDim3[idx] = vB[6] ?? 0;
      extraDim4[idx] = vB[7] ?? 0;
      extraDim5[idx] = vB[8] ?? 0;
      extraDim6[idx] = vB[9] ?? 0;
      idx++;
    }

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
    geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
    geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
    geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
    geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
    geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
    geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));

    return geo;
  }, [numEdges, edges, baseVertices, useFatLines]);

  // Fat edge geometry (for LineSegments2)
  const fatEdgeGeometry = useMemo(() => {
    if (numEdges === 0 || !useFatLines) return null;
    return new LineSegmentsGeometry();
  }, [numEdges, useFatLines]);

  useEffect(() => {
    fatEdgeGeometryRef.current = fatEdgeGeometry;
  }, [fatEdgeGeometry]);

  // ============ MATERIALS ============
  const pointMaterial = useMemo(() => {
    const mat = createPointShaderMaterial(vertexColor, opacity, vertexSize * 10);
    pointMaterialRef.current = mat;
    return mat;
  }, [vertexColor, opacity, vertexSize]);

  const thinEdgeMaterial = useMemo(() => {
    const mat = createEdgeShaderMaterial(edgeColor, opacity);
    edgeMaterialRef.current = mat;
    return mat;
  }, [edgeColor, opacity]);

  // Update point colors when provided
  useEffect(() => {
    if (!pointGeometry || !pointColors || pointColors.length === 0) return;

    const colorAttr = pointGeometry.getAttribute('aColor');
    if (!colorAttr) return;

    const colors = colorAttr.array as Float32Array;
    const tempColor = new Color();
    const count = Math.min(pointColors.length, numVertices);

    for (let i = 0; i < count; i++) {
      tempColor.set(pointColors[i]!);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    colorAttr.needsUpdate = true;

    // Enable vertex colors in shader
    if (pointMaterialRef.current) {
      pointMaterialRef.current.uniforms.uUseVertexColors!.value = true;
    }
  }, [pointColors, pointGeometry, numVertices]);

  // Update fat line material resolution
  useEffect(() => {
    if (fatLineMaterialRef.current) {
      resolutionRef.current.set(size.width, size.height);
      fatLineMaterialRef.current.resolution = resolutionRef.current;
    }
  }, [size]);

  // ============ CLEANUP ============
  useEffect(() => {
    return () => {
      pointMaterial.dispose();
      thinEdgeMaterial.dispose();
      pointGeometry?.dispose();
      thinEdgeGeometry?.dispose();
      fatEdgeGeometry?.dispose();
    };
  }, [pointMaterial, thinEdgeMaterial, pointGeometry, thinEdgeGeometry, fatEdgeGeometry]);

  // ============ USEFRAME: UPDATE UNIFORMS + FAT LINES ============
  useFrame(() => {
    if (numVertices === 0) return;

    // Read current state
    const rotations = useRotationStore.getState().rotations;
    const { uniformScale, perAxisScale } = useTransformStore.getState();
    const projectionType = useProjectionStore.getState().type;

    // Build transformation data
    const scales: number[] = [];
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale);
    }

    // Use scratch rotation matrix to avoid allocation per frame
    if (!rotationMatrixRef.current || rotationMatrixRef.current.length !== dimension) {
      rotationMatrixRef.current = composeRotations(dimension, rotations);
    } else {
      composeRotations(dimension, rotations, rotationMatrixRef.current);
    }
    const rotationMatrix = rotationMatrixRef.current;
    const gpuData = matrixToGPUUniforms(rotationMatrix, dimension);

    const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1;
    const projectionDistance = calculateSafeProjectionDistance(baseVertices, normalizationFactor);

    // Update point material uniforms
    if (pointMaterialRef.current) {
      const u = pointMaterialRef.current.uniforms;
      u.uRotationMatrix4D!.value = gpuData.rotationMatrix4D;
      u.uDimension!.value = dimension;
      u.uScale4D!.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1];
      const extraScales = u.uExtraScales!.value as Float32Array;
      for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
        extraScales[i] = scales[i + 4] ?? 1;
      }
      // Copy extra rotation data for full N-D rotation
      const extraCols = u.uExtraRotationCols!.value as Float32Array;
      extraCols.set(gpuData.extraRotationCols);
      const depthSums = u.uDepthRowSums!.value as Float32Array;
      depthSums.set(gpuData.depthRowSums);
      u.uProjectionDistance!.value = projectionDistance;
      u.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0;
      u.uPointColor!.value = new Color(vertexColor);
      u.uPointSize!.value = vertexSize * 10;
    }

    // Update thin edge material uniforms
    if (edgeMaterialRef.current && !useFatLines) {
      const u = edgeMaterialRef.current.uniforms;
      u.uRotationMatrix4D!.value = gpuData.rotationMatrix4D;
      u.uDimension!.value = dimension;
      u.uScale4D!.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1];
      const extraScales = u.uExtraScales!.value as Float32Array;
      for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
        extraScales[i] = scales[i + 4] ?? 1;
      }
      // Copy extra rotation data for full N-D rotation
      const extraCols = u.uExtraRotationCols!.value as Float32Array;
      extraCols.set(gpuData.extraRotationCols);
      const depthSums = u.uDepthRowSums!.value as Float32Array;
      depthSums.set(gpuData.depthRowSums);
      u.uProjectionDistance!.value = projectionDistance;
      u.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0;
      u.uEdgeColor!.value = new Color(edgeColor);
    }

    // Fat lines still need CPU transform (LineSegments2 uses its own shader)
    if (useFatLines && edgesVisible && fatEdgeGeometryRef.current && workingBuffers.current) {
      const buffers = workingBuffers.current;
      const scaleMatrix = createScaleMatrix(dimension, scales);

      // Transform vertices (apply scale + rotation)
      for (let i = 0; i < numVertices; i++) {
        const baseV = baseVertices[i]!;
        const transformedV = buffers.transformedVertices[i]!;

        multiplyMatrixVector(scaleMatrix, baseV, transformedV);
        const temp = [...transformedV];
        multiplyMatrixVector(rotationMatrix, temp, transformedV);
      }

      // Build fat line positions buffer
      const segmentCount = numEdges;
      const positionCount = segmentCount * 6;

      let targetBuffer: Float32Array;
      let needsResize = true;
      let instanceBuffer: InstancedInterleavedBuffer | null = null;

      if (hasInstanceBuffer(fatEdgeGeometryRef.current.attributes)) {
        const bufferData = fatEdgeGeometryRef.current.attributes.instanceStart.data;
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

      // Project edges directly into the Float32Array buffer
      // This eliminates intermediate Vector3D[] allocation and manual copy loop
      projectEdgesToPositions(
        buffers.transformedVertices,
        edges,
        targetBuffer,
        projectionDistance,
        projectionType === 'perspective'
      );

      if (needsResize) {
        fatEdgeGeometryRef.current.setPositions(targetBuffer);
      } else if (instanceBuffer) {
        instanceBuffer.needsUpdate = true;
        fatEdgeGeometryRef.current.computeBoundingSphere();
      }
    }
  });

  // ============ RENDER ============
  return (
    <group ref={groupRef}>
      {/* GPU-rendered thin edges */}
      {edgesVisible && thinEdgeGeometry && !useFatLines && (
        <lineSegments geometry={thinEdgeGeometry} material={thinEdgeMaterial} frustumCulled={false} />
      )}

      {/* CPU-transformed fat edges (LineSegments2 uses its own shader) */}
      {edgesVisible && fatEdgeGeometry && useFatLines && (
        <lineSegments2 geometry={fatEdgeGeometry}>
          <lineMaterial
            ref={fatLineMaterialRef}
            color={edgeColor}
            linewidth={edgeThickness}
            opacity={opacity}
            transparent={opacity < 1}
            dashed={false}
            alphaToCoverage={true}
            depthTest={true}
            depthWrite={opacity >= 1}
          />
        </lineSegments2>
      )}

      {/* GPU-rendered points */}
      {vertexVisible && pointGeometry && (
        <points geometry={pointGeometry} material={pointMaterial} frustumCulled={false} />
      )}
    </group>
  );
});
