import { createColorCache, createLightColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache';
import { computeDriftedOrigin, type OriginDriftConfig } from '@/lib/animation/originDrift';
import { createLightUniforms, updateLightUniforms, type LightUniforms } from '@/rendering/lights/uniforms';
import { composeRotations } from '@/lib/math/rotation';
import type { MatrixND } from '@/lib/math/types';
import { OPACITY_MODE_TO_INT, SAMPLE_QUALITY_TO_INT } from '@/rendering/opacity/types';
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette';
import { SHADOW_QUALITY_TO_INT, SHADOW_ANIMATION_MODE_TO_INT } from '@/rendering/shadows/types';
import { RENDER_LAYERS } from '@/rendering/core/layers';
import { TemporalDepthManager } from '@/rendering/core/TemporalDepthManager';
import { createTemporalDepthUniforms } from '@/hooks';
import { useAnimationStore } from '@/stores/animationStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import {
  getEffectiveSampleQuality,
  getEffectiveShadowQuality,
  usePerformanceStore,
} from '@/stores/performanceStore';
import type { RotationState } from '@/stores/rotationStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useUIStore } from '@/stores/uiStore';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import fragmentShader from './hyperbulb.frag?raw';
import vertexShader from './hyperbulb.vert?raw';

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
 */
