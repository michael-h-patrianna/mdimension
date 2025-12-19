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
 */

import { useAnimationStore } from '@/stores/animationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { Environment } from '@react-three/drei';
import React, { useMemo } from 'react';
import { SkyboxMesh } from './Skybox';

/** Resolution for environment cubemap (per face) */
const ENV_MAP_RESOLUTION = 256;

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
  if (!needsEnvironmentMap) {
    return <SkyboxMesh texture={null} />;
  }

  // With walls enabled: render Environment for cubemap capture + visual skybox mesh
  return (
    <>
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
