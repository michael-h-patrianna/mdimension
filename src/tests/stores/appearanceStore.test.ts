import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_EDGE_COLOR,
  DEFAULT_EDGE_THICKNESS,
  DEFAULT_FACE_OPACITY,
  DEFAULT_EDGES_VISIBLE,
  DEFAULT_FACES_VISIBLE,
  VISUAL_PRESETS,
} from '@/stores/defaults/visualDefaults';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

describe('appearanceStore', () => {
  beforeEach(() => {
    act(() => {
      useAppearanceStore.getState().reset();
    });
  });

  it('should have correct initial values', () => {
    const state = useAppearanceStore.getState();
    expect(state.edgeColor).toBe(DEFAULT_EDGE_COLOR);
    expect(state.edgeThickness).toBe(DEFAULT_EDGE_THICKNESS);
    expect(state.backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
  });

  it('should update edge color', () => {
    const { result } = renderHook(() => useAppearanceStore());
    act(() => {
      result.current.setEdgeColor('#ff0000');
    });
    expect(result.current.edgeColor).toBe('#ff0000');
  });

  it('should update edge thickness', () => {
    const { result } = renderHook(() => useAppearanceStore());
    act(() => {
      result.current.setEdgeThickness(5);
    });
    expect(result.current.edgeThickness).toBe(5);
  });

  it('should update background color', () => {
    const { result } = renderHook(() => useAppearanceStore());
    act(() => {
      result.current.setBackgroundColor('#ffffff');
    });
    expect(result.current.backgroundColor).toBe('#ffffff');
  });

  it('should apply visual presets', () => {
    const { result } = renderHook(() => useAppearanceStore());

    act(() => {
      result.current.applyPreset('neon');
    });
    expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.neon.edgeColor);
    expect(useAppearanceStore.getState().backgroundColor).toBe(VISUAL_PRESETS.neon.backgroundColor);

    act(() => {
      result.current.applyPreset('blueprint');
    });
    expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.blueprint.edgeColor);

    act(() => {
      result.current.applyPreset('hologram');
    });
    expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.hologram.edgeColor);

    act(() => {
      result.current.applyPreset('scientific');
    });
    expect(useAppearanceStore.getState().edgeColor).toBe(VISUAL_PRESETS.scientific.edgeColor);
  });

  it('should toggle face visibility', () => {
    const { result } = renderHook(() => useAppearanceStore());
    const initial = result.current.facesVisible;
    act(() => {
      result.current.setFacesVisible(!initial);
    });
    expect(result.current.facesVisible).toBe(!initial);
  });

  it('should toggle edge visibility', () => {
    const { result } = renderHook(() => useAppearanceStore());
    const initial = result.current.edgesVisible;
    act(() => {
      result.current.setEdgesVisible(!initial);
    });
    expect(result.current.edgesVisible).toBe(!initial);
  });

  it('should update opacity settings', () => {
    const { result } = renderHook(() => useAppearanceStore());
    
    // Test base face opacity (simple setter)
    act(() => {
      result.current.setFaceOpacity(0.8);
    });
    expect(result.current.faceOpacity).toBe(0.8);
  });

  it('should reset to defaults', () => {
    const { result } = renderHook(() => useAppearanceStore());

    // Change some values
    act(() => {
      result.current.setEdgeColor('#ff0000');
      result.current.setFaceOpacity(0.9);
      result.current.setEdgesVisible(!DEFAULT_EDGES_VISIBLE);
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    // Check defaults
    expect(result.current.edgeColor).toBe(DEFAULT_EDGE_COLOR);
    expect(result.current.faceOpacity).toBe(DEFAULT_FACE_OPACITY);
    expect(result.current.edgesVisible).toBe(DEFAULT_EDGES_VISIBLE);
    expect(result.current.facesVisible).toBe(DEFAULT_FACES_VISIBLE);
  });
});
