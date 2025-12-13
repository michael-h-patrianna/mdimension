import { renderHook } from '@testing-library/react';
import { useGeometryGenerator } from '@/hooks/useGeometryGenerator';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { DEFAULT_ROOT_SYSTEM_CONFIG } from '@/lib/geometry/extended';

// We will use the real stores, but we need to reset them
// Since they are persistent, we might need to manually set them to defaults

describe('useGeometryGenerator', () => {
  beforeEach(() => {
    // Reset stores to default state
    act(() => {
      useGeometryStore.setState({
        dimension: 3,
        objectType: 'hypercube',
      });
      useExtendedObjectStore.setState({
        // Reset extended object configs if needed, though defaults are usually fine
      });
    });
  });

  it('should generate initial geometry (3D hypercube)', () => {
    const { result } = renderHook(() => useGeometryGenerator());

    expect(result.current.dimension).toBe(3);
    expect(result.current.objectType).toBe('hypercube');
    expect(result.current.geometry).toBeDefined();
    expect(result.current.geometry.type).toBe('hypercube');
    expect(result.current.geometry.vertices.length).toBe(8); // 2^3
  });

  it('should update geometry when dimension changes', () => {
    const { result } = renderHook(() => useGeometryGenerator());

    act(() => {
      useGeometryStore.setState({ dimension: 4 });
    });

    expect(result.current.dimension).toBe(4);
    expect(result.current.geometry.vertices.length).toBe(16); // 2^4
  });

  it('should update geometry when object type changes', () => {
    const { result } = renderHook(() => useGeometryGenerator());

    act(() => {
      useGeometryStore.setState({ objectType: 'simplex', dimension: 3 });
    });

    expect(result.current.objectType).toBe('simplex');
    expect(result.current.geometry.type).toBe('simplex');
    expect(result.current.geometry.vertices.length).toBe(4); // n+1
  });

  it('should use extended object params', () => {
    // This tests that the hook correctly pulls from extendedObjectStore
    const { result } = renderHook(() => useGeometryGenerator());

    act(() => {
      useGeometryStore.setState({ objectType: 'root-system', dimension: 3 });
      useExtendedObjectStore.setState({
        rootSystem: { ...DEFAULT_ROOT_SYSTEM_CONFIG, rootType: 'A', scale: 2.0 }
      });
    });

    expect(result.current.objectType).toBe('root-system');
    // Root system generates vertices for the selected root type
    expect(result.current.geometry.vertices.length).toBeGreaterThan(0);
  });
});
