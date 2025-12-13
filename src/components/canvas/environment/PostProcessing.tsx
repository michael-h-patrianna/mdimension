/**
 * PostProcessing Component
 *
 * Manages post-processing effects for the Three.js scene using UnrealBloomPass.
 * Matches the official Three.js bloom example configuration.
 *
 * @see https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { useVisualStore } from '@/stores/visualStore';
import { TONE_MAPPING_TO_THREE } from '@/lib/shaders/types';

/**
 * PostProcessing component that applies UnrealBloomPass to the rendered scene.
 */
export const PostProcessing = memo(function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const originalToneMapping = useRef<THREE.ToneMapping>(gl.toneMapping);
  const originalExposure = useRef<number>(gl.toneMappingExposure);

  const {
    bloomEnabled,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    toneMappingEnabled,
    toneMappingAlgorithm,
    exposure,
  } = useVisualStore(
    useShallow((state) => ({
      bloomEnabled: state.bloomEnabled,
      bloomIntensity: state.bloomIntensity,
      bloomThreshold: state.bloomThreshold,
      bloomRadius: state.bloomRadius,
      toneMappingEnabled: state.toneMappingEnabled,
      toneMappingAlgorithm: state.toneMappingAlgorithm,
      exposure: state.exposure,
    }))
  );

  // Set up tone mapping for OutputPass
  // Using Canvas flat prop disables R3F's default tone mapping,
  // so we set it here for OutputPass to use
  useEffect(() => {
    originalToneMapping.current = gl.toneMapping;
    originalExposure.current = gl.toneMappingExposure;

    return () => {
      gl.toneMapping = originalToneMapping.current;
      gl.toneMappingExposure = originalExposure.current;
    };
  }, [gl]);

  // Update tone mapping when settings change
  useEffect(() => {
    if (toneMappingEnabled) {
      gl.toneMapping = TONE_MAPPING_TO_THREE[toneMappingAlgorithm] as THREE.ToneMapping;
      gl.toneMappingExposure = exposure;
    } else {
      gl.toneMapping = THREE.NoToneMapping;
      gl.toneMappingExposure = 1;
    }
  }, [gl, toneMappingEnabled, toneMappingAlgorithm, exposure]);

  // Create composer and passes - matching Three.js example exactly
  const composer = useMemo(() => {
    const effectComposer = new EffectComposer(gl);

    const renderPass = new RenderPass(scene, camera);
    effectComposer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomIntensity, // strength
      bloomRadius,    // radius
      bloomThreshold  // threshold
    );
    effectComposer.addPass(bloomPass);

    const outputPass = new OutputPass();
    effectComposer.addPass(outputPass);

    return { composer: effectComposer, bloomPass };
  }, [gl, scene, camera, size.width, size.height]);

  // Update bloom parameters when they change
  useEffect(() => {
    composer.bloomPass.strength = bloomIntensity;
    composer.bloomPass.threshold = bloomThreshold;
    composer.bloomPass.radius = bloomRadius;
  }, [composer, bloomIntensity, bloomThreshold, bloomRadius]);

  // Handle resize
  useEffect(() => {
    composer.composer.setSize(size.width, size.height);
    composer.bloomPass.resolution.set(size.width, size.height);
  }, [composer, size.width, size.height]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      composer.composer.dispose();
    };
  }, [composer]);

  // Render loop - always use composer for consistent tone mapping
  // When bloom is disabled, set strength to 0 so bloom has no effect
  // but the rendering pipeline (including tone mapping via OutputPass) stays consistent
  useFrame(() => {
    // Temporarily set bloom strength based on enabled state
    composer.bloomPass.strength = bloomEnabled ? bloomIntensity : 0;
    composer.composer.render();
  }, 1);

  return null;
});
