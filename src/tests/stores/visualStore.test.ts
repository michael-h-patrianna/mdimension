/**
 * Tests for visualStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useVisualStore,
  DEFAULT_EDGE_COLOR,
  DEFAULT_EDGE_THICKNESS,
  DEFAULT_VERTEX_VISIBLE,
  DEFAULT_VERTEX_SIZE,
  DEFAULT_VERTEX_COLOR,
  DEFAULT_FACE_OPACITY,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_EDGES_VISIBLE,
  DEFAULT_FACES_VISIBLE,
  VISUAL_PRESETS,
} from '@/stores/visualStore';

describe('visualStore', () => {
  beforeEach(() => {
    useVisualStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have default edge color', () => {
      expect(useVisualStore.getState().edgeColor).toBe(DEFAULT_EDGE_COLOR);
    });

    it('should have default edge thickness', () => {
      expect(useVisualStore.getState().edgeThickness).toBe(DEFAULT_EDGE_THICKNESS);
    });

    it('should have vertices visible by default', () => {
      expect(useVisualStore.getState().vertexVisible).toBe(DEFAULT_VERTEX_VISIBLE);
    });

    it('should have default vertex size', () => {
      expect(useVisualStore.getState().vertexSize).toBe(DEFAULT_VERTEX_SIZE);
    });

    it('should have default vertex color', () => {
      expect(useVisualStore.getState().vertexColor).toBe(DEFAULT_VERTEX_COLOR);
    });

    it('should have default face opacity', () => {
      expect(useVisualStore.getState().faceOpacity).toBe(DEFAULT_FACE_OPACITY);
    });

    it('should have default background color', () => {
      expect(useVisualStore.getState().backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
    });

    it('should have edges visible by default', () => {
      expect(useVisualStore.getState().edgesVisible).toBe(DEFAULT_EDGES_VISIBLE);
    });

    it('should have faces hidden by default', () => {
      expect(useVisualStore.getState().facesVisible).toBe(DEFAULT_FACES_VISIBLE);
    });
  });

  describe('setEdgeColor', () => {
    it('should set edge color', () => {
      useVisualStore.getState().setEdgeColor('#FF0000');
      expect(useVisualStore.getState().edgeColor).toBe('#FF0000');
    });
  });

  describe('setEdgeThickness', () => {
    it('should set edge thickness', () => {
      useVisualStore.getState().setEdgeThickness(4);
      expect(useVisualStore.getState().edgeThickness).toBe(4);
    });

    it('should clamp thickness to [1, 5]', () => {
      useVisualStore.getState().setEdgeThickness(0);
      expect(useVisualStore.getState().edgeThickness).toBe(1);

      useVisualStore.getState().setEdgeThickness(10);
      expect(useVisualStore.getState().edgeThickness).toBe(5);
    });
  });

  describe('setVertexVisible', () => {
    it('should toggle vertex visibility', () => {
      useVisualStore.getState().setVertexVisible(false);
      expect(useVisualStore.getState().vertexVisible).toBe(false);
    });
  });

  describe('setVertexSize', () => {
    it('should set vertex size', () => {
      useVisualStore.getState().setVertexSize(8);
      expect(useVisualStore.getState().vertexSize).toBe(8);
    });

    it('should clamp size to [1, 10]', () => {
      useVisualStore.getState().setVertexSize(0);
      expect(useVisualStore.getState().vertexSize).toBe(1);

      useVisualStore.getState().setVertexSize(20);
      expect(useVisualStore.getState().vertexSize).toBe(10);
    });
  });

  describe('setVertexColor', () => {
    it('should set vertex color', () => {
      useVisualStore.getState().setVertexColor('#00FF00');
      expect(useVisualStore.getState().vertexColor).toBe('#00FF00');
    });
  });

  describe('setFaceOpacity', () => {
    it('should set face opacity', () => {
      useVisualStore.getState().setFaceOpacity(0.5);
      expect(useVisualStore.getState().faceOpacity).toBe(0.5);
    });

    it('should clamp opacity to [0, 1]', () => {
      useVisualStore.getState().setFaceOpacity(-0.5);
      expect(useVisualStore.getState().faceOpacity).toBe(0);

      useVisualStore.getState().setFaceOpacity(1.5);
      expect(useVisualStore.getState().faceOpacity).toBe(1);
    });
  });

  describe('setBackgroundColor', () => {
    it('should set background color', () => {
      useVisualStore.getState().setBackgroundColor('#222222');
      expect(useVisualStore.getState().backgroundColor).toBe('#222222');
    });
  });

  describe('setEdgesVisible', () => {
    it('should set edges visibility', () => {
      useVisualStore.getState().setEdgesVisible(false);
      expect(useVisualStore.getState().edgesVisible).toBe(false);

      useVisualStore.getState().setEdgesVisible(true);
      expect(useVisualStore.getState().edgesVisible).toBe(true);
    });
  });

  describe('setFacesVisible', () => {
    it('should set faces visibility', () => {
      useVisualStore.getState().setFacesVisible(true);
      expect(useVisualStore.getState().facesVisible).toBe(true);

      useVisualStore.getState().setFacesVisible(false);
      expect(useVisualStore.getState().facesVisible).toBe(false);
    });

    it('should auto-set shaderType to surface when faces enabled', () => {
      useVisualStore.getState().setFacesVisible(true);
      expect(useVisualStore.getState().shaderType).toBe('surface');
    });

    it('should auto-set shaderType to wireframe when faces disabled', () => {
      // First enable faces to set surface shader
      useVisualStore.getState().setFacesVisible(true);
      expect(useVisualStore.getState().shaderType).toBe('surface');

      // Then disable faces
      useVisualStore.getState().setFacesVisible(false);
      expect(useVisualStore.getState().shaderType).toBe('wireframe');
    });
  });

  describe('applyPreset', () => {
    it('should apply neon preset', () => {
      useVisualStore.getState().applyPreset('neon');
      expect(useVisualStore.getState().edgeColor).toBe(VISUAL_PRESETS.neon.edgeColor);
      expect(useVisualStore.getState().backgroundColor).toBe(VISUAL_PRESETS.neon.backgroundColor);
    });

    it('should apply blueprint preset', () => {
      useVisualStore.getState().applyPreset('blueprint');
      expect(useVisualStore.getState().edgeColor).toBe(VISUAL_PRESETS.blueprint.edgeColor);
    });

    it('should apply hologram preset', () => {
      useVisualStore.getState().applyPreset('hologram');
      expect(useVisualStore.getState().edgeColor).toBe(VISUAL_PRESETS.hologram.edgeColor);
    });

    it('should apply scientific preset', () => {
      useVisualStore.getState().applyPreset('scientific');
      expect(useVisualStore.getState().edgeColor).toBe(VISUAL_PRESETS.scientific.edgeColor);
    });
  });

  describe('reset', () => {
    it('should reset all visual settings to defaults', () => {
      useVisualStore.getState().setEdgeColor('#FF0000');
      useVisualStore.getState().setEdgeThickness(5);
      useVisualStore.getState().setVertexVisible(false);
      useVisualStore.getState().setVertexSize(10);
      useVisualStore.getState().setVertexColor('#00FF00');
      useVisualStore.getState().setFaceOpacity(1);
      useVisualStore.getState().setBackgroundColor('#000000');
      useVisualStore.getState().setEdgesVisible(false);
      useVisualStore.getState().setFacesVisible(true);

      useVisualStore.getState().reset();

      expect(useVisualStore.getState().edgeColor).toBe(DEFAULT_EDGE_COLOR);
      expect(useVisualStore.getState().edgeThickness).toBe(DEFAULT_EDGE_THICKNESS);
      expect(useVisualStore.getState().vertexVisible).toBe(DEFAULT_VERTEX_VISIBLE);
      expect(useVisualStore.getState().vertexSize).toBe(DEFAULT_VERTEX_SIZE);
      expect(useVisualStore.getState().vertexColor).toBe(DEFAULT_VERTEX_COLOR);
      expect(useVisualStore.getState().faceOpacity).toBe(DEFAULT_FACE_OPACITY);
      expect(useVisualStore.getState().backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
      expect(useVisualStore.getState().edgesVisible).toBe(DEFAULT_EDGES_VISIBLE);
      expect(useVisualStore.getState().facesVisible).toBe(DEFAULT_FACES_VISIBLE);
    });
  });
});
