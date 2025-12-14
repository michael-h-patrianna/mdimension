import { composeRotations } from '@/lib/math/rotation';
import type { MatrixND } from '@/lib/math/types';
import { createLightUniforms, updateLightUniforms } from '@/lib/lights/uniforms';
import type { LightUniforms } from '@/lib/lights/uniforms';
import { COLOR_ALGORITHM_TO_INT } from '@/lib/shaders/palette';
import { useAnimationStore } from '@/stores/animationStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import type { RotationState } from '@/stores/rotationStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useVisualStore } from '@/stores/visualStore';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import fragmentShader from './mandelbox.frag?raw';
import vertexShader from './mandelbox.vert?raw';

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
 * Golden ratio for creating maximally-spaced, non-repeating patterns.
 */
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

/**
 * Phase offset to ensure dimension 0 doesn't start at sin(0) = 0.
 */
const PHASE_OFFSET = Math.PI / 4;

/**
 * Maximum deviation for fold limits at full bias.
 * More conservative than rotation bias to avoid breaking the fractal math.
 * At bias=1: fold limits range from (1-0.3)*base to (1+0.3)*base = 0.7 to 1.3
 */
const FOLD_MAX_DEVIATION = 0.3;

/**
 * Base frequency for scale animation oscillation.
 */
const SCALE_BASE_FREQUENCY = 0.5;

/**
 * Computes per-dimension fold limit multipliers based on animation bias.
 * Uses golden ratio spread to create non-repeating patterns across dimensions.
 *
 * @param dimension - Current dimension (3-11)
 * @param bias - Animation bias (0 = uniform, 1 = maximum variation)
 * @param baseFold - Base folding limit value
 * @returns Float32Array of fold limits per dimension
 */
function computeBiasedFoldLimits(dimension: number, bias: number, baseFold: number): Float32Array {
  const result = new Float32Array(11);

  for (let i = 0; i < 11; i++) {
    if (i >= dimension) {
      // Unused dimensions get base value
      result[i] = baseFold;
      continue;
    }

    if (i < 3 || bias === 0) {
      // First 3 dimensions (X, Y, Z) always use base fold to preserve 3D structure
      // Also skip if no bias
      result[i] = baseFold;
    } else {
      // Higher dimensions get biased fold limits
      // Use golden ratio spread for non-repeating pattern
      const dimIndex = i - 3; // 0-based index for dimensions 4+
      const goldenAngle = PHASE_OFFSET + dimIndex * GOLDEN_RATIO * 2 * Math.PI;
      const spread = Math.sin(goldenAngle); // Value in [-1, 1]

      // Calculate multiplier: at bias=0, mult=1; at bias=1, mult ranges 0.7-1.3
      const multiplier = 1 + bias * spread * FOLD_MAX_DEVIATION;

      // Safety clamp to avoid extreme values
      const clampedMult = Math.max(0.5, Math.min(1.5, multiplier));
      result[i] = baseFold * clampedMult;
    }
  }

  return result;
}

/**
 * Computes Julia mode c constant for each dimension using golden ratio spread.
 * Creates smooth, non-repeating orbits across all dimensions.
 *
 * @param dimension - Current dimension (3-11)
 * @param time - Current animation time (seconds)
 * @param speed - Animation speed multiplier
 * @param radius - Amplitude of the orbit
 * @returns Float32Array of c values per dimension
 */
function computeJuliaC(dimension: number, time: number, speed: number, radius: number): Float32Array {
  const result = new Float32Array(11);
  const baseTime = time * speed * 0.3;
  for (let i = 0; i < dimension && i < 11; i++) {
    const goldenAngle = PHASE_OFFSET + i * GOLDEN_RATIO * 2 * Math.PI;
    result[i] = radius * Math.sin(baseTime + goldenAngle);
  }
  return result;
}

/**
 * MandelboxMesh - Renders 3D-11D Mandelbox fractals using GPU raymarching
 *
 * The Mandelbox uses box fold + sphere fold operations that work identically
 * across all dimensions, unlike the Hyperbulb which uses dimension-specific
 * hyperspherical coordinates.
 * @returns Three.js mesh with raymarching shader
 */
