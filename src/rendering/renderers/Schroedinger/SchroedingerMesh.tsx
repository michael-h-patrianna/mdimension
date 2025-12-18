import { computeDriftedOrigin, type OriginDriftConfig } from '@/lib/animation/originDrift';
import { RAYMARCH_QUALITY_TO_SAMPLES } from '@/lib/geometry/extended/types';
import { getEffectiveVolumeSamples } from '@/rendering/utils/adaptiveQuality';
import { composeRotations } from '@/lib/math/rotation';
import type { MatrixND } from '@/lib/math/types';
import { createColorCache, createLightColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache';
import { RENDER_LAYERS, needsVolumetricSeparation } from '@/rendering/core/layers';
import { TemporalCloudManager } from '@/rendering/core/TemporalCloudManager';
import { TemporalDepthManager } from '@/rendering/core/TemporalDepthManager';
import { createLightUniforms, updateLightUniforms, type LightUniforms } from '@/rendering/lights/uniforms';
import { OPACITY_MODE_TO_INT, SAMPLE_QUALITY_TO_INT } from '@/rendering/opacity/types';
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette';
import { composeSchroedingerShader } from '@/rendering/shaders/schroedinger/compose';
import { MAX_DIM, MAX_TERMS } from '@/rendering/shaders/schroedinger/uniforms.glsl';
import { useAnimationStore } from '@/stores/animationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import {
  getEffectiveSampleQuality,
  usePerformanceStore,
} from '@/stores/performanceStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useUIStore } from '@/stores/uiStore';
import { useWebGLContextStore } from '@/stores/webglContextStore';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  flattenPresetForUniforms,
  generateQuantumPreset,
  getNamedPreset,
  type QuantumPreset,
} from '@/lib/geometry/extended/schroedinger/presets';
import vertexShader from './schroedinger.vert?raw';

/** Debounce time in ms before restoring high quality after rotation stops */
const QUALITY_RESTORE_DELAY_MS = 150;

/** Maximum supported dimension */
const MAX_DIMENSION = 11;

/**
 * Apply D-dimensional rotation matrix to a vector, writing result into pre-allocated output.
 * @param matrix
 * @param vec
 * @param out
 * @param dimension
 */
function applyRotationInPlace(matrix: MatrixND, vec: number[], out: Float32Array, dimension: number): void {
  out.fill(0);
  for (let i = 0; i < dimension; i++) {
    let sum = 0;
    const row = matrix[i];
    if (row) {
        for (let j = 0; j < dimension; j++) {
            sum += (row[j] ?? 0) * (vec[j] ?? 0);
        }
    }
    out[i] = sum;
  }
}

/**
 * Pre-allocated working arrays to avoid per-frame allocations.
 */
interface WorkingArrays {
  unitX: number[];
  unitY: number[];
  unitZ: number[];
  origin: number[];
  rotatedX: Float32Array;
  rotatedY: Float32Array;
  rotatedZ: Float32Array;
  rotatedOrigin: Float32Array;
}

/**
 * Pre-allocated quantum uniform arrays
 */
interface QuantumArrays {
  omega: Float32Array;
  quantum: Int32Array;
  coeff: Float32Array;
  energy: Float32Array;
}

function createWorkingArrays(): WorkingArrays {
  return {
    unitX: new Array(MAX_DIMENSION).fill(0),
    unitY: new Array(MAX_DIMENSION).fill(0),
    unitZ: new Array(MAX_DIMENSION).fill(0),
    origin: new Array(MAX_DIMENSION).fill(0),
    rotatedX: new Float32Array(MAX_DIMENSION),
    rotatedY: new Float32Array(MAX_DIMENSION),
    rotatedZ: new Float32Array(MAX_DIMENSION),
    rotatedOrigin: new Float32Array(MAX_DIMENSION),
  };
}

function createQuantumArrays(): QuantumArrays {
  return {
    omega: new Float32Array(MAX_DIM),
    quantum: new Int32Array(MAX_TERMS * MAX_DIM),
    coeff: new Float32Array(MAX_TERMS * 2),
    energy: new Float32Array(MAX_TERMS),
  };
}

/**
 * SchroedingerMesh - Renders N-dimensional quantum wavefunction volumes
 *
 * Visualizes superposition of harmonic oscillator eigenstates using
 * Beer-Lambert volumetric raymarching. The 3D slice plane is rotated
 * through D-dimensional space using rotated basis vectors.
 */
const SchroedingerMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();

  // Performance optimization: track rotation changes for adaptive quality
  const prevVersionRef = useRef<number>(-1);
  const fastModeRef = useRef(false);
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-allocated working arrays
  const workingArraysRef = useRef<WorkingArrays>(createWorkingArrays());
  const quantumArraysRef = useRef<QuantumArrays>(createQuantumArrays());

  // Cached rotation matrix and quantum preset
  const cachedRotationMatrixRef = useRef<MatrixND | null>(null);
  const prevDimensionRef = useRef<number | null>(null);
  const prevParamValuesRef = useRef<number[] | null>(null);
  const basisVectorsDirtyRef = useRef(true);

  // Cached state versions for optimization
  const prevLightingVersionRef = useRef<number>(-1);

  // Track quantum config changes to regenerate preset
  const prevQuantumConfigRef = useRef<{
    presetName: string;
    seed: number;
    termCount: number;
    maxQuantumNumber: number;
    frequencySpread: number;
    dimension: number;
  } | null>(null);
  const currentPresetRef = useRef<QuantumPreset | null>(null);

  // Cached linear colors
  const colorCacheRef = useRef(createColorCache());
  const lightColorCacheRef = useRef(createLightColorCache());

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (restoreQualityTimeoutRef.current) {
        clearTimeout(restoreQualityTimeoutRef.current);
        restoreQualityTimeoutRef.current = null;
      }
    };
  }, []);

  // ============================================
  // PERFORMANCE OPTIMIZATION: Only subscribe to values that affect shader compilation
  // All other values are read via getState() in useFrame to avoid unnecessary re-renders
  // ============================================

  // Values that affect shader compilation (require re-subscription)
  const dimension = useGeometryStore((state) => state.dimension);
  const isoEnabled = useExtendedObjectStore((state) => state.schroedinger.isoEnabled);
  const opacityMode = useUIStore((state) => state.opacitySettings.mode);

  // Context restore counter - forces material recreation when context is restored
  const restoreCount = useWebGLContextStore((state) => state.restoreCount);

  // Animation time tracking
  const animationTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const uniforms = useMemo(
    () => ({
      // Time and resolution
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      // Dimension
      uDimension: { value: 4 },

      // D-dimensional rotated coordinate system
      uBasisX: { value: new Float32Array(MAX_DIM) },
      uBasisY: { value: new Float32Array(MAX_DIM) },
      uBasisZ: { value: new Float32Array(MAX_DIM) },
      uOrigin: { value: new Float32Array(MAX_DIM) },

      // Quantum mode selection (0 = harmonic oscillator, 1 = hydrogen orbital)
      uQuantumMode: { value: 0 },

      // Harmonic oscillator state configuration
      uTermCount: { value: 6 },
      uOmega: { value: new Float32Array(MAX_DIM) },
      uQuantum: { value: new Int32Array(MAX_TERMS * MAX_DIM) },
      uCoeff: { value: new Float32Array(MAX_TERMS * 2) },
      uEnergy: { value: new Float32Array(MAX_TERMS) },

      // Hydrogen orbital configuration
      uPrincipalN: { value: 2 },
      uAzimuthalL: { value: 1 },
      uMagneticM: { value: 0 },
      uBohrRadius: { value: 1.0 },
      uUseRealOrbitals: { value: true },

      // Hydrogen ND configuration (extra dimensions 4-11)
      uExtraDimN: { value: new Int32Array(8) },
      uExtraDimOmega: { value: new Float32Array(8) },

      // Volume rendering parameters
      uTimeScale: { value: 0.5 },
      uFieldScale: { value: 1.0 },
      uDensityGain: { value: 2.0 },
      uPowderScale: { value: 1.0 },
      uEmissionIntensity: { value: 0.0 },
      uEmissionThreshold: { value: 0.3 },
      uEmissionColorShift: { value: 0.0 },
      uEmissionPulsing: { value: false },
      uRimExponent: { value: 3.0 },
      uScatteringAnisotropy: { value: 0.0 },
      uRoughness: { value: 0.3 },
      uSssEnabled: { value: false },
      uSssIntensity: { value: 1.0 },
      uSssColor: { value: new THREE.Color('#ff8844') },
      uSssThickness: { value: 1.0 },
      uSssJitter: { value: 0.2 },
      uErosionStrength: { value: 0.0 },
      uErosionScale: { value: 1.0 },
      uErosionTurbulence: { value: 0.5 },
      uErosionNoiseType: { value: 0 },
      uCurlEnabled: { value: false },
      uCurlStrength: { value: 0.3 },
      uCurlScale: { value: 1.0 },
      uCurlSpeed: { value: 1.0 },
      uCurlBias: { value: 0 },
      uDispersionEnabled: { value: false },
      uDispersionStrength: { value: 0.2 },
      uDispersionDirection: { value: 0 },
      uDispersionQuality: { value: 0 },
      uShadowsEnabled: { value: false },
      uShadowStrength: { value: 1.0 },
      uShadowSteps: { value: 4 },
      uAoEnabled: { value: false },
      uAoStrength: { value: 1.0 },
      uAoSteps: { value: 4 },
      uAoRadius: { value: 0.5 },
      uAoColor: { value: new THREE.Color('#000000') },
      uNodalEnabled: { value: false },
      uNodalColor: { value: new THREE.Color('#00ffff') },
      uNodalStrength: { value: 1.0 },
      uEnergyColorEnabled: { value: false },
      uShimmerEnabled: { value: false },
      uShimmerStrength: { value: 0.5 },
      uFogEnabled: { value: true },
      uFogContribution: { value: 1.0 },
      uInternalFogDensity: { value: 0.0 },
      uSceneFogColor: { value: new THREE.Color('#000000') },
      uSceneFogDensity: { value: 0.0 },

      // Isosurface mode
      uIsoEnabled: { value: false },
      uIsoThreshold: { value: -3.0 },

      // Color and palette
      uColor: { value: new THREE.Color().convertSRGBToLinear() },

      // 3D transformation matrices
      uModelMatrix: { value: new THREE.Matrix4() },
      uInverseModelMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },

      // Multi-light system uniforms
      ...createLightUniforms(),

      // Global lighting uniforms
      uAmbientIntensity: { value: 0.2 },
      uAmbientColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      uSpecularColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },
      uDiffuseIntensity: { value: 1.0 },
      uMetallic: { value: 0.0 },

      // Fresnel rim lighting
      uFresnelEnabled: { value: true },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },

      // Performance mode
      uFastMode: { value: false },
      uQualityMultiplier: { value: 1.0 },

      // Opacity Mode System uniforms
      uOpacityMode: { value: 0 },
      uSimpleAlpha: { value: 0.7 },
      uLayerCount: { value: 2 },
      uLayerOpacity: { value: 0.5 },
      uVolumetricDensity: { value: 1.0 },
      uSampleQuality: { value: 64 },
      uSampleCount: { value: 64 },
      uVolumetricReduceOnAnim: { value: true },

      // Advanced Color System uniforms
      uColorAlgorithm: { value: 1 },
      uCosineA: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uCosineB: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uCosineC: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      uCosineD: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
      uDistPower: { value: 1.0 },
      uDistCycles: { value: 1.0 },
      uDistOffset: { value: 0.0 },
      uLchLightness: { value: 0.7 },
      uLchChroma: { value: 0.15 },
      uMultiSourceWeights: { value: new THREE.Vector3(0.5, 0.3, 0.2) },

      // Temporal Reprojection uniforms (depth-skip for isosurface)
      uPrevDepthTexture: { value: null },
      uPrevViewProjectionMatrix: { value: new THREE.Matrix4() },
      uPrevInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
      uTemporalEnabled: { value: false },
      uDepthBufferResolution: { value: new THREE.Vector2(1, 1) },

      // Temporal Accumulation uniforms (Horizon-style for volumetric)
      uBayerOffset: { value: new THREE.Vector2(0, 0) },
      uFullResolution: { value: new THREE.Vector2(1, 1) },

      // Orthographic projection uniforms
      uOrthographic: { value: false },
      uOrthoRayDir: { value: new THREE.Vector3(0, 0, -1) },
      uInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
    }),
    []
  );

  // Get temporal settings (subscribed because it affects shader compilation)
  const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled);
  const shaderOverrides = usePerformanceStore((state) => state.shaderOverrides);
  const resetShaderOverrides = usePerformanceStore((state) => state.resetShaderOverrides);

  // Reset overrides when configuration changes
  useEffect(() => {
    resetShaderOverrides();
  }, [dimension, temporalEnabled, opacityMode, isoEnabled, resetShaderOverrides]);

  // Compile shader
  // For volumetric mode with temporal enabled, use temporal ACCUMULATION (Horizon-style)
  // For isosurface mode with temporal enabled, use temporal REPROJECTION (depth-skip)
  const useTemporalAccumulation = temporalEnabled && !isoEnabled;

  const { glsl: shaderString, modules, features } = useMemo(() => {
    const result = composeSchroedingerShader({
      dimension,
      shadows: true, // Enable volumetric self-shadowing (runtime toggle via uShadowsEnabled)
      temporal: temporalEnabled && isoEnabled, // Depth-skip only for isosurface
      temporalAccumulation: useTemporalAccumulation,
      ambientOcclusion: true, // Enable volumetric AO (runtime toggle via uAoEnabled)
      opacityMode: opacityMode,
      overrides: shaderOverrides,
      isosurface: isoEnabled,
    });
    return result;
  }, [dimension, temporalEnabled, opacityMode, shaderOverrides, isoEnabled, useTemporalAccumulation]);

  // Update debug info
  useEffect(() => {
    const { setShaderDebugInfo } = usePerformanceStore.getState();
    setShaderDebugInfo('object', {
      name: 'Schrödinger Quantum Volume',
      vertexShaderLength: vertexShader.length,
      fragmentShaderLength: shaderString.length,
      activeModules: modules,
      features: features,
    });
    return () => {
      const { setShaderDebugInfo: clearDebugInfo } = usePerformanceStore.getState();
      clearDebugInfo('object', null);
    };
  }, [shaderString, modules, features]);

  // Assign layer based on temporal accumulation mode
  // When temporal cloud accumulation is active, use VOLUMETRIC layer for separate rendering
  // CRITICAL: Use useLayoutEffect to ensure layer is set BEFORE first render
  // useEffect runs after render, causing the mesh to be on wrong layer for first frames
  useLayoutEffect(() => {
    if (meshRef.current?.layers) {
      const useVolumetricLayer = needsVolumetricSeparation({
        temporalCloudAccumulation: useTemporalAccumulation,
        objectType: 'schroedinger',
      });

      if (useVolumetricLayer) {
        // Use VOLUMETRIC layer for temporal accumulation (rendered separately at 1/4 res)
        meshRef.current.layers.set(RENDER_LAYERS.VOLUMETRIC);
      } else {
        // Standard main object layer (rendered as part of main scene)
        meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT);
      }
    }
  }, [useTemporalAccumulation]);

  // CRITICAL: Use negative priority (-10) to ensure uniforms are updated BEFORE
  // PostProcessing's useFrame runs the volumetric render pass.
  // Without this, the volumetric render uses stale uniforms and appears black.
  useFrame((state) => {
    // Update animation time
    const currentTime = state.clock.elapsedTime;
    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;
    const isPlaying = useAnimationStore.getState().isPlaying;
    if (isPlaying) {
      animationTimeRef.current += deltaTime;
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;

      // ============================================
      // PERFORMANCE: Read all state via getState() to avoid re-render subscriptions
      // ============================================
      const schroedinger = useExtendedObjectStore.getState().schroedinger;
      const appearance = useAppearanceStore.getState();
      const lighting = useLightingStore.getState();
      const uiState = useUIStore.getState();
      const { rotations, version: rotationVersion } = useRotationStore.getState();
      
      // Cache for colors
      const cache = colorCacheRef.current;

      // ============================================
      // Adaptive Quality
      // ============================================
      const rotationsChanged = rotationVersion !== prevVersionRef.current;
      const fractalAnimLowQuality = usePerformanceStore.getState().fractalAnimationLowQuality;

      if (rotationsChanged && fractalAnimLowQuality) {
        fastModeRef.current = true;
        prevVersionRef.current = rotationVersion;
        if (restoreQualityTimeoutRef.current) {
          clearTimeout(restoreQualityTimeoutRef.current);
          restoreQualityTimeoutRef.current = null;
        }
      } else if (fastModeRef.current) {
        if (!restoreQualityTimeoutRef.current) {
          restoreQualityTimeoutRef.current = setTimeout(() => {
            fastModeRef.current = false;
            restoreQualityTimeoutRef.current = null;
          }, QUALITY_RESTORE_DELAY_MS);
        }
      }

      // Update fast mode uniform
      // Note: For volumetric rendering, we typically want HQ mode, but allow fast mode
      // during rotation if explicitly enabled in performance settings.
      if (material.uniforms.uFastMode) {
        material.uniforms.uFastMode.value = fastModeRef.current;
      }

      // Sample Count System
      // Maps RaymarchQuality preset to sample count with screen coverage adaptation
      const baseSamples = RAYMARCH_QUALITY_TO_SAMPLES[schroedinger.raymarchQuality] ?? 32;
      const qualityMultiplier = usePerformanceStore.getState().qualityMultiplier;
      const effectiveSamples = getEffectiveVolumeSamples(baseSamples, camera as THREE.PerspectiveCamera, qualityMultiplier);

      if (material.uniforms.uSampleCount) {
          material.uniforms.uSampleCount.value = effectiveSamples;
      }

      // Quality multiplier uniform
      if (material.uniforms.uQualityMultiplier) {
        material.uniforms.uQualityMultiplier.value = qualityMultiplier;
      }

      // Time and resolution
      if (material.uniforms.uTime) material.uniforms.uTime.value = state.clock.elapsedTime;
      if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(size.width, size.height);
      if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(camera.position);

      // Model matrices (for ray transformation from world to local space)
      if (meshRef.current) {
        meshRef.current.updateMatrixWorld();
        if (material.uniforms.uModelMatrix) {
          material.uniforms.uModelMatrix.value.copy(meshRef.current.matrixWorld);
        }
        if (material.uniforms.uInverseModelMatrix) {
          material.uniforms.uInverseModelMatrix.value.copy(meshRef.current.matrixWorld).invert();
        }
      }

      // Dimension
      if (material.uniforms.uDimension) material.uniforms.uDimension.value = dimension;

      // ============================================
      // Quantum Preset Generation
      // Check if we need to regenerate the preset
      // ============================================
      const { presetName, seed, termCount, maxQuantumNumber, frequencySpread, spreadAnimationEnabled, spreadAnimationSpeed, quantumMode, principalQuantumNumber, azimuthalQuantumNumber, magneticQuantumNumber, bohrRadiusScale, useRealOrbitals } = schroedinger;

      // Update quantum mode uniform (0 = harmonic oscillator, 1 = hydrogen orbital, 2 = hydrogen ND)
      if (material.uniforms.uQuantumMode) {
        const modeMap: Record<string, number> = {
          'harmonicOscillator': 0,
          'hydrogenOrbital': 1,
          'hydrogenND': 2,
        };
        material.uniforms.uQuantumMode.value = modeMap[quantumMode] ?? 0;
      }

      // Update hydrogen orbital uniforms
      if (material.uniforms.uPrincipalN) material.uniforms.uPrincipalN.value = principalQuantumNumber;
      if (material.uniforms.uAzimuthalL) material.uniforms.uAzimuthalL.value = azimuthalQuantumNumber;
      if (material.uniforms.uMagneticM) material.uniforms.uMagneticM.value = magneticQuantumNumber;
      if (material.uniforms.uBohrRadius) material.uniforms.uBohrRadius.value = bohrRadiusScale;
      if (material.uniforms.uUseRealOrbitals) material.uniforms.uUseRealOrbitals.value = useRealOrbitals;

      // Update Hydrogen ND uniforms (extra dimensions 4-11)
      const { extraDimQuantumNumbers, extraDimOmega, extraDimFrequencySpread } = schroedinger;
      if (material.uniforms.uExtraDimN && extraDimQuantumNumbers) {
        const arr = material.uniforms.uExtraDimN.value as Int32Array;
        for (let i = 0; i < 8; i++) {
          arr[i] = extraDimQuantumNumbers[i] ?? 0;
        }
      }
      if (material.uniforms.uExtraDimOmega && extraDimOmega) {
        const arr = material.uniforms.uExtraDimOmega.value as Float32Array;
        // Apply frequency spread to omega values (like HO mode)
        for (let i = 0; i < 8; i++) {
          const baseOmega = extraDimOmega[i] ?? 1.0;
          const spread = 1.0 + (i - 3.5) * (extraDimFrequencySpread ?? 0);
          arr[i] = baseOmega * spread;
        }
      }
      
      let effectiveSpread = frequencySpread;
      if (spreadAnimationEnabled) {
         // Wavepacket Dispersion Animation
         // Oscillate spread to show "breathing" between localized (low spread) and delocalized (high spread)
         // Range: 0.01 (tight) to 0.45 (messy fog)
         const t = animationTimeRef.current * (spreadAnimationSpeed ?? 0.5);
         const phase = (Math.sin(t) + 1.0) * 0.5; // 0 to 1
         effectiveSpread = 0.01 + phase * 0.44;
      }

      const currentConfig = {
        presetName,
        seed,
        termCount,
        maxQuantumNumber,
        frequencySpread: effectiveSpread,
        dimension,
      };

      const needsPresetRegen =
        !prevQuantumConfigRef.current ||
        prevQuantumConfigRef.current.presetName !== currentConfig.presetName ||
        prevQuantumConfigRef.current.seed !== currentConfig.seed ||
        prevQuantumConfigRef.current.termCount !== currentConfig.termCount ||
        prevQuantumConfigRef.current.maxQuantumNumber !== currentConfig.maxQuantumNumber ||
        Math.abs(prevQuantumConfigRef.current.frequencySpread - currentConfig.frequencySpread) > 0.001 || // Float compare
        prevQuantumConfigRef.current.dimension !== currentConfig.dimension;

      if (needsPresetRegen) {
        // Generate or get preset
        let preset: QuantumPreset;
        if (presetName === 'custom') {
          preset = generateQuantumPreset(seed, dimension, termCount, maxQuantumNumber, frequencySpread);
        } else {
          preset = getNamedPreset(presetName, dimension) ??
            generateQuantumPreset(seed, dimension, termCount, maxQuantumNumber, frequencySpread);
        }

        currentPresetRef.current = preset;
        prevQuantumConfigRef.current = { ...currentConfig };

        // Flatten and update uniform arrays
        const flatData = flattenPresetForUniforms(preset);
        quantumArraysRef.current.omega.set(flatData.omega);
        quantumArraysRef.current.quantum.set(flatData.quantum);
        quantumArraysRef.current.coeff.set(flatData.coeff);
        quantumArraysRef.current.energy.set(flatData.energy);

        // Update uniforms
        if (material.uniforms.uTermCount) material.uniforms.uTermCount.value = preset.termCount;
        if (material.uniforms.uOmega) {
          (material.uniforms.uOmega.value as Float32Array).set(quantumArraysRef.current.omega);
        }
        if (material.uniforms.uQuantum) {
          (material.uniforms.uQuantum.value as Int32Array).set(quantumArraysRef.current.quantum);
        }
        if (material.uniforms.uCoeff) {
          (material.uniforms.uCoeff.value as Float32Array).set(quantumArraysRef.current.coeff);
        }
        if (material.uniforms.uEnergy) {
          (material.uniforms.uEnergy.value as Float32Array).set(quantumArraysRef.current.energy);
        }
      }

      // Volume rendering parameters
      const { timeScale, fieldScale, densityGain, powderScale, erosionStrength, erosionScale, erosionTurbulence, erosionNoiseType, curlEnabled, curlStrength, curlScale, curlSpeed, curlBias, dispersionEnabled, dispersionStrength, dispersionDirection, dispersionQuality, shadowsEnabled, shadowStrength, shadowSteps, aoEnabled, aoStrength, aoQuality, aoRadius, aoColor, nodalEnabled, nodalColor, nodalStrength, energyColorEnabled, shimmerEnabled, shimmerStrength, isoThreshold, scatteringAnisotropy } = schroedinger;
      
      // Global visuals from appearance store
      const { roughness, sssEnabled, sssIntensity, sssColor, sssThickness, sssJitter, fogIntegrationEnabled, fogContribution, internalFogDensity, faceEmission, faceEmissionThreshold, faceEmissionColorShift, faceEmissionPulsing, faceRimFalloff } = appearance;
      
      // Note: We use faceRimFalloff from appearance store for uRimExponent if available (which it is now)
      // We keep scatteringAnisotropy in schroedinger store for now.
      
      if (material.uniforms.uTimeScale) material.uniforms.uTimeScale.value = timeScale;
      if (material.uniforms.uFieldScale) material.uniforms.uFieldScale.value = fieldScale;
      if (material.uniforms.uDensityGain) material.uniforms.uDensityGain.value = densityGain;
      if (material.uniforms.uPowderScale) material.uniforms.uPowderScale.value = powderScale;
      
      // Emission & Rim (Unified)
      if (material.uniforms.uEmissionIntensity) material.uniforms.uEmissionIntensity.value = faceEmission;
      if (material.uniforms.uEmissionThreshold) material.uniforms.uEmissionThreshold.value = faceEmissionThreshold;
      if (material.uniforms.uEmissionColorShift) material.uniforms.uEmissionColorShift.value = faceEmissionColorShift;
      if (material.uniforms.uEmissionPulsing) material.uniforms.uEmissionPulsing.value = faceEmissionPulsing;
      
      // Use the global faceRimFalloff
      if (material.uniforms.uRimExponent) material.uniforms.uRimExponent.value = faceRimFalloff;
      
      if (material.uniforms.uScatteringAnisotropy) material.uniforms.uScatteringAnisotropy.value = scatteringAnisotropy;
      
      // Unified Visuals
      if (material.uniforms.uRoughness) material.uniforms.uRoughness.value = roughness;
      if (material.uniforms.uSssEnabled) material.uniforms.uSssEnabled.value = sssEnabled;
      if (material.uniforms.uSssIntensity) material.uniforms.uSssIntensity.value = sssIntensity;
      if (material.uniforms.uSssColor) {
          updateLinearColorUniform(cache.faceColor /* reuse helper */, material.uniforms.uSssColor.value as THREE.Color, sssColor || '#ff8844');
      }
      if (material.uniforms.uSssThickness) material.uniforms.uSssThickness.value = sssThickness;
      if (material.uniforms.uSssJitter) material.uniforms.uSssJitter.value = sssJitter;
      
      if (material.uniforms.uErosionStrength) material.uniforms.uErosionStrength.value = erosionStrength;
      if (material.uniforms.uErosionScale) material.uniforms.uErosionScale.value = erosionScale;
      if (material.uniforms.uErosionTurbulence) material.uniforms.uErosionTurbulence.value = erosionTurbulence;
      if (material.uniforms.uErosionNoiseType) material.uniforms.uErosionNoiseType.value = erosionNoiseType;
      if (material.uniforms.uCurlEnabled) material.uniforms.uCurlEnabled.value = curlEnabled;
      if (material.uniforms.uCurlStrength) material.uniforms.uCurlStrength.value = curlStrength;
      if (material.uniforms.uCurlScale) material.uniforms.uCurlScale.value = curlScale;
      if (material.uniforms.uCurlSpeed) material.uniforms.uCurlSpeed.value = curlSpeed;
      if (material.uniforms.uCurlBias) material.uniforms.uCurlBias.value = curlBias;
      if (material.uniforms.uDispersionEnabled) material.uniforms.uDispersionEnabled.value = dispersionEnabled;
      if (material.uniforms.uDispersionStrength) material.uniforms.uDispersionStrength.value = dispersionStrength;
      if (material.uniforms.uDispersionDirection) material.uniforms.uDispersionDirection.value = dispersionDirection;
      if (material.uniforms.uDispersionQuality) material.uniforms.uDispersionQuality.value = dispersionQuality;
      if (material.uniforms.uShadowsEnabled) material.uniforms.uShadowsEnabled.value = shadowsEnabled;
      if (material.uniforms.uShadowStrength) material.uniforms.uShadowStrength.value = shadowStrength;
      if (material.uniforms.uShadowSteps) material.uniforms.uShadowSteps.value = shadowSteps;
      // Schrödinger uses its own AO toggle (unified UI sets aoEnabled directly)
      if (material.uniforms.uAoEnabled) {
        material.uniforms.uAoEnabled.value = aoEnabled;
      }
      if (material.uniforms.uAoStrength) material.uniforms.uAoStrength.value = aoStrength;
      if (material.uniforms.uAoSteps) material.uniforms.uAoSteps.value = aoQuality;
      if (material.uniforms.uAoRadius) material.uniforms.uAoRadius.value = aoRadius;
      if (material.uniforms.uAoColor) {
          updateLinearColorUniform(cache.faceColor /* reuse helper */, material.uniforms.uAoColor.value as THREE.Color, aoColor || '#000000');
      }
      if (material.uniforms.uNodalEnabled) material.uniforms.uNodalEnabled.value = nodalEnabled;
      if (material.uniforms.uNodalStrength) material.uniforms.uNodalStrength.value = nodalStrength;
      if (material.uniforms.uNodalColor) {
          updateLinearColorUniform(cache.faceColor /* reuse helper */, material.uniforms.uNodalColor.value as THREE.Color, nodalColor || '#00ffff');
      }
      if (material.uniforms.uEnergyColorEnabled) material.uniforms.uEnergyColorEnabled.value = energyColorEnabled;
      if (material.uniforms.uShimmerEnabled) material.uniforms.uShimmerEnabled.value = shimmerEnabled;
      if (material.uniforms.uShimmerStrength) material.uniforms.uShimmerStrength.value = shimmerStrength;
      
      // Unified Fog
      if (material.uniforms.uFogEnabled) material.uniforms.uFogEnabled.value = fogIntegrationEnabled;
      if (material.uniforms.uFogContribution) material.uniforms.uFogContribution.value = fogContribution;
      if (material.uniforms.uInternalFogDensity) material.uniforms.uInternalFogDensity.value = internalFogDensity;

      // Update scene fog uniforms
      if (state.scene.fog && (state.scene.fog as THREE.FogExp2).isFogExp2) {
          const fog = state.scene.fog as THREE.FogExp2;
          if (material.uniforms.uSceneFogColor) material.uniforms.uSceneFogColor.value.copy(fog.color);
          if (material.uniforms.uSceneFogDensity) material.uniforms.uSceneFogDensity.value = fog.density;
      } else if (state.scene.fog && (state.scene.fog as THREE.Fog).isFog) {
           // Handle linear fog if necessary, but we mostly use Exp2
           // For now, map linear to approximate exp2 or just set 0
           const fog = state.scene.fog as THREE.Fog;
           if (material.uniforms.uSceneFogColor) material.uniforms.uSceneFogColor.value.copy(fog.color);
           // Approximate density from near/far? 
           // density ~ 1/(far-near)
           if (material.uniforms.uSceneFogDensity) material.uniforms.uSceneFogDensity.value = 0.0;
      } else {
           if (material.uniforms.uSceneFogDensity) material.uniforms.uSceneFogDensity.value = 0.0;
      }
      
      // Isosurface mode
      if (material.uniforms.uIsoEnabled) material.uniforms.uIsoEnabled.value = isoEnabled;
      if (material.uniforms.uIsoThreshold) material.uniforms.uIsoThreshold.value = isoThreshold;

      // Color (cached linear conversion)
      const { faceColor } = appearance;
      if (material.uniforms.uColor) {
        updateLinearColorUniform(cache.faceColor, material.uniforms.uColor.value as THREE.Color, faceColor);
      }

      // Camera matrices
      if (material.uniforms.uProjectionMatrix) material.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
      if (material.uniforms.uViewMatrix) material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);

      // Orthographic projection
      const projectionType = useProjectionStore.getState().type;
      if (material.uniforms.uOrthographic) {
        material.uniforms.uOrthographic.value = projectionType === 'orthographic';
      }
      if (material.uniforms.uOrthoRayDir) {
        camera.getWorldDirection(material.uniforms.uOrthoRayDir.value as THREE.Vector3);
      }
      if (material.uniforms.uInverseViewProjectionMatrix) {
        const invVP = material.uniforms.uInverseViewProjectionMatrix.value as THREE.Matrix4;
        invVP.copy(camera.projectionMatrixInverse).premultiply(camera.matrixWorld);
      }

      // Temporal reprojection (depth-skip for isosurface mode)
      const temporalUniforms = TemporalDepthManager.getUniforms();
      if (material.uniforms.uPrevDepthTexture) {
        material.uniforms.uPrevDepthTexture.value = temporalUniforms.uPrevDepthTexture;
      }
      if (material.uniforms.uPrevViewProjectionMatrix) {
        material.uniforms.uPrevViewProjectionMatrix.value.copy(temporalUniforms.uPrevViewProjectionMatrix);
      }
      if (material.uniforms.uPrevInverseViewProjectionMatrix) {
        material.uniforms.uPrevInverseViewProjectionMatrix.value.copy(temporalUniforms.uPrevInverseViewProjectionMatrix);
      }
      if (material.uniforms.uTemporalEnabled) {
        material.uniforms.uTemporalEnabled.value = temporalUniforms.uTemporalEnabled;
      }
      if (material.uniforms.uDepthBufferResolution) {
        material.uniforms.uDepthBufferResolution.value.copy(temporalUniforms.uDepthBufferResolution);
      }

      // Temporal accumulation (Horizon-style for volumetric mode)
      // These uniforms are only used when USE_TEMPORAL_ACCUMULATION is defined
      const cloudUniforms = TemporalCloudManager.getUniforms();
      if (material.uniforms.uBayerOffset) {
        material.uniforms.uBayerOffset.value.copy(cloudUniforms.uBayerOffset);
      }
      if (material.uniforms.uFullResolution) {
        material.uniforms.uFullResolution.value.copy(cloudUniforms.uAccumulationResolution);
      }

      // Lighting
      const { lights, ambientIntensity, ambientColor, specularIntensity, shininess, specularColor, diffuseIntensity, version: lightingVersion } = lighting;
      
      if (prevLightingVersionRef.current !== lightingVersion) {
        updateLightUniforms(material.uniforms as unknown as LightUniforms, lights, lightColorCacheRef.current);
        prevLightingVersionRef.current = lightingVersion;
      }

      if (material.uniforms.uAmbientIntensity) material.uniforms.uAmbientIntensity.value = ambientIntensity;
      if (material.uniforms.uAmbientColor) {
        updateLinearColorUniform(cache.ambientColor, material.uniforms.uAmbientColor.value as THREE.Color, ambientColor);
      }
      if (material.uniforms.uSpecularIntensity) material.uniforms.uSpecularIntensity.value = specularIntensity;
      if (material.uniforms.uSpecularPower) material.uniforms.uSpecularPower.value = shininess;
      if (material.uniforms.uSpecularColor) {
        updateLinearColorUniform(cache.specularColor, material.uniforms.uSpecularColor.value as THREE.Color, specularColor);
      }
      if (material.uniforms.uDiffuseIntensity) material.uniforms.uDiffuseIntensity.value = diffuseIntensity;

      // Fresnel
      const { edgesVisible, fresnelIntensity, edgeColor } = appearance;
      if (material.uniforms.uFresnelEnabled) material.uniforms.uFresnelEnabled.value = edgesVisible;
      if (material.uniforms.uFresnelIntensity) material.uniforms.uFresnelIntensity.value = fresnelIntensity;
      if (material.uniforms.uRimColor) {
        updateLinearColorUniform(cache.rimColor, material.uniforms.uRimColor.value as THREE.Color, edgeColor);
      }

      // Advanced Color System
      const { colorAlgorithm, cosineCoefficients, distribution, lchLightness, lchChroma, multiSourceWeights } = appearance;
      
      // Update color algorithm uniforms only if algorithm changed or always? 
      // Coefficients might change even if algorithm doesn't.
      // But we can check if colorAlgorithm is 'cosine' etc.
      // For now, let's just optimize the integer mapping part if possible, or leave as is since .set() is cheap.
      // Actually, we can skip updating cosine coefficients if colorAlgorithm is not 'palette' (3).
      // But uColorAlgorithm is always needed.
      if (material.uniforms.uColorAlgorithm) material.uniforms.uColorAlgorithm.value = COLOR_ALGORITHM_TO_INT[colorAlgorithm];
      
      // Only update extensive cosine arrays if we are in a mode that might use them (or just update them, they are fast)
      // Optimization: Only update if changed? We don't have versioning for appearance store yet.
      // We'll stick to unconditional updates for now as Float32Array.set is fast enough.
      
      if (material.uniforms.uCosineA) material.uniforms.uCosineA.value.set(cosineCoefficients.a[0], cosineCoefficients.a[1], cosineCoefficients.a[2]);
      if (material.uniforms.uCosineB) material.uniforms.uCosineB.value.set(cosineCoefficients.b[0], cosineCoefficients.b[1], cosineCoefficients.b[2]);
      if (material.uniforms.uCosineC) material.uniforms.uCosineC.value.set(cosineCoefficients.c[0], cosineCoefficients.c[1], cosineCoefficients.c[2]);
      if (material.uniforms.uCosineD) material.uniforms.uCosineD.value.set(cosineCoefficients.d[0], cosineCoefficients.d[1], cosineCoefficients.d[2]);
      if (material.uniforms.uDistPower) material.uniforms.uDistPower.value = distribution.power;
      if (material.uniforms.uDistCycles) material.uniforms.uDistCycles.value = distribution.cycles;
      if (material.uniforms.uDistOffset) material.uniforms.uDistOffset.value = distribution.offset;
      if (material.uniforms.uLchLightness) material.uniforms.uLchLightness.value = lchLightness;
      if (material.uniforms.uLchChroma) material.uniforms.uLchChroma.value = lchChroma;
      if (material.uniforms.uMultiSourceWeights) material.uniforms.uMultiSourceWeights.value.set(multiSourceWeights.depth, multiSourceWeights.orbitTrap, multiSourceWeights.normal);

      // Opacity Mode System
      const { opacitySettings, animationBias } = uiState;
      if (material.uniforms.uOpacityMode) {
        // Respect user's opacity mode selection, including SOLID mode
        // The temporal accumulation compositing pass now correctly handles all modes
        // Note: Previous workaround forced 'volumetricDensity' mode to avoid compositing bugs
        // which have since been fixed (autoClear and alpha preservation in reconstruction)
        material.uniforms.uOpacityMode.value = OPACITY_MODE_TO_INT[opacitySettings.mode as keyof typeof OPACITY_MODE_TO_INT];
      }
      if (material.uniforms.uSimpleAlpha) {
        material.uniforms.uSimpleAlpha.value = opacitySettings.simpleAlphaOpacity;
      }
      if (material.uniforms.uLayerCount) {
        material.uniforms.uLayerCount.value = opacitySettings.layerCount;
      }
      if (material.uniforms.uLayerOpacity) {
        material.uniforms.uLayerOpacity.value = opacitySettings.layerOpacity;
      }
      if (material.uniforms.uVolumetricDensity) {
        material.uniforms.uVolumetricDensity.value = opacitySettings.volumetricDensity;
      }
      if (material.uniforms.uSampleQuality) {
        const effectiveSampleQuality = getEffectiveSampleQuality(opacitySettings.sampleQuality, qualityMultiplier);
        material.uniforms.uSampleQuality.value = SAMPLE_QUALITY_TO_INT[effectiveSampleQuality];
      }
      if (material.uniforms.uVolumetricReduceOnAnim) {
        material.uniforms.uVolumetricReduceOnAnim.value = opacitySettings.volumetricAnimationQuality === 'reduce';
      }

      // Configure transparency
      // When temporal accumulation is active, we MUST treat the material as transparent
      // to ensure correct alpha behavior and rendering order, even if mode is 'solid'
      const isTransparent = opacitySettings.mode !== 'solid' || useTemporalAccumulation;
      if (material.transparent !== isTransparent) {
        material.transparent = isTransparent;
        material.depthWrite = !isTransparent;
        material.needsUpdate = true;
      }

      // ============================================
      // D-dimensional Rotation & Basis Vectors
      // ============================================
      const D = dimension;
      const work = workingArraysRef.current;

      const { parameterValues, originDriftEnabled, driftAmplitude, driftBaseFrequency, driftFrequencySpread,
              sliceAnimationEnabled, sliceSpeed, sliceAmplitude } = schroedinger;

      const paramsChanged = !prevParamValuesRef.current ||
        prevParamValuesRef.current.length !== parameterValues.length ||
        parameterValues.some((v, i) => prevParamValuesRef.current![i] !== v);

      const needsRecompute = rotationsChanged ||
        dimension !== prevDimensionRef.current ||
        paramsChanged ||
        basisVectorsDirtyRef.current;

      if (needsRecompute) {
        cachedRotationMatrixRef.current = composeRotations(dimension, rotations);

        for (let i = 0; i < MAX_DIMENSION; i++) work.unitX[i] = 0;
        work.unitX[0] = 1;

        for (let i = 0; i < MAX_DIMENSION; i++) work.unitY[i] = 0;
        work.unitY[1] = 1;

        for (let i = 0; i < MAX_DIMENSION; i++) work.unitZ[i] = 0;
        work.unitZ[2] = 1;

        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitX, work.rotatedX, dimension);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitY, work.rotatedY, dimension);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitZ, work.rotatedZ, dimension);

        if (material.uniforms.uBasisX) {
          (material.uniforms.uBasisX.value as Float32Array).set(work.rotatedX);
        }
        if (material.uniforms.uBasisY) {
          (material.uniforms.uBasisY.value as Float32Array).set(work.rotatedY);
        }
        if (material.uniforms.uBasisZ) {
          (material.uniforms.uBasisZ.value as Float32Array).set(work.rotatedZ);
        }

        prevDimensionRef.current = dimension;
        prevParamValuesRef.current = [...parameterValues];
        basisVectorsDirtyRef.current = false;
      }

      // ============================================
      // Origin Update
      // ============================================
      const needsOriginUpdate = needsRecompute || originDriftEnabled || sliceAnimationEnabled;

      if (needsOriginUpdate && cachedRotationMatrixRef.current) {
        for (let i = 0; i < MAX_DIMENSION; i++) work.origin[i] = 0;

        if (originDriftEnabled && D > 3) {
          const driftConfig: OriginDriftConfig = {
            enabled: true,
            amplitude: driftAmplitude,
            baseFrequency: driftBaseFrequency,
            frequencySpread: driftFrequencySpread,
          };
          const animationSpeed = useAnimationStore.getState().speed;
          const driftedOrigin = computeDriftedOrigin(
            parameterValues,
            animationTimeRef.current,
            driftConfig,
            animationSpeed,
            animationBias
          );
          for (let i = 3; i < D; i++) {
            work.origin[i] = driftedOrigin[i - 3] ?? 0;
          }
        } else if (sliceAnimationEnabled && D > 3) {
          const PHI = 1.618033988749895;
          // Use tracked animation time for proper pause support
          const timeInSeconds = animationTimeRef.current;

          for (let i = 3; i < D; i++) {
            const extraDimIndex = i - 3;
            const phase = extraDimIndex * PHI;
            const t1 = timeInSeconds * sliceSpeed * 2 * Math.PI + phase;
            const t2 = timeInSeconds * sliceSpeed * 1.3 * 2 * Math.PI + phase * 1.5;
            const offset = sliceAmplitude * (0.7 * Math.sin(t1) + 0.3 * Math.sin(t2));
            work.origin[i] = (parameterValues[extraDimIndex] ?? 0) + offset;
          }
        } else {
          for (let i = 3; i < D; i++) {
            work.origin[i] = parameterValues[i - 3] ?? 0;
          }
        }

        applyRotationInPlace(cachedRotationMatrixRef.current, work.origin, work.rotatedOrigin, dimension);

        if (material.uniforms.uOrigin) {
          (material.uniforms.uOrigin.value as Float32Array).set(work.rotatedOrigin);
        }
      }
    }
  }, -10); // Priority -10: Run BEFORE PostProcessing (priority 10)

  // Generate unique key to force material recreation when shader changes or context is restored
  const materialKey = useMemo(() => {
    return `schroedinger-material-${shaderString.length}-${features.join(',')}-${useTemporalAccumulation}-${restoreCount}`;
  }, [shaderString, features, useTemporalAccumulation, restoreCount]);

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[4, 4, 4]} />
      <shaderMaterial
        key={materialKey}
        glslVersion={THREE.GLSL3}
        vertexShader={vertexShader}
        fragmentShader={shaderString}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default SchroedingerMesh;
