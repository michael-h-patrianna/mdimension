/**
 * Tests for enhanced appearanceStore features
 * Tests shader system, bloom, lighting, and depth effects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { APPEARANCE_INITIAL_STATE } from '@/stores/slices/appearanceSlice';
import { LIGHTING_INITIAL_STATE } from '@/stores/slices/lightingSlice';
import { POST_PROCESSING_INITIAL_STATE } from '@/stores/slices/postProcessingSlice';
import {
  DEFAULT_BLOOM_INTENSITY,
  DEFAULT_BLOOM_ENABLED,
  DEFAULT_COLOR_ALGORITHM,
  DEFAULT_FACE_COLOR,
  DEFAULT_LIGHT_COLOR,
  DEFAULT_LIGHT_ENABLED,
  DEFAULT_SHADER_TYPE,
  VISUAL_PRESETS,
} from '@/stores/defaults/visualDefaults';

describe('Enhanced Features Stores', () => {
  beforeEach(() => {
    useAppearanceStore.setState(APPEARANCE_INITIAL_STATE);
    useLightingStore.setState(LIGHTING_INITIAL_STATE);
    usePostProcessingStore.setState(POST_PROCESSING_INITIAL_STATE);
  });

  describe('Shader System', () => {
    it('should set shader type', () => {
      useAppearanceStore.getState().setShaderType('wireframe');
      expect(useAppearanceStore.getState().shaderType).toBe('wireframe');

      useAppearanceStore.getState().setShaderType('surface');
      expect(useAppearanceStore.getState().shaderType).toBe('surface');
    });

    it('should set wireframe settings', () => {
      useAppearanceStore.getState().setWireframeSettings({ lineThickness: 4 });
      expect(useAppearanceStore.getState().shaderSettings.wireframe.lineThickness).toBe(4);
    });

    it('should clamp wireframe line thickness', () => {
      useAppearanceStore.getState().setWireframeSettings({ lineThickness: 10 });
      expect(useAppearanceStore.getState().shaderSettings.wireframe.lineThickness).toBe(5);

      useAppearanceStore.getState().setWireframeSettings({ lineThickness: 0 });
      expect(useAppearanceStore.getState().shaderSettings.wireframe.lineThickness).toBe(1);
    });

    it('should set surface settings', () => {
      useAppearanceStore.getState().setSurfaceSettings({
        faceOpacity: 0.5,
        specularIntensity: 1.5,
        fresnelEnabled: false,
      });
      expect(useAppearanceStore.getState().shaderSettings.surface.faceOpacity).toBe(0.5);
      expect(useAppearanceStore.getState().shaderSettings.surface.specularIntensity).toBe(1.5);
      expect(useAppearanceStore.getState().shaderSettings.surface.fresnelEnabled).toBe(false);
    });

    it('should clamp surface settings', () => {
      useAppearanceStore.getState().setSurfaceSettings({
        faceOpacity: 2,
        specularIntensity: 10,
      });
      expect(useAppearanceStore.getState().shaderSettings.surface.faceOpacity).toBe(1);
      expect(useAppearanceStore.getState().shaderSettings.surface.specularIntensity).toBe(2);
    });
  });

  describe('Bloom Settings', () => {
    it('should toggle bloom', () => {
      usePostProcessingStore.getState().setBloomEnabled(true);
      expect(usePostProcessingStore.getState().bloomEnabled).toBe(true);

      usePostProcessingStore.getState().setBloomEnabled(false);
      expect(usePostProcessingStore.getState().bloomEnabled).toBe(false);
    });

    it('should set bloom intensity', () => {
      usePostProcessingStore.getState().setBloomIntensity(1.5);
      expect(usePostProcessingStore.getState().bloomIntensity).toBe(1.5);
    });

    it('should clamp bloom intensity to [0, 2]', () => {
      usePostProcessingStore.getState().setBloomIntensity(5);
      expect(usePostProcessingStore.getState().bloomIntensity).toBe(2);

      usePostProcessingStore.getState().setBloomIntensity(-1);
      expect(usePostProcessingStore.getState().bloomIntensity).toBe(0);
    });

    it('should set bloom threshold', () => {
      usePostProcessingStore.getState().setBloomThreshold(0.5);
      expect(usePostProcessingStore.getState().bloomThreshold).toBe(0.5);
    });

    it('should clamp bloom threshold to [0, 1]', () => {
      usePostProcessingStore.getState().setBloomThreshold(2);
      expect(usePostProcessingStore.getState().bloomThreshold).toBe(1);

      usePostProcessingStore.getState().setBloomThreshold(-0.5);
      expect(usePostProcessingStore.getState().bloomThreshold).toBe(0);
    });

    it('should set bloom radius', () => {
      usePostProcessingStore.getState().setBloomRadius(0.6);
      expect(usePostProcessingStore.getState().bloomRadius).toBe(0.6);
    });

    it('should clamp bloom radius to [0, 1]', () => {
      usePostProcessingStore.getState().setBloomRadius(1.5);
      expect(usePostProcessingStore.getState().bloomRadius).toBe(1);

      usePostProcessingStore.getState().setBloomRadius(-0.2);
      expect(usePostProcessingStore.getState().bloomRadius).toBe(0);
    });
  });

  describe('Lighting Settings', () => {
    it('should toggle light', () => {
      useLightingStore.getState().setLightEnabled(false);
      expect(useLightingStore.getState().lightEnabled).toBe(false);
    });

    it('should set light color', () => {
      useLightingStore.getState().setLightColor('#FFAA00');
      expect(useLightingStore.getState().lightColor).toBe('#FFAA00');
    });

    it('should set light horizontal angle', () => {
      useLightingStore.getState().setLightHorizontalAngle(180);
      expect(useLightingStore.getState().lightHorizontalAngle).toBe(180);
    });

    it('should normalize light horizontal angle to [0, 360)', () => {
      useLightingStore.getState().setLightHorizontalAngle(400);
      expect(useLightingStore.getState().lightHorizontalAngle).toBe(40);

      useLightingStore.getState().setLightHorizontalAngle(-90);
      expect(useLightingStore.getState().lightHorizontalAngle).toBe(270);
    });

    it('should set light vertical angle', () => {
      useLightingStore.getState().setLightVerticalAngle(60);
      expect(useLightingStore.getState().lightVerticalAngle).toBe(60);
    });

    it('should clamp light vertical angle to [-90, 90]', () => {
      useLightingStore.getState().setLightVerticalAngle(120);
      expect(useLightingStore.getState().lightVerticalAngle).toBe(90);

      useLightingStore.getState().setLightVerticalAngle(-120);
      expect(useLightingStore.getState().lightVerticalAngle).toBe(-90);
    });

    it('should set ambient intensity', () => {
      useLightingStore.getState().setAmbientIntensity(0.5);
      expect(useLightingStore.getState().ambientIntensity).toBe(0.5);
    });

    it('should clamp ambient intensity to [0, 1]', () => {
      useLightingStore.getState().setAmbientIntensity(5);
      expect(useLightingStore.getState().ambientIntensity).toBe(1);

      useLightingStore.getState().setAmbientIntensity(-0.5);
      expect(useLightingStore.getState().ambientIntensity).toBe(0);
    });

    // Note: specularIntensity tests moved to pbrStore tests
    // These properties are now in the unified PBR system

    it('should toggle light indicator', () => {
      useLightingStore.getState().setShowLightIndicator(true);
      expect(useLightingStore.getState().showLightIndicator).toBe(true);
    });
  });

  describe('Surface Effects', () => {
    it('should toggle fresnel', () => {
      useAppearanceStore.getState().setFresnelEnabled(false);
      expect(useAppearanceStore.getState().fresnelEnabled).toBe(false);
    });

    it('should set fresnel intensity', () => {
      useAppearanceStore.getState().setFresnelIntensity(0.8);
      expect(useAppearanceStore.getState().fresnelIntensity).toBe(0.8);
    });

    it('should clamp fresnel intensity to [0, 1]', () => {
      useAppearanceStore.getState().setFresnelIntensity(2);
      expect(useAppearanceStore.getState().fresnelIntensity).toBe(1);

      useAppearanceStore.getState().setFresnelIntensity(-0.5);
      expect(useAppearanceStore.getState().fresnelIntensity).toBe(0);
    });

    it('should toggle per-dimension color', () => {
      useAppearanceStore.getState().setPerDimensionColorEnabled(true);
      expect(useAppearanceStore.getState().perDimensionColorEnabled).toBe(true);
    });
  });

  describe('Face Color', () => {
    it('should set face color', () => {
      useAppearanceStore.getState().setFaceColor('#FF00FF');
      expect(useAppearanceStore.getState().faceColor).toBe('#FF00FF');
    });
  });

  describe('Synthwave Preset', () => {
    it('should apply synthwave preset', () => {
      useAppearanceStore.getState().applyPreset('synthwave');
      expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.synthwave.edgeColor);
      expect(useAppearanceStore.getState().backgroundColor).toBe(VISUAL_PRESETS.synthwave.backgroundColor);
      expect(useAppearanceStore.getState().faceColor).toBe(VISUAL_PRESETS.synthwave.faceColor);
    });
  });

  describe('Reset', () => {
    it('should reset all enhanced settings to defaults', () => {
      // Modify all settings
      useAppearanceStore.getState().setShaderType('surface');
      usePostProcessingStore.getState().setBloomEnabled(true);
      usePostProcessingStore.getState().setBloomIntensity(1.5);
      useLightingStore.getState().setLightEnabled(false);
      useLightingStore.getState().setLightColor('#FF0000');
      useAppearanceStore.getState().setFaceColor('#00FF00');

      // Reset
      useAppearanceStore.setState(APPEARANCE_INITIAL_STATE);
      useLightingStore.setState(LIGHTING_INITIAL_STATE);
      usePostProcessingStore.setState(POST_PROCESSING_INITIAL_STATE);

      // Verify all reset
      expect(useAppearanceStore.getState().shaderType).toBe(DEFAULT_SHADER_TYPE);
      expect(usePostProcessingStore.getState().bloomEnabled).toBe(DEFAULT_BLOOM_ENABLED);
      expect(usePostProcessingStore.getState().bloomIntensity).toBe(DEFAULT_BLOOM_INTENSITY);
      expect(useLightingStore.getState().lightEnabled).toBe(DEFAULT_LIGHT_ENABLED);
      expect(useLightingStore.getState().lightColor).toBe(DEFAULT_LIGHT_COLOR);
      expect(useAppearanceStore.getState().faceColor).toBe(DEFAULT_FACE_COLOR);
    });
  });

  describe('Color Algorithm', () => {
    it('should set color algorithm', () => {
      useAppearanceStore.getState().setColorAlgorithm('monochromatic');
      expect(useAppearanceStore.getState().colorAlgorithm).toBe('monochromatic');

      useAppearanceStore.getState().setColorAlgorithm('analogous');
      expect(useAppearanceStore.getState().colorAlgorithm).toBe('analogous');

      useAppearanceStore.getState().setColorAlgorithm('cosine');
      expect(useAppearanceStore.getState().colorAlgorithm).toBe('cosine');

      useAppearanceStore.getState().setColorAlgorithm('lch');
      expect(useAppearanceStore.getState().colorAlgorithm).toBe('lch');
    });

    it('should reset color algorithm to default on reset', () => {
      useAppearanceStore.getState().setColorAlgorithm('lch');
      expect(useAppearanceStore.getState().colorAlgorithm).toBe('lch');

      useAppearanceStore.setState(APPEARANCE_INITIAL_STATE);
      expect(useAppearanceStore.getState().colorAlgorithm).toBe(DEFAULT_COLOR_ALGORITHM);
    });
  });

  // Note: Edge-specific Specular and Unified PBR Properties tests have been moved to
  // a dedicated pbrStore.test.ts file. These properties are now managed by the
  // unified PBR system via usePBRStore with face/edge/ground configurations.
});
