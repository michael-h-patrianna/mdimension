/**
 * Main Application Component
 * N-Dimensional Object Visualizer
 *
 * Supports both traditional polytopes and extended objects:
 * - Polytopes: Hypercube, Simplex, Cross-Polytope
 * - Extended: Hypersphere, Root System, Clifford Torus
 */

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/components/canvas/Scene';
import { Layout } from '@/components/Layout';
import { useVisualStore } from '@/stores/visualStore';
import { useProjectedVertices } from '@/hooks/useProjectedVertices';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useCrossSectionAnimation } from '@/hooks/useCrossSectionAnimation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSyncedDimension } from '@/hooks/useSyncedDimension';
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator';
import { useObjectTransformations } from '@/hooks/useObjectTransformations';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useCrossSectionCalculator } from '@/hooks/useCrossSectionCalculator';
import type { Vector3D } from '@/lib/math/types';

/**
 * Main visualization component that handles the render pipeline
 */
function Visualizer() {
  // 1. Synchronize dimensions across stores
  useSyncedDimension();

  // 2. Run animation loops
  useAnimationLoop();
  useCrossSectionAnimation();

  // 3. Generate geometry based on store state
  const { geometry, dimension, objectType } = useGeometryGenerator();

  // 4. Apply scale, rotation, shear, and translation
  const transformedVertices = useObjectTransformations(geometry.vertices, dimension);

  // 5. Project to 3D for rendering
  const projectedVertices = useProjectedVertices(transformedVertices);

  // 6. Detect faces for surface rendering
  const faces = useFaceDetection(geometry, objectType);

  // 7. Calculate cross-sections if enabled
  const {
    vertices: crossSectionVertices,
    edges: crossSectionEdges,
    mainOpacity
  } = useCrossSectionCalculator(
    transformedVertices,
    geometry,
    faces,
    dimension,
    objectType
  );

  // Prepare edges for rendering
  const edges = useMemo(() => {
    return geometry.edges as [number, number][];
  }, [geometry.edges]);

  return (
    <Scene
      vertices={mainOpacity > 0 ? projectedVertices as Vector3D[] : undefined}
      edges={mainOpacity > 0 ? edges : undefined}
      faces={mainOpacity > 0 ? faces : undefined}
      opacity={mainOpacity}
      crossSectionVertices={crossSectionVertices}
      crossSectionEdges={crossSectionEdges}
      isPointCloud={geometry.isPointCloud}
    />
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
