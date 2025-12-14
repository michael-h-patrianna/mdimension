/**
 * Tests for enhanced visualStore features
 * Tests shader system, bloom, lighting, and depth effects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useVisualStore,
  DEFAULT_BLOOM_ENABLED,
  DEFAULT_BLOOM_INTENSITY,
  DEFAULT_LIGHT_ENABLED,
  DEFAULT_LIGHT_COLOR,
  DEFAULT_DEPTH_ATTENUATION_ENABLED,
  DEFAULT_FACE_COLOR,
  VISUAL_PRESETS,
  DEFAULT_SHADER_TYPE,
} from '@/stores/visualStore';
import { DEFAULT_COLOR_ALGORITHM } from '@/lib/shaders/palette';

describe('visualStore - Enhanced Features', () => {
  beforeEach(() => {
    useVisualStore.getState().reset();
  });

  describe('Shader System', () => {
    it('should set shader type', () => {
      useVisualStore.getState().setShaderType('wireframe');
      expect(useVisualStore.getState().shaderType).toBe('wireframe');

      useVisualStore.getState().setShaderType('surface');
      expect(useVisualStore.getState().shaderType).toBe('surface');
    });

    it('should set wireframe settings', () => {
      useVisualStore.getState().setWireframeSettings({ lineThickness: 4 });
      expect(useVisualStore.getState().shaderSettings.wireframe.lineThickness).toBe(4);
    });

    it('should clamp wireframe line thickness', () => {
      useVisualStore.getState().setWireframeSettings({ lineThickness: 10 });
      expect(useVisualStore.getState().shaderSettings.wireframe.lineThickness).toBe(5);

      useVisualStore.getState().setWireframeSettings({ lineThickness: 0 });
      expect(useVisualStore.getState().shaderSettings.wireframe.lineThickness).toBe(1);
    });

    it('should set surface settings', () => {
      useVisualStore.getState().setSurfaceSettings({
        faceOpacity: 0.5,
        specularIntensity: 1.5,
        shininess: 64,
        fresnelEnabled: false,
      });
      expect(useVisualStore.getState().shaderSettings.surface.faceOpacity).toBe(0.5);
      expect(useVisualStore.getState().shaderSettings.surface.specularIntensity).toBe(1.5);
      expect(useVisualStore.getState().shaderSettings.surface.shininess).toBe(64);
      expect(useVisualStore.getState().shaderSettings.surface.fresnelEnabled).toBe(false);
    });

    it('should clamp surface settings', () => {
      useVisualStore.getState().setSurfaceSettings({
        faceOpacity: 2,
        specularIntensity: 10,
        shininess: 200,
      });
      expect(useVisualStore.getState().shaderSettings.surface.faceOpacity).toBe(1);
      expect(useVisualStore.getState().shaderSettings.surface.specularIntensity).toBe(2);
      expect(useVisualStore.getState().shaderSettings.surface.shininess).toBe(128);
    });
  });

  describe('Bloom Settings', () => {
    it('should toggle bloom', () => {
      useVisualStore.getState().setBloomEnabled(true);
      expect(useVisualStore.getState().bloomEnabled).toBe(true);

      useVisualStore.getState().setBloomEnabled(false);
      expect(useVisualStore.getState().bloomEnabled).toBe(false);
    });

    it('should set bloom intensity', () => {
      useVisualStore.getState().setBloomIntensity(1.5);
      expect(useVisualStore.getState().bloomIntensity).toBe(1.5);
    });

    it('should clamp bloom intensity to [0, 2]', () => {
      useVisualStore.getState().setBloomIntensity(5);
      expect(useVisualStore.getState().bloomIntensity).toBe(2);

      useVisualStore.getState().setBloomIntensity(-1);
      expect(useVisualStore.getState().bloomIntensity).toBe(0);
    });

    it('should set bloom threshold', () => {
      useVisualStore.getState().setBloomThreshold(0.5);
      expect(useVisualStore.getState().bloomThreshold).toBe(0.5);
    });

    it('should clamp bloom threshold to [0, 1]', () => {
      useVisualStore.getState().setBloomThreshold(2);
      expect(useVisualStore.getState().bloomThreshold).toBe(1);

      useVisualStore.getState().setBloomThreshold(-0.5);
      expect(useVisualStore.getState().bloomThreshold).toBe(0);
    });

    it('should set bloom radius', () => {
      useVisualStore.getState().setBloomRadius(0.6);
      expect(useVisualStore.getState().bloomRadius).toBe(0.6);
    });

    it('should clamp bloom radius to [0, 1]', () => {
      useVisualStore.getState().setBloomRadius(1.5);
      expect(useVisualStore.getState().bloomRadius).toBe(1);

      useVisualStore.getState().setBloomRadius(-0.2);
      expect(useVisualStore.getState().bloomRadius).toBe(0);
    });
  });

  describe('Lighting Settings', () => {
    it('should toggle light', () => {
      useVisualStore.getState().setLightEnabled(false);
      expect(useVisualStore.getState().lightEnabled).toBe(false);
    });

    it('should set light color', () => {
      useVisualStore.getState().setLightColor('#FFAA00');
      expect(useVisualStore.getState().lightColor).toBe('#FFAA00');
    });

    it('should set light horizontal angle', () => {
      useVisualStore.getState().setLightHorizontalAngle(180);
      expect(useVisualStore.getState().lightHorizontalAngle).toBe(180);
    });

    it('should normalize light horizontal angle to [0, 360)', () => {
      useVisualStore.getState().setLightHorizontalAngle(400);
      expect(useVisualStore.getState().lightHorizontalAngle).toBe(40);

      useVisualStore.getState().setLightHorizontalAngle(-90);
      expect(useVisualStore.getState().lightHorizontalAngle).toBe(270);
    });

    it('should set light vertical angle', () => {
      useVisualStore.getState().setLightVerticalAngle(60);
      expect(useVisualStore.getState().lightVerticalAngle).toBe(60);
    });

    it('should clamp light vertical angle to [-90, 90]', () => {
      useVisualStore.getState().setLightVerticalAngle(120);
      expect(useVisualStore.getState().lightVerticalAngle).toBe(90);

      useVisualStore.getState().setLightVerticalAngle(-120);
      expect(useVisualStore.getState().lightVerticalAngle).toBe(-90);
    });

    it('should set ambient intensity', () => {
      useVisualStore.getState().setAmbientIntensity(0.5);
      expect(useVisualStore.getState().ambientIntensity).toBe(0.5);
    });

    it('should clamp ambient intensity to [0, 3]', () => {
      useVisualStore.getState().setAmbientIntensity(5);
      expect(useVisualStore.getState().ambientIntensity).toBe(3);

      useVisualStore.getState().setAmbientIntensity(-0.5);
      expect(useVisualStore.getState().ambientIntensity).toBe(0);
    });

    it('should set specular intensity', () => {
      useVisualStore.getState().setSpecularIntensity(1.5);
      expect(useVisualStore.getState().specularIntensity).toBe(1.5);
    });

    it('should clamp specular intensity to [0, 2]', () => {
      useVisualStore.getState().setSpecularIntensity(5);
      expect(useVisualStore.getState().specularIntensity).toBe(2);
    });

    it('should set shininess', () => {
      useVisualStore.getState().setShininess(64);
      expect(useVisualStore.getState().shininess).toBe(64);
    });

    it('should clamp shininess to [1, 128]', () => {
      useVisualStore.getState().setShininess(200);
      expect(useVisualStore.getState().shininess).toBe(128);

      useVisualStore.getState().setShininess(0);
      expect(useVisualStore.getState().shininess).toBe(1);
    });

    it('should toggle light indicator', () => {
      useVisualStore.getState().setShowLightIndicator(true);
      expect(useVisualStore.getState().showLightIndicator).toBe(true);
    });
  });

  describe('Depth Effects', () => {
    it('should toggle depth attenuation', () => {
      useVisualStore.getState().setDepthAttenuationEnabled(false);
      expect(useVisualStore.getState().depthAttenuationEnabled).toBe(false);
    });

    it('should set depth attenuation strength', () => {
      useVisualStore.getState().setDepthAttenuationStrength(0.4);
      expect(useVisualStore.getState().depthAttenuationStrength).toBe(0.4);
    });

    it('should clamp depth attenuation strength to [0, 0.5]', () => {
      useVisualStore.getState().setDepthAttenuationStrength(1);
      expect(useVisualStore.getState().depthAttenuationStrength).toBe(0.5);

      useVisualStore.getState().setDepthAttenuationStrength(-0.5);
      expect(useVisualStore.getState().depthAttenuationStrength).toBe(0);
    });

    it('should toggle fresnel', () => {
      useVisualStore.getState().setFresnelEnabled(false);
      expect(useVisualStore.getState().fresnelEnabled).toBe(false);
    });

    it('should set fresnel intensity', () => {
      useVisualStore.getState().setFresnelIntensity(0.8);
      expect(useVisualStore.getState().fresnelIntensity).toBe(0.8);
    });

    it('should clamp fresnel intensity to [0, 1]', () => {
      useVisualStore.getState().setFresnelIntensity(2);
      expect(useVisualStore.getState().fresnelIntensity).toBe(1);

      useVisualStore.getState().setFresnelIntensity(-0.5);
      expect(useVisualStore.getState().fresnelIntensity).toBe(0);
    });

    it('should toggle per-dimension color', () => {
      useVisualStore.getState().setPerDimensionColorEnabled(true);
      expect(useVisualStore.getState().perDimensionColorEnabled).toBe(true);
    });
  });

  describe('Face Color', () => {
    it('should set face color', () => {
      useVisualStore.getState().setFaceColor('#FF00FF');
      expect(useVisualStore.getState().faceColor).toBe('#FF00FF');
    });
  });

  describe('Synthwave Preset', () => {
    it('should apply synthwave preset', () => {
      useVisualStore.getState().applyPreset('synthwave');
      expect(useVisualStore.getState().edgeColor).toBe(VISUAL_PRESETS.synthwave.edgeColor);
      expect(useVisualStore.getState().backgroundColor).toBe(VISUAL_PRESETS.synthwave.backgroundColor);
      expect(useVisualStore.getState().faceColor).toBe(VISUAL_PRESETS.synthwave.faceColor);
    });
  });

  describe('Reset', () => {
    it('should reset all enhanced settings to defaults', () => {
      // Modify all settings
      useVisualStore.getState().setShaderType('surface');
      useVisualStore.getState().setBloomEnabled(true);
      useVisualStore.getState().setBloomIntensity(1.5);
      useVisualStore.getState().setLightEnabled(false);
      useVisualStore.getState().setLightColor('#FF0000');
      useVisualStore.getState().setDepthAttenuationEnabled(false);
      useVisualStore.getState().setFaceColor('#00FF00');

      // Reset
      useVisualStore.getState().reset();

      // Verify all reset
      expect(useVisualStore.getState().shaderType).toBe(DEFAULT_SHADER_TYPE);
      expect(useVisualStore.getState().bloomEnabled).toBe(DEFAULT_BLOOM_ENABLED);
      expect(useVisualStore.getState().bloomIntensity).toBe(DEFAULT_BLOOM_INTENSITY);
      expect(useVisualStore.getState().lightEnabled).toBe(DEFAULT_LIGHT_ENABLED);
      expect(useVisualStore.getState().lightColor).toBe(DEFAULT_LIGHT_COLOR);
      expect(useVisualStore.getState().depthAttenuationEnabled).toBe(DEFAULT_DEPTH_ATTENUATION_ENABLED);
      expect(useVisualStore.getState().faceColor).toBe(DEFAULT_FACE_COLOR);
    });
  });

  describe('Color Algorithm', () => {
    it('should set color algorithm', () => {
      useVisualStore.getState().setColorAlgorithm('monochromatic');
      expect(useVisualStore.getState().colorAlgorithm).toBe('monochromatic');

      useVisualStore.getState().setColorAlgorithm('analogous');
      expect(useVisualStore.getState().colorAlgorithm).toBe('analogous');

      useVisualStore.getState().setColorAlgorithm('cosine');
      expect(useVisualStore.getState().colorAlgorithm).toBe('cosine');

      useVisualStore.getState().setColorAlgorithm('lch');
      expect(useVisualStore.getState().colorAlgorithm).toBe('lch');
    });

    it('should reset color algorithm to default on reset', () => {
      useVisualStore.getState().setColorAlgorithm('lch');
      expect(useVisualStore.getState().colorAlgorithm).toBe('lch');

      useVisualStore.getState().reset();
      expect(useVisualStore.getState().colorAlgorithm).toBe(DEFAULT_COLOR_ALGORITHM);
    });
  });
});
