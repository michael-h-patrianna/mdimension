/**
 * Tests for geometry transfer utilities
 *
 * Tests the serialization/deserialization functions used for
 * zero-copy transfer between main thread and Web Workers.
 */

import { describe, it, expect } from 'vitest'
import {
  flattenGeometry,
  inflateGeometry,
  flattenFaces,
  inflateFaces,
  flattenVerticesOnly,
  inflateVerticesOnly,
} from '@/lib/geometry/transfer'
import type { PolytopeGeometry } from '@/lib/geometry/types'

describe('flattenGeometry / inflateGeometry', () => {
  describe('roundtrip', () => {
    it('should correctly roundtrip a 3D cube geometry', () => {
      const cube: PolytopeGeometry = {
        vertices: [
          [-1, -1, -1],
          [1, -1, -1],
          [-1, 1, -1],
          [1, 1, -1],
          [-1, -1, 1],
          [1, -1, 1],
          [-1, 1, 1],
          [1, 1, 1],
        ],
        edges: [
          [0, 1],
          [2, 3],
          [4, 5],
          [6, 7],
          [0, 2],
          [1, 3],
          [4, 6],
          [5, 7],
          [0, 4],
          [1, 5],
          [2, 6],
          [3, 7],
        ],
        dimension: 3,
        type: 'hypercube',
      }

      const { transferable, buffers } = flattenGeometry(cube)
      expect(buffers).toHaveLength(2)

      const inflated = inflateGeometry(transferable)

      expect(inflated.vertices).toHaveLength(8)
      expect(inflated.edges).toHaveLength(12)
      expect(inflated.dimension).toBe(3)
      expect(inflated.type).toBe('hypercube')

      // Check vertex values
      for (let i = 0; i < cube.vertices.length; i++) {
        for (let d = 0; d < 3; d++) {
          expect(inflated.vertices[i]![d]).toBe(cube.vertices[i]![d])
        }
      }

      // Check edge values
      for (let i = 0; i < cube.edges.length; i++) {
        expect(inflated.edges[i]![0]).toBe(cube.edges[i]![0])
        expect(inflated.edges[i]![1]).toBe(cube.edges[i]![1])
      }
    })

    it('should correctly roundtrip a 4D simplex geometry', () => {
      const simplex: PolytopeGeometry = {
        vertices: [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
          [-0.25, -0.25, -0.25, -0.25],
        ],
        edges: [
          [0, 1],
          [0, 2],
          [0, 3],
          [0, 4],
          [1, 2],
          [1, 3],
          [1, 4],
          [2, 3],
          [2, 4],
          [3, 4],
        ],
        dimension: 4,
        type: 'simplex',
      }

      const { transferable } = flattenGeometry(simplex)
      const inflated = inflateGeometry(transferable)

      expect(inflated.vertices).toHaveLength(5)
      expect(inflated.edges).toHaveLength(10)
      expect(inflated.dimension).toBe(4)
    })

    it('should preserve metadata', () => {
      const geometry: PolytopeGeometry = {
        vertices: [[0, 0, 0]],
        edges: [],
        dimension: 3,
        type: 'hypercube',
        metadata: {
          name: 'Test Cube',
          properties: { testProp: 'value' },
        },
      }

      const { transferable } = flattenGeometry(geometry)
      const inflated = inflateGeometry(transferable)

      expect(inflated.metadata?.name).toBe('Test Cube')
      expect(inflated.metadata?.properties?.testProp).toBe('value')
    })
  })

  describe('error handling', () => {
    it('should throw on invalid dimension', () => {
      const invalid = {
        vertices: new Float64Array([1, 2, 3]),
        edges: new Uint32Array([]),
        dimension: 0,
        type: 'hypercube' as const,
      }

      expect(() => inflateGeometry(invalid)).toThrow('Invalid dimension')
    })

    it('should throw on vertex data corruption', () => {
      const invalid = {
        vertices: new Float64Array([1, 2, 3, 4, 5]), // 5 values, not divisible by 3
        edges: new Uint32Array([]),
        dimension: 3,
        type: 'hypercube' as const,
      }

      expect(() => inflateGeometry(invalid)).toThrow('not divisible by dimension')
    })

    it('should throw on edge data corruption', () => {
      const invalid = {
        vertices: new Float64Array([1, 2, 3]),
        edges: new Uint32Array([0, 1, 2]), // 3 values, not divisible by 2
        dimension: 3,
        type: 'hypercube' as const,
      }

      expect(() => inflateGeometry(invalid)).toThrow('not divisible by 2')
    })

    it('should throw on edge referencing non-existent vertex', () => {
      const invalid = {
        vertices: new Float64Array([1, 2, 3]), // 1 vertex
        edges: new Uint32Array([0, 5]), // Edge references vertex 5
        dimension: 3,
        type: 'hypercube' as const,
      }

      expect(() => inflateGeometry(invalid)).toThrow('references vertex')
    })
  })
})

