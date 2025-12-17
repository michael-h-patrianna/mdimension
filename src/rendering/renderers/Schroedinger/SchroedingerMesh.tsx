import { computeDriftedOrigin, type OriginDriftConfig } from '@/lib/animation/originDrift';
import { composeRotations } from '@/lib/math/rotation';
import type { MatrixND } from '@/lib/math/types';
import { createColorCache, createLightColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache';
import { RENDER_LAYERS } from '@/rendering/core/layers';
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
import type { RotationState } from '@/stores/rotationStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useUIStore } from '@/stores/uiStore';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
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

/** Color mode to integer mapping */
const COLOR_MODE_TO_INT: Record<string, number> = {
  density: 0,
  phase: 1,
  mixed: 2,
};

/**
 * Apply D-dimensional rotation matrix to a vector, writing result into pre-allocated output.
 */
function applyRotationInPlace(matrix: MatrixND, vec: number[], out: Float32Array): void {
  const D = matrix.length;
  for (let i = 0; i < MAX_DIMENSION; i++) out[i] = 0;
  for (let i = 0; i < D; i++) {
    let sum = 0;
    for (let j = 0; j < D; j++) {
      sum += (matrix[i]?.[j] ?? 0) * (vec[j] ?? 0);
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
  const prevRotationsRef = useRef<RotationState['rotations'] | null>(null);
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

  // Assign main object layer
  useEffect(() => {
    if (meshRef.current?.layers) {
      meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT);
    }
  }, []);

  // Get dimension from geometry store
  const dimension = useGeometryStore((state) => state.dimension);

  // Get Schroedinger quantum config from store
  const presetName = useExtendedObjectStore((state) => state.schroedinger.presetName);
  const seed = useExtendedObjectStore((state) => state.schroedinger.seed);
  const termCount = useExtendedObjectStore((state) => state.schroedinger.termCount);
  const maxQuantumNumber = useExtendedObjectStore((state) => state.schroedinger.maxQuantumNumber);
  const frequencySpread = useExtendedObjectStore((state) => state.schroedinger.frequencySpread);

  // Volume rendering parameters
  const timeScale = useExtendedObjectStore((state) => state.schroedinger.timeScale);
  const fieldScale = useExtendedObjectStore((state) => state.schroedinger.fieldScale);
  const densityGain = useExtendedObjectStore((state) => state.schroedinger.densityGain);
  const colorMode = useExtendedObjectStore((state) => state.schroedinger.colorMode);

  // Isosurface mode
  const isoEnabled = useExtendedObjectStore((state) => state.schroedinger.isoEnabled);
  const isoThreshold = useExtendedObjectStore((state) => state.schroedinger.isoThreshold);

  // Slice parameters
  const parameterValues = useExtendedObjectStore((state) => state.schroedinger.parameterValues);

  // Origin drift parameters
  const originDriftEnabled = useExtendedObjectStore((state) => state.schroedinger.originDriftEnabled);
  const driftAmplitude = useExtendedObjectStore((state) => state.schroedinger.driftAmplitude);
  const driftBaseFrequency = useExtendedObjectStore((state) => state.schroedinger.driftBaseFrequency);
  const driftFrequencySpread = useExtendedObjectStore((state) => state.schroedinger.driftFrequencySpread);

  // Slice Animation parameters
  const sliceAnimationEnabled = useExtendedObjectStore((state) => state.schroedinger.sliceAnimationEnabled);
  const sliceSpeed = useExtendedObjectStore((state) => state.schroedinger.sliceSpeed);
  const sliceAmplitude = useExtendedObjectStore((state) => state.schroedinger.sliceAmplitude);

  // Animation bias
  const animationBias = useUIStore((state) => state.animationBias);

  // Animation time tracking
  const animationTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // Color state
  const faceColor = useAppearanceStore((state) => state.faceColor);
  const colorAlgorithm = useAppearanceStore((state) => state.colorAlgorithm);
  const cosineCoefficients = useAppearanceStore((state) => state.cosineCoefficients);
  const distribution = useAppearanceStore((state) => state.distribution);
  const lchLightness = useAppearanceStore((state) => state.lchLightness);
  const lchChroma = useAppearanceStore((state) => state.lchChroma);
  const multiSourceWeights = useAppearanceStore((state) => state.multiSourceWeights);

  // Lighting
  const lights = useLightingStore((state) => state.lights);
  const ambientIntensity = useLightingStore((state) => state.ambientIntensity);
  const ambientColor = useLightingStore((state) => state.ambientColor);
  const specularIntensity = useLightingStore((state) => state.specularIntensity);
  const shininess = useLightingStore((state) => state.shininess);
  const specularColor = useLightingStore((state) => state.specularColor);
  const diffuseIntensity = useLightingStore((state) => state.diffuseIntensity);

  // Fresnel
  const edgesVisible = useAppearanceStore((state) => state.edgesVisible);
  const fresnelIntensity = useAppearanceStore((state) => state.fresnelIntensity);
  const edgeColor = useAppearanceStore((state) => state.edgeColor);

  // Opacity settings
  const opacitySettings = useUIStore((state) => state.opacitySettings);

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

      // Quantum state configuration
      uTermCount: { value: 6 },
      uOmega: { value: new Float32Array(MAX_DIM) },
      uQuantum: { value: new Int32Array(MAX_TERMS * MAX_DIM) },
      uCoeff: { value: new Float32Array(MAX_TERMS * 2) },
      uEnergy: { value: new Float32Array(MAX_TERMS) },

      // Volume rendering parameters
      uTimeScale: { value: 0.5 },
      uFieldScale: { value: 1.0 },
      uDensityGain: { value: 2.0 },
      uColorMode: { value: 2 },

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

      // Temporal Reprojection uniforms
      uPrevDepthTexture: { value: null },
      uPrevViewProjectionMatrix: { value: new THREE.Matrix4() },
      uPrevInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
      uTemporalEnabled: { value: false },
      uDepthBufferResolution: { value: new THREE.Vector2(1, 1) },

      // Orthographic projection uniforms
      uOrthographic: { value: false },
      uOrthoRayDir: { value: new THREE.Vector3(0, 0, -1) },
      uInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
    }),
    []
  );

  /**
   * Check if rotations have changed
   */
  const hasRotationsChanged = useCallback(
    (current: RotationState['rotations'], previous: RotationState['rotations'] | null): boolean => {
      if (!previous) return true;
      if (current.size !== previous.size) return true;
      for (const [key, value] of current.entries()) {
        if (previous.get(key) !== value) return true;
      }
      return false;
    },
    []
  );

  // Get temporal settings
  const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled);
  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo);
  const shaderOverrides = usePerformanceStore((state) => state.shaderOverrides);
  const resetShaderOverrides = usePerformanceStore((state) => state.resetShaderOverrides);

  // Reset overrides when configuration changes
  useEffect(() => {
    resetShaderOverrides();
  }, [dimension, temporalEnabled, opacitySettings.mode, isoEnabled, resetShaderOverrides]);

  // Compile shader
  const { glsl: shaderString, modules, features } = useMemo(() => {
    return composeSchroedingerShader({
      dimension,
      shadows: false, // Volumetric mode doesn't use traditional shadows
      temporal: temporalEnabled,
      ambientOcclusion: false,
      opacityMode: opacitySettings.mode,
      overrides: shaderOverrides,
      isosurface: isoEnabled,
    });
  }, [dimension, temporalEnabled, opacitySettings.mode, shaderOverrides, isoEnabled]);

  // Update debug info
  useEffect(() => {
    setShaderDebugInfo({
      name: 'Schrödinger Quantum Volume',
      vertexShaderLength: vertexShader.length,
      fragmentShaderLength: shaderString.length,
      activeModules: modules,
      features: features,
    });
    return () => setShaderDebugInfo(null);
  }, [shaderString, modules, features, setShaderDebugInfo]);

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

      // Get rotations
      const rotations = useRotationStore.getState().rotations;

      // ============================================
      // Adaptive Quality
      // ============================================
      const rotationsChanged = hasRotationsChanged(rotations, prevRotationsRef.current);

      if (rotationsChanged) {
        fastModeRef.current = true;
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

      if (rotationsChanged || !prevRotationsRef.current) {
        prevRotationsRef.current = new Map(rotations);
      }

      // Update fast mode uniform
      // Note: For volumetric rendering, we always use HQ mode (volumeRaymarchHQ)
      // because the fast mode only supports ambient lighting, which looks incorrect
      // for volumetric data that needs proper multi-light support
      if (material.uniforms.uFastMode) {
        material.uniforms.uFastMode.value = false;
      }

      // Quality multiplier
      const qualityMultiplier = usePerformanceStore.getState().qualityMultiplier;
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
      const currentConfig = {
        presetName,
        seed,
        termCount,
        maxQuantumNumber,
        frequencySpread,
        dimension,
      };

      const needsPresetRegen =
        !prevQuantumConfigRef.current ||
        prevQuantumConfigRef.current.presetName !== currentConfig.presetName ||
        prevQuantumConfigRef.current.seed !== currentConfig.seed ||
        prevQuantumConfigRef.current.termCount !== currentConfig.termCount ||
        prevQuantumConfigRef.current.maxQuantumNumber !== currentConfig.maxQuantumNumber ||
        prevQuantumConfigRef.current.frequencySpread !== currentConfig.frequencySpread ||
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
      if (material.uniforms.uTimeScale) material.uniforms.uTimeScale.value = timeScale;
      if (material.uniforms.uFieldScale) material.uniforms.uFieldScale.value = fieldScale;
      if (material.uniforms.uDensityGain) material.uniforms.uDensityGain.value = densityGain;
      if (material.uniforms.uColorMode) material.uniforms.uColorMode.value = COLOR_MODE_TO_INT[colorMode] ?? 2;

      // Isosurface mode
      if (material.uniforms.uIsoEnabled) material.uniforms.uIsoEnabled.value = isoEnabled;
      if (material.uniforms.uIsoThreshold) material.uniforms.uIsoThreshold.value = isoThreshold;

      // Color (cached linear conversion)
      const cache = colorCacheRef.current;
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

      // Temporal reprojection
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

      // Lighting
      updateLightUniforms(material.uniforms as unknown as LightUniforms, lights, lightColorCacheRef.current);
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
      if (material.uniforms.uFresnelEnabled) material.uniforms.uFresnelEnabled.value = edgesVisible;
      if (material.uniforms.uFresnelIntensity) material.uniforms.uFresnelIntensity.value = fresnelIntensity;
      if (material.uniforms.uRimColor) {
        updateLinearColorUniform(cache.rimColor, material.uniforms.uRimColor.value as THREE.Color, edgeColor);
      }

      // Advanced Color System
      if (material.uniforms.uColorAlgorithm) material.uniforms.uColorAlgorithm.value = COLOR_ALGORITHM_TO_INT[colorAlgorithm];
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
      if (material.uniforms.uOpacityMode) {
        material.uniforms.uOpacityMode.value = OPACITY_MODE_TO_INT[opacitySettings.mode];
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
      const isTransparent = opacitySettings.mode !== 'solid';
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

        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitX, work.rotatedX);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitY, work.rotatedY);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitZ, work.rotatedZ);

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

        applyRotationInPlace(cachedRotationMatrixRef.current, work.origin, work.rotatedOrigin);

        if (material.uniforms.uOrigin) {
          (material.uniforms.uOrigin.value as Float32Array).set(work.rotatedOrigin);
        }
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[4, 4, 4]} />
      <shaderMaterial
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
