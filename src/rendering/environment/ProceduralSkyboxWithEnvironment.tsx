/**
 * Procedural Skybox with Environment Map Generation
 *
 * Renders procedural skybox shaders and generates environment maps for PBR
 * reflections when walls are enabled. Uses drei's Environment component to
 * automatically handle cubemap rendering and PMREM conversion.
 *
 * Features:
 * - Conditional environment map generation (only when walls active)
 * - Captures on settings changes only (static cubemap)
 * - Settings-based re-render triggering via key prop
 * - Optimized resolution (256px) for performance
 * - Captures procedural skybox to CubeRenderTarget for black hole shader
 */

import { FRAME_PRIORITY } from '@/rendering/core/framePriorities';
import { RENDER_LAYERS } from '@/rendering/core/layers';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkyboxMesh } from './Skybox';

/** Resolution for environment cubemap (per face) */
const ENV_MAP_RESOLUTION = 256;

/**
 * Component that captures the procedural skybox to a CubeRenderTarget
 * and sets scene.background for the black hole shader to use.
 *
 * The black hole shader requires an actual CubeTexture for samplerCube uniforms.
 * drei's Environment only produces PMREM (2D) textures, so we need this separate
 * capture pass to provide a proper cubemap.
 *
 * @returns React component that manages skybox capture
 */
const ProceduralSkyboxCapture: React.FC = () => {
  const { gl, scene } = useThree();
  const skyCubemapResolution = useExtendedObjectStore((state) => state.blackhole.skyCubemapResolution);

  // Create CubeCamera and RenderTarget
  const cubeRenderTarget = useRef<THREE.WebGLCubeRenderTarget | null>(null);
  const cubeCamera = useRef<THREE.CubeCamera | null>(null);

  // Track if we need to update (settings change or initial mount)
  const needsUpdateRef = useRef(true);
  const frameCountRef = useRef(0);

  // Initialize render target and camera
  // CRITICAL: Use useLayoutEffect to prevent scene.background gap during StrictMode double-mount.
  // Without this, cleanup sets scene.background=null, and black hole sees stale value before re-mount.
  useLayoutEffect(() => {
    cubeRenderTarget.current = new THREE.WebGLCubeRenderTarget(skyCubemapResolution, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });

    // Set mapping so black hole shader can detect this as cube-compatible
    cubeRenderTarget.current.texture.mapping = THREE.CubeReflectionMapping;

    cubeCamera.current = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget.current);

    // CRITICAL: Only capture SKYBOX layer, exclude MAIN_OBJECT (black hole)
    // This prevents the black hole from being baked into the background cubemap
    cubeCamera.current.layers.disableAll();
    cubeCamera.current.layers.enable(RENDER_LAYERS.SKYBOX);

    // CRITICAL: Perform immediate initial capture in useLayoutEffect.
    // This ensures scene.background is SET before any useFrame callback runs,
    // preventing the black hole from seeing null on its first frame.
    // Without this, there's a ~7 frame gap where scene.background is null.
    cubeCamera.current.position.set(0, 0, 0);
    cubeCamera.current.update(gl, scene);
    scene.background = cubeRenderTarget.current.texture;

    return () => {
      // Clear scene.background on unmount (before disposing)
      // Relaxed check: if we created a render target, we should clear the background
      // when unmounting to prevent stale textures or bright corners.
      const rt = cubeRenderTarget.current;
      if (rt) {
        scene.background = null;
      }
      rt?.dispose();
      cubeRenderTarget.current = null;
      cubeCamera.current = null;
    };
  }, [gl, scene, skyCubemapResolution]);

  // Trigger update when settings change (via key remount) or on initial mount
  useEffect(() => {
    needsUpdateRef.current = true;
    frameCountRef.current = 0;
  }, [skyCubemapResolution]);

  // CRITICAL: Priority SKYBOX_CAPTURE (-20) ensures this runs BEFORE black hole's useFrame.
  // Without this, on initial page load the black hole checks scene.background before
  // this capture runs, sees null, and sets uEnvMapReady=0, causing lensing to fail
  // for rays that hit the early-out path (using unbent direction instead of bent).
  useFrame(() => {
    if (!cubeCamera.current || !cubeRenderTarget.current) {
      return;
    }

    // DEBUG: Check for GL errors before and after cube camera update
    const glCtx = gl.getContext();
    const errorBefore = glCtx.getError();
    if (errorBefore !== glCtx.NO_ERROR) {
      console.warn('[ProceduralSkyboxCapture] GL error BEFORE useFrame:', errorBefore);
    }

    // Determine if we should capture this frame:
    // 1. Initial capture needed (first 2 frames after mount/settings change)
    const needsInitialCapture = needsUpdateRef.current && frameCountRef.current < 2;
    const shouldUpdate = needsInitialCapture;

    if (shouldUpdate) {
      if (import.meta.env.DEV) {
        console.log('[ProceduralSkyboxCapture] Starting cube camera update');
      }

      // Position camera at origin (center of skybox sphere)
      cubeCamera.current.position.set(0, 0, 0);

      // CRITICAL: Clear scene.background before capture to avoid feedback loop
      // (we're reading from scene while writing to the same texture)
      scene.background = null;

      // Update the cube camera (renders all 6 faces)
      // This captures the skybox mesh to the cubemap
      cubeCamera.current.update(gl, scene);

      // DEBUG: Check for GL errors after cube camera update
      const errorAfterCube = glCtx.getError();
      if (errorAfterCube !== glCtx.NO_ERROR) {
        console.error('[ProceduralSkyboxCapture] GL error AFTER cubeCamera.update:', errorAfterCube);
      }

      // Set the captured cubemap as background for black hole shader
      scene.background = cubeRenderTarget.current.texture;

      frameCountRef.current++;
      if (frameCountRef.current >= 2) {
        needsUpdateRef.current = false;
      }
    }
  }, FRAME_PRIORITY.SKYBOX_CAPTURE);

  return null;
};

