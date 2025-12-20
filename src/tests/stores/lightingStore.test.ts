import { useLightingStore } from '@/stores/lightingStore';
import {
  DEFAULT_LIGHT_COLOR,
  DEFAULT_LIGHT_STRENGTH,
  DEFAULT_TRANSFORM_MODE,
} from '@/stores/defaults/visualDefaults';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

describe('lightingStore', () => {
  beforeEach(() => {
    act(() => {
      useLightingStore.getState().reset();
    });
  });

  it('should have correct initial values', () => {
    const state = useLightingStore.getState();
    expect(state.lights.length).toBeGreaterThan(0);
    expect(state.transformMode).toBe(DEFAULT_TRANSFORM_MODE);
    expect(state.showLightGizmos).toBe(false);
  });

  it('should add a new light', () => {
    const { result } = renderHook(() => useLightingStore());
    const initialCount = result.current.lights.length;
    
    act(() => {
      result.current.addLight('point');
    });
    
    expect(result.current.lights.length).toBe(initialCount + 1);
    const newLight = result.current.lights[result.current.lights.length - 1];
    if (newLight) {
        expect(newLight.type).toBe('point');
        expect(newLight.color).toBe(DEFAULT_LIGHT_COLOR);
        expect(newLight.intensity).toBe(DEFAULT_LIGHT_STRENGTH);
    }
  });

  it('should remove a light', () => {
    const { result } = renderHook(() => useLightingStore());
    // Ensure we have at least one light
    if (result.current.lights.length === 0) {
      act(() => {
        result.current.addLight('point');
      });
    }
    const light = result.current.lights[0];
    if (light) {
        const lightId = light.id;
        const initialCount = result.current.lights.length;

        act(() => {
            result.current.removeLight(lightId);
        });

        expect(result.current.lights.length).toBe(initialCount - 1);
        expect(result.current.lights.find(l => l.id === lightId)).toBeUndefined();
    }
  });

  it('should update light properties', () => {
    const { result } = renderHook(() => useLightingStore());
    act(() => {
        if (result.current.lights.length === 0) result.current.addLight('point');
    });
    
    const light = result.current.lights[0];
    if (light) {
        const lightId = light.id;
        const newColor = '#ff00ff';

        act(() => {
            result.current.updateLight(lightId, { color: newColor });
        });

        const updatedLight = result.current.lights.find(l => l.id === lightId);
        expect(updatedLight?.color).toBe(newColor);
    }
  });

  it('should select a light', () => {
    const { result } = renderHook(() => useLightingStore());
    act(() => {
        if (result.current.lights.length === 0) result.current.addLight('point');
    });
    
    const light = result.current.lights[0];
    if (light) {
        const lightId = light.id;

        act(() => {
            result.current.selectLight(lightId);
        });

        expect(result.current.selectedLightId).toBe(lightId);

        act(() => {
            result.current.selectLight(null);
        });

        expect(result.current.selectedLightId).toBeNull();
    }
  });

  it('should toggle gizmos', () => {
    const { result } = renderHook(() => useLightingStore());
    const initial = result.current.showLightGizmos;

    act(() => {
      result.current.setShowLightGizmos(!initial);
    });

    expect(result.current.showLightGizmos).toBe(!initial);
  });
});
