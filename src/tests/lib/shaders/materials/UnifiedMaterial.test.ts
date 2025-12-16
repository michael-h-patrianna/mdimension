import { describe, it, expect } from 'vitest';
import { ShaderMaterial, Color } from 'three';
import {
  createUnifiedMaterial,
  updateUnifiedMaterial,
  updateUnifiedMaterialVisuals,
  updateUnifiedMaterialPalette,
  updateUnifiedMaterialLighting,
  updateUnifiedMaterialFresnel,
} from '@/rendering/materials/unified/UnifiedMaterial';
import { createIdentityMatrix, createRotationMatrix } from '@/lib/math';

describe('UnifiedMaterial', () => {
  describe('createUnifiedMaterial', () => {
    it('should create a ShaderMaterial', () => {
      const material = createUnifiedMaterial();
      expect(material).toBeInstanceOf(ShaderMaterial);
    });

    it('should use default options', () => {
      const material = createUnifiedMaterial();

      expect(material.uniforms.uOpacity!.value).toBe(1.0);
      expect(material.transparent).toBe(false);
    });

    it('should accept custom color', () => {
      const material = createUnifiedMaterial({ color: '#FF0000' });
      const color = material.uniforms.uColor!.value as Color;

      expect(color.getHexString()).toBe('ff0000');
    });

    it('should accept Color instance', () => {
      const inputColor = new Color('#00FF00');
      const material = createUnifiedMaterial({ color: inputColor });
      const color = material.uniforms.uColor!.value as Color;

      expect(color.getHexString()).toBe('00ff00');
    });

    it('should set opacity correctly', () => {
      const material = createUnifiedMaterial({ opacity: 0.5 });

      expect(material.uniforms.uOpacity!.value).toBe(0.5);
      expect(material.transparent).toBe(true);
    });

    it('should set color mode correctly', () => {
      const solidMaterial = createUnifiedMaterial({ colorMode: 'solid' });
      expect(solidMaterial.uniforms.uColorMode!.value).toBe(0);

      const paletteMaterial = createUnifiedMaterial({ colorMode: 'palette' });
      expect(paletteMaterial.uniforms.uColorMode!.value).toBe(1);

      const depthMaterial = createUnifiedMaterial({ colorMode: 'depth' });
      expect(depthMaterial.uniforms.uColorMode!.value).toBe(2);
    });

    it('should set fresnel enabled', () => {
      const material = createUnifiedMaterial({ fresnelEnabled: true });
      expect(material.uniforms.uFresnelEnabled!.value).toBe(true);

      const materialNoFresnel = createUnifiedMaterial({ fresnelEnabled: false });
      expect(materialNoFresnel.uniforms.uFresnelEnabled!.value).toBe(false);
    });

    it('should set point size for points mode', () => {
      const material = createUnifiedMaterial({ renderMode: 'points', pointSize: 5.0 });
      expect(material.uniforms.uPointSize!.value).toBe(5.0);
    });

    it('should include vertex shader code', () => {
      const material = createUnifiedMaterial();
      expect(material.vertexShader).toContain('void main()');
      expect(material.vertexShader).toContain('gl_Position');
    });

    it('should include fragment shader code', () => {
      const material = createUnifiedMaterial();
      expect(material.fragmentShader).toContain('void main()');
      expect(material.fragmentShader).toContain('gl_FragColor');
    });

    it('should support custom max dimension', () => {
      const material = createUnifiedMaterial({ maxDimension: 6 });
      expect(material.vertexShader).toContain('Supports dimensions 3 to 6');
    });
  });

  describe('updateUnifiedMaterial', () => {
    it('should update rotation matrix', () => {
      const material = createUnifiedMaterial();
      const rotationMatrix = createRotationMatrix(4, 0, 1, Math.PI / 4);

      updateUnifiedMaterial(
        material,
        rotationMatrix,
        4,
        [1, 1, 1, 1],
        5.0,
        'perspective'
      );

      expect(material.uniforms.uDimension!.value).toBe(4);
      expect(material.uniforms.uProjectionDistance!.value).toBe(5.0);
      expect(material.uniforms.uProjectionType!.value).toBe(1);
    });

    it('should update projection type', () => {
      const material = createUnifiedMaterial();
      const rotationMatrix = createIdentityMatrix(4);

      updateUnifiedMaterial(
        material,
        rotationMatrix,
        4,
        [1, 1, 1, 1],
        5.0,
        'orthographic'
      );

      expect(material.uniforms.uProjectionType!.value).toBe(0);
    });

    it('should update scales', () => {
      const material = createUnifiedMaterial();
      const rotationMatrix = createIdentityMatrix(6);

      updateUnifiedMaterial(
        material,
        rotationMatrix,
        6,
        [1, 2, 3, 4, 5, 6],
        5.0,
        'perspective'
      );

      const scale4D = material.uniforms.uScale4D!.value as number[];
      expect(scale4D[0]).toBe(1);
      expect(scale4D[1]).toBe(2);
      expect(scale4D[2]).toBe(3);
      expect(scale4D[3]).toBe(4);

      const extraScales = material.uniforms.uExtraScales!.value as Float32Array;
      expect(extraScales[0]).toBe(5);
      expect(extraScales[1]).toBe(6);
    });
  });

  describe('updateUnifiedMaterialVisuals', () => {
    it('should update color', () => {
      const material = createUnifiedMaterial();

      updateUnifiedMaterialVisuals(material, '#FF00FF', 1.0, 'solid');

      const color = material.uniforms.uColor!.value as Color;
      expect(color.getHexString()).toBe('ff00ff');
    });

    it('should update opacity', () => {
      const material = createUnifiedMaterial();

      updateUnifiedMaterialVisuals(material, '#FFFFFF', 0.5, 'solid');

      expect(material.uniforms.uOpacity!.value).toBe(0.5);
      expect(material.transparent).toBe(true);
    });

    it('should update color mode', () => {
      const material = createUnifiedMaterial();

      updateUnifiedMaterialVisuals(material, '#FFFFFF', 1.0, 'palette');
      expect(material.uniforms.uColorMode!.value).toBe(1);

      updateUnifiedMaterialVisuals(material, '#FFFFFF', 1.0, 'depth');
      expect(material.uniforms.uColorMode!.value).toBe(2);
    });
  });

  describe('updateUnifiedMaterialPalette', () => {
    it('should update palette colors', () => {
      const material = createUnifiedMaterial();

      updateUnifiedMaterialPalette(material, '#FF0000', '#0000FF');

      const startColor = material.uniforms.uPaletteStart!.value as Color;
      const endColor = material.uniforms.uPaletteEnd!.value as Color;

      expect(startColor.getHexString()).toBe('ff0000');
      expect(endColor.getHexString()).toBe('0000ff');
    });

    it('should accept Color instances', () => {
      const material = createUnifiedMaterial();

      updateUnifiedMaterialPalette(
        material,
        new Color('#00FF00'),
        new Color('#FFFF00')
      );

      const startColor = material.uniforms.uPaletteStart!.value as Color;
      expect(startColor.getHexString()).toBe('00ff00');
    });
  });

  describe('updateUnifiedMaterialLighting', () => {
    it('should update lighting properties', () => {
      const material = createUnifiedMaterial();

      updateUnifiedMaterialLighting(material, 0.5, 0.9, [1, 0, 0]);

      expect(material.uniforms.uAmbientIntensity!.value).toBe(0.5);
      expect(material.uniforms.uDirectionalIntensity!.value).toBe(0.9);
      expect(material.uniforms.uDirectionalDirection!.value).toEqual([1, 0, 0]);
    });
  });

  describe('updateUnifiedMaterialFresnel', () => {
    it('should update fresnel properties', () => {
      const material = createUnifiedMaterial();

      updateUnifiedMaterialFresnel(material, true, 4.0, 0.8);

      expect(material.uniforms.uFresnelEnabled!.value).toBe(true);
      expect(material.uniforms.uFresnelPower!.value).toBe(4.0);
      expect(material.uniforms.uFresnelIntensity!.value).toBe(0.8);
    });

    it('should disable fresnel', () => {
      const material = createUnifiedMaterial({ fresnelEnabled: true });

      updateUnifiedMaterialFresnel(material, false, 3.0, 0.5);

      expect(material.uniforms.uFresnelEnabled!.value).toBe(false);
    });
  });
});
