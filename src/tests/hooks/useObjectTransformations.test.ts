import { renderHook } from '@testing-library/react';
import { useObjectTransformations } from '@/hooks/useObjectTransformations';
import { useTransformStore } from '@/stores/transformStore';
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import type { VectorND } from '@/lib/math/types';

describe('useObjectTransformations', () => {
  const initialVertices: VectorND[] = [
    [1, 1, 1],
    [-1, -1, -1]
  ];
  const dimension = 3;

  beforeEach(() => {
    act(() => {
      useTransformStore.setState({
        uniformScale: 1,
        perAxisScale: [], // Use array instead of object
        shears: new Map(),
        translation: [],
        dimension: 3,
      });
    });
  });

  it('should return vertices unchanged if no transformations applied', () => {
    const { result } = renderHook(() => 
      useObjectTransformations(initialVertices, dimension)
    );
    expect(result.current).toEqual(initialVertices);
  });

  it('should apply uniform scale', () => {
    act(() => {
      useTransformStore.setState({ uniformScale: 2 });
    });
    
    const { result } = renderHook(() => 
      useObjectTransformations(initialVertices, dimension)
    );
    
    expect(result.current[0]).toEqual([2, 2, 2]);
    expect(result.current[1]).toEqual([-2, -2, -2]);
  });

  it('should apply translation', () => {
    act(() => {
        // Translation in 3D: [1, 0, 0]
        useTransformStore.setState({ translation: [1, 0, 0] });
    });

    const { result } = renderHook(() => 
      useObjectTransformations(initialVertices, dimension)
    );

    // [1,1,1] + [1,0,0] = [2,1,1]
    expect(result.current[0]).toEqual([2, 1, 1]);
  });
});
