/**
 * Linear Color Cache
 *
 * Optimizes sRGB to linear color conversion by caching results.
 * Conversions only happen when the source color actually changes,
 * avoiding per-frame pow() operations for static colors.
 *
 * @module
 */

import { Color } from 'three'

/**
 * Cached linear color with change tracking.
 * Stores both the source sRGB string and the converted linear Color.
 */
export interface CachedLinearColor {
  /** The source sRGB color string (for change detection) */
  source: string
  /** The converted linear color (reused Three.js Color object) */
  linear: Color
}

/**
 * Create a cached linear color tracker.
 * Returns an object that efficiently converts sRGB to linear only when needed.
 *
 * @returns CachedLinearColor with empty source (will convert on first use)
 */
export function createCachedLinearColor(): CachedLinearColor {
  return {
    source: '',
    linear: new Color(),
  }
}

/**
 * Update a cached linear color if the source has changed.
 * Returns true if conversion was performed, false if cached value was used.
 *
 * @param cache - The cached color object to update
 * @param srgbColor - The source sRGB color string (hex like '#FF0000' or CSS color)
 * @returns true if color was converted, false if cache hit
 */
export function updateCachedLinearColor(cache: CachedLinearColor, srgbColor: string): boolean {
  if (cache.source === srgbColor) {
    return false // Cache hit - no conversion needed
  }

  // Cache miss - convert and store
  cache.source = srgbColor
  cache.linear.set(srgbColor).convertSRGBToLinear()
  return true
}

/**
 * Update a Three.js Color uniform with linear color, using cache.
 * Only performs sRGB->linear conversion when source color changes.
 *
 * @param cache - The cached color object for tracking
 * @param targetColor - The Three.js Color uniform value to update
 * @param srgbColor - The source sRGB color string
 */
export function updateLinearColorUniform(
  cache: CachedLinearColor,
  targetColor: Color,
  srgbColor: string
): void {
  if (cache.source !== srgbColor) {
    // Cache miss - convert and store
    cache.source = srgbColor
    cache.linear.set(srgbColor).convertSRGBToLinear()
  }

  // Copy cached linear value to target (fast Vector3 copy)
  targetColor.copy(cache.linear)
}

/**
 * Create a set of cached linear colors for common shader uniforms.
 * Pre-allocates caches for frequently used colors.
 *
 * @returns Object with named caches for common color uniforms
 */
export function createColorCache() {
  return {
    faceColor: createCachedLinearColor(),
    edgeColor: createCachedLinearColor(),
    pointColor: createCachedLinearColor(),
    lightColor: createCachedLinearColor(),
    ambientColor: createCachedLinearColor(),
    specularColor: createCachedLinearColor(),
    rimColor: createCachedLinearColor(),
    sssColor: createCachedLinearColor(),
  }
}

export type ColorCache = ReturnType<typeof createColorCache>

/**
 * Maximum number of lights supported by the lighting system.
 * Must match MAX_LIGHTS in lib/lights/types.ts
 */
const MAX_LIGHTS = 4

/**
 * Cache for per-light colors in the multi-light system.
 * Pre-allocates MAX_LIGHTS cache slots to avoid per-frame allocations.
 */
export interface LightColorCache {
  /** Array of cached colors, one per light slot */
  lights: CachedLinearColor[]
}

/**
 * Create a cache for multi-light system colors.
 * Pre-allocates MAX_LIGHTS cache slots.
 *
 * @returns LightColorCache with pre-allocated slots
 */
export function createLightColorCache(): LightColorCache {
  const lights: CachedLinearColor[] = []
  for (let i = 0; i < MAX_LIGHTS; i++) {
    lights.push(createCachedLinearColor())
  }
  return { lights }
}

/**
 * Update a light's color uniform with cached linear conversion.
 * Only performs sRGB->linear conversion when the source color changes.
 *
 * @param cache - The light color cache
 * @param lightIndex - Index of the light (0 to MAX_LIGHTS-1)
 * @param targetColor - The Three.js Color uniform value to update
 * @param srgbColor - The source sRGB color string
 * @returns true if color was converted, false if cache hit
 */
export function updateLightColorUniform(
  cache: LightColorCache,
  lightIndex: number,
  targetColor: Color,
  srgbColor: string
): boolean {
  const lightCache = cache.lights[lightIndex]
  if (!lightCache) return false

  if (lightCache.source !== srgbColor) {
    // Cache miss - convert and store
    lightCache.source = srgbColor
    lightCache.linear.set(srgbColor).convertSRGBToLinear()
    targetColor.copy(lightCache.linear)
    return true
  }

  // Cache hit - just copy the cached value
  targetColor.copy(lightCache.linear)
  return false
}
