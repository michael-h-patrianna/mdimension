/**
 * Procedural Skybox Component
 *
 * Renders procedural skybox shaders. Environment map generation (for black hole
 * lensing and wall PBR reflections) is now handled by CubemapCapturePass in the
 * render graph, ensuring proper MRT state management.
 *
 * This component only renders the visual SkyboxMesh - all cubemap capture logic
 * has been moved to src/rendering/graph/passes/CubemapCapturePass.ts
 *
 * WebGPU: Uses TSL-based material (SkyboxMaterialTSL) for native WebGPU rendering.
 * WebGL: Falls back to GLSL ShaderMaterial (SkyboxMesh).
 */

import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useRendererStore } from '@/stores/rendererStore';
import { SkyboxMaterialTSL } from '@/rendering/tsl/materials/skybox/SkyboxMaterialTSL';
import { SkyboxMesh } from './Skybox';

/**
 * Procedural skybox component that renders the visual skybox mesh.
 *
 * Cubemap capture for black hole lensing (scene.background) and wall reflections
 * (scene.environment) is handled by CubemapCapturePass in the render graph.
 *
 * @returns React element rendering procedural skybox mesh
 */
export const ProceduralSkyboxWithEnvironment: React.FC = () => {
  const gl = useThree((state) => state.gl);
  const storeBackend = useRendererStore((state) => state.backend);

  // Direct detection from renderer is more reliable than store during initial render
  // Three.js r181+ uses isWebGPUBackend property
  const isWebGPU = useMemo(() => {
    const rendererBackend = (gl as { backend?: { isWebGPUBackend?: boolean } }).backend;
    if (rendererBackend?.isWebGPUBackend !== undefined) {
      return rendererBackend.isWebGPUBackend;
    }
    return storeBackend === 'webgpu';
  }, [gl, storeBackend]);

  // Just render the visual skybox mesh
  // CubemapCapturePass in PostProcessingV2 handles:
  // - scene.background (raw CubeTexture for black hole samplerCube)
  // - scene.environment (PMREM for wall PBR reflections)

  // Debug: Log backend detection
  if (import.meta.env.DEV) {
    console.log('[ProceduralSkyboxWithEnvironment] isWebGPU:', isWebGPU, 'storeBackend:', storeBackend);
  }

  // WebGPU: Use TSL-based material with all 7 procedural modes
  if (isWebGPU) {
    return <SkyboxMaterialTSL />;
  }

  // WebGL: Fall back to GLSL ShaderMaterial
  return <SkyboxMesh texture={null} />;
};
