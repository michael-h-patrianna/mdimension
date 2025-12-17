/**
 * Tests for visualStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppearanceStore } from '@/stores/appearanceStore';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_EDGES_VISIBLE,
  DEFAULT_EDGE_COLOR,
  DEFAULT_EDGE_METALLIC,
  DEFAULT_EDGE_ROUGHNESS,
  DEFAULT_EDGE_THICKNESS,
  DEFAULT_FACES_VISIBLE,
  DEFAULT_FACE_OPACITY,
  VISUAL_PRESETS,
} from '@/stores/defaults/visualDefaults';
import { APPEARANCE_INITIAL_STATE } from '@/stores/slices/appearanceSlice';

describe('appearanceStore', () => {
  beforeEach(() => {
    useAppearanceStore.setState(APPEARANCE_INITIAL_STATE);
  });

  describe('Initial State', () => {
    it('should have default edge color', () => {
      expect(useAppearanceStore.getState().edgeColor).toBe(DEFAULT_EDGE_COLOR);
    });

    it('should have default edge thickness', () => {
      expect(useAppearanceStore.getState().edgeThickness).toBe(DEFAULT_EDGE_THICKNESS);
    });

    it('should have default face opacity', () => {
      expect(useAppearanceStore.getState().faceOpacity).toBe(DEFAULT_FACE_OPACITY);
    });

    it('should have default background color', () => {
      expect(useAppearanceStore.getState().backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
    });

    it('should have edges visible by default', () => {
      expect(useAppearanceStore.getState().edgesVisible).toBe(DEFAULT_EDGES_VISIBLE);
    });

    it('should have faces hidden by default', () => {
      expect(useAppearanceStore.getState().facesVisible).toBe(DEFAULT_FACES_VISIBLE);
    });
  });

  describe('setEdgeColor', () => {
    it('should set edge color', () => {
      useAppearanceStore.getState().setEdgeColor('#FF0000');
      expect(useAppearanceStore.getState().edgeColor).toBe('#FF0000');
    });
  });

  describe('setEdgeThickness', () => {
    it('should set edge thickness', () => {
      useAppearanceStore.getState().setEdgeThickness(4);
      expect(useAppearanceStore.getState().edgeThickness).toBe(4);
    });

    it('should clamp thickness to [0, 5]', () => {
      useAppearanceStore.getState().setEdgeThickness(-1);
      expect(useAppearanceStore.getState().edgeThickness).toBe(0);

      useAppearanceStore.getState().setEdgeThickness(10);
      expect(useAppearanceStore.getState().edgeThickness).toBe(5);
    });
  });

  describe('setFaceOpacity', () => {
    it('should set face opacity', () => {
      useAppearanceStore.getState().setFaceOpacity(0.5);
      expect(useAppearanceStore.getState().faceOpacity).toBe(0.5);
    });

    it('should clamp opacity to [0, 1]', () => {
      useAppearanceStore.getState().setFaceOpacity(-0.5);
      expect(useAppearanceStore.getState().faceOpacity).toBe(0);

      useAppearanceStore.getState().setFaceOpacity(1.5);
      expect(useAppearanceStore.getState().faceOpacity).toBe(1);
    });
  });

  describe('setBackgroundColor', () => {
    it('should set background color', () => {
      useAppearanceStore.getState().setBackgroundColor('#222222');
      expect(useAppearanceStore.getState().backgroundColor).toBe('#222222');
    });
  });

  describe('setEdgesVisible', () => {
    it('should set edges visibility', () => {
      useAppearanceStore.getState().setEdgesVisible(false);
      expect(useAppearanceStore.getState().edgesVisible).toBe(false);

      useAppearanceStore.getState().setEdgesVisible(true);
      expect(useAppearanceStore.getState().edgesVisible).toBe(true);
    });
  });

  describe('setFacesVisible', () => {
    it('should set faces visibility', () => {
      useAppearanceStore.getState().setFacesVisible(true);
      expect(useAppearanceStore.getState().facesVisible).toBe(true);

      useAppearanceStore.getState().setFacesVisible(false);
      expect(useAppearanceStore.getState().facesVisible).toBe(false);
    });

    it('should auto-set shaderType to surface when faces enabled', () => {
      useAppearanceStore.getState().setFacesVisible(true);
      expect(useAppearanceStore.getState().shaderType).toBe('surface');
    });

    it('should auto-set shaderType to wireframe when faces disabled', () => {
      // First enable faces to set surface shader
      useAppearanceStore.getState().setFacesVisible(true);
      expect(useAppearanceStore.getState().shaderType).toBe('surface');

      // Then disable faces
      useAppearanceStore.getState().setFacesVisible(false);
      expect(useAppearanceStore.getState().shaderType).toBe('wireframe');
    });
  });

  describe('applyPreset', () => {
    it('should apply neon preset', () => {
      useAppearanceStore.getState().applyPreset('neon');
      expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.neon.edgeColor);
      expect(useAppearanceStore.getState().backgroundColor).toBe(VISUAL_PRESETS.neon.backgroundColor);
    });

    it('should apply blueprint preset', () => {
      useAppearanceStore.getState().applyPreset('blueprint');
      expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.blueprint.edgeColor);
    });

    it('should apply hologram preset', () => {
      useAppearanceStore.getState().applyPreset('hologram');
      expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.hologram.edgeColor);
    });

    it('should apply scientific preset', () => {
      useAppearanceStore.getState().applyPreset('scientific');
      expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.scientific.edgeColor);
    });
  });

  describe('reset', () => {
    it('should reset all visual settings to defaults', () => {
      useAppearanceStore.getState().setEdgeColor('#FF0000');
      useAppearanceStore.getState().setEdgeThickness(5);
      useAppearanceStore.getState().setFaceOpacity(1);
      useAppearanceStore.getState().setBackgroundColor('#000000');
      useAppearanceStore.getState().setEdgesVisible(false);
      useAppearanceStore.getState().setFacesVisible(true);

      useAppearanceStore.setState(APPEARANCE_INITIAL_STATE);

      expect(useAppearanceStore.getState().edgeColor).toBe(DEFAULT_EDGE_COLOR);
      expect(useAppearanceStore.getState().edgeThickness).toBe(DEFAULT_EDGE_THICKNESS);
      expect(useAppearanceStore.getState().faceOpacity).toBe(DEFAULT_FACE_OPACITY);
      expect(useAppearanceStore.getState().backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
      expect(useAppearanceStore.getState().edgesVisible).toBe(DEFAULT_EDGES_VISIBLE);
      expect(useAppearanceStore.getState().facesVisible).toBe(DEFAULT_FACES_VISIBLE);
    });
  });



  describe('edgeMetallic', () => {
    it('should have default edge metallic of 0', () => {
      expect(useAppearanceStore.getState().edgeMetallic).toBe(DEFAULT_EDGE_METALLIC);
      expect(DEFAULT_EDGE_METALLIC).toBe(0);
    });

    it('should set edge metallic', () => {
      useAppearanceStore.getState().setEdgeMetallic(0.5);
      expect(useAppearanceStore.getState().edgeMetallic).toBe(0.5);
    });

    it('should clamp edge metallic to [0, 1]', () => {
      useAppearanceStore.getState().setEdgeMetallic(-0.5);
      expect(useAppearanceStore.getState().edgeMetallic).toBe(0);

      useAppearanceStore.getState().setEdgeMetallic(1.5);
      expect(useAppearanceStore.getState().edgeMetallic).toBe(1);
    });
  });

  describe('edgeRoughness', () => {
    it('should have default edge roughness of 0.5', () => {
      expect(useAppearanceStore.getState().edgeRoughness).toBe(DEFAULT_EDGE_ROUGHNESS);
      expect(DEFAULT_EDGE_ROUGHNESS).toBe(0.5);
    });

    it('should set edge roughness', () => {
      useAppearanceStore.getState().setEdgeRoughness(0.8);
      expect(useAppearanceStore.getState().edgeRoughness).toBe(0.8);
    });

    it('should clamp edge roughness to [0, 1]', () => {
      useAppearanceStore.getState().setEdgeRoughness(-0.5);
      expect(useAppearanceStore.getState().edgeRoughness).toBe(0);

      useAppearanceStore.getState().setEdgeRoughness(1.5);
      expect(useAppearanceStore.getState().edgeRoughness).toBe(1);
    });
  });


});
