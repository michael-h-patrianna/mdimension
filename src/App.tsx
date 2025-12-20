/**
 * Main Application Component
 * N-Dimensional Object Visualizer
 *
 * Supports both traditional polytopes and extended objects:
 * - Standard: Hypercube, Simplex, Cross-polytope
 * - Extended: Root System, Clifford Torus, Mandelbulb
 *
 * Unified Architecture:
 * All rendering uses useFrame-based high-performance pipelines that bypass React
 * re-renders during animation. UnifiedRenderer routes to the appropriate renderer:
 * - MandelbulbMesh: For raymarched 3D/4D surfaces (Mandelbulb/Mandelbulb)
 * - PolytopeScene: For 3D+ projected wireframes and faces
 */

import { FpsController } from '@/components/canvas/FpsController';
import { PerformanceMonitor } from '@/components/canvas/PerformanceMonitor';
import { PerformanceStatsCollector } from '@/components/canvas/PerformanceStatsCollector';
import { RefinementIndicator } from '@/components/canvas/RefinementIndicator';
import { VideoExportController } from '@/components/canvas/VideoExportController';
import { EditorLayout } from '@/components/layout/EditorLayout';
import { ContextLostOverlay } from '@/components/ui/ContextLostOverlay';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ShaderCompilationOverlay } from '@/components/ui/ShaderCompilationOverlay';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';
import { useFaceDepths } from '@/hooks/useFaceDepths';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSyncedDimension } from '@/hooks/useSyncedDimension';
import type { Vector3D, VectorND } from '@/lib/math/types';
import { ContextEventHandler } from '@/rendering/core/ContextEventHandler';
import { VisibilityHandler } from '@/rendering/core/VisibilityHandler';
import { Scene } from '@/rendering/Scene';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useUIStore } from '@/stores/uiStore';
import { RECOVERY_STATE_KEY, RECOVERY_STATE_MAX_AGE } from '@/stores/webglContextStore';
import { Canvas } from '@react-three/fiber';
import { LazyMotion, domMax } from 'motion/react';
import { useEffect, useMemo } from 'react';

/**
 * Extract 3D positions from N-D vertices for ground plane bounds calculation.
 * This is much cheaper than full transform + projection pipeline.
 * @param vertices - N-dimensional vertices to extract positions from
 * @returns Array of 3D positions extracted from the first 3 coordinates
 */
function extractBasePositions(vertices: VectorND[]): Vector3D[] {
  return vertices.map((v) => [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0] as Vector3D);
}

/**
 * Main visualization component that handles the render pipeline.
 *
 * Unified architecture: All renderers use useFrame for GPU-based transformations,
 * reading from stores via getState() to bypass React's render cycle.
 * @returns The visualization scene with all renderers and effects
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

  // Minimum bounding radius for ground plane positioning
  // Currently all objects use the same radius for consistent ground placement
  const minBoundingRadius = 1.5;

  return (
    <Scene
      geometry={geometry}
      dimension={dimension}
      objectType={objectType}
      faces={faces}
      faceDepths={faceDepths}
      projectedVertices={basePositions}
      minBoundingRadius={minBoundingRadius}
    />
  );
}

/**
 * Hook to restore state after a failed WebGL context recovery.
 * Checks localStorage for saved state and restores it if found.
 * @returns void
 */
function useStateRecovery() {
  const { addToast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECOVERY_STATE_KEY);
      if (saved) {
        const state = JSON.parse(saved) as {
          dimension?: number;
          savedAt?: number;
        };

        // Only restore if saved within the max age window
        if (state.savedAt && Date.now() - state.savedAt < RECOVERY_STATE_MAX_AGE) {
          // Restore state to stores
          if (state.dimension) {
            useGeometryStore.getState().setDimension(state.dimension);
          }

          addToast('Session restored from recovery', 'success');
        }

        // Clean up regardless of whether we restored
        localStorage.removeItem(RECOVERY_STATE_KEY);
      }
    } catch (error) {
      // Recovery is best-effort, but log for debugging
      if (import.meta.env.DEV) {
        console.error('[App] State recovery failed:', error);
      }
      localStorage.removeItem(RECOVERY_STATE_KEY);
    }
  }, [addToast]);
}

/**
 * Inner app content that requires ToastProvider context.
 * @returns The main application layout with all UI components
 */
function AppContent() {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Dynamic Favicon
  useDynamicFavicon();

  // Restore state after WebGL context recovery failure
  useStateRecovery();

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
    <EditorLayout>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Performance indicators */}
        <RefinementIndicator position="bottom-right" />

        <ErrorBoundary fallback={<div className="flex h-full w-full items-center justify-center text-red-400 bg-black/90">Renderer Crashed. Reload page.</div>}>
          <Canvas
            frameloop="never"
            camera={{
              position: [2, 2, 2.5],
              fov: 60,
            }}
            shadows="soft"
            flat
            gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
            style={{ background: backgroundColor }}
            onPointerMissed={handlePointerMissed}
          >
            {/* WebGL Context Management */}
            <ContextEventHandler />
            <VisibilityHandler />

            <FpsController />
            <VideoExportController />
            <Visualizer />
            <PerformanceStatsCollector />
          </Canvas>
        </ErrorBoundary>

        {/* Context Lost Overlay - shown when WebGL context is lost */}
        <ContextLostOverlay />

        {/* Shader Compilation Overlay - shown during shader compilation */}
        <ShaderCompilationOverlay />

        {showPerfMonitor && <PerformanceMonitor />}
      </div>
    </EditorLayout>
  );
}

/**
 * Main App Container
 * @returns The root application component wrapped in providers
 */
function App() {
  return (
    <LazyMotion features={domMax} strict>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </LazyMotion>
  );
}

export default App;
