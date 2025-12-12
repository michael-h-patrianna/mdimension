/**
 * Main Application Component
 * N-Dimensional Object Visualizer
 *
 * Supports both traditional polytopes and extended objects:
 * - Polytopes: Hypercube, Simplex, Cross-Polytope
 * - Extended: Hypersphere, Root System, Clifford Torus, Mandelbrot
 */

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/components/canvas/Scene';
import { Layout } from '@/components/Layout';
import { useVisualStore } from '@/stores/visualStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useProjectedVertices } from '@/hooks/useProjectedVertices';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSyncedDimension } from '@/hooks/useSyncedDimension';
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator';
import { useObjectTransformations } from '@/hooks/useObjectTransformations';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useFaceDepths } from '@/hooks/useFaceDepths';
import { useMandelbrotColors } from '@/hooks/useMandelbrotColors';
import MandelbulbMesh from '@/components/canvas/Mandelbulb/MandelbulbMesh';
import HyperbulbMesh from '@/components/canvas/Hyperbulb/HyperbulbMesh';
import type { Vector3D } from '@/lib/math/types';

/**
 * Main visualization component that handles the render pipeline
 */
function Visualizer() {
  // 1. Synchronize dimensions across stores
  useSyncedDimension();

  // 2. Run animation loops
  useAnimationLoop();

  // 3. Generate geometry based on store state
  const { geometry, dimension, objectType } = useGeometryGenerator();

  // 4. Apply scale, rotation, shear, and translation
  const transformedVertices = useObjectTransformations(geometry.vertices, dimension);

  // 5. Project to 3D for rendering
  const projectedVertices = useProjectedVertices(transformedVertices);

  // 6. Detect faces for surface rendering
  const faces = useFaceDetection(geometry, objectType);

  // 6b. Compute per-face depth values for palette color variation
  const faceDepths = useFaceDepths(transformedVertices, faces, dimension);

  // 8. Compute Mandelbrot colors (derived from user's vertex color)
  const mandelbrotConfig = useExtendedObjectStore((state) => state.mandelbrot);
  const vertexColor = useVisualStore((state) => state.vertexColor);
  const pointColors = useMandelbrotColors(geometry, mandelbrotConfig, vertexColor);
  const facesVisible = useVisualStore((state) => state.facesVisible);

  // Prepare edges for rendering
  const edges = useMemo(() => {
    return geometry.edges as [number, number][];
  }, [geometry.edges]);

  // Calculate minimum bounding radius for ground plane positioning
  // When raymarched Mandelbulb/Hyperbulb is visible, ensure ground plane accounts for it
  // Both have approximate radius of 1.5 for power 8
  const isMandelbulbVisible = objectType === 'mandelbrot' && facesVisible && dimension === 3;
  const isHyperbulbVisible = objectType === 'mandelbrot' && facesVisible && dimension >= 4;
  const minBoundingRadius = (isMandelbulbVisible || isHyperbulbVisible) ? 1.5 : undefined;

  return (
    <>
      <Scene
        vertices={projectedVertices as Vector3D[]}
        edges={edges}
        faces={faces}
        isPointCloud={geometry.isPointCloud}
        pointColors={pointColors}
        minBoundingRadius={minBoundingRadius}
        faceDepths={faceDepths}
      />
      {isMandelbulbVisible && <MandelbulbMesh />}
      {isHyperbulbVisible && <HyperbulbMesh />}
    </>
  );
}

/**
 * Main App Container
 */
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