const MandelboxMesh = () => {
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

  // Animation time tracking - only advances when isPlaying is true
  const animationTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (restoreQualityTimeoutRef.current) {
        clearTimeout(restoreQualityTimeoutRef.current);
        restoreQualityTimeoutRef.current = null;
      }
    };
  }, []);

  // Get dimension from geometry store
  const dimension = useGeometryStore((state) => state.dimension);

  // Get Mandelbox config from store
  const scale = useExtendedObjectStore((state) => state.mandelbox.scale);
  const foldingLimit = useExtendedObjectStore((state) => state.mandelbox.foldingLimit);
  const minRadius = useExtendedObjectStore((state) => state.mandelbox.minRadius);
  const fixedRadius = useExtendedObjectStore((state) => state.mandelbox.fixedRadius);
  const maxIterations = useExtendedObjectStore((state) => state.mandelbox.maxIterations);
  const escapeRadius = useExtendedObjectStore((state) => state.mandelbox.escapeRadius);
  const iterationRotation = useExtendedObjectStore((state) => state.mandelbox.iterationRotation);
  const parameterValues = useExtendedObjectStore((state) => state.mandelbox.parameterValues);

  // Scale animation parameters
  const scaleAnimationEnabled = useExtendedObjectStore((state) => state.mandelbox.scaleAnimationEnabled);
  const scaleCenter = useExtendedObjectStore((state) => state.mandelbox.scaleCenter);
  const scaleAmplitude = useExtendedObjectStore((state) => state.mandelbox.scaleAmplitude);
  const scaleSpeed = useExtendedObjectStore((state) => state.mandelbox.scaleSpeed);

  // Julia mode parameters
  const juliaMode = useExtendedObjectStore((state) => state.mandelbox.juliaMode);
  const juliaSpeed = useExtendedObjectStore((state) => state.mandelbox.juliaSpeed);
  const juliaRadius = useExtendedObjectStore((state) => state.mandelbox.juliaRadius);

  // Animation playback state - controls whether scale/julia animations run
  const isPlaying = useAnimationStore((state) => state.isPlaying);

  // Get color state from visual store
  const faceColor = useVisualStore((state) => state.faceColor);

  // Advanced color system state
  const colorAlgorithm = useVisualStore((state) => state.colorAlgorithm);
  const cosineCoefficients = useVisualStore((state) => state.cosineCoefficients);
  const distribution = useVisualStore((state) => state.distribution);
  const lchLightness = useVisualStore((state) => state.lchLightness);
  const lchChroma = useVisualStore((state) => state.lchChroma);
  const multiSourceWeights = useVisualStore((state) => state.multiSourceWeights);

  // Get modern multi-light system from visual store
  const lights = useVisualStore((state) => state.lights);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const ambientColor = useVisualStore((state) => state.ambientColor);
  const specularIntensity = useVisualStore((state) => state.specularIntensity);
  const shininess = useVisualStore((state) => state.shininess);
  // Enhanced lighting settings
  const specularColor = useVisualStore((state) => state.specularColor);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);

  // Edges render mode controls fresnel rim lighting
  const edgesVisible = useVisualStore((state) => state.edgesVisible);
  const fresnelIntensity = useVisualStore((state) => state.fresnelIntensity);
  const edgeColor = useVisualStore((state) => state.edgeColor);

  // Animation bias for per-dimension fold limit variation
  const animationBias = useVisualStore((state) => state.animationBias);

  const uniforms = useMemo(
    () => ({
      // Time and resolution
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      // Mandelbox parameters
      uDimension: { value: 3 },
      uScale: { value: -1.5 },
      uFoldingLimit: { value: 1.0 },
      uFoldLimits: { value: new Float32Array(11).fill(1.0) }, // Per-dimension fold limits (bias-controlled)
      uMinRadius2: { value: 0.25 },    // minRadius squared
      uFixedRadius2: { value: 1.0 },   // fixedRadius squared
      uIterations: { value: 50.0 },
      uEscapeRadius: { value: 10.0 },
      uIterationRotation: { value: 0.1 }, // Intra-iteration rotation for N-D mixing

      // Julia Mode uniforms
      uJuliaMode: { value: false },
      uJuliaC: { value: new Float32Array(11) },

      // D-dimensional rotated coordinate system
      uBasisX: { value: new Float32Array(11) },
      uBasisY: { value: new Float32Array(11) },
      uBasisZ: { value: new Float32Array(11) },
      uOrigin: { value: new Float32Array(11) },

      // Color and palette
      uColor: { value: new THREE.Color() },

      // 3D transformation matrices
      uModelMatrix: { value: new THREE.Matrix4() },
      uInverseModelMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },

      // Multi-light system uniforms
      ...createLightUniforms(),
      // Global lighting uniforms
      uAmbientIntensity: { value: 0.2 },
      uAmbientColor: { value: new THREE.Color('#FFFFFF') },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      uSpecularColor: { value: new THREE.Color('#FFFFFF') },
      uDiffuseIntensity: { value: 1.0 },

      // Fresnel rim lighting uniforms
      uFresnelEnabled: { value: true },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new THREE.Color('#FFFFFF') },

      // Performance mode
      uFastMode: { value: false },

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
    if (current.size !== previous.size) return true;
    for (const [key, value] of current.entries()) {
      if (previous.get(key) !== value) return true;
    }
    return false;
  }, []);

  useFrame((state) => {
    // Update animation time - only advances when isPlaying is true
    const currentTime = state.clock.elapsedTime;
    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;
    if (isPlaying) {
      animationTimeRef.current += deltaTime;
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;

      // Get rotations from store
      const rotations = useRotationStore.getState().rotations;

      // Adaptive Quality: Detect rotation animation
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
      if (material.uniforms.uFastMode) {
        material.uniforms.uFastMode.value = fastModeRef.current;
      }

      // Update time and resolution
      if (material.uniforms.uTime) material.uniforms.uTime.value = state.clock.elapsedTime;
      if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(size.width, size.height);
      if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(camera.position);

      // Update dimension
      if (material.uniforms.uDimension) material.uniforms.uDimension.value = dimension;

      // Update Mandelbox parameters
      // Scale Animation: oscillate around center with amplitude (respects isPlaying)
      let effectiveScale = scale;
      if (scaleAnimationEnabled) {
        effectiveScale = scaleCenter + scaleAmplitude * Math.sin(
          animationTimeRef.current * scaleSpeed * SCALE_BASE_FREQUENCY
        );
      }
      if (material.uniforms.uScale) material.uniforms.uScale.value = effectiveScale;
      if (material.uniforms.uFoldingLimit) material.uniforms.uFoldingLimit.value = foldingLimit;

      // Compute per-dimension fold limits based on animation bias
      // At bias=0: all dimensions use the same fold limit
      // At bias>0: higher dimensions (4+) get varying fold limits for asymmetric structure
      if (material.uniforms.uFoldLimits) {
        const biasedFolds = computeBiasedFoldLimits(dimension, animationBias, foldingLimit);
        const arr = material.uniforms.uFoldLimits.value as Float32Array;
        for (let i = 0; i < 11; i++) arr[i] = biasedFolds[i] ?? foldingLimit;
      }

      if (material.uniforms.uMinRadius2) material.uniforms.uMinRadius2.value = minRadius * minRadius;
      if (material.uniforms.uFixedRadius2) material.uniforms.uFixedRadius2.value = fixedRadius * fixedRadius;
      if (material.uniforms.uIterations) material.uniforms.uIterations.value = maxIterations;
      if (material.uniforms.uEscapeRadius) material.uniforms.uEscapeRadius.value = escapeRadius;
      if (material.uniforms.uIterationRotation) material.uniforms.uIterationRotation.value = iterationRotation;

      // Julia Mode: animated global c constant instead of per-pixel (respects isPlaying)
      if (material.uniforms.uJuliaMode) material.uniforms.uJuliaMode.value = juliaMode;
      if (juliaMode && material.uniforms.uJuliaC) {
        const juliaC = computeJuliaC(dimension, animationTimeRef.current, juliaSpeed, juliaRadius);
        const arr = material.uniforms.uJuliaC.value as Float32Array;
        for (let i = 0; i < 11; i++) arr[i] = juliaC[i] ?? 0;
      }

      // Update color
      if (material.uniforms.uColor) material.uniforms.uColor.value.set(faceColor);

      // Update camera matrices
      if (material.uniforms.uProjectionMatrix) material.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
      if (material.uniforms.uViewMatrix) material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);

      // Update multi-light system uniforms
      updateLightUniforms(material.uniforms as unknown as LightUniforms, lights);
      // Update global lighting uniforms
      if (material.uniforms.uAmbientIntensity) material.uniforms.uAmbientIntensity.value = ambientIntensity;
      if (material.uniforms.uAmbientColor) material.uniforms.uAmbientColor.value.set(ambientColor);
      if (material.uniforms.uSpecularIntensity) material.uniforms.uSpecularIntensity.value = specularIntensity;
      if (material.uniforms.uSpecularPower) material.uniforms.uSpecularPower.value = shininess;
      if (material.uniforms.uSpecularColor) material.uniforms.uSpecularColor.value.set(specularColor);
      if (material.uniforms.uDiffuseIntensity) material.uniforms.uDiffuseIntensity.value = diffuseIntensity;

      // Fresnel rim lighting
      if (material.uniforms.uFresnelEnabled) material.uniforms.uFresnelEnabled.value = edgesVisible;
      if (material.uniforms.uFresnelIntensity) material.uniforms.uFresnelIntensity.value = fresnelIntensity;
      if (material.uniforms.uRimColor) material.uniforms.uRimColor.value.set(edgeColor);

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

        // Clear and set up origin = [0, 0, 0, slice[0], slice[1], ...]
        for (let i = 0; i < MAX_DIMENSION; i++) work.origin[i] = 0;
        for (let i = 3; i < D; i++) {
          work.origin[i] = parameterValues[i - 3] ?? 0;
        }

        // Apply rotation to basis vectors using pre-allocated output arrays
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitX, work.rotatedX);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitY, work.rotatedY);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.unitZ, work.rotatedZ);
        applyRotationInPlace(cachedRotationMatrixRef.current, work.origin, work.rotatedOrigin);

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
        if (material.uniforms.uOrigin) {
          const arr = material.uniforms.uOrigin.value as Float32Array;
          arr.set(work.rotatedOrigin);
        }

        // Update tracking refs
        prevDimensionRef.current = dimension;
        prevParamValuesRef.current = [...parameterValues];
        basisVectorsDirtyRef.current = false;
      }

      // Model matrices are always identity for Mandelbox - no need to set every frame
      // (they are already identity from useMemo initialization)
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Larger bounding box for Mandelbox (extends further than Hyperbulb) */}
      <boxGeometry args={[8, 8, 8]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default MandelboxMesh;
