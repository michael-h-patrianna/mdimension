/**
 * Tests for SurfaceMaterial module
 *
 * Tests the MeshPhongMaterial-based surface material with custom shader injection
 * for palette colors, fresnel rim lighting, and tone mapping.
 */

import { describe, it, expect } from 'vitest';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer, IUniform } from 'three';
import { MeshPhongMaterial, DoubleSide } from 'three';
import {
  createPhongPaletteMaterial,
  updatePhongPaletteMaterial,
  createBasicSurfaceMaterial,
} from '@/lib/shaders/materials';

/** Mock shader structure for testing onBeforeCompile - minimal subset for testing */
interface MockShader {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, IUniform>;
}

/**
 * Creates a mock shader object for testing onBeforeCompile
 * The mock provides only the fields our code modifies, cast to full type
 */
function createMockShader(): WebGLProgramParametersWithUniforms {
  const mockShader: MockShader = {
    vertexShader: '#define PHONG\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>\n#include <tonemapping_fragment>',
    uniforms: {},
  };
  // Cast to full type - we only use vertexShader, fragmentShader, and uniforms in tests
  return mockShader as unknown as WebGLProgramParametersWithUniforms;
}

/** Mock WebGL renderer - only the type is needed for the test */
const mockRenderer = null as unknown as WebGLRenderer;

