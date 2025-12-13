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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
      });

      expect(material.userData.customUniforms).toBeDefined();
      expect(material.userData.customUniforms.uRimColor).toBeDefined();
      expect(material.userData.customUniforms.uFresnelIntensity).toBeDefined();
      // Advanced color system uniforms
      expect(material.userData.customUniforms.uColorAlgorithm).toBeDefined();
      expect(material.userData.customUniforms.uCosineA).toBeDefined();
      expect(material.userData.customUniforms.uCosineB).toBeDefined();
      expect(material.userData.customUniforms.uCosineC).toBeDefined();
      expect(material.userData.customUniforms.uCosineD).toBeDefined();
      expect(material.userData.customUniforms.uDistPower).toBeDefined();
      expect(material.userData.customUniforms.uDistCycles).toBeDefined();
      expect(material.userData.customUniforms.uDistOffset).toBeDefined();
    });

    it('should set fresnel intensity based on fresnelEnabled', () => {
      const materialWithFresnel = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorAlgorithm: 'monochromatic',
      });

      const materialWithoutFresnel = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: false,
        colorAlgorithm: 'monochromatic',
      });

      expect(materialWithFresnel.userData.customUniforms.uFresnelIntensity.value).toBe(0.5);
      expect(materialWithoutFresnel.userData.customUniforms.uFresnelIntensity.value).toBe(0.0);
    });

    it('should set color algorithm correctly', () => {
      // New algorithm numbering: 0=monochromatic, 1=analogous, 2=cosine, 3=normal, 4=distance, 5=lch, 6=multiSource
      const algorithms = ['monochromatic', 'analogous', 'cosine', 'normal', 'distance', 'lch', 'multiSource'] as const;
      const expectedValues = [0, 1, 2, 3, 4, 5, 6];

      algorithms.forEach((algo, index) => {
        const material = createPhongPaletteMaterial({
          color: '#8800FF',
          faceOpacity: 0.8,
          specularIntensity: 0.5,
          shininess: 30,
          fresnelEnabled: false,
          colorAlgorithm: algo,
        });

        expect(material.userData.customUniforms.uColorAlgorithm.value).toBe(expectedValues[index]);
      });
    });

    it('should set onBeforeCompile callback', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
      });

      updatePhongPaletteMaterial(material, {
        rimColor: '#00FF00',
        fresnelIntensity: 0.8,
        colorAlgorithm: 'normal',
      });

      const uniforms = material.userData.customUniforms;
      expect(uniforms.uRimColor.value.getHexString()).toBe('00ff00');
      expect(uniforms.uFresnelIntensity.value).toBe(0.8);
      expect(uniforms.uColorAlgorithm.value).toBe(3); // normal = 3
    });

    it('should handle partial updates', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorAlgorithm: 'cosine',
      });

      // Only update color
      updatePhongPaletteMaterial(material, { color: '#FF0000' });

      // Other properties should remain unchanged
      expect(material.opacity).toBe(0.8);
      expect(material.shininess).toBe(30);
      expect(material.userData.customUniforms.uColorAlgorithm.value).toBe(2); // cosine = 2
    });

    it('should update all color algorithms correctly', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorAlgorithm: 'monochromatic',
      });

      // New algorithm numbering: 0=monochromatic, 1=analogous, 2=cosine, 3=normal, 4=distance, 5=lch, 6=multiSource
      const algorithms = ['monochromatic', 'analogous', 'cosine', 'normal', 'distance', 'lch', 'multiSource'] as const;
      const expectedValues = [0, 1, 2, 3, 4, 5, 6];

      algorithms.forEach((algo, index) => {
        updatePhongPaletteMaterial(material, { colorAlgorithm: algo });
        expect(material.userData.customUniforms.uColorAlgorithm.value).toBe(expectedValues[index]);
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
      });

      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      // Check fragment shader modifications
      expect(mockShader.fragmentShader).toContain('uniform vec3 uRimColor');
      expect(mockShader.fragmentShader).toContain('uniform float uFresnelIntensity');
      expect(mockShader.fragmentShader).toContain('rgb2hsl');
      expect(mockShader.fragmentShader).toContain('hsl2rgb');
      // Advanced color system - cosine palette functions
      expect(mockShader.fragmentShader).toContain('cosinePalette');
      expect(mockShader.fragmentShader).toContain('uColorAlgorithm');
    });

    it('should inject fresnel rim lighting code in opaque_fragment', () => {
      const material = createPhongPaletteMaterial({
        color: '#8800FF',
        faceOpacity: 0.8,
        specularIntensity: 0.5,
        shininess: 30,
        fresnelEnabled: true,
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
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
        colorAlgorithm: 'cosine',
      });

      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      expect(mockShader.uniforms).toHaveProperty('uRimColor');
      expect(mockShader.uniforms).toHaveProperty('uFresnelIntensity');
      // Advanced color system uniforms
      expect(mockShader.uniforms).toHaveProperty('uColorAlgorithm');
      expect(mockShader.uniforms).toHaveProperty('uCosineA');
      expect(mockShader.uniforms).toHaveProperty('uCosineB');
      expect(mockShader.uniforms).toHaveProperty('uCosineC');
      expect(mockShader.uniforms).toHaveProperty('uCosineD');
      expect(mockShader.uniforms).toHaveProperty('uDistPower');
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
        colorAlgorithm: 'cosine',
      });

      // Simulate shader compilation by calling onBeforeCompile
      const mockShader = createMockShader();
      material.onBeforeCompile(mockShader, mockRenderer);

      // Now update the material
      updatePhongPaletteMaterial(material, {
        fresnelIntensity: 0.9,
        colorAlgorithm: 'lch',
      });

      // Both shader.uniforms and userData.customUniforms should be updated
      const uniforms = mockShader.uniforms;
      expect(uniforms.uFresnelIntensity?.value).toBe(0.9);
      expect(uniforms.uColorAlgorithm?.value).toBe(5); // lch = 5
    });
  });
});
