import { computeDriftedOrigin, type OriginDriftConfig } from '@/lib/animation/originDrift';
import { composeRotations } from '@/lib/math/rotation';
import type { MatrixND } from '@/lib/math/types';
import { createColorCache, createLightColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache';
import { RENDER_LAYERS } from '@/rendering/core/layers';
import { TemporalDepthManager } from '@/rendering/core/TemporalDepthManager';
import { ZoomAutopilot, type AutopilotConfig } from '@/rendering/effects/ZoomAutopilot';
import { createLightUniforms, updateLightUniforms, type LightUniforms } from '@/rendering/lights/uniforms';
import { OPACITY_MODE_TO_INT, SAMPLE_QUALITY_TO_INT } from '@/rendering/opacity/types';
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette';
import { SHADOW_ANIMATION_MODE_TO_INT, SHADOW_QUALITY_TO_INT } from '@/rendering/shadows/types';
import { useAnimationStore } from '@/stores/animationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore } from '@/stores/lightingStore';
import {
    getEffectiveSampleQuality,
    getEffectiveShadowQuality,
    usePerformanceStore,
} from '@/stores/performanceStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useUIStore } from '@/stores/uiStore';
import { useWebGLContextStore } from '@/stores/webglContextStore';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { composeMandelbulbShader } from '@/rendering/shaders/mandelbulb/compose';
import vertexShader from './mandelbulb.vert?raw';

/** Debounce time in ms before restoring high quality after rotation stops */
const QUALITY_RESTORE_DELAY_MS = 150;

/** Maximum supported dimension */
const MAX_DIMENSION = 11;

/**
 * Apply D-dimensional rotation matrix to a vector, writing result into pre-allocated output.
 * Matrix is row-major: result[i] = sum(matrix[i][j] * vec[j])
 * @param matrix - D×D rotation matrix
 * @param vec - Input vector (length D)
 * @param out - Pre-allocated output Float32Array (length MAX_DIMENSION)
 * @param dimension - Current dimension (optimization: only loop up to this)
 */
function applyRotationInPlace(matrix: MatrixND, vec: number[] | Float32Array, out: Float32Array, dimension: number): void {
  // Clear output first (only needed if we assume clean buffer beyond D)
  // For consistency with previous behavior and safety we fill with 0
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
 * These are module-level to ensure single allocation across component lifecycle.
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
 * Create pre-allocated working arrays for rotation calculations.
 * All arrays sized to MAX_DIMENSION to handle any dimension without reallocation.
 * @returns Pre-allocated working arrays for basis vector computations
 */
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

/**
 * MandelbulbMesh - Renders 4D-11D Mandelbulb fractals using GPU raymarching
 *
 * Supports full D-dimensional rotation through all rotation planes (XY, XZ, YZ, XW, YW, ZW, etc.)
 * The 3D slice plane is rotated through D-dimensional space using rotated basis vectors.
 * @returns Three.js mesh with raymarching shader
 */
const MandelbulbMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();

  // Performance optimization: track rotation changes for adaptive quality
  const prevVersionRef = useRef<number>(-1);
  const fastModeRef = useRef(false);
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-allocated working arrays to avoid per-frame allocations
  const workingArraysRef = useRef<WorkingArrays>(createWorkingArrays());

  // Cached rotation matrix and basis vectors - only recomputed when rotations/dimension/params change
  const cachedRotationMatrixRef = useRef<MatrixND | null>(null);
  const prevDimensionRef = useRef<number | null>(null);
  const prevParamValuesRef = useRef<number[] | null>(null);
  const basisVectorsDirtyRef = useRef(true);

  // Cached uniform values to avoid redundant updates
  const prevPowerRef = useRef<number | null>(null);
  const prevIterationsRef = useRef<number | null>(null);
  const prevEscapeRadiusRef = useRef<number | null>(null);
  const prevZoomRef = useRef<number | null>(null);
  const prevLightingVersionRef = useRef<number>(-1);

  // Cached linear colors - avoid per-frame sRGB->linear conversion
  const colorCacheRef = useRef(createColorCache());
  const lightColorCacheRef = useRef(createLightColorCache());

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (restoreQualityTimeoutRef.current) {
        clearTimeout(restoreQualityTimeoutRef.current);
        restoreQualityTimeoutRef.current = null;
      }
    };
  }, []);

  // Assign main object layer for depth-based effects (SSR, refraction, bokeh)
  useEffect(() => {
    if (meshRef.current?.layers) {
      meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT);
    }
  }, []);

  // Cleanup zoom autopilot on unmount
  useEffect(() => {
    return () => {
      if (zoomAutopilotRef.current) {
        zoomAutopilotRef.current.dispose();
        zoomAutopilotRef.current = null;
      }
    };
  }, []);

  // Get dimension from geometry store
  const dimension = useGeometryStore((state) => state.dimension);

  // Context restore counter - forces material recreation when context is restored
  const restoreCount = useWebGLContextStore((state) => state.restoreCount);

  // Get Mandelbulb/Mandelbulb config from store
  const mandelbulbPower = useExtendedObjectStore((state) => state.mandelbulb.mandelbulbPower);
  const maxIterations = useExtendedObjectStore((state) => state.mandelbulb.maxIterations);
  const escapeRadius = useExtendedObjectStore((state) => state.mandelbulb.escapeRadius);
  const parameterValues = useExtendedObjectStore((state) => state.mandelbulb.parameterValues);

  // Power animation parameters (organic multi-frequency motion)
  const powerAnimationEnabled = useExtendedObjectStore((state) => state.mandelbulb.powerAnimationEnabled);
  const powerMin = useExtendedObjectStore((state) => state.mandelbulb.powerMin);
  const powerMax = useExtendedObjectStore((state) => state.mandelbulb.powerMax);
  const powerSpeed = useExtendedObjectStore((state) => state.mandelbulb.powerSpeed);

  // Alternate power parameters (Technique B - blend between two powers)
  const alternatePowerEnabled = useExtendedObjectStore((state) => state.mandelbulb.alternatePowerEnabled);
  const alternatePowerValue = useExtendedObjectStore((state) => state.mandelbulb.alternatePowerValue);
  const alternatePowerBlend = useExtendedObjectStore((state) => state.mandelbulb.alternatePowerBlend);

  // Origin drift parameters (Technique C - animate slice origin in extra dims)
  const originDriftEnabled = useExtendedObjectStore((state) => state.mandelbulb.originDriftEnabled);
  const driftAmplitude = useExtendedObjectStore((state) => state.mandelbulb.driftAmplitude);
  const driftBaseFrequency = useExtendedObjectStore((state) => state.mandelbulb.driftBaseFrequency);
  const driftFrequencySpread = useExtendedObjectStore((state) => state.mandelbulb.driftFrequencySpread);

  // Dimension mixing parameters (Technique A - shear matrix inside iteration)
  const dimensionMixEnabled = useExtendedObjectStore((state) => state.mandelbulb.dimensionMixEnabled);
  const mixIntensity = useExtendedObjectStore((state) => state.mandelbulb.mixIntensity);
  const mixFrequency = useExtendedObjectStore((state) => state.mandelbulb.mixFrequency);

  // Slice Animation parameters (4D+ only - fly through higher-dimensional cross-sections)
  const sliceAnimationEnabled = useExtendedObjectStore((state) => state.mandelbulb.sliceAnimationEnabled);
  const sliceSpeed = useExtendedObjectStore((state) => state.mandelbulb.sliceSpeed);
  const sliceAmplitude = useExtendedObjectStore((state) => state.mandelbulb.sliceAmplitude);

  // Phase Shift parameters (angular twisting)
  const phaseShiftEnabled = useExtendedObjectStore((state) => state.mandelbulb.phaseShiftEnabled);
  const phaseSpeed = useExtendedObjectStore((state) => state.mandelbulb.phaseSpeed);
  const phaseAmplitude = useExtendedObjectStore((state) => state.mandelbulb.phaseAmplitude);

  // Zoom parameters
  const zoomEnabled = useExtendedObjectStore((state) => state.mandelbulb.zoomEnabled);
  const zoom = useExtendedObjectStore((state) => state.mandelbulb.zoom);
  const zoomSpeed = useExtendedObjectStore((state) => state.mandelbulb.zoomSpeed);
  const zoomAnimationEnabled = useExtendedObjectStore((state) => state.mandelbulb.zoomAnimationEnabled);
  const zoomAnimationMode = useExtendedObjectStore((state) => state.mandelbulb.zoomAnimationMode);
  const zoomTargetLevel = useExtendedObjectStore((state) => state.mandelbulb.zoomTargetLevel);

  // Autopilot parameters
  const autopilotEnabled = useExtendedObjectStore((state) => state.mandelbulb.autopilotEnabled);
  const autopilotStrategy = useExtendedObjectStore((state) => state.mandelbulb.autopilotStrategy);
  const centerRayProbeSize = useExtendedObjectStore((state) => state.mandelbulb.centerRayProbeSize);
  const centerRayProbeFrequency = useExtendedObjectStore((state) => state.mandelbulb.centerRayProbeFrequency);
  const centerRayMissThreshold = useExtendedObjectStore((state) => state.mandelbulb.centerRayMissThreshold);
  const centerRayNudgeStrength = useExtendedObjectStore((state) => state.mandelbulb.centerRayNudgeStrength);
  const interestScoreResolution = useExtendedObjectStore((state) => state.mandelbulb.interestScoreResolution);
  const interestScoreInterval = useExtendedObjectStore((state) => state.mandelbulb.interestScoreInterval);
  const interestScoreCandidates = useExtendedObjectStore((state) => state.mandelbulb.interestScoreCandidates);
  const interestScoreNudgeRadius = useExtendedObjectStore((state) => state.mandelbulb.interestScoreNudgeRadius);
  const interestScoreMetric = useExtendedObjectStore((state) => state.mandelbulb.interestScoreMetric);
  const boundaryTargetEscapeRatio = useExtendedObjectStore((state) => state.mandelbulb.boundaryTargetEscapeRatio);
  const boundaryTargetBand = useExtendedObjectStore((state) => state.mandelbulb.boundaryTargetBand);
  const boundaryTargetCorrectionStrength = useExtendedObjectStore((state) => state.mandelbulb.boundaryTargetCorrectionStrength);

  // Animation bias for per-dimension variation
  const animationBias = useUIStore((state) => state.animationBias);

  // Animation time tracking - only advances when isPlaying is true
  const animationTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // Zoom state refs
  const logZoomRef = useRef(0);  // Log-space zoom for smooth animation
  const zoomAutopilotRef = useRef<ZoomAutopilot | null>(null);
  const zoomSpeedMultiplierRef = useRef(1.0);  // Autopilot speed adjustment

  // Get color state from visual store
  const faceColor = useAppearanceStore((state) => state.faceColor);

  // Advanced color system state
  const colorAlgorithm = useAppearanceStore((state) => state.colorAlgorithm);
  const cosineCoefficients = useAppearanceStore((state) => state.cosineCoefficients);
  const distribution = useAppearanceStore((state) => state.distribution);
  const lchLightness = useAppearanceStore((state) => state.lchLightness);
  const lchChroma = useAppearanceStore((state) => state.lchChroma);
  const multiSourceWeights = useAppearanceStore((state) => state.multiSourceWeights);

  // Get multi-light system from visual store
  const lights = useLightingStore((state) => state.lights);

  // Get global lighting settings from visual store
  const ambientIntensity = useLightingStore((state) => state.ambientIntensity);
  const ambientColor = useLightingStore((state) => state.ambientColor);
  const specularIntensity = useLightingStore((state) => state.specularIntensity);
  const shininess = useLightingStore((state) => state.shininess);
  // Enhanced lighting settings
  const specularColor = useLightingStore((state) => state.specularColor);
  const diffuseIntensity = useLightingStore((state) => state.diffuseIntensity);


  // Edges render mode controls fresnel rim lighting for Mandelbulb
  const edgesVisible = useAppearanceStore((state) => state.edgesVisible);
  const fresnelIntensity = useAppearanceStore((state) => state.fresnelIntensity);
  const edgeColor = useAppearanceStore((state) => state.edgeColor);

  // Opacity settings (shared global state)
  const opacitySettings = useUIStore((state) => state.opacitySettings);

  // Shadow settings
  const shadowEnabled = useLightingStore((state) => state.shadowEnabled);
  const shadowQuality = useLightingStore((state) => state.shadowQuality);
  const shadowSoftness = useLightingStore((state) => state.shadowSoftness);
  const shadowAnimationMode = useLightingStore((state) => state.shadowAnimationMode);

  const uniforms = useMemo(
    () => ({
      // Time and resolution
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      // Mandelbulb parameters
      uDimension: { value: 4 },
      uPower: { value: 8.0 },
      uIterations: { value: 48.0 },
      uEscapeRadius: { value: 8.0 },

      // Power Animation uniforms (Technique B - power oscillation)
      uPowerAnimationEnabled: { value: false },
      uAnimatedPower: { value: 8.0 },  // Computed power = center + amplitude * sin(time * speed)

      // Alternate Power uniforms (Technique B variant - blend two powers)
      uAlternatePowerEnabled: { value: false },
      uAlternatePowerValue: { value: 4.0 },
      uAlternatePowerBlend: { value: 0.5 },

      // Dimension Mixing uniforms (Technique A - shear matrix)
      uDimensionMixEnabled: { value: false },
      uMixIntensity: { value: 0.1 },
      uMixTime: { value: 0 },  // Animated mix time = animTime * mixFrequency

      // Phase Shift uniforms (angular twisting)
      uPhaseEnabled: { value: false },
      uPhaseTheta: { value: 0.0 },  // Phase offset for theta angle
      uPhasePhi: { value: 0.0 },    // Phase offset for phi angle

      // Zoom uniforms
      uZoomEnabled: { value: false },
      uZoom: { value: 1.0 },

      // D-dimensional rotated coordinate system
      // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
      uBasisX: { value: new Float32Array(11) },
      uBasisY: { value: new Float32Array(11) },
      uBasisZ: { value: new Float32Array(11) },
      uOrigin: { value: new Float32Array(11) },

      // Color and palette (converted to linear for physically correct lighting)
      uColor: { value: new THREE.Color().convertSRGBToLinear() },

      // 3D transformation matrices (for camera/view only)
      uModelMatrix: { value: new THREE.Matrix4() },
      uInverseModelMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },

      // Multi-light system uniforms
      ...createLightUniforms(),

      // Global lighting uniforms (colors converted to linear for physically correct lighting)
      uAmbientIntensity: { value: 0.2 },
      uAmbientColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      // Enhanced lighting uniforms
      uSpecularColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },
      uDiffuseIntensity: { value: 1.0 },
      // Material property for G-buffer (reflectivity for SSR)
      uMetallic: { value: 0.0 },

      // Advanced Rendering
      uRoughness: { value: 0.3 },
      uSssEnabled: { value: false },
      uSssIntensity: { value: 1.0 },
      uSssColor: { value: new THREE.Color('#ff8844') },
      uSssThickness: { value: 1.0 },
      
      // Atmosphere
      uFogEnabled: { value: true },
      uFogContribution: { value: 1.0 },
      uInternalFogDensity: { value: 0.0 },

      // Fresnel rim lighting uniforms (color converted to linear)
      uFresnelEnabled: { value: true },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },

      // Performance mode: reduces quality during rotation animations
      uFastMode: { value: false },

      // Progressive refinement quality multiplier (0.25-1.0)
      uQualityMultiplier: { value: 1.0 },

      // Opacity Mode System uniforms
      uOpacityMode: { value: 0 },
      uSimpleAlpha: { value: 0.7 },
      uLayerCount: { value: 2 },
      uLayerOpacity: { value: 0.5 },
      uVolumetricDensity: { value: 1.0 },
      uSampleQuality: { value: 1 },
      uVolumetricReduceOnAnim: { value: true },

      // Shadow System uniforms
      uShadowEnabled: { value: false },
      uShadowQuality: { value: 1 },
      uShadowSoftness: { value: 1.0 },
      uShadowAnimationMode: { value: 0 },

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

  // Get temporal settings
  const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled);
  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo);
  const shaderOverrides = usePerformanceStore((state) => state.shaderOverrides);
  const resetShaderOverrides = usePerformanceStore((state) => state.resetShaderOverrides);

  // Reset overrides when base configuration changes
  useEffect(() => {
    resetShaderOverrides();
  }, [dimension, shadowEnabled, temporalEnabled, opacitySettings.mode, resetShaderOverrides]);

  // Compile shader only when configuration changes
  const { glsl: shaderString, modules, features } = useMemo(() => {
    return composeMandelbulbShader({
      dimension,
      shadows: shadowEnabled,
      temporal: temporalEnabled,
      ambientOcclusion: true, // Always included unless explicit toggle added
      opacityMode: opacitySettings.mode,
      overrides: shaderOverrides,
    });
  }, [dimension, shadowEnabled, temporalEnabled, opacitySettings.mode, shaderOverrides]);

  // Update debug info store
  useEffect(() => {
    setShaderDebugInfo('object', {
      name: 'Mandelbulb Raymarcher',
      vertexShaderLength: vertexShader.length,
      fragmentShaderLength: shaderString.length,
      activeModules: modules,
      features: features,
    });
    return () => setShaderDebugInfo('object', null);
  }, [shaderString, modules, features, setShaderDebugInfo]);

  useFrame((state) => {
    // Update animation time - only advances when isPlaying is true
    const currentTime = state.clock.elapsedTime;
    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;
    const isPlaying = useAnimationStore.getState().isPlaying;
    if (isPlaying) {
      animationTimeRef.current += deltaTime;
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;

      // Get rotations from store
      // Use version to detect changes cheaply
      const { rotations, version: rotationVersion } = useRotationStore.getState();

      // ============================================
      // Adaptive Quality: Detect rotation animation
      // ============================================
      const rotationsChanged = rotationVersion !== prevVersionRef.current;

      if (rotationsChanged) {
        // Rotation is happening - switch to fast mode
        fastModeRef.current = true;
        prevVersionRef.current = rotationVersion;

        // Clear any pending quality restore timeout
        if (restoreQualityTimeoutRef.current) {
          clearTimeout(restoreQualityTimeoutRef.current);
          restoreQualityTimeoutRef.current = null;
        }
      } else if (fastModeRef.current) {
        // Rotation stopped - schedule quality restore after delay
        if (!restoreQualityTimeoutRef.current) {
          restoreQualityTimeoutRef.current = setTimeout(() => {
            fastModeRef.current = false;
            restoreQualityTimeoutRef.current = null;
          }, QUALITY_RESTORE_DELAY_MS);
        }
      }

      // Update fast mode uniform
      // Only enable fast mode if fractalAnimationLowQuality is enabled in performance settings
      if (material.uniforms.uFastMode) {
        const fractalAnimLowQuality = usePerformanceStore.getState().fractalAnimationLowQuality;
        material.uniforms.uFastMode.value = fractalAnimLowQuality && fastModeRef.current;
      }

      // Get progressive refinement quality multiplier from performance store
      // Used for raymarching quality and to compute effective quality for other effects
      const qualityMultiplier = usePerformanceStore.getState().qualityMultiplier;
      if (material.uniforms.uQualityMultiplier) {
        material.uniforms.uQualityMultiplier.value = qualityMultiplier;
      }

      // Update time and resolution
      if (material.uniforms.uTime) material.uniforms.uTime.value = state.clock.elapsedTime;
      if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(size.width, size.height);
      if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(camera.position);

      // Update dimension
      if (material.uniforms.uDimension) material.uniforms.uDimension.value = dimension;

      // Update Mandelbulb parameters (conditionally)
      if (material.uniforms.uIterations && prevIterationsRef.current !== maxIterations) {
        material.uniforms.uIterations.value = maxIterations;
        prevIterationsRef.current = maxIterations;
      }
      if (material.uniforms.uEscapeRadius && prevEscapeRadiusRef.current !== escapeRadius) {
        material.uniforms.uEscapeRadius.value = escapeRadius;
        prevEscapeRadiusRef.current = escapeRadius;
      }

      // Power: either animated or static
      // When animated, directly set uPower (same as manually moving the slider)
      if (material.uniforms.uPower) {
        if (powerAnimationEnabled) {
          // Use raw clock time directly (convert ms to seconds)
          // powerSpeed 0.03 = one full cycle (back and forth) every ~33 seconds
          const timeInSeconds = state.clock.elapsedTime / 1000;

          // Sine wave oscillation - naturally eases at the peaks and troughs
          // This creates smooth back-and-forth motion without any jump cuts
          const t = timeInSeconds * powerSpeed * 2 * Math.PI;
          const normalized = (Math.sin(t) + 1) / 2; // Maps [-1, 1] to [0, 1]

          const targetPower = powerMin + normalized * (powerMax - powerMin);
          material.uniforms.uPower.value = targetPower;
          prevPowerRef.current = targetPower;
        } else {
          if (prevPowerRef.current !== mandelbulbPower) {
            material.uniforms.uPower.value = mandelbulbPower;
            prevPowerRef.current = mandelbulbPower;
          }
        }
      }

      // Disable the separate animation uniform system (not needed anymore)
      if (material.uniforms.uPowerAnimationEnabled) {
        material.uniforms.uPowerAnimationEnabled.value = false;
      }

      // Alternate Power (Technique B): blend between primary and alternate powers
      if (material.uniforms.uAlternatePowerEnabled) {
        material.uniforms.uAlternatePowerEnabled.value = alternatePowerEnabled;
      }
      if (material.uniforms.uAlternatePowerValue) {
        material.uniforms.uAlternatePowerValue.value = alternatePowerValue;
      }
      if (material.uniforms.uAlternatePowerBlend) {
        material.uniforms.uAlternatePowerBlend.value = alternatePowerBlend;
      }

      // Dimension Mixing (Technique A): update uniforms for shader-side mixing matrix
      if (material.uniforms.uDimensionMixEnabled) {
        material.uniforms.uDimensionMixEnabled.value = dimensionMixEnabled;
      }
      if (material.uniforms.uMixIntensity) {
        material.uniforms.uMixIntensity.value = mixIntensity;
      }
      if (material.uniforms.uMixTime) {
        // Mix time advances based on animation time and frequency
        // The shader will use this to compute sin/cos values for the mixing matrix
        material.uniforms.uMixTime.value = animationTimeRef.current * mixFrequency * 2 * Math.PI;
      }

      // Update color and palette (cached linear conversion - only converts when color changes)
      const cache = colorCacheRef.current;
      if (material.uniforms.uColor) {
        updateLinearColorUniform(cache.faceColor, material.uniforms.uColor.value as THREE.Color, faceColor);
      }

      // Update camera matrices
      if (material.uniforms.uProjectionMatrix) material.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
      if (material.uniforms.uViewMatrix) material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);

      // Update orthographic projection uniforms
      const projectionType = useProjectionStore.getState().type;
      if (material.uniforms.uOrthographic) {
        material.uniforms.uOrthographic.value = projectionType === 'orthographic';
      }
      if (material.uniforms.uOrthoRayDir) {
        // Get camera's forward direction (negative Z in camera space, transformed to world space)
        const orthoDir = material.uniforms.uOrthoRayDir.value as THREE.Vector3;
        camera.getWorldDirection(orthoDir);
      }
      if (material.uniforms.uInverseViewProjectionMatrix) {
        // Compute inverse view-projection matrix for unprojecting screen coords to world space
        // inverseVP = inverse(projection * view) = inverse(view) * inverse(projection)
        // inverse(view) = camera.matrixWorld, inverse(projection) = camera.projectionMatrixInverse
        const invVP = material.uniforms.uInverseViewProjectionMatrix.value as THREE.Matrix4;
        invVP.copy(camera.projectionMatrixInverse).premultiply(camera.matrixWorld);
      }

      // Update temporal reprojection uniforms from manager
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
      // Note: uCameraNear and uCameraFar are no longer needed - temporal buffer now stores
      // unnormalized ray distances directly (world-space units)

      // Update multi-light uniforms (with cached color conversion and version check)
      const currentLightingVersion = useLightingStore.getState().version;
      if (prevLightingVersionRef.current !== currentLightingVersion) {
        updateLightUniforms(material.uniforms as unknown as LightUniforms, lights, lightColorCacheRef.current);
        prevLightingVersionRef.current = currentLightingVersion;
      }

      // Update global lighting uniforms (cached linear conversion)
      if (material.uniforms.uAmbientIntensity) material.uniforms.uAmbientIntensity.value = ambientIntensity;
      if (material.uniforms.uAmbientColor) {
        updateLinearColorUniform(cache.ambientColor, material.uniforms.uAmbientColor.value as THREE.Color, ambientColor);
      }
      if (material.uniforms.uSpecularIntensity) material.uniforms.uSpecularIntensity.value = specularIntensity;
      if (material.uniforms.uSpecularPower) material.uniforms.uSpecularPower.value = shininess;
      // Enhanced lighting uniforms
      if (material.uniforms.uSpecularColor) {
        updateLinearColorUniform(cache.specularColor, material.uniforms.uSpecularColor.value as THREE.Color, specularColor);
      }
      if (material.uniforms.uDiffuseIntensity) material.uniforms.uDiffuseIntensity.value = diffuseIntensity;
      
      // Advanced Rendering (Global Visuals)
      const visuals = useAppearanceStore.getState();
      if (material.uniforms.uRoughness) material.uniforms.uRoughness.value = visuals.roughness;
      if (material.uniforms.uSssEnabled) material.uniforms.uSssEnabled.value = visuals.sssEnabled;
      if (material.uniforms.uSssIntensity) material.uniforms.uSssIntensity.value = visuals.sssIntensity;
      if (material.uniforms.uSssColor) {
          updateLinearColorUniform(cache.faceColor /* reuse helper */, material.uniforms.uSssColor.value as THREE.Color, visuals.sssColor || '#ff8844');
      }
      if (material.uniforms.uSssThickness) material.uniforms.uSssThickness.value = visuals.sssThickness;
      
      // Atmosphere (Global Visuals)
      if (material.uniforms.uFogEnabled) material.uniforms.uFogEnabled.value = visuals.fogIntegrationEnabled;
      if (material.uniforms.uFogContribution) material.uniforms.uFogContribution.value = visuals.fogContribution;
      if (material.uniforms.uInternalFogDensity) material.uniforms.uInternalFogDensity.value = visuals.internalFogDensity;
      
      // LOD (Global Visuals)
      if (visuals.lodEnabled && material.uniforms.uQualityMultiplier) {
          // Distance-based LOD
          // Reduce quality (increase epsilon) when far away
          const distance = camera.position.length();
          // Heuristic: scale quality multiplier down as distance increases
          // Base multiplier from performance store
          const perfQuality = usePerformanceStore.getState().qualityMultiplier;
          
          // LOD factor: 1.0 near, 0.25 far
          // distance 2 -> 1.0
          // distance 10 -> 0.25
          const lodFactor = THREE.MathUtils.clamp(1.0 - (distance - 2.0) / 8.0 * 0.75, 0.25, 1.0);
          
          material.uniforms.uQualityMultiplier.value = perfQuality * lodFactor * (visuals.lodDetail ?? 1.0);
      }

      // Fresnel rim lighting (controlled by Edges render mode, cached linear conversion)
      if (material.uniforms.uFresnelEnabled) material.uniforms.uFresnelEnabled.value = edgesVisible;
      if (material.uniforms.uFresnelIntensity) material.uniforms.uFresnelIntensity.value = fresnelIntensity;
      if (material.uniforms.uRimColor) {
        updateLinearColorUniform(cache.rimColor, material.uniforms.uRimColor.value as THREE.Color, edgeColor);
      }

      // Advanced Color System uniforms
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

      // Opacity Mode System uniforms
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
        // Progressive refinement: scale volumetric quality from low → user's target
        const effectiveSampleQuality = getEffectiveSampleQuality(
          opacitySettings.sampleQuality,
          qualityMultiplier
        );
        material.uniforms.uSampleQuality.value = SAMPLE_QUALITY_TO_INT[effectiveSampleQuality];
      }
      if (material.uniforms.uVolumetricReduceOnAnim) {
        material.uniforms.uVolumetricReduceOnAnim.value = opacitySettings.volumetricAnimationQuality === 'reduce';
      }

      // Shadow System uniforms
      if (material.uniforms.uShadowEnabled) {
        material.uniforms.uShadowEnabled.value = shadowEnabled;
      }
      if (material.uniforms.uShadowQuality) {
        // Progressive refinement: scale shadow quality from low → user's target
        const effectiveShadowQuality = getEffectiveShadowQuality(
          shadowQuality,
          qualityMultiplier
        );
        material.uniforms.uShadowQuality.value = SHADOW_QUALITY_TO_INT[effectiveShadowQuality];
      }
      if (material.uniforms.uShadowSoftness) {
        material.uniforms.uShadowSoftness.value = shadowSoftness;
      }
      if (material.uniforms.uShadowAnimationMode) {
        material.uniforms.uShadowAnimationMode.value = SHADOW_ANIMATION_MODE_TO_INT[shadowAnimationMode];
      }

      // Configure material transparency based on opacity mode
      const isTransparent = opacitySettings.mode !== 'solid';
      if (material.transparent !== isTransparent) {
        material.transparent = isTransparent;
        material.depthWrite = !isTransparent;
        material.needsUpdate = true;
      }

      // ============================================
      // Optimized D-dimensional Rotation & Basis Vectors
      // Only recompute when rotations, dimension, or params change
      // ============================================
      const D = dimension;
      const work = workingArraysRef.current;

      // Check if parameterValues changed (shallow array comparison)
      const paramsChanged = !prevParamValuesRef.current ||
        prevParamValuesRef.current.length !== parameterValues.length ||
        parameterValues.some((v, i) => prevParamValuesRef.current![i] !== v);

      // Determine if we need to recompute basis vectors
      const needsRecompute = rotationsChanged ||
        dimension !== prevDimensionRef.current ||
        paramsChanged ||
        basisVectorsDirtyRef.current;

      if (needsRecompute) {
        // Compute rotation matrix only when needed
        cachedRotationMatrixRef.current = composeRotations(dimension, rotations);

        // Prepare unit vectors in pre-allocated arrays (no allocation)
        // Clear and set up unitX = [1, 0, 0, ...]
        for (let i = 0; i < MAX_DIMENSION; i++) work.unitX[i] = 0;
        work.unitX[0] = 1;

        // Clear and set up unitY = [0, 1, 0, ...]
        for (let i = 0; i < MAX_DIMENSION; i++) work.unitY[i] = 0;
        work.unitY[1] = 1;

        // Clear and set up unitZ = [0, 0, 1, ...]
        for (let i = 0; i < MAX_DIMENSION; i++) work.unitZ[i] = 0;
        work.unitZ[2] = 1;

        // Apply rotation to basis vectors using pre-allocated output arrays
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitX, work.rotatedX, dimension);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitY, work.rotatedY, dimension);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitZ, work.rotatedZ, dimension);

        // Update basis vector uniforms
        if (material.uniforms.uBasisX) {
          const arr = material.uniforms.uBasisX.value as Float32Array;
          arr.set(work.rotatedX);
        }
        if (material.uniforms.uBasisY) {
          const arr = material.uniforms.uBasisY.value as Float32Array;
          arr.set(work.rotatedY);
        }
        if (material.uniforms.uBasisZ) {
          const arr = material.uniforms.uBasisZ.value as Float32Array;
          arr.set(work.rotatedZ);
        }

        // Update tracking refs
        prevDimensionRef.current = dimension;
        prevParamValuesRef.current = [...parameterValues];
        basisVectorsDirtyRef.current = false;
      }

      // ============================================
      // Origin Update (separate from basis vectors)
      // Must update every frame when origin drift or slice animation is enabled
      // ============================================
      const needsOriginUpdate = needsRecompute || originDriftEnabled || sliceAnimationEnabled;

      if (needsOriginUpdate && cachedRotationMatrixRef.current) {
        // Clear and set up origin = [0, 0, 0, slice[0], slice[1], ...]
        for (let i = 0; i < MAX_DIMENSION; i++) work.origin[i] = 0;

        // Apply origin drift if enabled (Technique C)
        if (originDriftEnabled && D > 3) {
          const driftConfig: OriginDriftConfig = {
            enabled: true,
            amplitude: driftAmplitude,
            baseFrequency: driftBaseFrequency,
            frequencySpread: driftFrequencySpread,
          };
          // Get animation speed from store for consistent drift timing
          const animationSpeed = useAnimationStore.getState().speed;
          const driftedOrigin = computeDriftedOrigin(
            parameterValues,
            animationTimeRef.current,
            driftConfig,
            animationSpeed,
            animationBias
          );
          // Set drifted values for extra dimensions
          for (let i = 3; i < D; i++) {
            work.origin[i] = driftedOrigin[i - 3] ?? 0;
          }
        } else if (sliceAnimationEnabled && D > 3) {
          // Slice Animation: animate through higher-dimensional cross-sections
          // Use sine waves with golden ratio phase offsets for organic motion
          const PHI = 1.618033988749895; // Golden ratio
          const timeInSeconds = state.clock.elapsedTime / 1000;

          for (let i = 3; i < D; i++) {
            const extraDimIndex = i - 3;
            // Each dimension gets a unique phase offset based on golden ratio
            const phase = extraDimIndex * PHI;
            // Multi-frequency sine for more interesting motion
            const t1 = timeInSeconds * sliceSpeed * 2 * Math.PI + phase;
            const t2 = timeInSeconds * sliceSpeed * 1.3 * 2 * Math.PI + phase * 1.5;
            // Blend two frequencies for non-repetitive motion
            const offset = sliceAmplitude * (0.7 * Math.sin(t1) + 0.3 * Math.sin(t2));
            work.origin[i] = (parameterValues[extraDimIndex] ?? 0) + offset;
          }
        } else {
          // No drift or slice animation - use static parameter values
          for (let i = 3; i < D; i++) {
            work.origin[i] = parameterValues[i - 3] ?? 0;
          }
        }

        // Apply rotation to origin
        applyRotationInPlace(cachedRotationMatrixRef.current, work.origin, work.rotatedOrigin, dimension);

        // Update origin uniform
        if (material.uniforms.uOrigin) {
          const arr = material.uniforms.uOrigin.value as Float32Array;
          arr.set(work.rotatedOrigin);
        }
      }

      // ============================================
      // Phase Shift Animation
      // Add time-varying phase offsets to spherical angles
      // ============================================
      if (material.uniforms.uPhaseEnabled) {
        material.uniforms.uPhaseEnabled.value = phaseShiftEnabled;
      }
      if (phaseShiftEnabled) {
        const timeInSeconds = state.clock.elapsedTime / 1000;
        const t = timeInSeconds * phaseSpeed * 2 * Math.PI;
        // Theta and phi use different frequencies for more organic twisting
        if (material.uniforms.uPhaseTheta) {
          material.uniforms.uPhaseTheta.value = phaseAmplitude * Math.sin(t);
        }
        if (material.uniforms.uPhasePhi) {
          material.uniforms.uPhasePhi.value = phaseAmplitude * Math.sin(t * 1.618); // Golden ratio frequency offset
        }
      } else {
        if (material.uniforms.uPhaseTheta) material.uniforms.uPhaseTheta.value = 0;
        if (material.uniforms.uPhasePhi) material.uniforms.uPhasePhi.value = 0;
      }

      // ============================================
      // Zoom Animation & Autopilot
      // ============================================
      if (material.uniforms.uZoomEnabled) {
        material.uniforms.uZoomEnabled.value = zoomEnabled;
      }

      if (zoomEnabled) {
        // Initialize logZoom from current zoom level if needed
        if (Math.abs(Math.log(zoom) - logZoomRef.current) > 0.001) {
          logZoomRef.current = Math.log(zoom);
        }

        // Animate zoom if enabled and playing
        if (zoomAnimationEnabled && isPlaying) {
          if (zoomAnimationMode === 'continuous') {
            // Continuous zoom: increase zoom indefinitely
            logZoomRef.current += zoomSpeed * deltaTime * zoomSpeedMultiplierRef.current;
          } else if (zoomAnimationMode === 'target') {
            // Target mode: ease toward target level
            const targetLog = Math.log(zoomTargetLevel);
            const diff = targetLog - logZoomRef.current;
            if (Math.abs(diff) > 0.001) {
              logZoomRef.current += diff * zoomSpeed * deltaTime * zoomSpeedMultiplierRef.current;
            }
          }

          // Update store with new zoom value (will be clamped by setter)
          const newZoom = Math.exp(logZoomRef.current);
          useExtendedObjectStore.getState().setMandelbulbZoom(newZoom);
        }

        // Update zoom uniform
        if (material.uniforms.uZoom && prevZoomRef.current !== zoom) {
          material.uniforms.uZoom.value = zoom;
          prevZoomRef.current = zoom;
        }

        // Autopilot: create/update/run if enabled
        if (autopilotEnabled && zoomAnimationEnabled) {
          // Create autopilot if needed or update config
          if (!zoomAutopilotRef.current) {
            const config: AutopilotConfig = {
              strategy: autopilotStrategy,
              centerRayLock: {
                probeSize: centerRayProbeSize,
                probeFrequency: centerRayProbeFrequency,
                missThreshold: centerRayMissThreshold,
                nudgeStrength: centerRayNudgeStrength,
              },
              interestScore: {
                resolution: interestScoreResolution,
                interval: interestScoreInterval,
                candidates: interestScoreCandidates,
                nudgeRadius: interestScoreNudgeRadius,
                metric: interestScoreMetric,
              },
              boundaryTarget: {
                escapeRatio: boundaryTargetEscapeRatio,
                band: boundaryTargetBand,
                correctionStrength: boundaryTargetCorrectionStrength,
              },
            };
            zoomAutopilotRef.current = new ZoomAutopilot(config);
          }

          // Run autopilot update
          const gl = state.gl;
          const scene = state.scene;
          const result = zoomAutopilotRef.current.update(
            gl,
            scene,
            camera,
            work.rotatedOrigin,
            dimension
          );

          // Apply autopilot results
          zoomSpeedMultiplierRef.current = result.zoomSpeedMultiplier;

          // Apply D-dimensional origin nudge to track interesting fractal regions
          // CRITICAL: Must nudge ALL dimensions (0,1,2 control zoom target in 3D fractal space)
          if (result.originNudge.length > 0) {
            for (let i = 0; i < dimension; i++) {
              const nudge = result.originNudge[i] ?? 0;
              if (nudge !== 0) {
                const currentValue = work.origin[i] ?? 0;
                work.origin[i] = currentValue + nudge;
              }
            }
            // Re-apply rotation to updated origin
            if (cachedRotationMatrixRef.current) {
              applyRotationInPlace(cachedRotationMatrixRef.current, work.origin, work.rotatedOrigin, dimension);
              if (material.uniforms.uOrigin) {
                const arr = material.uniforms.uOrigin.value as Float32Array;
                arr.set(work.rotatedOrigin);
              }
            }
          }
        } else {
          // Reset speed multiplier when autopilot disabled
          zoomSpeedMultiplierRef.current = 1.0;
        }
      } else {
        // Zoom disabled - reset uniforms
        if (material.uniforms.uZoom && prevZoomRef.current !== 1.0) {
          material.uniforms.uZoom.value = 1.0;
          prevZoomRef.current = 1.0;
        }
        // Reset zoom state
        logZoomRef.current = 0;
        zoomSpeedMultiplierRef.current = 1.0;
        // Dispose autopilot when zoom disabled
        if (zoomAutopilotRef.current) {
          zoomAutopilotRef.current.dispose();
          zoomAutopilotRef.current = null;
        }
      }

      // Model matrices are always identity for Mandelbulb - no need to set every frame
      // (they are already identity from useMemo initialization)
    }
  });

  // Generate unique key to force material recreation when shader changes or context is restored
  const materialKey = `mandelbulb-material-${shaderString.length}-${features.join(',')}-${restoreCount}`;

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

export default MandelbulbMesh;
