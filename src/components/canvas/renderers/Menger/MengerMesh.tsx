import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import vertexShader from './menger.vert?raw';
import fragmentShader from './menger.frag?raw';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useVisualStore } from '@/stores/visualStore';
import { useAnimationStore } from '@/stores/animationStore';
import { composeRotations } from '@/lib/math/rotation';
import { COLOR_ALGORITHM_TO_INT } from '@/lib/shaders/palette';
import type { MatrixND } from '@/lib/math/types';
import type { RotationState } from '@/stores/rotationStore';

/** Debounce time in ms before restoring high quality after rotation stops */
const QUALITY_RESTORE_DELAY_MS = 150;

/**
 * Convert horizontal/vertical angles to a normalized direction vector.
 */
function anglesToDirection(horizontalDeg: number, verticalDeg: number): THREE.Vector3 {
  const hRad = (horizontalDeg * Math.PI) / 180;
  const vRad = (verticalDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(vRad) * Math.sin(hRad),
    Math.sin(vRad),
    Math.cos(vRad) * Math.cos(hRad)
  ).normalize();
}

/**
 * Apply D-dimensional rotation matrix to a vector.
 * Matrix is row-major: result[i] = sum(matrix[i][j] * vec[j])
 */
function applyRotation(matrix: MatrixND, vec: number[]): Float32Array {
  const D = matrix.length;
  const result = new Float32Array(11); // Max dimension
  for (let i = 0; i < D; i++) {
    let sum = 0;
    for (let j = 0; j < D; j++) {
      sum += (matrix[i]?.[j] ?? 0) * (vec[j] ?? 0);
    }
    result[i] = sum;
  }
  return result;
}

/**
 * MengerMesh - Renders 3D-11D Menger Sponge using GPU raymarching
 *
 * The Menger sponge uses KIFS fold operations (absolute value, sort, scale)
 * that work identically across all dimensions with a true geometric SDF.
 */
const MengerMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();

  // Performance optimization: track rotation changes for adaptive quality
  const prevRotationsRef = useRef<RotationState['rotations'] | null>(null);
  const fastModeRef = useRef(false);
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Get Menger config from store
  const iterations = useExtendedObjectStore((state) => state.menger.iterations);
  const scale = useExtendedObjectStore((state) => state.menger.scale);
  const parameterValues = useExtendedObjectStore((state) => state.menger.parameterValues);

  // Fold Twist Animation
  const foldTwistEnabled = useExtendedObjectStore((state) => state.menger.foldTwistEnabled);
  const foldTwistAngle = useExtendedObjectStore((state) => state.menger.foldTwistAngle);
  const foldTwistSpeed = useExtendedObjectStore((state) => state.menger.foldTwistSpeed);

  // Scale Pulse Animation
  const scalePulseEnabled = useExtendedObjectStore((state) => state.menger.scalePulseEnabled);
  const scalePulseAmplitude = useExtendedObjectStore((state) => state.menger.scalePulseAmplitude);
  const scalePulseSpeed = useExtendedObjectStore((state) => state.menger.scalePulseSpeed);

  // Slice Sweep Animation
  const sliceSweepEnabled = useExtendedObjectStore((state) => state.menger.sliceSweepEnabled);
  const sliceSweepAmplitude = useExtendedObjectStore((state) => state.menger.sliceSweepAmplitude);
  const sliceSweepSpeed = useExtendedObjectStore((state) => state.menger.sliceSweepSpeed);

  // Animation time tracking (respects isPlaying state)
  const animationTimeRef = useRef(0);

  // Get color state from visual store
  const faceColor = useVisualStore((state) => state.faceColor);

  // Advanced color system state
  const colorAlgorithm = useVisualStore((state) => state.colorAlgorithm);
  const cosineCoefficients = useVisualStore((state) => state.cosineCoefficients);
  const distribution = useVisualStore((state) => state.distribution);
  const lchLightness = useVisualStore((state) => state.lchLightness);
  const lchChroma = useVisualStore((state) => state.lchChroma);
  const multiSourceWeights = useVisualStore((state) => state.multiSourceWeights);

  // Get lighting settings from visual store
  const lightEnabled = useVisualStore((state) => state.lightEnabled);
  const lightColor = useVisualStore((state) => state.lightColor);
  const lightHorizontalAngle = useVisualStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useVisualStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const ambientColor = useVisualStore((state) => state.ambientColor);
  const specularIntensity = useVisualStore((state) => state.specularIntensity);
  const shininess = useVisualStore((state) => state.shininess);
  // Enhanced lighting settings
  const specularColor = useVisualStore((state) => state.specularColor);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);
  const lightStrength = useVisualStore((state) => state.lightStrength);

  // Edges render mode controls fresnel rim lighting
  const edgesVisible = useVisualStore((state) => state.edgesVisible);
  const fresnelIntensity = useVisualStore((state) => state.fresnelIntensity);
  const edgeColor = useVisualStore((state) => state.edgeColor);

  const uniforms = useMemo(
    () => ({
      // Time and resolution
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      // Menger parameters
      uDimension: { value: 3 },
      uIterations: { value: 5.0 },
      uScale: { value: 1.0 },

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

      // Lighting uniforms
      uLightEnabled: { value: true },
      uLightColor: { value: new THREE.Color() },
      uLightDirection: { value: new THREE.Vector3() },
      uAmbientIntensity: { value: 0.2 },
      uAmbientColor: { value: new THREE.Color('#FFFFFF') },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      uLightStrength: { value: 1.0 },
      uSpecularColor: { value: new THREE.Color('#FFFFFF') },
      uDiffuseIntensity: { value: 1.0 },
      uToneMappingEnabled: { value: false },
      uToneMappingAlgorithm: { value: 0 },
      uExposure: { value: 1.0 },

      // Fresnel rim lighting uniforms
      uFresnelEnabled: { value: true },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new THREE.Color('#FFFFFF') },

      // Performance mode
      uFastMode: { value: false },

      // Fold Twist Animation uniforms
      uFoldTwistEnabled: { value: false },
      uFoldTwistAngle: { value: 0.0 },

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
   */
  const hasRotationsChanged = useCallback((
    current: RotationState['rotations'],
    previous: RotationState['rotations'] | null
  ): boolean => {
    if (!previous) return false;
    if (current.size !== previous.size) return true;
    for (const [key, value] of current.entries()) {
      if (previous.get(key) !== value) return true;
    }
    return false;
  }, []);

  useFrame((state) => {
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

      // Track animation time (respects isPlaying state)
      const isPlaying = useAnimationStore.getState().isPlaying;
      if (isPlaying) {
        animationTimeRef.current += state.clock.getDelta();
      }

      // Update time and resolution
      if (material.uniforms.uTime) material.uniforms.uTime.value = state.clock.elapsedTime;
      if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(size.width, size.height);
      if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(camera.position);

      // Update dimension
      if (material.uniforms.uDimension) material.uniforms.uDimension.value = dimension;

      // Update Menger parameters
      if (material.uniforms.uIterations) material.uniforms.uIterations.value = iterations;

      // Scale Pulse Animation: compute effective scale
      let effectiveScale = scale;
      if (scalePulseEnabled && scalePulseAmplitude > 0 && scalePulseSpeed > 0) {
        effectiveScale = scale + scalePulseAmplitude *
          Math.sin(animationTimeRef.current * scalePulseSpeed * Math.PI);
      }
      if (material.uniforms.uScale) material.uniforms.uScale.value = effectiveScale;

      // Fold Twist Animation
      if (material.uniforms.uFoldTwistEnabled) {
        material.uniforms.uFoldTwistEnabled.value = foldTwistEnabled;
      }
      if (material.uniforms.uFoldTwistAngle) {
        let angle = foldTwistAngle;
        if (foldTwistEnabled && foldTwistSpeed > 0) {
          angle += animationTimeRef.current * foldTwistSpeed;
        }
        material.uniforms.uFoldTwistAngle.value = angle;
      }

      // Update color
      if (material.uniforms.uColor) material.uniforms.uColor.value.set(faceColor);

      // Update camera matrices
      if (material.uniforms.uProjectionMatrix) material.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
      if (material.uniforms.uViewMatrix) material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);

      // Update lighting uniforms
      if (material.uniforms.uLightEnabled) material.uniforms.uLightEnabled.value = lightEnabled;
      if (material.uniforms.uLightColor) material.uniforms.uLightColor.value.set(lightColor);
      if (material.uniforms.uLightDirection) {
        const dir = anglesToDirection(lightHorizontalAngle, lightVerticalAngle);
        material.uniforms.uLightDirection.value.copy(dir);
      }
      if (material.uniforms.uAmbientIntensity) material.uniforms.uAmbientIntensity.value = ambientIntensity;
      if (material.uniforms.uAmbientColor) material.uniforms.uAmbientColor.value.set(ambientColor);
      if (material.uniforms.uSpecularIntensity) material.uniforms.uSpecularIntensity.value = specularIntensity;
      if (material.uniforms.uSpecularPower) material.uniforms.uSpecularPower.value = shininess;
      if (material.uniforms.uLightStrength) material.uniforms.uLightStrength.value = lightStrength ?? 1.0;
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

      // Build D-dimensional rotation matrix
      const rotationMatrix = composeRotations(dimension, rotations);

      // Build basis vectors for the 3D slice in D-dimensional space
      const D = dimension;

      // Create unrotated basis vectors
      const unitX = new Array(D).fill(0);
      unitX[0] = 1;
      const unitY = new Array(D).fill(0);
      unitY[1] = 1;
      const unitZ = new Array(D).fill(0);
      unitZ[2] = 1;

      // Create origin with slice values in dimensions 3+
      const origin = new Array(D).fill(0);
      for (let i = 3; i < D; i++) {
        origin[i] = parameterValues[i - 3] ?? 0;
      }

      // Slice Sweep Animation (4D+ only)
      // Uses golden ratio for non-repeating phase offsets across dimensions
      if (sliceSweepEnabled && dimension >= 4 && sliceSweepAmplitude > 0 && sliceSweepSpeed > 0) {
        const GOLDEN_RATIO = 1.618033988749895;
        for (let i = 3; i < D; i++) {
          const dimIndex = i - 3;
          const phase = dimIndex * GOLDEN_RATIO * Math.PI * 2;
          const baseValue = parameterValues[dimIndex] ?? 0;
          const sweep = sliceSweepAmplitude *
            Math.sin(animationTimeRef.current * sliceSweepSpeed + phase);
          origin[i] = baseValue + sweep;
        }
      }

      // Apply D-dimensional rotation to get rotated basis vectors
      const rotatedX = applyRotation(rotationMatrix, unitX);
      const rotatedY = applyRotation(rotationMatrix, unitY);
      const rotatedZ = applyRotation(rotationMatrix, unitZ);
      const rotatedOrigin = applyRotation(rotationMatrix, origin);

      // Update uniforms in place
      if (material.uniforms.uBasisX) {
        const arr = material.uniforms.uBasisX.value as Float32Array;
        for (let i = 0; i < 11; i++) arr[i] = rotatedX[i] ?? 0;
      }
      if (material.uniforms.uBasisY) {
        const arr = material.uniforms.uBasisY.value as Float32Array;
        for (let i = 0; i < 11; i++) arr[i] = rotatedY[i] ?? 0;
      }
      if (material.uniforms.uBasisZ) {
        const arr = material.uniforms.uBasisZ.value as Float32Array;
        for (let i = 0; i < 11; i++) arr[i] = rotatedZ[i] ?? 0;
      }
      if (material.uniforms.uOrigin) {
        const arr = material.uniforms.uOrigin.value as Float32Array;
        for (let i = 0; i < 11; i++) arr[i] = rotatedOrigin[i] ?? 0;
      }

      // Use identity for model matrix (rotation handled by basis vectors)
      if (material.uniforms.uModelMatrix) {
        material.uniforms.uModelMatrix.value.identity();
      }
      if (material.uniforms.uInverseModelMatrix) {
        material.uniforms.uInverseModelMatrix.value.identity();
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Menger is bounded within unit cube * scale, give some margin */}
      <boxGeometry args={[4, 4, 4]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default MengerMesh;
