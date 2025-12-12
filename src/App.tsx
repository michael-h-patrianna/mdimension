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
import { useAnimationStore } from '@/stores/animationStore';
import { useCrossSectionStore } from '@/stores/crossSectionStore';
import { useVisualStore } from '@/stores/visualStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useRotatedVertices } from '@/hooks/useRotatedVertices';
import { useProjectedVertices } from '@/hooks/useProjectedVertices';
import { useTransformedVertices } from '@/hooks/useTransformedVertices';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useCrossSectionAnimation } from '@/hooks/useCrossSectionAnimation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { generatePolytope, computeCrossSection, detectFaces } from '@/lib/geometry';
import { projectPerspective, projectOrthographic } from '@/lib/math/projection';
import {
  multiplyMatrixVector,
  multiplyMatrices,
  createIdentityMatrix,
  createScaleMatrix,
  createShearMatrix,
} from '@/lib/math';
import type { Vector3D } from '@/lib/math/types';

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

  // Sync animation store dimension with geometry store
  const setAnimationDimension = useAnimationStore((state) => state.setDimension);

  // Get transform raw values (not methods that depend on internal dimension)
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const perAxisScale = useTransformStore((state) => state.perAxisScale);
  const shears = useTransformStore((state) => state.shears);
  const translation = useTransformStore((state) => state.translation);

  // Get cross-section state
  const crossSectionEnabled = useCrossSectionStore((state) => state.enabled);
  const sliceW = useCrossSectionStore((state) => state.sliceW);
  const showOriginal = useCrossSectionStore((state) => state.showOriginal);
  const originalOpacity = useCrossSectionStore((state) => state.originalOpacity);

  // Get projection state for cross-section rendering
  const projectionType = useProjectionStore((state) => state.type);
  const projectionDistance = useProjectionStore((state) => state.distance);

  // Run animation loop
  useAnimationLoop();

  // Run cross-section animation
  useCrossSectionAnimation();

  // Sync dimensions BEFORE render using useLayoutEffect
  useLayoutEffect(() => {
    setRotationDimension(dimension);
    setTransformDimension(dimension);
    setAnimationDimension(dimension);
  }, [dimension, setRotationDimension, setTransformDimension, setAnimationDimension]);

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
          result = multiplyMatrices(result, shearMat);
        }
      }
    }
    return result;
  }, [dimension, shears]);

  // Apply shear and translation transformations using optimized hook
  // Ensure translation vector matches current dimension
  const effectiveTranslation = useMemo(() => {
    const t = new Array(dimension).fill(0);
    for (let i = 0; i < dimension; i++) {
      if (i < translation.length) {
        t[i] = translation[i];
      }
    }
    return t;
  }, [dimension, translation]);

  const transformedVertices = useTransformedVertices(
    rotatedVertices,
    shearMatrix,
    effectiveTranslation
  );

  // Project to 3D
  const projectedVertices = useProjectedVertices(transformedVertices);

  // Convert edges to the format expected by Scene
  const edges = useMemo(() => {
    return geometry.edges as [number, number][];
  }, [geometry.edges]);

  // Detect faces for Surface shader rendering (PRD Story 2)
  // Compute once when geometry changes, using original n-dimensional vertices
  const faces = useMemo(() => {
    try {
      return detectFaces(
        geometry.vertices,
        geometry.edges,
        objectType
      );
    } catch (e) {
      console.warn('Face detection failed:', e);
      return [];
    }
  }, [geometry, objectType]);

  // Compute cross-section if enabled and dimension >= 4
  const crossSectionResult = useMemo(() => {
    if (!crossSectionEnabled || dimension < 4) {
      return null;
    }
    // Build geometry with transformed vertices for cross-section computation
    const transformedGeometry = {
      vertices: transformedVertices,
      edges: geometry.edges,
      dimension,
      type: objectType,
    };
    return computeCrossSection(transformedGeometry, sliceW, faces);
  }, [crossSectionEnabled, dimension, transformedVertices, geometry.edges, sliceW, objectType, faces]);

  // Project cross-section vertices to 3D using the same projection as the main object
  const crossSectionVertices = useMemo(() => {
    if (!crossSectionResult || !crossSectionResult.hasIntersection) {
      return undefined;
    }

    // Reuse 3D vectors to avoid allocation if possible, but for now map new ones
    // We must apply the same 4D->3D projection that the main object uses
    return crossSectionResult.points.map((p) => {
      const out: Vector3D = [0, 0, 0];
      if (projectionType === 'perspective') {
        projectPerspective(p, projectionDistance, out);
      } else {
        projectOrthographic(p, out);
      }
      return out;
    });
  }, [crossSectionResult, projectionType, projectionDistance]);

  const crossSectionEdges = useMemo(() => {
    if (!crossSectionResult || !crossSectionResult.hasIntersection) {
      return undefined;
    }
    return crossSectionResult.edges;
  }, [crossSectionResult]);

  // Determine opacity for main polytope
  const mainOpacity = crossSectionEnabled && crossSectionResult?.hasIntersection
    ? (showOriginal ? originalOpacity : 0)
    : 1.0;

  return (
    <Scene
      vertices={mainOpacity > 0 ? projectedVertices as Vector3D[] : undefined}
      edges={mainOpacity > 0 ? edges : undefined}
      faces={mainOpacity > 0 ? faces : undefined}
      opacity={mainOpacity}
      crossSectionVertices={crossSectionVertices}
      crossSectionEdges={crossSectionEdges}
    />
  );
}

function App() {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Get background color from visual store (PRD Story 6 AC7)
  const backgroundColor = useVisualStore((state) => state.backgroundColor);

  return (
    <Layout appTitle="N-Dimensional Visualizer" showHeader>
      <Canvas
        camera={{
          position: [2, 2, 2.5],
          fov: 60,
        }}
        style={{ background: backgroundColor }}
      >
        <Visualizer />
      </Canvas>
    </Layout>
  );
}

export default App;
