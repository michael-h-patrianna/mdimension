/**
 * Main Application Component
 * N-Dimensional Object Visualizer
 *
 * Supports both traditional polytopes and extended objects:
 * - Polytopes: Hypercube, Simplex, Cross-Polytope
 * - Extended: Root System, Clifford Torus, Mandelbrot, Mandelbox
 *
 * Unified Architecture:
 * All rendering uses useFrame-based high-performance pipelines that bypass React
 * re-renders during animation. UnifiedRenderer routes to the appropriate renderer:
 * - PolytopeScene: For polytopes with faces/edges/vertices (GPU shaders)
 * - PointCloudScene: For root systems, Clifford torus, Mandelbrot point clouds (GPU shaders)
 * - MandelbulbMesh/HyperbulbMesh/MandelboxMesh: For raymarched 3D/4D surfaces
 */

import { useMemo } from 'react';
import { Scene } from '@/components/canvas/Scene';
import { Layout } from '@/components/layout/Layout';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useFaceDepths } from '@/hooks/useFaceDepths';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMandelbrotColors } from '@/hooks/useMandelbrotColors';
import { useSyncedDimension } from '@/hooks/useSyncedDimension';
import type { VectorND, Vector3D } from '@/lib/math/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useVisualStore } from '@/stores/visualStore';
import { Canvas } from '@react-three/fiber';
import { Perf } from 'r3f-perf';

/**
 * Extract 3D positions from N-D vertices for ground plane bounds calculation.
 * This is much cheaper than full transform + projection pipeline.
 */
function extractBasePositions(vertices: VectorND[]): Vector3D[] {
  return vertices.map((v) => [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0] as Vector3D);
}

/**
 * Main visualization component that handles the render pipeline.
 *
 * Unified architecture: All renderers use useFrame for GPU-based transformations,
 * reading from stores via getState() to bypass React's render cycle.
 */
function Visualizer() {
  // 1. Synchronize dimensions across stores
  useSyncedDimension();

  // 2. Run animation loops
  useAnimationLoop();

  // 3. Generate geometry based on store state
  const { geometry, dimension, objectType } = useGeometryGenerator();

  // 4. Detect faces for surface rendering (polytopes only)
  const faces = useFaceDetection(geometry, objectType);

  // 5. Extract base 3D positions for ground plane bounds (no transform needed)
  // Ground plane only recalculates on vertex count change, not during animation
  const basePositions = useMemo(
    () => extractBasePositions(geometry.vertices),
    [geometry.vertices.length]
  );

  // 6. Compute per-face depth values for palette color variation (polytopes only)
  const faceDepths = useFaceDepths(geometry.vertices, faces, dimension);

  // 7. Compute Mandelbrot colors (derived from user's edge color)
  const mandelbrotConfig = useExtendedObjectStore((state) => state.mandelbrot);
  const edgeColorForMandelbrot = useVisualStore((state) => state.edgeColor);
  const pointColors = useMandelbrotColors(geometry, mandelbrotConfig, edgeColorForMandelbrot);
  const facesVisible = useVisualStore((state) => state.facesVisible);

  // 8. Get performance monitor state
  const showPerfMonitor = useVisualStore((state) => state.showPerfMonitor);

  // Calculate minimum bounding radius for ground plane positioning
  // When raymarched objects are visible, ensure ground plane accounts for them
  const isMandelbulbVisible = objectType === 'mandelbrot' && facesVisible && dimension === 3;
  const isHyperbulbVisible = objectType === 'mandelbrot' && facesVisible && dimension >= 4;
  // Mandelbox has a larger bounding radius (BOUND_R = 4.0 in shader)
  const isMandelboxVisible = objectType === 'mandelbox' && facesVisible && dimension >= 3;
  // Menger sponge is bounded within unit cube (BOUND_R = 2.0 in shader)
  const isMengerVisible = objectType === 'menger' && facesVisible && dimension >= 3;

  // Mandelbox needs larger radius (4.0), Menger/Mandelbulb/Hyperbulb need smaller (2.0/1.5)
  const minBoundingRadius = isMandelboxVisible
    ? 4.0
    : isMengerVisible
      ? 2.0
      : (isMandelbulbVisible || isHyperbulbVisible)
        ? 1.5
        : undefined;

  return (
    <>
      {/* Performance monitor - only mounted when enabled (zero overhead when off) */}
      {showPerfMonitor && (
        <Perf
          position="bottom-left"
          className="perf-monitor"
          showGraph={true}
          antialias={true}
          logsPerSecond={10}
        />
      )}
      <Scene
        geometry={geometry}
        dimension={dimension}
        objectType={objectType}
        faces={faces}
        faceDepths={faceDepths}
        pointColors={pointColors}
        projectedVertices={basePositions}
        minBoundingRadius={minBoundingRadius}
      />
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

  // Get selectLight action for click-to-deselect
  const selectLight = useVisualStore((state) => state.selectLight);

  // Handle clicks on empty space to deselect lights
  const handlePointerMissed = () => {
    selectLight(null);
  };

  return (
    <Layout appTitle="N-Dimensional Visualizer" showHeader>
      <Canvas
        camera={{
          position: [2, 2, 2.5],
          fov: 60,
        }}
        flat
        gl={{ alpha: false }}
        style={{ background: backgroundColor }}
        onPointerMissed={handlePointerMissed}
      >
        <Visualizer />
      </Canvas>
    </Layout>
  );
}

export default App;
