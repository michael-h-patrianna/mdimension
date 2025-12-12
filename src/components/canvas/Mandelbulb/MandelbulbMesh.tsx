import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import vertexShader from './mandelbulb.vert?raw';
import fragmentShader from './mandelbulb.frag?raw';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useVisualStore } from '@/stores/visualStore';
import { composeRotations } from '@/lib/math/rotation';
import { COLOR_MODE_TO_INT } from '@/lib/shaders/palette';
import { TONE_MAPPING_TO_INT } from '@/lib/shaders/types';

/** MandelbulbMesh is always 3D - this constant ensures consistency */
const MANDELBULB_DIMENSION = 3;

/**
 * Convert horizontal/vertical angles to a normalized direction vector.
 * Matches the light direction calculation used in SceneLighting.
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

const MandelbulbMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();

  // Get config from store - these change infrequently so hooks are fine
  const mandelbulbPower = useExtendedObjectStore((state) => state.mandelbrot.mandelbulbPower);
  const maxIterations = useExtendedObjectStore((state) => state.mandelbrot.maxIterations);
  const escapeRadius = useExtendedObjectStore((state) => state.mandelbrot.escapeRadius);

  // Get color state from visual store (unified palette system)
  const faceColor = useVisualStore((state) => state.faceColor);
  const colorMode = useVisualStore((state) => state.colorMode);

  // Get lighting settings from visual store
  const lightEnabled = useVisualStore((state) => state.lightEnabled);
  const lightColor = useVisualStore((state) => state.lightColor);
  const lightHorizontalAngle = useVisualStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useVisualStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const specularIntensity = useVisualStore((state) => state.specularIntensity);
  const specularPower = useVisualStore((state) => state.specularPower);
  // Enhanced lighting settings
  const specularColor = useVisualStore((state) => state.specularColor);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);
  const toneMappingEnabled = useVisualStore((state) => state.toneMappingEnabled);
  const toneMappingAlgorithm = useVisualStore((state) => state.toneMappingAlgorithm);
  const exposure = useVisualStore((state) => state.exposure);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },
      uPower: { value: 8.0 },
      uIterations: { value: 10.0 },
      uEscapeRadius: { value: 4.0 },
      uColor: { value: new THREE.Color() },
      uPaletteMode: { value: 0 },
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
    }),
    []
  );

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms.uTime) material.uniforms.uTime.value = state.clock.elapsedTime;
      if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(size.width, size.height);
      if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(camera.position);
      if (material.uniforms.uPower) material.uniforms.uPower.value = mandelbulbPower;
      if (material.uniforms.uIterations) material.uniforms.uIterations.value = maxIterations;
      if (material.uniforms.uEscapeRadius) material.uniforms.uEscapeRadius.value = escapeRadius;
      if (material.uniforms.uColor) material.uniforms.uColor.value.set(faceColor);
      if (material.uniforms.uPaletteMode) material.uniforms.uPaletteMode.value = COLOR_MODE_TO_INT[colorMode];
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
      if (material.uniforms.uSpecularPower) material.uniforms.uSpecularPower.value = specularPower;
      // Enhanced lighting uniforms
      if (material.uniforms.uSpecularColor) material.uniforms.uSpecularColor.value.set(specularColor);
      if (material.uniforms.uDiffuseIntensity) material.uniforms.uDiffuseIntensity.value = diffuseIntensity;
      if (material.uniforms.uToneMappingEnabled) material.uniforms.uToneMappingEnabled.value = toneMappingEnabled;
      if (material.uniforms.uToneMappingAlgorithm) material.uniforms.uToneMappingAlgorithm.value = TONE_MAPPING_TO_INT[toneMappingAlgorithm];
      if (material.uniforms.uExposure) material.uniforms.uExposure.value = exposure;

      // Access rotation state directly to avoid re-renders during animation
      // Filter to only include 3D-valid planes (XY, XZ, YZ) to prevent errors
      // when rotationStore still has 4D planes during dimension transitions
      const allRotations = useRotationStore.getState().rotations;
      const validPlanes = new Set(['XY', 'XZ', 'YZ']);
      const rotations = new Map<string, number>();
      for (const [plane, angle] of allRotations.entries()) {
        if (validPlanes.has(plane)) {
          rotations.set(plane, angle);
        }
      }

      // Build rotation matrix using the SAME function as point cloud vertices
      // This ensures identical rotation behavior between raymarched and point cloud
      const rotationMatrix = composeRotations(MANDELBULB_DIMENSION, rotations);

      // Convert our row-major 3x3 matrix to THREE.js column-major 4x4 Matrix4
      // Our matrix: rotationMatrix[row][col]
      // THREE.js Matrix4.set() takes row-major order: (n11, n12, n13, n14, n21, ...)
      const m = rotationMatrix;
      const threeRotMatrix = new THREE.Matrix4().set(
        m[0]![0]!, m[0]![1]!, m[0]![2]!, 0,
        m[1]![0]!, m[1]![1]!, m[1]![2]!, 0,
        m[2]![0]!, m[2]![1]!, m[2]![2]!, 0,
        0, 0, 0, 1
      );

      // Pass both forward and inverse rotation matrices for the shader
      // Forward matrix: transforms object space to world space (for depth calculation)
      // Inverse matrix: transforms world space to object space (for raymarching)
      if (material.uniforms.uModelMatrix) {
        material.uniforms.uModelMatrix.value.copy(threeRotMatrix);
      }
      if (material.uniforms.uInverseModelMatrix) {
        material.uniforms.uInverseModelMatrix.value.copy(threeRotMatrix).invert();
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

export default MandelbulbMesh;
