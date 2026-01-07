/**
 * TSL Color Caching for Performance
 *
 * Avoids per-frame sRGB to linear conversion by caching linear colors.
 * Only recomputes when source color changes.
 *
 * 100% parity with WebGL color cache pattern.
 *
 * @module rendering/tsl/utils/color-cache
 */

import { Color, Vector3 } from 'three'

/**
 * Cached color entry
 */
interface CachedColor {
  /** Original sRGB hex string */
  sourceHex: string
  /** Linear RGB values as Vector3 */
  linearRGB: Vector3
  /** Linear Color object */
  linearColor: Color
}

/**
 * Color cache for avoiding per-frame conversions
 */
export class ColorCache {
  private cache: Map<string, CachedColor> = new Map()

  /**
   * Get linear RGB color from sRGB hex string
   *
   * @param hex - sRGB color hex string (e.g., "#ff0000")
   * @returns Linear RGB as Vector3
   */
  getLinearRGB(hex: string): Vector3 {
    const cached = this.cache.get(hex)
    if (cached) {
      return cached.linearRGB
    }

    // Convert sRGB to linear
    const color = new Color(hex)
    color.convertSRGBToLinear()

    const linearRGB = new Vector3(color.r, color.g, color.b)

    this.cache.set(hex, {
      sourceHex: hex,
      linearRGB,
      linearColor: color,
    })

    return linearRGB
  }

  /**
   * Get linear Color object from sRGB hex string
   *
   * @param hex - sRGB color hex string
   * @returns Linear Color object
   */
  getLinearColor(hex: string): Color {
    const cached = this.cache.get(hex)
    if (cached) {
      return cached.linearColor
    }

    // This will populate the cache
    this.getLinearRGB(hex)
    return this.cache.get(hex)!.linearColor
  }

  /**
   * Clear the cache (call when too many colors accumulated)
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size for debugging
   */
  get size(): number {
    return this.cache.size
  }
}

// Singleton instance
let globalColorCache: ColorCache | null = null

/**
 * Get the global color cache instance
 */
export function getColorCache(): ColorCache {
  if (!globalColorCache) {
    globalColorCache = new ColorCache()
  }
  return globalColorCache
}

/**
 * Convenience function to get linear RGB from hex
 */
export function hexToLinearRGB(hex: string): Vector3 {
  return getColorCache().getLinearRGB(hex)
}

/**
 * Convenience function to get linear Color from hex
 */
export function hexToLinearColor(hex: string): Color {
  return getColorCache().getLinearColor(hex)
}
