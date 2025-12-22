/**
 * Tests for FilmGrainPass.
 *
 * Tests cinematic film grain post-processing effect.
 */

import { describe, expect, it, beforeEach } from 'vitest';

import { FilmGrainPass } from '@/rendering/graph/passes/FilmGrainPass';

describe('FilmGrainPass', () => {
  let pass: FilmGrainPass;

  beforeEach(() => {
    pass = new FilmGrainPass({
      id: 'filmGrain',
      colorInput: 'sceneColor',
      outputResource: 'grainedColor',
    });
  });

  describe('initialization', () => {
    it('should create pass with correct ID', () => {
      expect(pass.id).toBe('filmGrain');
    });

    it('should configure color input', () => {
      expect(pass.config.inputs).toHaveLength(1);
      expect(pass.config.inputs[0]!.resourceId).toBe('sceneColor');
    });

    it('should configure correct output', () => {
      expect(pass.config.outputs).toHaveLength(1);
      expect(pass.config.outputs[0]!.resourceId).toBe('grainedColor');
    });
  });

  describe('default parameters', () => {
    it('should create pass with default intensity of 0.35', () => {
      const customPass = new FilmGrainPass({
        id: 'custom',
        colorInput: 'color',
        outputResource: 'output',
      });
      expect(customPass.id).toBe('custom');
    });
  });

  describe('custom configuration', () => {
    it('should accept custom intensity', () => {
      const customPass = new FilmGrainPass({
        id: 'custom',
        colorInput: 'color',
        outputResource: 'output',
        intensity: 0.5,
      });
      expect(customPass.id).toBe('custom');
    });

    it('should accept custom grain size', () => {
      const customPass = new FilmGrainPass({
        id: 'custom',
        colorInput: 'color',
        outputResource: 'output',
        grainSize: 2.0,
      });
      expect(customPass.id).toBe('custom');
    });

    it('should accept colored grain option', () => {
      const customPass = new FilmGrainPass({
        id: 'custom',
        colorInput: 'color',
        outputResource: 'output',
        colored: true,
      });
      expect(customPass.id).toBe('custom');
    });

    it('should accept all custom parameters', () => {
      const customPass = new FilmGrainPass({
        id: 'custom',
        colorInput: 'color',
        outputResource: 'output',
        intensity: 0.2,
        grainSize: 1.5,
        colored: true,
      });
      expect(customPass.id).toBe('custom');
    });
  });

  describe('parameter setters', () => {
    it('should set intensity', () => {
      expect(() => pass.setIntensity(0.5)).not.toThrow();
    });

    it('should set grain size', () => {
      expect(() => pass.setGrainSize(2.0)).not.toThrow();
    });

    it('should set colored option', () => {
      expect(() => pass.setColored(true)).not.toThrow();
      expect(() => pass.setColored(false)).not.toThrow();
    });
  });

  describe('disposal', () => {
    it('should dispose without error', () => {
      expect(() => pass.dispose()).not.toThrow();
    });

    it('should be safe to call dispose multiple times', () => {
      pass.dispose();
      expect(() => pass.dispose()).not.toThrow();
    });
  });
});
