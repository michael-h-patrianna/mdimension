/**
 * useBlackHoleUniforms Hook
 *
 * Creates and manages the uniform object for the black hole shader.
 * These uniforms are passed to the shader material and updated each frame.
 */

import { createLightUniforms } from '@/rendering/lights/uniforms'
import { useMemo } from 'react'
import * as THREE from 'three'
import { MAX_DIMENSION } from './types'

/**
 * Type for black hole shader uniforms
 */
export type BlackHoleUniforms = ReturnType<typeof useBlackHoleUniforms>

/**
 * Create black hole shader uniforms
 *
 * This hook creates a stable uniform object that persists across renders.
 * The uniforms are updated each frame in useBlackHoleUniformUpdates.
 *
 * @returns Uniform object for ShaderMaterial
 */
export function useBlackHoleUniforms() {
  return useMemo(
    () => ({
      // Time and resolution
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      // Dimension
      uDimension: { value: 4 },

      // D-dimensional rotated coordinate system
      uBasisX: { value: new Float32Array(MAX_DIMENSION) },
      uBasisY: { value: new Float32Array(MAX_DIMENSION) },
      uBasisZ: { value: new Float32Array(MAX_DIMENSION) },
      uOrigin: { value: new Float32Array(MAX_DIMENSION) },

      // Parameter values for extra dimensions
      uParamValues: { value: new Float32Array(8) },

      // Basic black hole parameters
      uHorizonRadius: { value: 1.0 },
      uGravityStrength: { value: 5.0 },
      uManifoldIntensity: { value: 1.0 },
      uManifoldThickness: { value: 0.15 },
      uPhotonShellWidth: { value: 0.05 },
      uTimeScale: { value: 1.0 },
      uBaseColor: { value: new THREE.Color('#fff5e6').convertSRGBToLinear() },
      uPaletteMode: { value: 0 },
      uBloomBoost: { value: 1.5 },

      // Lensing
      uDimensionEmphasis: { value: 0.8 },
      uDistanceFalloff: { value: 1.6 },
      uEpsilonMul: { value: 0.01 },
      uBendScale: { value: 1.0 },
      uBendMaxPerStep: { value: 0.25 },
      uLensingClamp: { value: 10.0 },
      uRayBendingMode: { value: 0 },
      uDimPower: { value: 1.0 }, // Pre-calculated pow(DIMENSION, emphasis)
      uOriginOffsetLengthSq: { value: 0.0 }, // Pre-calculated lengthSq of extra-dim offset

      // Photon shell
      uPhotonShellRadiusMul: { value: 1.3 },
      uPhotonShellRadiusDimBias: { value: 0.1 },
      uShellGlowStrength: { value: 3.0 },
      uShellGlowColor: { value: new THREE.Color('#ffffff').convertSRGBToLinear() },
      uShellStepMul: { value: 0.35 },
      uShellContrastBoost: { value: 1.0 },

      // Manifold
      uManifoldType: { value: 0 },
      uDensityFalloff: { value: 6.0 },
      uDiskInnerRadiusMul: { value: 1.2 },
      uDiskOuterRadiusMul: { value: 8.0 },
      uRadialSoftnessMul: { value: 0.2 },
      uThicknessPerDimMax: { value: 4.0 },
      uHighDimWScale: { value: 2.0 },
      uSwirlAmount: { value: 0.6 },
      uNoiseScale: { value: 1.0 },
      uNoiseAmount: { value: 0.25 },
      uMultiIntersectionGain: { value: 1.0 },

      // Rotation damping
      uDampInnerMul: { value: 1.2 },
      uDampOuterMul: { value: 3.0 },

      // Quality
      uMaxSteps: { value: 256 },
      uStepBase: { value: 0.08 },
      uStepMin: { value: 0.01 },
      uStepMax: { value: 0.2 },
      uStepAdaptG: { value: 1.0 },
      uStepAdaptR: { value: 0.2 },
      uEnableAbsorption: { value: false },
      uAbsorption: { value: 1.0 },
      uTransmittanceCutoff: { value: 0.01 },
      uFarRadius: { value: 20.0 },

      // Lighting
      uLightingMode: { value: 0 },
      uRoughness: { value: 0.6 },
      uSpecular: { value: 0.2 },
      uAmbientTint: { value: 0.1 },

      // Edge glow
      uEdgeGlowEnabled: { value: true },
      uEdgeGlowWidth: { value: 0.1 },
      uEdgeGlowColor: { value: new THREE.Color('#ff6600').convertSRGBToLinear() },
      uEdgeGlowIntensity: { value: 1.0 },

      // Background
      uBackgroundMode: { value: 0 },
      uStarfieldDensity: { value: 1.0 },
      uStarfieldBrightness: { value: 1.0 },
      envMap: { value: null },

      // Doppler
      uDopplerEnabled: { value: false },
      uDopplerStrength: { value: 0.6 },
      uDopplerHueShift: { value: 0.1 },

      // Jets
      uJetsEnabled: { value: false },
      uJetsHeight: { value: 10.0 },
      uJetsWidth: { value: 0.5 },
      uJetsIntensity: { value: 2.0 },
      uJetsColor: { value: new THREE.Color('#88ccff').convertSRGBToLinear() },
      uJetsFalloff: { value: 3.0 },
      uJetsNoiseAmount: { value: 0.3 },
      uJetsPulsation: { value: 0.5 },

      // Animation
      uSwirlAnimationEnabled: { value: false },
      uSwirlAnimationSpeed: { value: 0.5 },
      uPulseEnabled: { value: false },
      uPulseSpeed: { value: 0.3 },
      uPulseAmount: { value: 0.2 },

      // Slice animation (for trueND mode)
      uSliceSpeed: { value: 0.02 },
      uSliceAmplitude: { value: 0.3 },

      // 3D transformation matrices
      uModelMatrix: { value: new THREE.Matrix4() },
      uInverseModelMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },

      // Temporal accumulation
      uBayerOffset: { value: new THREE.Vector2(0, 0) },
      uFullResolution: { value: new THREE.Vector2(1, 1) },
      uInverseViewProjectionMatrix: { value: new THREE.Matrix4() },

      // Multi-light system
      ...createLightUniforms(),
    }),
    []
  )
}
