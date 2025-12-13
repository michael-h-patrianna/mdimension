import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import vertexShader from './hyperbulb.vert?raw';
import fragmentShader from './hyperbulb.frag?raw';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useVisualStore } from '@/stores/visualStore';
import { composeRotations } from '@/lib/math/rotation';
import { COLOR_MODE_TO_INT } from '@/lib/shaders/palette';
import { TONE_MAPPING_TO_INT } from '@/lib/shaders/types';
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
 * HyperbulbMesh - Renders 4D-11D Hyperbulb fractals using GPU raymarching
 *
 * Supports full D-dimensional rotation through all rotation planes (XY, XZ, YZ, XW, YW, ZW, etc.)
 * The 3D slice plane is rotated through D-dimensional space using rotated basis vectors.
 */
const HyperbulbMesh = () => {
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

  // Get Mandelbrot/Hyperbulb config from store
  const mandelbulbPower = useExtendedObjectStore((state) => state.mandelbrot.mandelbulbPower);
  const maxIterations = useExtendedObjectStore((state) => state.mandelbrot.maxIterations);
  const escapeRadius = useExtendedObjectStore((state) => state.mandelbrot.escapeRadius);
  const parameterValues = useExtendedObjectStore((state) => state.mandelbrot.parameterValues);

  // Get color state from visual store
  const faceColor = useVisualStore((state) => state.faceColor);
  const colorMode = useVisualStore((state) => state.colorMode);

  // Get lighting settings from visual store
  const lightEnabled = useVisualStore((state) => state.lightEnabled);
  const lightColor = useVisualStore((state) => state.lightColor);
  const lightHorizontalAngle = useVisualStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useVisualStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const specularIntensity = useVisualStore((state) => state.specularIntensity);
  const shininess = useVisualStore((state) => state.shininess);
  // Enhanced lighting settings
  const specularColor = useVisualStore((state) => state.specularColor);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);
  const toneMappingEnabled = useVisualStore((state) => state.toneMappingEnabled);
  const toneMappingAlgorithm = useVisualStore((state) => state.toneMappingAlgorithm);
  const exposure = useVisualStore((state) => state.exposure);

  // Edges render mode controls fresnel rim lighting for Hyperbulb
  const edgesVisible = useVisualStore((state) => state.edgesVisible);
  const fresnelIntensity = useVisualStore((state) => state.fresnelIntensity);
  const edgeColor = useVisualStore((state) => state.edgeColor);

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

      // D-dimensional rotated coordinate system
      // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
      uBasisX: { value: new Float32Array(11) },
      uBasisY: { value: new Float32Array(11) },
      uBasisZ: { value: new Float32Array(11) },
      uOrigin: { value: new Float32Array(11) },

      // Color and palette
      uColor: { value: new THREE.Color() },
      uPaletteMode: { value: 0 },

      // 3D transformation matrices (for camera/view only)
      uModelMatrix: { value: new THREE.Matrix4() },
      uInverseModelMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },

      // Lighting uniforms
      uLightEnabled: { value: true },
      uLightColor: { value: new THREE.Color() },
      uLightDirection: { value: new THREE.Vector3() },
      uAmbientIntensity: { value: 0.2 },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      // Enhanced lighting uniforms
      uSpecularColor: { value: new THREE.Color('#FFFFFF') },
      uDiffuseIntensity: { value: 1.0 },
      uToneMappingEnabled: { value: true },
      uToneMappingAlgorithm: { value: 0 },
      uExposure: { value: 1.0 },

      // Fresnel rim lighting uniforms
      uFresnelEnabled: { value: true },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new THREE.Color('#FFFFFF') },

      // Performance mode: reduces quality during rotation animations
      uFastMode: { value: false },
    }),
    []
  );

  /**
   * Check if rotations have changed by comparing current vs previous state.
   * Returns true if any rotation angle has changed.
   */
  const hasRotationsChanged = useCallback((
    current: RotationState['rotations'],
    previous: RotationState['rotations'] | null
  ): boolean => {
    if (!previous) return false;

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

      // Update time and resolution
      if (material.uniforms.uTime) material.uniforms.uTime.value = state.clock.elapsedTime;
      if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(size.width, size.height);
      if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(camera.position);

      // Update dimension
      if (material.uniforms.uDimension) material.uniforms.uDimension.value = dimension;

      // Update Hyperbulb parameters
      if (material.uniforms.uPower) material.uniforms.uPower.value = mandelbulbPower;
      if (material.uniforms.uIterations) material.uniforms.uIterations.value = maxIterations;
      if (material.uniforms.uEscapeRadius) material.uniforms.uEscapeRadius.value = escapeRadius;

      // Update color and palette
      if (material.uniforms.uColor) material.uniforms.uColor.value.set(faceColor);
      if (material.uniforms.uPaletteMode) material.uniforms.uPaletteMode.value = COLOR_MODE_TO_INT[colorMode];

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
      if (material.uniforms.uSpecularIntensity) material.uniforms.uSpecularIntensity.value = specularIntensity;
      if (material.uniforms.uSpecularPower) material.uniforms.uSpecularPower.value = shininess;
      // Enhanced lighting uniforms
      if (material.uniforms.uSpecularColor) material.uniforms.uSpecularColor.value.set(specularColor);
      if (material.uniforms.uDiffuseIntensity) material.uniforms.uDiffuseIntensity.value = diffuseIntensity;
      if (material.uniforms.uToneMappingEnabled) material.uniforms.uToneMappingEnabled.value = toneMappingEnabled;
      if (material.uniforms.uToneMappingAlgorithm) material.uniforms.uToneMappingAlgorithm.value = TONE_MAPPING_TO_INT[toneMappingAlgorithm];
      if (material.uniforms.uExposure) material.uniforms.uExposure.value = exposure;

      // Fresnel rim lighting (controlled by Edges render mode)
      if (material.uniforms.uFresnelEnabled) material.uniforms.uFresnelEnabled.value = edgesVisible;
      if (material.uniforms.uFresnelIntensity) material.uniforms.uFresnelIntensity.value = fresnelIntensity;
      if (material.uniforms.uRimColor) material.uniforms.uRimColor.value.set(edgeColor);

      // Build FULL D-dimensional rotation matrix
      const rotationMatrix = composeRotations(dimension, rotations);

      // Build basis vectors for the 3D slice in D-dimensional space
      // Before rotation: X=[1,0,0,0,...], Y=[0,1,0,0,...], Z=[0,0,1,0,...]
      // Origin = [0,0,0, slice[0], slice[1], ...]
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

      // For Hyperbulb, the D-dimensional rotation is handled entirely by the basis vectors.
      // We use identity for the 3D model matrix because:
      // 1. The fractal rotation happens in D-dimensional space via uBasisX/Y/Z
      // 2. Extracting a 3x3 from a D-dimensional rotation can produce singular matrices
      //    (e.g., when XW rotation puts X axis into W dimension, the 3x3 has a zero row)
      // 3. Using identity keeps camera/lighting in world space, which is correct
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

export default HyperbulbMesh;
