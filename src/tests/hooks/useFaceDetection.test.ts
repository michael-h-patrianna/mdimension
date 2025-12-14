import { useFaceDetection } from '@/hooks/useFaceDetection'
import type { NdGeometry } from '@/lib/geometry'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('useFaceDetection', () => {
  it('should return empty array for point clouds', () => {
    const geometry: NdGeometry = {
      vertices: [[1, 1, 1]],
      edges: [],
      dimension: 3,
      type: 'root-system',
    }
    const { result } = renderHook(() => useFaceDetection(geometry, 'root-system'))
    expect(result.current).toEqual([])
  })

  it('should detect faces for hypercube (3D)', () => {
    // A simple 3D cube geometry approximation for testing face detection flow
    // We don't need real vertices for the detection logic mocked here,
    // BUT detectFaces implementation calculates indices mathematically for hypercubes.
    // It depends on vertex count being 2^n.
    const vertices = new Array(8).fill([0, 0, 0])
    const edges: [number, number][] = [[0, 1]] // provide at least one edge to pass validation

    const geometry: NdGeometry = {
      vertices,
      edges,
      dimension: 3,
      type: 'hypercube',
    }

    const { result } = renderHook(() => useFaceDetection(geometry, 'hypercube'))
    // A 3D cube has 6 faces
    expect(result.current).toHaveLength(6)
  })
})