describe('SurfaceMaterial', () => {
  describe('createBasicSurfaceMaterial', () => {
    it('should create a MeshPhongMaterial', () => {
      const material = createBasicSurfaceMaterial({
        color: '#FF0000',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: false,
      });

      expect(material).toBeInstanceOf(MeshPhongMaterial);
    });

    it('should set correct properties', () => {
      const material = createBasicSurfaceMaterial({
        color: '#FF0000',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: false,
      });

      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.8);
      expect(material.side).toBe(DoubleSide);
      expect(material.shininess).toBe(30);
      expect(material.flatShading).toBe(false);
    });

    it('should set color correctly', () => {
      const material = createBasicSurfaceMaterial({
        color: '#FF0000',
        faceOpacity: 1,
        specularIntensity: 1,
        shininess: 30,
        fresnelEnabled: false,
      });

      expect(material.color.getHexString()).toBe('ff0000');
    });
  });

  describe('createPhongPaletteMaterial', () => {
    it('should create a MeshPhongMaterial', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        edgeColor: '#00FFFF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      expect(material).toBeInstanceOf(MeshPhongMaterial);
    });

    it('should set correct base properties', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        edgeColor: '#00FFFF',
        faceOpacity: 0.7,
        specularIntensity: 0.5,
        shininess: 64,
        fresnelEnabled: true,
        colorMode: 'complementary',
      });

      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.7);
      expect(material.side).toBe(DoubleSide);
      expect(material.shininess).toBe(64);
      expect(material.flatShading).toBe(false);
    });

    it('should store custom uniforms in userData', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        edgeColor: '#00FFFF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      expect(material.userData.customUniforms).toBeDefined();
      expect(material.userData.customUniforms.uRimColor).toBeDefined();
      expect(material.userData.customUniforms.uFresnelIntensity).toBeDefined();
      expect(material.userData.customUniforms.uPaletteMode).toBeDefined();
      expect(material.userData.customUniforms.uToneMappingCustomEnabled).toBeDefined();
      expect(material.userData.customUniforms.uToneMappingAlgorithm).toBeDefined();
      expect(material.userData.customUniforms.uExposure).toBeDefined();
    });

    it('should set fresnel intensity based on fresnelEnabled', () => {
      const materialWithFresnel = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'monochromatic',
      });

      const materialWithoutFresnel = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: false,
        colorMode: 'monochromatic',
      });

      expect(materialWithFresnel.userData.customUniforms.uFresnelIntensity.value).toBe(0.5);
      expect(materialWithoutFresnel.userData.customUniforms.uFresnelIntensity.value).toBe(0.0);
    });

    it('should set palette mode correctly', () => {
      const modes = ['monochromatic', 'analogous', 'complementary', 'triadic', 'splitComplementary'] as const;
      const expectedValues = [0, 1, 2, 3, 4];

      modes.forEach((mode, index) => {
        const material = createPhongPaletteMaterial({
          color: '#8800FF',
          faceOpacity: 0.8,
          specularIntensity: 0.5,
          shininess: 30,
          fresnelEnabled: false,
          colorMode: mode,
        });

        expect(material.userData.customUniforms.uPaletteMode.value).toBe(expectedValues[index]);
      });
    });

    it('should set onBeforeCompile callback', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      expect(material.onBeforeCompile).toBeDefined();
      expect(typeof material.onBeforeCompile).toBe('function');
    });

    it('should set customProgramCacheKey', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      expect(material.customProgramCacheKey).toBeDefined();
      expect(material.customProgramCacheKey()).toBe('phong-palette-v1');
    });

    it('should set rim color from edgeColor', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        edgeColor: '#00FF00',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      expect(material.userData.customUniforms.uRimColor.value.getHexString()).toBe('00ff00');
    });

    it('should default edgeColor to white if not provided', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      expect(material.userData.customUniforms.uRimColor.value.getHexString()).toBe('ffffff');
    });
  });

  describe('updatePhongPaletteMaterial', () => {
    it('should update color', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      updatePhongPaletteMaterial(material, { color: '#FF0000' });

      expect(material.color.getHexString()).toBe('ff0000');
    });

    it('should update opacity', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      updatePhongPaletteMaterial(material, { opacity: 0.5 });

      expect(material.opacity).toBe(0.5);
    });

    it('should update specular intensity', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      updatePhongPaletteMaterial(material, { specularIntensity: 0.9 });

      // MeshPhongMaterial.specular is a Color, setScalar sets r=g=b
      expect(material.specular.r).toBeCloseTo(0.9);
      expect(material.specular.g).toBeCloseTo(0.9);
      expect(material.specular.b).toBeCloseTo(0.9);
    });

    it('should update specular color', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      updatePhongPaletteMaterial(material, { specularColor: '#FF0000' });

      expect(material.specular.getHexString()).toBe('ff0000');
    });

    it('should update shininess', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      updatePhongPaletteMaterial(material, { shininess: 100 });

      expect(material.shininess).toBe(100);
    });

    it('should update custom uniforms in userData.customUniforms', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      updatePhongPaletteMaterial(material, {
        rimColor: '#00FF00',
        fresnelIntensity: 0.8,
        colorMode: 'triadic',
        toneMappingEnabled: false,
        toneMappingAlgorithm: 'aces',
        exposure: 1.5,
      });

      const uniforms = material.userData.customUniforms;
      expect(uniforms.uRimColor.value.getHexString()).toBe('00ff00');
      expect(uniforms.uFresnelIntensity.value).toBe(0.8);
      expect(uniforms.uPaletteMode.value).toBe(3); // triadic = 3
      expect(uniforms.uToneMappingCustomEnabled.value).toBe(false);
      expect(uniforms.uToneMappingAlgorithm.value).toBe(1); // aces = 1
      expect(uniforms.uExposure.value).toBe(1.5);
    });

    it('should handle partial updates', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      // Only update color
      updatePhongPaletteMaterial(material, { color: '#FF0000' });

      // Other properties should remain unchanged
      expect(material.opacity).toBe(0.8);
      expect(material.shininess).toBe(30);
      expect(material.userData.customUniforms.uPaletteMode.value).toBe(1); // analogous = 1
    });

    it('should update all color modes correctly', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'monochromatic',
      });

      const modes = ['monochromatic', 'analogous', 'complementary', 'triadic', 'splitComplementary'] as const;
      const expectedValues = [0, 1, 2, 3, 4];

      modes.forEach((mode, index) => {
        updatePhongPaletteMaterial(material, { colorMode: mode });
        expect(material.userData.customUniforms.uPaletteMode.value).toBe(expectedValues[index]);
      });
    });

    it('should update all tone mapping algorithms correctly', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'monochromatic',
      });

      const algorithms = ['reinhard', 'aces', 'uncharted2'] as const;
      const expectedValues = [0, 1, 2];

      algorithms.forEach((algo, index) => {
        updatePhongPaletteMaterial(material, { toneMappingAlgorithm: algo });
        expect(material.userData.customUniforms.uToneMappingAlgorithm.value).toBe(expectedValues[index]);
      });
    });
  });

  describe('onBeforeCompile shader modifications', () => {
    it('should modify vertex shader to include faceDepth attribute', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      // Check vertex shader modifications
      // Note: vNormal is already provided by Three.js Phong shader, so we don't inject it
      expect(mockShader.vertexShader).toContain('attribute float faceDepth');
      expect(mockShader.vertexShader).toContain('varying float vDepth');
      expect(mockShader.vertexShader).toContain('varying vec3 vWorldPosition');
      expect(mockShader.vertexShader).toContain('vDepth = faceDepth');
      expect(mockShader.vertexShader).toContain('vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz');
    });

    it('should modify fragment shader to include palette functions', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      // Check fragment shader modifications
      expect(mockShader.fragmentShader).toContain('uniform vec3 uRimColor');
      expect(mockShader.fragmentShader).toContain('uniform float uFresnelIntensity');
      expect(mockShader.fragmentShader).toContain('uniform int uPaletteMode');
      expect(mockShader.fragmentShader).toContain('rgb2hsl');
      expect(mockShader.fragmentShader).toContain('getPaletteColor');
      expect(mockShader.fragmentShader).toContain('applyToneMapping');
    });

    it('should inject fresnel rim lighting code in opaque_fragment', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      // Fresnel code is injected in the opaque_fragment replacement
      expect(mockShader.fragmentShader).toContain('uFresnelIntensity > 0.0');
      expect(mockShader.fragmentShader).toContain('outgoingLight += uRimColor * fresnelRim');
      // Should also contain the standard output fragment code
      expect(mockShader.fragmentShader).toContain('gl_FragColor = vec4( outgoingLight');
    });

    it('should store shader reference in userData', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      expect(material.userData.shader).toBe(mockShader);
    });

    it('should merge custom uniforms into shader.uniforms', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        edgeColor: '#00FFFF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      expect(mockShader.uniforms).toHaveProperty('uRimColor');
      expect(mockShader.uniforms).toHaveProperty('uFresnelIntensity');
      expect(mockShader.uniforms).toHaveProperty('uPaletteMode');
      expect(mockShader.uniforms).toHaveProperty('uToneMappingCustomEnabled');
      expect(mockShader.uniforms).toHaveProperty('uToneMappingAlgorithm');
      expect(mockShader.uniforms).toHaveProperty('uExposure');
    });
  });

  describe('updatePhongPaletteMaterial with compiled shader', () => {
    it('should update shader.uniforms when shader is compiled', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorMode: 'analogous',
      });

      // Simulate shader compilation by calling onBeforeCompile
      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      // Now update the material
      updatePhongPaletteMaterial(material, {
        fresnelIntensity: 0.9,
        colorMode: 'complementary',
        exposure: 2.0,
      });

      // Both shader.uniforms and userData.customUniforms should be updated
      const uniforms = mockShader.uniforms;
      expect(uniforms.uFresnelIntensity?.value).toBe(0.9);
      expect(uniforms.uPaletteMode?.value).toBe(2); // complementary
      expect(uniforms.uExposure?.value).toBe(2.0);
    });
  });
});