/**
 * Number of frames to capture when animation is paused.
 * Using 2 frames ensures the skybox shader has time to initialize
 * its uniforms in useFrame before the environment map is captured.
 */
const STATIC_CAPTURE_FRAMES = 2;

/**
 * Procedural skybox component that conditionally generates environment maps
 * for wall reflections.
 *
 * When walls are enabled, wraps the skybox in drei's Environment component
 * which captures it to a cubemap and converts to PMREM format for proper
 * PBR reflections on meshStandardMaterial surfaces.
 *
 * When walls are disabled, renders only the visual skybox mesh with no
 * environment map overhead.
 *
 * Capture behavior:
 * - Captures once after shader initialization
 * - Re-captures on settings change (no per-frame updates)
 * @returns React element rendering procedural skybox with optional environment mapping
 */
export const ProceduralSkyboxWithEnvironment: React.FC = () => {
  const skyboxMode = useEnvironmentStore((state) => state.skyboxMode);
  const proceduralSettings = useEnvironmentStore((state) => state.proceduralSettings);
  const activeWalls = useEnvironmentStore((state) => state.activeWalls);
  const cosineCoefficients = useAppearanceStore((state) => state.cosineCoefficients);

  // Check if walls need environment reflections
  const needsEnvironmentMap = activeWalls.length > 0;

  // Determine frame capture mode (static captures only)
  const framesToCapture = STATIC_CAPTURE_FRAMES;

  // Generate key for Environment component to trigger re-render on settings change
  // Only include settings that affect the visual appearance of the skybox
  const settingsKey = useMemo(() => {
    const relevantSettings = {
      mode: skyboxMode,
      scale: proceduralSettings.scale,
      complexity: proceduralSettings.complexity,
      evolution: proceduralSettings.evolution,
      hue: proceduralSettings.hue,
      saturation: proceduralSettings.saturation,
      turbulence: proceduralSettings.turbulence,
      sunIntensity: proceduralSettings.sunIntensity,
      sunPosition: proceduralSettings.sunPosition,
      syncWithObject: proceduralSettings.syncWithObject,
      // Include object palette if syncing colors
      ...(proceduralSettings.syncWithObject ? { palette: cosineCoefficients } : {}),
      // No per-frame updates: static capture only
    };
    return JSON.stringify(relevantSettings);
  }, [skyboxMode, proceduralSettings, cosineCoefficients]);

  // If no walls, just render the visual skybox mesh (no environment map overhead)
  // Still include capture component for black hole shader
  if (!needsEnvironmentMap) {
    return (
      <>
        <ProceduralSkyboxCapture key={`capture-${settingsKey}`} />
        <SkyboxMesh texture={null} />
      </>
    );
  }

  // With walls enabled: render Environment for cubemap capture + visual skybox mesh
  return (
    <>
      {/* Capture procedural skybox to CubeRenderTarget for black hole shader */}
      <ProceduralSkyboxCapture key={`capture-${settingsKey}`} />

      {/* Environment captures skybox to cubemap -> PMREM -> scene.environment */}
      <Environment
        key={settingsKey}
        frames={framesToCapture}
        resolution={ENV_MAP_RESOLUTION}
        near={0.1}
        far={1000}
        background={false}
      >
        {/* Render skybox inside Environment for cubemap capture */}
        <SkyboxMesh texture={null} />
      </Environment>

      {/* Visual skybox mesh (rendered to screen) */}
      <SkyboxMesh texture={null} />
    </>
  );
};
