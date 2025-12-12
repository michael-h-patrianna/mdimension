import { renderHook } from '@testing-library/react';
import { useCrossSectionCalculator } from '@/hooks/useCrossSectionCalculator';
import { useCrossSectionStore } from '@/stores/crossSectionStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import type { NdGeometry, Face } from '@/lib/geometry';

describe('useCrossSectionCalculator', () => {
  const mockVertices = [
    [1, 1, 1, -1], // w = -1
    [1, 1, 1, 1],  // w = 1
  ];
  const mockEdges: [number, number][] = [[0, 1]];
  const mockGeometry: NdGeometry = {
    vertices: mockVertices, // The base geometry doesn't matter much for vertices, but edges/type do
    edges: mockEdges,
    dimension: 4,
    type: 'hypercube',
  };
  const mockFaces: Face[] = []; // No faces for simplicity

  beforeEach(() => {
    act(() => {
      useCrossSectionStore.setState({
        enabled: true,
        sliceW: 0,
        showOriginal: false,
        originalOpacity: 0.1,
      });
      useProjectionStore.setState({
        type: 'perspective',
        distance: 5,
      });
    });
  });

  it('should return null if disabled', () => {
    act(() => {
      useCrossSectionStore.setState({ enabled: false });
    });
    const { result } = renderHook(() =>
      useCrossSectionCalculator(mockVertices, mockGeometry, mockFaces, 4, 'hypercube')
    );
    expect(result.current.vertices).toBeUndefined();
    expect(result.current.result).toBeNull();
  });

  it('should return null if dimension < 4', () => {
    const { result } = renderHook(() =>
      useCrossSectionCalculator(mockVertices, mockGeometry, mockFaces, 3, 'hypercube')
    );
    expect(result.current.vertices).toBeUndefined();
    expect(result.current.result).toBeNull();
  });

  it('should calculate intersection', () => {
    // Edge from w=-1 to w=1 crosses w=0
    const { result } = renderHook(() =>
      useCrossSectionCalculator(mockVertices, mockGeometry, mockFaces, 4, 'hypercube')
    );

    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.hasIntersection).toBe(true);
    expect(result.current.result!.points.length).toBeGreaterThan(0);
    // Intersection of (1,1,1,-1) and (1,1,1,1) at w=0 is (1,1,1,0)
    // Projected to 3D: (1,1,1)
    expect(result.current.vertices).toBeDefined();
    expect(result.current.vertices!.length).toBeGreaterThan(0);
  });

  it('should handle no intersection', () => {
    act(() => {
        useCrossSectionStore.setState({ sliceW: 5 }); // Far away
    });
    const { result } = renderHook(() =>
      useCrossSectionCalculator(mockVertices, mockGeometry, mockFaces, 4, 'hypercube')
    );
    // If hasIntersection is false, vertices is undefined
    expect(result.current.vertices).toBeUndefined();
  });
});
