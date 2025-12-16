/**
 * Main Application Component
 * N-Dimensional Object Visualizer
 *
 * Supports both traditional polytopes and extended objects:
 * - Standard: Hypercube, Simplex, Cross-polytope
 * - Extended: Root System, Clifford Torus, Mandelbrot
 *
 * Unified Architecture:
 * All rendering uses useFrame-based high-performance pipelines that bypass React
 * re-renders during animation. UnifiedRenderer routes to the appropriate renderer:
 * - HyperbulbMesh: For raymarched 3D/4D surfaces (Mandelbrot/Hyperbulb)
 * - PolytopeScene: For 3D+ projected wireframes and faces
 */

import { useMemo } from 'react';
import { FpsController } from '@/components/canvas/FpsController';
import { Scene } from '@/rendering/Scene';
import { EditorLayout } from '@/components/layout/EditorLayout';
import { RefinementIndicator } from '@/components/canvas/RefinementIndicator';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useFaceDepths } from '@/hooks/useFaceDepths';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMandelbrotColors } from '@/hooks/useMandelbrotColors';
import { useSyncedDimension } from '@/hooks/useSyncedDimension';
import type { VectorND, Vector3D } from '@/lib/math/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useUIStore } from '@/stores/uiStore';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@/components/canvas/PerformanceMonitor';
import { PerformanceStatsCollector } from '@/components/canvas/PerformanceStatsCollector';
import { ToastProvider } from '@/contexts/ToastContext';
import { LazyMotion, domMax } from 'motion/react';

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
  const edgeColorForMandelbrot = useAppearanceStore((state) => state.edgeColor);
  const pointColors = useMandelbrotColors(geometry, mandelbrotConfig, edgeColorForMandelbrot);
  const facesVisible = useAppearanceStore((state) => state.facesVisible);

  // Calculate minimum bounding radius for ground plane positioning
  // When raymarched objects are visible, ensure ground plane accounts for them
  const isMandelbulbVisible = objectType === 'mandelbrot' && facesVisible && dimension === 3;
  const isHyperbulbVisible = objectType === 'mandelbrot' && facesVisible && dimension >= 4;
  // Mandelbulb/Hyperbulb need smaller (1.5)
  const minBoundingRadius = 1.5;

  return (
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
  );
}

/**
 * Main App Container
 */
function App() {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Get background color from visual store (PRD Story 6 AC7)
  const backgroundColor = useAppearanceStore((state) => state.backgroundColor);

  // Get selectLight action for click-to-deselect
  const selectLight = useLightingStore((state) => state.selectLight);

  // Get performance monitor state
  const showPerfMonitor = useUIStore((state) => state.showPerfMonitor);

  // Handle clicks on empty space to deselect lights
  const handlePointerMissed = () => {
    selectLight(null);
  };

  return (
    <LazyMotion features={domMax} strict>
      <ToastProvider>
        <EditorLayout>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Performance indicators */}
            <RefinementIndicator position="bottom-right" />

            <Canvas
              frameloop="never"
              camera={{
                position: [2, 2, 2.5],
                fov: 60,
              }}
              shadows="soft"
              flat
              gl={{ alpha: false, antialias: false }}
              style={{ background: backgroundColor }}
              onPointerMissed={handlePointerMissed}
            >
              <FpsController />
              <Visualizer />
              <PerformanceStatsCollector />
            </Canvas>
            {showPerfMonitor && <PerformanceMonitor />}
          </div>
        </EditorLayout>
      </ToastProvider>
    </LazyMotion>
  );
}

export default App;