describe('flattenFaces / inflateFaces', () => {
  describe('roundtrip', () => {
    it('should correctly roundtrip triangular faces', () => {
      const faces: [number, number, number][] = [
        [0, 1, 2],
        [0, 2, 3],
        [1, 2, 4],
        [3, 4, 5],
      ]

      const { flatFaces, buffer } = flattenFaces(faces)

      expect(flatFaces).toHaveLength(12) // 4 triangles * 3 indices
      expect(buffer).toBeInstanceOf(ArrayBuffer)

      const inflated = inflateFaces(flatFaces)

      expect(inflated).toHaveLength(4)
      for (let i = 0; i < faces.length; i++) {
        expect(inflated[i]).toEqual(faces[i])
      }
    })

    it('should handle empty faces array', () => {
      const faces: [number, number, number][] = []

      const { flatFaces } = flattenFaces(faces)
      expect(flatFaces).toHaveLength(0)

      const inflated = inflateFaces(flatFaces)
      expect(inflated).toHaveLength(0)
    })

    it('should handle single face', () => {
      const faces: [number, number, number][] = [[0, 1, 2]]

      const { flatFaces } = flattenFaces(faces)
      expect(flatFaces).toHaveLength(3)

      const inflated = inflateFaces(flatFaces)
      expect(inflated).toEqual([[0, 1, 2]])
    })

    it('should handle large face arrays', () => {
      const faces: [number, number, number][] = []
      for (let i = 0; i < 1000; i++) {
        faces.push([i, i + 1, i + 2])
      }

      const { flatFaces } = flattenFaces(faces)
      expect(flatFaces).toHaveLength(3000)

      const inflated = inflateFaces(flatFaces)
      expect(inflated).toHaveLength(1000)

      for (let i = 0; i < 1000; i++) {
        expect(inflated[i]).toEqual([i, i + 1, i + 2])
      }
    })
  })

  describe('error handling', () => {
    it('should throw on array length not divisible by 3', () => {
      const invalid = new Uint32Array([0, 1, 2, 3, 4]) // 5 values

      expect(() => inflateFaces(invalid)).toThrow('not divisible by 3')
    })
  })
})

describe('flattenVerticesOnly / inflateVerticesOnly', () => {
  describe('roundtrip', () => {
    it('should correctly roundtrip 3D vertices', () => {
      const vertices = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [-1, -1, -1],
      ]

      const { flatVertices, buffer } = flattenVerticesOnly(vertices, 3)

      expect(flatVertices).toHaveLength(12) // 4 vertices * 3 dimensions
      expect(buffer).toBeInstanceOf(ArrayBuffer)

      const inflated = inflateVerticesOnly(flatVertices, 3)

      expect(inflated).toHaveLength(4)
      for (let i = 0; i < vertices.length; i++) {
        for (let d = 0; d < 3; d++) {
          expect(inflated[i]![d]).toBe(vertices[i]![d])
        }
      }
    })

    it('should correctly roundtrip 5D vertices', () => {
      const vertices = [
        [1, 2, 3, 4, 5],
        [5, 4, 3, 2, 1],
      ]

      const { flatVertices } = flattenVerticesOnly(vertices, 5)
      expect(flatVertices).toHaveLength(10)

      const inflated = inflateVerticesOnly(flatVertices, 5)

      expect(inflated).toHaveLength(2)
      expect(inflated[0]).toEqual([1, 2, 3, 4, 5])
      expect(inflated[1]).toEqual([5, 4, 3, 2, 1])
    })

    it('should handle empty vertex array', () => {
      const vertices: number[][] = []

      const { flatVertices } = flattenVerticesOnly(vertices, 3)
      expect(flatVertices).toHaveLength(0)

      const inflated = inflateVerticesOnly(flatVertices, 3)
      expect(inflated).toHaveLength(0)
    })

    it('should handle high-dimensional vertices', () => {
      const vertices = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]

      const { flatVertices } = flattenVerticesOnly(vertices, 11)
      expect(flatVertices).toHaveLength(11)

      const inflated = inflateVerticesOnly(flatVertices, 11)
      expect(inflated[0]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    })
  })

  describe('error handling', () => {
    it('should throw on invalid dimension', () => {
      const flat = new Float64Array([1, 2, 3])

      expect(() => inflateVerticesOnly(flat, 0)).toThrow('Invalid dimension')
      expect(() => inflateVerticesOnly(flat, -1)).toThrow('Invalid dimension')
    })

    it('should throw on buffer length not divisible by dimension', () => {
      const flat = new Float64Array([1, 2, 3, 4, 5]) // 5 values

      expect(() => inflateVerticesOnly(flat, 3)).toThrow('not divisible by dimension')
    })
  })
})