function applyRotationInPlace(matrix: MatrixND, vec: number[], out: Float32Array): void {
  const D = matrix.length;
  // Clear output first (for dimensions beyond D)
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
 * HyperbulbMesh - Renders 4D-11D Hyperbulb fractals using GPU raymarching
 *
 * Supports full D-dimensional rotation through all rotation planes (XY, XZ, YZ, XW, YW, ZW, etc.)
 * The 3D slice plane is rotated through D-dimensional space using rotated basis vectors.
 * @returns Three.js mesh with raymarching shader
 */
const HyperbulbMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();

  // Performance optimization: track rotation changes for adaptive quality
  const prevRotationsRef = useRef<RotationState['rotations'] | null>(null);
  const fastModeRef = useRef(false);
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-allocated working arrays to avoid per-frame allocations
  const workingArraysRef = useRef<WorkingArrays>(createWorkingArrays());

  // Cached rotation matrix and basis vectors - only recomputed when rotations/dimension/params change
  const cachedRotationMatrixRef = useRef<MatrixND | null>(null);
  const prevDimensionRef = useRef<number | null>(null);
  const prevParamValuesRef = useRef<number[] | null>(null);
  const basisVectorsDirtyRef = useRef(true);

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

  // Get dimension from geometry store
  const dimension = useGeometryStore((state) => state.dimension);

  // Get Mandelbrot/Hyperbulb config from store
  const mandelbulbPower = useExtendedObjectStore((state) => state.mandelbrot.mandelbulbPower);
  const maxIterations = useExtendedObjectStore((state) => state.mandelbrot.maxIterations);
  const escapeRadius = useExtendedObjectStore((state) => state.mandelbrot.escapeRadius);
  const parameterValues = useExtendedObjectStore((state) => state.mandelbrot.parameterValues);

  // Power animation parameters (organic multi-frequency motion)
  const powerAnimationEnabled = useExtendedObjectStore((state) => state.mandelbrot.powerAnimationEnabled);
  const powerMin = useExtendedObjectStore((state) => state.mandelbrot.powerMin);
  const powerMax = useExtendedObjectStore((state) => state.mandelbrot.powerMax);
  const powerSpeed = useExtendedObjectStore((state) => state.mandelbrot.powerSpeed);

  // Alternate power parameters (Technique B - blend between two powers)
  const alternatePowerEnabled = useExtendedObjectStore((state) => state.mandelbrot.alternatePowerEnabled);
  const alternatePowerValue = useExtendedObjectStore((state) => state.mandelbrot.alternatePowerValue);
  const alternatePowerBlend = useExtendedObjectStore((state) => state.mandelbrot.alternatePowerBlend);

  // Origin drift parameters (Technique C - animate slice origin in extra dims)
  const originDriftEnabled = useExtendedObjectStore((state) => state.mandelbrot.originDriftEnabled);
  const driftAmplitude = useExtendedObjectStore((state) => state.mandelbrot.driftAmplitude);
  const driftBaseFrequency = useExtendedObjectStore((state) => state.mandelbrot.driftBaseFrequency);
  const driftFrequencySpread = useExtendedObjectStore((state) => state.mandelbrot.driftFrequencySpread);

  // Dimension mixing parameters (Technique A - shear matrix inside iteration)
  const dimensionMixEnabled = useExtendedObjectStore((state) => state.mandelbrot.dimensionMixEnabled);
  const mixIntensity = useExtendedObjectStore((state) => state.mandelbrot.mixIntensity);
  const mixFrequency = useExtendedObjectStore((state) => state.mandelbrot.mixFrequency);

  // Slice Animation parameters (4D+ only - fly through higher-dimensional cross-sections)
  const sliceAnimationEnabled = useExtendedObjectStore((state) => state.mandelbrot.sliceAnimationEnabled);
  const sliceSpeed = useExtendedObjectStore((state) => state.mandelbrot.sliceSpeed);
  const sliceAmplitude = useExtendedObjectStore((state) => state.mandelbrot.sliceAmplitude);

  // Julia Morphing parameters (animate Julia constant)
  const juliaModeEnabled = useExtendedObjectStore((state) => state.mandelbrot.juliaModeEnabled);
  const juliaOrbitSpeed = useExtendedObjectStore((state) => state.mandelbrot.juliaOrbitSpeed);
  const juliaOrbitRadius = useExtendedObjectStore((state) => state.mandelbrot.juliaOrbitRadius);

  // Phase Shift parameters (angular twisting)
  const phaseShiftEnabled = useExtendedObjectStore((state) => state.mandelbrot.phaseShiftEnabled);
  const phaseSpeed = useExtendedObjectStore((state) => state.mandelbrot.phaseSpeed);
  const phaseAmplitude = useExtendedObjectStore((state) => state.mandelbrot.phaseAmplitude);

  // Animation bias for per-dimension variation
  const animationBias = useUIStore((state) => state.animationBias);

  // Animation time tracking - only advances when isPlaying is true
  const animationTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastPowerRef = useRef(8.0); // Track last power to avoid micro-updates

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


  // Edges render mode controls fresnel rim lighting for Hyperbulb
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

      // Hyperbulb parameters
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

      // Julia Morphing uniforms
      uJuliaEnabled: { value: false },
      uJuliaC: { value: new Float32Array(11) },  // Animated Julia constant

      // Phase Shift uniforms (angular twisting)
      uPhaseEnabled: { value: false },
      uPhaseTheta: { value: 0.0 },  // Phase offset for theta angle
      uPhasePhi: { value: 0.0 },    // Phase offset for phi angle

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
      ...createTemporalDepthUniforms(),
    }),
    []
  );

  /**
   * Check if rotations have changed by comparing current vs previous state.
   * Returns true if any rotation angle has changed, or if this is the first comparison.
   */
  const hasRotationsChanged = useCallback((
    current: RotationState['rotations'],
    previous: RotationState['rotations'] | null
  ): boolean => {
    // First frame or no previous state - consider it a change to ensure initial computation
    if (!previous) return true;

    // Check if sizes differ
    if (current.size !== previous.size) return true;

    // Compare all rotation planes using Map methods
    for (const [key, value] of current.entries()) {
      if (previous.get(key) !== value) {
        return true;
      }
    }
    return false;
  }, []);

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

      // Get rotations from store first (needed for rotation change detection)
      const rotations = useRotationStore.getState().rotations;

      // ============================================
      // Adaptive Quality: Detect rotation animation
      // ============================================
      const rotationsChanged = hasRotationsChanged(rotations, prevRotationsRef.current);

      if (rotationsChanged) {
        // Rotation is happening - switch to fast mode
        fastModeRef.current = true;

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

      // Store current rotations for next frame comparison only when changed
      // (avoids creating garbage every frame)
      if (rotationsChanged || !prevRotationsRef.current) {
        prevRotationsRef.current = new Map(rotations);
      }

      // Update fast mode uniform
      if (material.uniforms.uFastMode) {
        material.uniforms.uFastMode.value = fastModeRef.current;
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

      // Update Hyperbulb parameters
      if (material.uniforms.uIterations) material.uniforms.uIterations.value = maxIterations;
      if (material.uniforms.uEscapeRadius) material.uniforms.uEscapeRadius.value = escapeRadius;

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
        } else {
          material.uniforms.uPower.value = mandelbulbPower;
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
      if (material.uniforms.uCameraNear) {
        material.uniforms.uCameraNear.value = temporalUniforms.uNearClip;
      }
      if (material.uniforms.uCameraFar) {
        material.uniforms.uCameraFar.value = temporalUniforms.uFarClip;
      }

      // Update multi-light uniforms (with cached color conversion)
      updateLightUniforms(material.uniforms as unknown as LightUniforms, lights, lightColorCacheRef.current);

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
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitX, work.rotatedX);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitY, work.rotatedY);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitZ, work.rotatedZ);

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
        applyRotationInPlace(cachedRotationMatrixRef.current, work.origin, work.rotatedOrigin);

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
      // Julia Morphing Animation
      // Animate the Julia constant in a circular orbit
      // ============================================
      if (material.uniforms.uJuliaEnabled) {
        material.uniforms.uJuliaEnabled.value = juliaModeEnabled;
      }
      if (juliaModeEnabled && material.uniforms.uJuliaC) {
        const timeInSeconds = state.clock.elapsedTime / 1000;
        const t = timeInSeconds * juliaOrbitSpeed * 2 * Math.PI;
        const juliaC = material.uniforms.uJuliaC.value as Float32Array;

        // Julia constant orbits in a hypersphere
        // First 4 components form primary orbit, rest use golden ratio phases
        const PHI = 1.618033988749895;
        juliaC[0] = juliaOrbitRadius * Math.cos(t);           // x
        juliaC[1] = juliaOrbitRadius * Math.sin(t);           // y
        juliaC[2] = juliaOrbitRadius * 0.5 * Math.sin(t * PHI); // z - secondary frequency
        juliaC[3] = juliaOrbitRadius * 0.3 * Math.cos(t * PHI * 0.7); // w - tertiary

        // Higher dimensions use smaller amplitudes with golden ratio phase offsets
        for (let i = 4; i < D; i++) {
          const phase = i * PHI;
          const amplitude = juliaOrbitRadius * (0.2 / (i - 2)); // Decreasing amplitude
          juliaC[i] = amplitude * Math.sin(t * (1 + 0.1 * i) + phase);
        }
        // Zero out unused dimensions
        for (let i = D; i < MAX_DIMENSION; i++) {
          juliaC[i] = 0;
        }
      }

      // Model matrices are always identity for Hyperbulb - no need to set every frame
      // (they are already identity from useMemo initialization)
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[4, 4, 4]} />
      <shaderMaterial
        glslVersion={THREE.GLSL3}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default HyperbulbMesh;
