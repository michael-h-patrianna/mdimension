import { useFaceDetection } from '@/hooks/useFaceDetection'
import type { NdGeometry } from '@/lib/geometry'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('useFaceDetection', () => {
  it('should return FaceDetectionResult with faces and isLoading', () => {
    const geometry: NdGeometry = {
      vertices: [[1, 1, 1]],
      edges: [],
      dimension: 3,
      type: 'hypercube',
    }
    const { result } = renderHook(() => useFaceDetection(geometry, 'hypercube'))

    // Check that the hook returns the correct shape
    expect(result.current).toHaveProperty('faces')
    expect(result.current).toHaveProperty('isLoading')
    expect(Array.isArray(result.current.faces)).toBe(true)
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('should return empty faces for null geometry', () => {
    const { result } = renderHook(() => useFaceDetection(null, 'hypercube'))

    expect(result.current.faces).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('should detect faces for hypercube (3D) synchronously', async () => {
    // A simple 3D cube geometry approximation for testing face detection flow
    // detectFaces implementation calculates indices mathematically for hypercubes.
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

    // Wait for faces to be detected (sync path should be immediate)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // A 3D cube has 6 faces
    expect(result.current.faces).toHaveLength(6)
  })

  it('should return empty faces for geometry with no vertices', () => {
    const geometry: NdGeometry = {
      vertices: [],
      edges: [],
      dimension: 3,
      type: 'hypercube',
    }

    const { result } = renderHook(() => useFaceDetection(geometry, 'hypercube'))

    expect(result.current.faces).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })
})
