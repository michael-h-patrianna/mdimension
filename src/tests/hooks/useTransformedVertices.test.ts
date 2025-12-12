import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTransformedVertices } from '@/hooks/useTransformedVertices';
import type { VectorND, MatrixND } from '@/lib/math/types';

describe('useTransformedVertices', () => {
  it('should return empty array for empty input', () => {
    const { result } = renderHook(() => 
      useTransformedVertices([], [[1]], [0])
    );
    expect(result.current).toEqual([]);
  });

  it('should apply shear matrix', () => {
    // Identity shear
    const vertices: VectorND[] = [[1, 2]];
    const shear: MatrixND = [[1, 0], [0, 1]];
    const translation: VectorND = [0, 0];

    const { result } = renderHook(() => 
      useTransformedVertices(vertices, shear, translation)
    );

    expect(result.current[0]).toEqual([1, 2]);

    // Actual shear
    // x' = x + y
    // y' = y
    const shear2: MatrixND = [[1, 1], [0, 1]];
    const { result: result2 } = renderHook(() => 
      useTransformedVertices(vertices, shear2, translation)
    );

    // 1*1 + 2*1 = 3
    // 1*0 + 2*1 = 2
    // Wait, matrix multiplication is M * v
    // [[1, 1], [0, 1]] * [1, 2]
    // Row 0: 1*1 + 1*2 = 3
    // Row 1: 0*1 + 1*2 = 2
    expect(result2.current[0]).toEqual([3, 2]);
  });

  it('should apply translation', () => {
    const vertices: VectorND[] = [[1, 2]];
    const shear: MatrixND = [[1, 0], [0, 1]];
    const translation: VectorND = [10, 20];

    const { result } = renderHook(() => 
      useTransformedVertices(vertices, shear, translation)
    );

    expect(result.current[0]).toEqual([11, 22]);
  });

  it('should apply shear then translation', () => {
    const vertices: VectorND[] = [[1, 2]];
    const shear: MatrixND = [[1, 1], [0, 1]]; // x' = x+y, y'=y -> [3, 2]
    const translation: VectorND = [10, 20];

    const { result } = renderHook(() => 
      useTransformedVertices(vertices, shear, translation)
    );

    // [3+10, 2+20] = [13, 22]
    expect(result.current[0]).toEqual([13, 22]);
  });

  it('should memoize results', () => {
    const vertices: VectorND[] = [[1, 2]];
    const shear: MatrixND = [[1, 0], [0, 1]];
    const translation: VectorND = [0, 0];

    const { result, rerender } = renderHook(() => 
      useTransformedVertices(vertices, shear, translation)
    );

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it('should update when inputs change', () => {
    const vertices: VectorND[] = [[1, 2]];
    const shear: MatrixND = [[1, 0], [0, 1]];
    const translation: VectorND = [0, 0];

    const { result, rerender } = renderHook((props) => 
      useTransformedVertices(props.vertices, props.shear, props.translation),
      { initialProps: { vertices, shear, translation } }
    );

    const firstResult = result.current;

    // Change translation
    rerender({ vertices, shear, translation: [1, 1] });
    
    const secondResult = result.current;

    expect(firstResult).not.toBe(secondResult);
    expect(secondResult[0]).toEqual([2, 3]);
  });
});
