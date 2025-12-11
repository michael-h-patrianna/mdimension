/**
 * Tests for crossSectionStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useCrossSectionStore,
  MIN_SLICE_W,
  MAX_SLICE_W,
  DEFAULT_SLICE_W,
} from '@/stores/crossSectionStore';

describe('crossSectionStore', () => {
  beforeEach(() => {
    useCrossSectionStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should be disabled by default', () => {
      expect(useCrossSectionStore.getState().enabled).toBe(false);
    });

    it('should have default slice at W=0', () => {
      expect(useCrossSectionStore.getState().sliceW).toBe(DEFAULT_SLICE_W);
    });

    it('should show original by default', () => {
      expect(useCrossSectionStore.getState().showOriginal).toBe(true);
    });

    it('should have default opacity of 0.3', () => {
      expect(useCrossSectionStore.getState().originalOpacity).toBe(0.3);
    });

    it('should not animate slice by default', () => {
      expect(useCrossSectionStore.getState().animateSlice).toBe(false);
    });
  });

  describe('setEnabled / toggle', () => {
    it('should enable cross-section', () => {
      useCrossSectionStore.getState().setEnabled(true);
      expect(useCrossSectionStore.getState().enabled).toBe(true);
    });

    it('should toggle cross-section', () => {
      useCrossSectionStore.getState().toggle();
      expect(useCrossSectionStore.getState().enabled).toBe(true);
      useCrossSectionStore.getState().toggle();
      expect(useCrossSectionStore.getState().enabled).toBe(false);
    });
  });

  describe('setSliceW', () => {
    it('should set slice position', () => {
      useCrossSectionStore.getState().setSliceW(0.5);
      expect(useCrossSectionStore.getState().sliceW).toBe(0.5);
    });

    it('should clamp slice below minimum', () => {
      useCrossSectionStore.getState().setSliceW(-10);
      expect(useCrossSectionStore.getState().sliceW).toBe(MIN_SLICE_W);
    });

    it('should clamp slice above maximum', () => {
      useCrossSectionStore.getState().setSliceW(10);
      expect(useCrossSectionStore.getState().sliceW).toBe(MAX_SLICE_W);
    });

    it('should handle negative values', () => {
      useCrossSectionStore.getState().setSliceW(-0.5);
      expect(useCrossSectionStore.getState().sliceW).toBe(-0.5);
    });
  });

  describe('setShowOriginal', () => {
    it('should toggle show original', () => {
      useCrossSectionStore.getState().setShowOriginal(false);
      expect(useCrossSectionStore.getState().showOriginal).toBe(false);
    });
  });

  describe('setOriginalOpacity', () => {
    it('should set opacity', () => {
      useCrossSectionStore.getState().setOriginalOpacity(0.5);
      expect(useCrossSectionStore.getState().originalOpacity).toBe(0.5);
    });

    it('should clamp opacity to [0, 1]', () => {
      useCrossSectionStore.getState().setOriginalOpacity(-0.5);
      expect(useCrossSectionStore.getState().originalOpacity).toBe(0);

      useCrossSectionStore.getState().setOriginalOpacity(1.5);
      expect(useCrossSectionStore.getState().originalOpacity).toBe(1);
    });
  });

  describe('setAnimateSlice', () => {
    it('should enable slice animation', () => {
      useCrossSectionStore.getState().setAnimateSlice(true);
      expect(useCrossSectionStore.getState().animateSlice).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      useCrossSectionStore.getState().setEnabled(true);
      useCrossSectionStore.getState().setSliceW(1.5);
      useCrossSectionStore.getState().setShowOriginal(false);
      useCrossSectionStore.getState().setOriginalOpacity(0.8);
      useCrossSectionStore.getState().setAnimateSlice(true);

      useCrossSectionStore.getState().reset();

      expect(useCrossSectionStore.getState().enabled).toBe(false);
      expect(useCrossSectionStore.getState().sliceW).toBe(DEFAULT_SLICE_W);
      expect(useCrossSectionStore.getState().showOriginal).toBe(true);
      expect(useCrossSectionStore.getState().originalOpacity).toBe(0.3);
      expect(useCrossSectionStore.getState().animateSlice).toBe(false);
    });
  });
});
