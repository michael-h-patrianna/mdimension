/**
 * Main Application Component
 * N-Dimensional Object Visualizer
 */

import { useMemo, useLayoutEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/components/canvas/Scene';
import { Layout } from '@/components/Layout';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useRotatedVertices } from '@/hooks/useRotatedVertices';
import { useProjectedVertices } from '@/hooks/useProjectedVertices';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { generatePolytope } from '@/lib/geometry';
import {
  multiplyMatrixVector,
  createIdentityMatrix,
  createScaleMatrix,
  createShearMatrix,
} from '@/lib/math';
import type { Vector3D, VectorND, MatrixND } from '@/lib/math/types';

/**
 * Main visualization component that handles the render pipeline
 */
function Visualizer() {
  // Get geometry state
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);

  // Sync rotation store dimension with geometry store
  const setRotationDimension = useRotationStore((state) => state.setDimension);

  // Sync transform store dimension with geometry store
  const setTransformDimension = useTransformStore((state) => state.setDimension);

  // Get transform raw values (not methods that depend on internal dimension)
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const perAxisScale = useTransformStore((state) => state.perAxisScale);
  const shears = useTransformStore((state) => state.shears);
  const translation = useTransformStore((state) => state.translation);

  // Run animation loop
  useAnimationLoop();

  // Sync dimensions BEFORE render using useLayoutEffect
  useLayoutEffect(() => {
    setRotationDimension(dimension);
    setTransformDimension(dimension);
  }, [dimension, setRotationDimension, setTransformDimension]);

  // Generate the polytope geometry
  const geometry = useMemo(() => {
    return generatePolytope(objectType, dimension);
  }, [objectType, dimension]);

  // Build scale matrix for current dimension (not store's internal dimension)
  const scaleMatrix = useMemo(() => {
    // Create scale values array for current dimension
    const scales: number[] = [];
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale);
    }
    return createScaleMatrix(dimension, scales);
  }, [dimension, perAxisScale, uniformScale]);

  // Apply scale transformation
  const scaledVertices = useMemo(() => {
    return geometry.vertices.map((v) => multiplyMatrixVector(scaleMatrix, v));
  }, [geometry.vertices, scaleMatrix]);

  // Apply rotation transformations
  const rotatedVertices = useRotatedVertices(scaledVertices, dimension);

  // Build shear matrix for current dimension
  const shearMatrix = useMemo(() => {
    if (shears.size === 0) {
      return createIdentityMatrix(dimension);
    }

    const AXIS_NAMES = ['X', 'Y', 'Z', 'W', 'V', 'U'];
    const parseAxisName = (name: string): number => {
      const idx = AXIS_NAMES.indexOf(name);
      if (idx !== -1) return idx;
      if (name.startsWith('A')) {
        const num = parseInt(name.slice(1), 10);
        if (!isNaN(num)) return num;
      }
      return -1;
    };

    let result = createIdentityMatrix(dimension);
    for (const [plane, amount] of shears.entries()) {
      const parts = plane.match(/[A-Z][0-9]*/g);
      if (parts && parts.length === 2) {
        const axis1 = parseAxisName(parts[0]!);
        const axis2 = parseAxisName(parts[1]!);
        if (axis1 >= 0 && axis1 < dimension && axis2 >= 0 && axis2 < dimension) {
          const shearMat = createShearMatrix(dimension, axis1, axis2, amount);
          // Multiply matrices
          const newResult: MatrixND = [];
          for (let i = 0; i < dimension; i++) {
            newResult[i] = [];
            for (let j = 0; j < dimension; j++) {
              let sum = 0;
              for (let k = 0; k < dimension; k++) {
                sum += result[i]![k]! * shearMat[k]![j]!;
              }
              newResult[i]![j] = sum;
            }
          }
          result = newResult;
        }
      }
    }
    return result;
  }, [dimension, shears]);

  // Apply shear transformation
  const shearedVertices = useMemo(() => {
    return rotatedVertices.map((v) => multiplyMatrixVector(shearMatrix, v));
  }, [rotatedVertices, shearMatrix]);

  // Apply translation
  const translatedVertices = useMemo(() => {
    return shearedVertices.map((v) =>
      v.map((val, i) => val + (translation[i] ?? 0))
    ) as VectorND[];
  }, [shearedVertices, translation]);

  // Project to 3D
  const projectedVertices = useProjectedVertices(translatedVertices);

  // Convert edges to the format expected by Scene
  const edges = useMemo(() => {
    return geometry.edges as [number, number][];
  }, [geometry.edges]);

  return (
    <Scene
      vertices={projectedVertices as Vector3D[]}
      edges={edges}
      showGrid
    />
  );
}

function App() {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <Layout appTitle="N-Dimensional Visualizer" showHeader>
      <Canvas
        camera={{
          position: [0, 0, 5],
          fov: 60,
        }}
        style={{ background: '#0F0F1A' }}
      >
        <Visualizer />
      </Canvas>
    </Layout>
  );
}

export default App;
