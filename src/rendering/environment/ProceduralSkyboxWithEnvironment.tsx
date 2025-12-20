/**
 * Procedural Skybox with Environment Map Generation
 *
 * Renders procedural skybox shaders and generates environment maps for PBR
 * reflections when walls are enabled. Uses drei's Environment component to
 * automatically handle cubemap rendering and PMREM conversion.
 *
 * Features:
 * - Conditional environment map generation (only when walls active)
 * - Continuous updates when animation is playing for dynamic reflections
 * - Settings-based re-render triggering via key prop when paused
 * - Optimized resolution (256px) for performance
 * - Captures procedural skybox to CubeRenderTarget for black hole shader
 */

import { RENDER_LAYERS } from '@/rendering/core/layers';
import { useAnimationStore } from '@/stores/animationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkyboxMesh } from './Skybox';

/** Resolution for environment cubemap (per face) */
const ENV_MAP_RESOLUTION = 256;

/** Resolution for black hole background cubemap (higher for quality lensing) */
const BACKGROUND_CUBEMAP_RESOLUTION = 512;

/**
 * Component that captures the procedural skybox to a CubeRenderTarget
 * and sets scene.background for the black hole shader to use.
 *
 * The black hole shader requires an actual CubeTexture for samplerCube uniforms.
 * drei's Environment only produces PMREM (2D) textures, so we need this separate
 * capture pass to provide a proper cubemap.
 */
const ProceduralSkyboxCapture: React.FC = () => {
  const { gl, scene } = useThree();
  const isPlaying = useAnimationStore((state) => state.isPlaying);

  // Create CubeCamera and RenderTarget
  const cubeRenderTarget = useRef<THREE.WebGLCubeRenderTarget | null>(null);
  const cubeCamera = useRef<THREE.CubeCamera | null>(null);
  const skyboxGroupRef = useRef<THREE.Group | null>(null);

  // Track if we need to update (when playing or settings changed)
  const needsUpdateRef = useRef(true);
  const frameCountRef = useRef(0);

  // Initialize render target and camera
  useEffect(() => {
    cubeRenderTarget.current = new THREE.WebGLCubeRenderTarget(BACKGROUND_CUBEMAP_RESOLUTION, {
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

    // Create a group to hold the skybox for isolated rendering
    skyboxGroupRef.current = new THREE.Group();

    return () => {
      // Clear scene.background on unmount (before disposing)
      const rt = cubeRenderTarget.current;
      if (rt && scene.background === rt.texture) {
        scene.background = null;
      }
      rt?.dispose();
      cubeRenderTarget.current = null;
      cubeCamera.current = null;
    };
  }, [scene]);

  // Trigger update when settings change (via key remount) or on initial mount
  useEffect(() => {
    needsUpdateRef.current = true;
    frameCountRef.current = 0;
  }, []);

  useFrame(() => {
    if (!cubeCamera.current || !cubeRenderTarget.current) return;

    // Update when playing or when we need initial capture (first 2 frames)
    const shouldUpdate = isPlaying || (needsUpdateRef.current && frameCountRef.current < 2);

    if (shouldUpdate) {
      // Position camera at origin (center of skybox sphere)
      cubeCamera.current.position.set(0, 0, 0);

      // CRITICAL: Clear scene.background before capture to avoid feedback loop
      // (we're reading from scene while writing to the same texture)
      scene.background = null;

      // Update the cube camera (renders all 6 faces)
      // This captures the skybox mesh to the cubemap
      cubeCamera.current.update(gl, scene);

      // Set the captured cubemap as background for black hole shader
      scene.background = cubeRenderTarget.current.texture;

      frameCountRef.current++;
      if (frameCountRef.current >= 2) {
        needsUpdateRef.current = false;
      }
    }
  });

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
 * Animation behavior:
 * - When animation is playing: continuous environment map updates for dynamic reflections
 * - When animation is paused: captures once after shader initialization, re-captures on settings change
 * @returns React element rendering procedural skybox with optional environment mapping
 */
export const ProceduralSkyboxWithEnvironment: React.FC = () => {
  const skyboxMode = useEnvironmentStore((state) => state.skyboxMode);
  const proceduralSettings = useEnvironmentStore((state) => state.proceduralSettings);
  const activeWalls = useEnvironmentStore((state) => state.activeWalls);
  const cosineCoefficients = useAppearanceStore((state) => state.cosineCoefficients);
  const isPlaying = useAnimationStore((state) => state.isPlaying);

  // Check if walls need environment reflections
  const needsEnvironmentMap = activeWalls.length > 0;

  // Determine frame capture mode:
  // - Infinity: continuous updates for animated skybox reflections
  // - STATIC_CAPTURE_FRAMES: limited captures when paused (ensures shader init + settings changes)
  const framesToCapture = isPlaying ? Infinity : STATIC_CAPTURE_FRAMES;

  // Generate key for Environment component to trigger re-render on settings change
  // Only include settings that affect the visual appearance of the skybox
  // When playing, include isPlaying to reset frame counter on play/pause transitions
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
      // Include isPlaying to reset Environment when animation state changes
      isPlaying,
    };
    return JSON.stringify(relevantSettings);
  }, [skyboxMode, proceduralSettings, cosineCoefficients, isPlaying]);

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
