import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import vertexShader from './mandelbulb.vert?raw';
import fragmentShader from './mandelbulb.frag?raw';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useVisualStore } from '@/stores/visualStore';
import { composeRotations } from '@/lib/math/rotation';
import { COLOR_ALGORITHM_TO_INT } from '@/lib/shaders/palette';
import { MAX_LIGHTS, LIGHT_TYPE_TO_INT, rotationToDirection } from '@/lib/lights/types';
import type { LightSource } from '@/lib/lights/types';

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
  const specularIntensity = useVisualStore((state) => state.specularIntensity);
  const shininess = useVisualStore((state) => state.shininess);
  // Enhanced lighting settings
  const specularColor = useVisualStore((state) => state.specularColor);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);
  const lightStrength = useVisualStore((state) => state.lightStrength);

  // Edges render mode controls fresnel rim lighting for Mandelbulb
  const edgesVisible = useVisualStore((state) => state.edgesVisible);
  const fresnelIntensity = useVisualStore((state) => state.fresnelIntensity);
  const edgeColor = useVisualStore((state) => state.edgeColor);

  // Multi-light system state
  const lights = useVisualStore((state) => state.lights);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },
      uPower: { value: 8.0 },
      uIterations: { value: 10.0 },
      uEscapeRadius: { value: 4.0 },
      uColor: { value: new THREE.Color() },
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
      uLightStrength: { value: 1.0 },
      // Enhanced lighting uniforms
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
      // Multi-light system uniforms
      uNumLights: { value: 0 },
      uLightsEnabled: { value: Array(MAX_LIGHTS).fill(false) },
      uLightTypes: { value: Array(MAX_LIGHTS).fill(0) },
      uLightPositions: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, 5, 0)) },
      uLightDirections: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -1, 0)) },
      uLightColors: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color('#FFFFFF')) },
      uLightIntensities: { value: Array(MAX_LIGHTS).fill(1.0) },
      uSpotAngles: { value: Array(MAX_LIGHTS).fill(Math.PI / 6) },
      uSpotPenumbras: { value: Array(MAX_LIGHTS).fill(0.5) },
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
      if (material.uniforms.uLightStrength) material.uniforms.uLightStrength.value = lightStrength ?? 1.0;
      // Enhanced lighting uniforms
      if (material.uniforms.uSpecularColor) material.uniforms.uSpecularColor.value.set(specularColor);
      if (material.uniforms.uDiffuseIntensity) material.uniforms.uDiffuseIntensity.value = diffuseIntensity;

      // Fresnel rim lighting (controlled by Edges render mode)
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

      // Multi-light system uniform updates
      const u = material.uniforms;
      if (u.uNumLights && u.uLightsEnabled && u.uLightTypes && u.uLightPositions &&
          u.uLightDirections && u.uLightColors && u.uLightIntensities &&
          u.uSpotAngles && u.uSpotPenumbras) {
        const numLights = Math.min(lights.length, MAX_LIGHTS);
        u.uNumLights.value = numLights;

        for (let i = 0; i < MAX_LIGHTS; i++) {
          const light: LightSource | undefined = lights[i];

          if (light) {
            u.uLightsEnabled.value[i] = light.enabled;
            u.uLightTypes.value[i] = LIGHT_TYPE_TO_INT[light.type];
            u.uLightPositions.value[i].set(light.position[0], light.position[1], light.position[2]);

            // Calculate direction from rotation
            const dir = rotationToDirection(light.rotation);
            u.uLightDirections.value[i].set(dir[0], dir[1], dir[2]);

            u.uLightColors.value[i].set(light.color);
            u.uLightIntensities.value[i] = light.intensity;
            u.uSpotAngles.value[i] = (light.coneAngle * Math.PI) / 180;
            u.uSpotPenumbras.value[i] = light.penumbra;
          } else {
            u.uLightsEnabled.value[i] = false;
          }
        }
      }

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
