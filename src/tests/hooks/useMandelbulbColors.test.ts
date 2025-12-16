/**
 * Tests for useMandelbulbColors hook
 *
 * Tests cover:
 * - Hook returns undefined for non-Mandelbulb geometry
 * - Hook returns colors for Mandelbulb geometry
 * - Hook updates when config changes
 */

import { useMandelbulbColors } from '@/hooks/useMandelbulbColors'
import { DEFAULT_MANDELBROT_CONFIG } from '@/lib/geometry/extended/types'
import type { NdGeometry } from '@/lib/geometry/types'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('useMandelbulbColors', () => {
  const baseColor = '#ff0000'

  describe('non-Mandelbulb geometry', () => {
    it('should return undefined for null geometry', () => {
      const { result } = renderHook(() =>
        useMandelbulbColors(null, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      expect(result.current).toBeUndefined()
    })

    it('should return undefined for hypercube geometry', () => {
      const geometry: NdGeometry = {
        dimension: 4,
        type: 'hypercube',
        vertices: [[1, 0, 0, 0]],
        edges: [],
      }
      const { result } = renderHook(() =>
        useMandelbulbColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      expect(result.current).toBeUndefined()
    })

    it('should return undefined for root-system geometry', () => {
      const geometry: NdGeometry = {
        dimension: 4,
        type: 'root-system',
        vertices: [[1, 0, 0, 0]],
        edges: [],
      }
      const { result } = renderHook(() =>
        useMandelbulbColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      expect(result.current).toBeUndefined()
    })
  })

  describe('Mandelbulb geometry without escape values', () => {
    it('should return undefined if no metadata', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbulb',
        vertices: [[0, 0, 0]],
        edges: [],
      }
      const { result } = renderHook(() =>
        useMandelbulbColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      expect(result.current).toBeUndefined()
    })

    it('should return undefined if metadata has no normalizedEscapeValues', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbulb',
        vertices: [[0, 0, 0]],
        edges: [],

        metadata: {
          name: 'Mandelbulb',
          properties: {},
        },
      }
      const { result } = renderHook(() =>
        useMandelbulbColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      expect(result.current).toBeUndefined()
    })
  })

  describe('Mandelbulb geometry with escape values', () => {
    const createMandelbulbGeometry = (escapeValues: number[]): NdGeometry => ({
      dimension: 3,
      type: 'mandelbulb',
      vertices: escapeValues.map((_, i) => [i, 0, 0]),
      edges: [],

      metadata: {
        name: 'Mandelbulb',
        properties: {
          normalizedEscapeValues: escapeValues,
        },
      },
    })

    it('should return color array matching escape values length', () => {
      const geometry = createMandelbulbGeometry([0.1, 0.5, 0.9, 1.0])
      const { result } = renderHook(() =>
        useMandelbulbColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      expect(result.current).toHaveLength(4)
    })

    it('should return valid hex colors', () => {
      const geometry = createMandelbulbGeometry([0.1, 0.5, 0.9])
      const { result } = renderHook(() =>
        useMandelbulbColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      result.current?.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/)
      })
    })

    it('should use interior color for bounded points (value = 1)', () => {
      const geometry = createMandelbulbGeometry([1.0, 1.0])
      const config = { ...DEFAULT_MANDELBROT_CONFIG, interiorColor: '#123456' }
      const { result } = renderHook(() => useMandelbulbColors(geometry, config, baseColor))
      // All bounded points should get interior color
      result.current?.forEach((color) => {
        expect(color).toBe('#123456')
      })
    })

    it('should return different colors for different escape values', () => {
      const geometry = createMandelbulbGeometry([0.1, 0.5, 0.9])
      const { result } = renderHook(() =>
        useMandelbulbColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      )
      // Colors should not all be the same
      const uniqueColors = new Set(result.current)
      expect(uniqueColors.size).toBeGreaterThan(1)
    })
  })

  describe('memoization', () => {
    it('should return same reference when inputs unchanged', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbulb',
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        edges: [],

        metadata: {
          name: 'Mandelbulb',
          properties: {
            normalizedEscapeValues: [0.1, 0.5],
          },
        },
      }

      const { result, rerender } = renderHook(
        ({ geo, cfg, color }) => useMandelbulbColors(geo, cfg, color),
        {
          initialProps: {
            geo: geometry,
            cfg: DEFAULT_MANDELBROT_CONFIG,
            color: baseColor,
          },
        }
      )

      const firstResult = result.current
      rerender({ geo: geometry, cfg: DEFAULT_MANDELBROT_CONFIG, color: baseColor })
      const secondResult = result.current

      expect(firstResult).toBe(secondResult)
    })

    it('should update when config changes', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbulb',
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        edges: [],

        metadata: {
          name: 'Mandelbulb',
          properties: {
            normalizedEscapeValues: [0.1, 0.5],
          },
        },
      }

      const { result, rerender } = renderHook(
        ({ geo, cfg, color }) => useMandelbulbColors(geo, cfg, color),
        {
          initialProps: {
            geo: geometry,
            cfg: DEFAULT_MANDELBROT_CONFIG,
            color: baseColor,
          },
        }
      )

      const firstResult = result.current
      rerender({
        geo: geometry,
        cfg: { ...DEFAULT_MANDELBROT_CONFIG, palette: 'triadic' },
        color: baseColor,
      })
      const secondResult = result.current

      // Result should be different reference since config changed
      expect(firstResult).not.toBe(secondResult)
    })

    it('should update when baseColor changes', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbulb',
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        edges: [],

        metadata: {
          name: 'Mandelbulb',
          properties: {
            normalizedEscapeValues: [0.1, 0.5],
          },
        },
      }

      const { result, rerender } = renderHook(
        ({ geo, cfg, color }) => useMandelbulbColors(geo, cfg, color),
        {
          initialProps: {
            geo: geometry,
            cfg: DEFAULT_MANDELBROT_CONFIG,
            color: '#ff0000',
          },
        }
      )

      const firstResult = result.current
      rerender({
        geo: geometry,
        cfg: DEFAULT_MANDELBROT_CONFIG,
        color: '#00ff00', // Different color
      })
      const secondResult = result.current

      // Result should be different reference since baseColor changed
      expect(firstResult).not.toBe(secondResult)
    })
  })
})
