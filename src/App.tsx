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

import { PerformanceMonitor } from '@/components/canvas/PerformanceMonitor';
import { RefinementIndicator } from '@/components/canvas/RefinementIndicator';
import { EditorLayout } from '@/components/layout/EditorLayout';
import { ContextLostOverlay } from '@/components/overlays/ContextLostOverlay';
import { MsgBox } from '@/components/overlays/MsgBox';
import { ScreenshotModal } from '@/components/overlays/ScreenshotModal';
import { ShaderCompilationOverlay } from '@/components/overlays/ShaderCompilationOverlay';
import { WebGL2UnsupportedOverlay } from '@/components/overlays/WebGL2UnsupportedOverlay';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { GeometryLoadingIndicator } from '@/components/ui/GeometryLoadingIndicator';
import { ToastProvider } from '@/contexts/ToastContext';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';
import { useFaceDepths } from '@/hooks/useFaceDepths';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSyncedDimension } from '@/hooks/useSyncedDimension';
import { useToast } from '@/hooks/useToast';
import { useUrlState } from '@/hooks/useUrlState';
import { useCachePrewarming } from '@/hooks/useCachePrewarming';
import type { Vector3D, VectorND } from '@/lib/math/types';
import { ProdDevDiagnostics } from '@/dev-tools/ProdDevDiagnostics';
import { FpsController } from '@/rendering/controllers/FpsController';
import { PerformanceStatsCollector } from '@/rendering/controllers/PerformanceStatsCollector';
import { VideoExportController } from '@/rendering/controllers/VideoExportController';
import { ContextEventHandler } from '@/rendering/core/ContextEventHandler';
import { UniformLifecycleController } from '@/rendering/core/UniformLifecycleController';
import { VisibilityHandler } from '@/rendering/core/VisibilityHandler';
import { initializeGlobalMRT } from '@/rendering/graph/MRTStateManager';
import { isWebGPUBackend } from '@/rendering/core/rendererUtils';
import { Scene } from '@/rendering/Scene';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useUIStore } from '@/stores/uiStore';
import { RECOVERY_STATE_KEY, RECOVERY_STATE_MAX_AGE } from '@/stores/webglContextStore';
import { Html } from '@react-three/drei';
import { Canvas, type RootState } from '@react-three/fiber';
import { domMax, LazyMotion } from 'motion/react';
import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
// REMOVED: WebGPU.isAvailable() creates a test context that can fail and break subsequent contexts
// import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { useRendererStore } from '@/stores/rendererStore';
import { WebGPUBadgeStore } from '@/components/ui/WebGPUBadge';

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

  // 3. Generate geometry based on store state (async for Wythoff polytopes)
  const {
    geometry,
    dimension,
    objectType,
    isLoading: geometryLoading,
    progress,
    stage,
  } = useGeometryGenerator();

  // 4. Detect faces for surface rendering (polytopes only, async for convex-hull)
  const { faces, isLoading: faceLoading } = useFaceDetection(geometry, objectType);

  // Combined loading state for any async operation
  const isLoading = geometryLoading || faceLoading;

  // 5. Extract base 3D positions for ground plane bounds (no transform needed)
  // Ground plane only recalculates on vertex count change, not during animation
  const basePositions = useMemo(
    () => (geometry ? extractBasePositions(geometry.vertices) : []),
    [geometry]
  );

  // 6. Compute per-face depth values for palette color variation (polytopes only)
  const faceDepths = useFaceDepths(geometry?.vertices ?? [], faces, dimension);

  // Minimum bounding radius for ground plane positioning
  // Currently all objects use the same radius for consistent ground placement
  const minBoundingRadius = 1.5;

  return (
    <>
      {/* Loading indicator for async geometry or face detection */}
      {isLoading && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <GeometryLoadingIndicator
            isLoading={true}
            progress={geometryLoading ? progress : 100}
            stage={geometryLoading ? stage : 'faces'}
          />
        </Html>
      )}
      {/* Always render Scene to ensure proper WebGL cleanup during transitions.
          When geometry is null, Scene renders environment only (no object). */}
      <Scene
        geometry={geometry}
        dimension={dimension}
        objectType={objectType}
        faces={faces}
        faceDepths={faceDepths}
        projectedVertices={basePositions}
        minBoundingRadius={minBoundingRadius}
      />
    </>
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
  // Initialize state from URL parameters (must be first)
  useUrlState();

  // Pre-warm geometry cache from IndexedDB (non-blocking)
  useCachePrewarming();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Dynamic Favicon
  useDynamicFavicon();

  // Restore state after WebGL context recovery failure
  useStateRecovery();

  // Detect device capabilities (WebGL2 + GPU tier) and apply mobile defaults
  const { webgl2Supported } = useDeviceCapabilities();

  // Get background color from visual store (PRD Story 6 AC7)
  const backgroundColor = useAppearanceStore((state) => state.backgroundColor);

  // Get selectLight action for click-to-deselect
  const selectLight = useLightingStore((state) => state.selectLight);

  // Get performance monitor state
  const showPerfMonitor = useUIStore((state) => state.showPerfMonitor);

  // Get renderer store actions
  const initializeRenderer = useRendererStore((state) => state.initialize);

  // Handle clicks on empty space to deselect lights
  const handlePointerMissed = () => {
    selectLight(null);
  };

  // Check if WebGL fallback should be forced via URL parameter
  const shouldForceWebGL = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('forceWebGL') === 'true' || params.get('backend') === 'webgl';
  }, []);

  // Check if WebGPU should be attempted
  // IMPORTANT: Do NOT call WebGPU.isAvailable() here - it creates a test context
  // which can fail and poison subsequent context creation attempts.
  // Instead, just check for the API and let createRenderer handle actual initialization.
  const shouldTryWebGPU = useMemo(() => {
    if (shouldForceWebGL) {
      console.log('[App] WebGL forced via URL parameter');
      return false;
    }

    // Only check for API availability (no context creation)
    const hasWebGPUAPI = typeof navigator !== 'undefined' && 'gpu' in navigator;
    console.log('[App] WebGPU API available:', hasWebGPUAPI);
    return hasWebGPUAPI;
  }, [shouldForceWebGL]);

  // ==========================================================================
  // CRITICAL: Initialize MRT state management on Canvas creation
  // ==========================================================================
  // This runs BEFORE any child component mounts, ensuring the renderer's
  // setRenderTarget is patched before any rendering occurs.
  // Without this, CubeCamera.update() in ProceduralSkyboxCapture would render
  // to MRT targets before drawBuffers is properly configured, causing
  // GL_INVALID_OPERATION: Active draw buffers with missing fragment shader outputs
  const handleCanvasCreated = useCallback((state: RootState) => {
    initializeGlobalMRT(state.gl);

    // Detect and store renderer backend info
    const renderer = state.gl as unknown as {
      backend?: {
        isWebGPU?: boolean;
        parameters?: { adapterInfo?: GPUAdapterInfo };
      };
      capabilities?: { maxTextureSize?: number };
    };

    const isWebGPU = isWebGPUBackend(state.gl);
    const gpuName = renderer.backend?.parameters?.adapterInfo?.description;
    const maxTextureSize = renderer.capabilities?.maxTextureSize ?? 4096;

    initializeRenderer({
      backend: isWebGPU ? 'webgpu' : 'webgl',
      gpuName,
      maxTextureSize,
      isWebGLForced: shouldForceWebGL,
    });

    if (import.meta.env.DEV) {
      console.log(
        `[App] Canvas created with ${isWebGPU ? 'WebGPU' : 'WebGL'} backend`,
        gpuName ? `(${gpuName})` : ''
      );
    }
  }, [initializeRenderer, shouldForceWebGL]);

  // ==========================================================================
  // WebGPU Renderer Factory (async)
  // ==========================================================================
  // Creates a WebGPURenderer with automatic WebGL fallback.
  // The async gl prop pattern is required for WebGPU because:
  // 1. WebGPU adapter/device acquisition is async
  // 2. WebGPURenderer.init() must complete before any rendering
  //
  // R3F v9 supports async gl callbacks that receive DefaultGLProps
  const createRenderer = useCallback(
    async (props: Record<string, unknown>) => {
      const canvas = props.canvas as HTMLCanvasElement;

      // If WebGPU is not available or forced off, create WebGLRenderer
      if (!shouldTryWebGPU) {
        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: true,
        });
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        return renderer;
      }

      try {
        // Create WebGPU renderer with fallback capability
        // CRITICAL: Request higher limits for MRT with 3x RGBA32Float (48 bytes)
        // Default maxColorAttachmentBytesPerSample is 32, we need 48+ for full MRT
        const renderer = new WebGPURenderer({
          canvas,
          antialias: false, // Match existing config
          alpha: false,
          powerPreference: 'high-performance',
          requiredLimits: {
            // MRT uses 3x RGBA32Float: output, normal, position = 3 * 16 = 48 bytes
            maxColorAttachmentBytesPerSample: 128,
          },
        });

        // Initialize the renderer (async operation)
        await renderer.init();

        // Configure tone mapping
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        if (import.meta.env.DEV) {
          const backend = isWebGPUBackend(renderer) ? 'WebGPU' : 'WebGL (fallback)';
          console.log(`[App] Renderer initialized with ${backend}`);
        }

        return renderer;
      } catch (error) {
        // Fallback to WebGL on any error
        console.warn('[App] WebGPU initialization failed, falling back to WebGL:', error);

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: true,
        });
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        return renderer;
      }
    },
    [shouldTryWebGPU]
  );

  return (
    <EditorLayout>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Performance indicators */}
        <RefinementIndicator position="bottom-right" />

        {webgl2Supported ? (
          <ErrorBoundary fallback={<div className="flex h-full w-full items-center justify-center text-red-400 bg-black/90">Renderer Crashed. Reload page.</div>}>
            <Canvas
              id="main-webgl-canvas"
              // CRITICAL: WebGPU requires frameloop="always" for proper frame presentation
              // The "never" mode with advance() doesn't present WebGPU frames correctly
              // TODO: Implement FPS limiting for WebGPU in a different way
              frameloop={shouldTryWebGPU ? 'always' : 'never'}
              camera={{
                position: [0, 3.125, 7.5], // Closer angled view for prominent Interstellar look (25% further out)
                fov: 60,
              }}
              raycaster={{
                // Enable DEBUG layer for raycasting so gizmos on layer 4 are interactive.
                // The raycaster's layers determine which objects receive pointer events.
                // By default only layer 0 is enabled; we add layer 4 (DEBUG) for gizmo interaction.
                layers: (() => {
                  const layers = new THREE.Layers();
                  layers.enableAll(); // Enable all layers for comprehensive event handling
                  return layers;
                })(),
              }}
              shadows="soft"
              flat
              // R3F v9 supports async gl callbacks for WebGPU initialization
              // Type assertion needed as R3F types may not fully reflect async support
              gl={createRenderer as unknown as THREE.WebGLRendererParameters}
              style={{ background: backgroundColor }}
              onPointerMissed={handlePointerMissed}
              onCreated={handleCanvasCreated}
            >
              {/* WebGL Context Management */}
              <ContextEventHandler />
              <VisibilityHandler />
              <UniformLifecycleController />

              <FpsController />
              <VideoExportController />
              <Visualizer />
              <PerformanceStatsCollector />
              <ProdDevDiagnostics />
            </Canvas>
          </ErrorBoundary>
        ) : (
          <WebGL2UnsupportedOverlay />
        )}

        {/* Context Lost Overlay - shown when WebGL context is lost */}
        <ContextLostOverlay />

        {/* Global Message Box Overlay */}
        <MsgBox />

        {/* Shader Compilation Overlay - shown during shader compilation */}
        <ShaderCompilationOverlay />

        {showPerfMonitor && <PerformanceMonitor />}

        {/* WebGPU Backend Indicator (outside Canvas, uses store) */}
        <WebGPUBadgeStore position="bottom-right" />

        {/* Screenshot Preview Modal */}
        <ScreenshotModal />
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
