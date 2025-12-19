/**
 * Caching utilities for Wythoff polytope generation.
 *
 * Implements a two-tier caching strategy:
 * 1. In-memory cache for fastest access (Map)
 * 2. IndexedDB cache for persistence across sessions (binary format)
 *
 * Cache key is scale-independent - geometry is cached at scale=1.0
 * and scaled on retrieval for better cache hit rates.
 */

import { IndexedDBCache } from '@/lib/cache/IndexedDBCache'
import { WYTHOFF_CONFIG } from '../config'
import type { PolytopeGeometry } from '../types'
import {
  deserializeFromBinary,
  isBinaryFormat,
  serializeToBinary,
  type BinaryPolytopeData,
} from '../utils/binary-serialization'
import type { WythoffPolytopeConfig } from './types'

/**
 * In-memory cache for generated polytopes (fastest access)
 */
const polytopeCache = new Map<string, PolytopeGeometry>()

/**
 * Promise that resolves to the IndexedDB cache instance or null.
 * Using a single promise that returns the cache directly prevents race conditions.
 */
let indexedDBCachePromise: Promise<IndexedDBCache | null> | null = null

/**
 * Get or initialize the IndexedDB cache.
 *
 * Thread-safe: Uses a single promise that resolves to the cache instance,
 * preventing race conditions between concurrent callers.
 *
 * @returns Promise resolving to cache instance if available, null otherwise
 */
async function getIndexedDBCache(): Promise<IndexedDBCache | null> {
  // Create initialization promise only once
  if (indexedDBCachePromise === null) {
    indexedDBCachePromise = (async () => {
      const cache = new IndexedDBCache()
      const available = await cache.open()
      return available ? cache : null
    })()
  }

  // All callers wait on the same promise and get the same result
  return indexedDBCachePromise
}

/**
 * Generate a scale-independent cache key for Wythoff polytope configuration.
 * Scale is intentionally excluded - we cache normalized geometry (scale=1.0)
 * and apply scale on retrieval for better cache hit rates.
 * @param dimension - The dimension of the polytope
 * @param config - Wythoff polytope configuration
 * @returns JSON string cache key
 */
export function getCacheKey(dimension: number, config: WythoffPolytopeConfig): string {
  return JSON.stringify({
    d: dimension,
    s: config.symmetryGroup,
    p: config.preset,
    c: config.customSymbol,
    // Note: scale intentionally omitted - we cache at scale=1.0
    sn: config.snub,
  })
}

/**
 * Apply scale to cached geometry.
 * Creates a new geometry object with scaled vertices.
 *
 * @param geometry - The geometry to scale (assumed to be at scale=1.0)
 * @param scale - Target scale factor
 * @returns New geometry with scaled vertices
 */
export function applyScaleToGeometry(geometry: PolytopeGeometry, scale: number): PolytopeGeometry {
  // If scale is ~1.0, return as-is to avoid unnecessary allocation
  if (Math.abs(scale - 1.0) < 1e-9) {
    return geometry
  }

  // Scale all vertices
  const scaledVertices = geometry.vertices.map((vertex) => vertex.map((coord) => coord * scale))

  return {
    ...geometry,
    vertices: scaledVertices,
    metadata: {
      ...geometry.metadata,
      properties: {
        ...geometry.metadata?.properties,
        appliedScale: scale,
      },
    },
  }
}

/**
 * Cache a polytope to both memory and IndexedDB (fire-and-forget).
 *
 * IndexedDB storage uses binary format for ~2.5x size reduction:
 * - Vertices: Float64Array instead of JSON arrays
 * - Edges: Uint32Array instead of JSON arrays
 *
 * @param key - Cache key
 * @param geometry - Polytope geometry to cache
 */
export function cachePolytope(key: string, geometry: PolytopeGeometry): void {
  // Always cache in memory (sync)
  if (polytopeCache.size >= WYTHOFF_CONFIG.MAX_CACHE_SIZE) {
    const firstKey = polytopeCache.keys().next().value
    if (firstKey) polytopeCache.delete(firstKey)
  }
  polytopeCache.set(key, geometry)

  // Persist to IndexedDB in binary format (async, fire-and-forget)
  getIndexedDBCache()
    .then((cache) => {
      if (cache) {
        // Serialize to binary format for efficient storage
        const binaryData = serializeToBinary(geometry)
        cache.set('polytope-geometry', key, binaryData).catch((error) => {
          console.warn('[Wythoff] IndexedDB write failed:', error)
        })
      }
    })
    .catch(() => {
      // IndexedDB unavailable - memory cache still works
    })
}

/**
 * Try to get cached polytope from memory or IndexedDB.
 *
 * Handles both binary format (new) and JSON format (legacy) for backwards
 * compatibility with existing cache entries.
 *
 * @param key - Cache key
 * @returns Promise resolving to cached geometry or null
 */
export async function getCachedPolytope(key: string): Promise<PolytopeGeometry | null> {
  // Check memory cache first (fastest)
  if (polytopeCache.has(key)) {
    return polytopeCache.get(key)!
  }

  // Check IndexedDB (persisted across sessions)
  const cache = await getIndexedDBCache()
  if (cache) {
    try {
      // Try to get cached data (could be binary or legacy JSON format)
      const cached = await cache.get<PolytopeGeometry | BinaryPolytopeData>(
        'polytope-geometry',
        key
      )
      if (cached) {
        // Deserialize from binary format if needed
        const geometry = isBinaryFormat(cached)
          ? deserializeFromBinary(cached)
          : (cached as PolytopeGeometry)

        // Populate memory cache for future sync access
        if (polytopeCache.size >= WYTHOFF_CONFIG.MAX_CACHE_SIZE) {
          const firstKey = polytopeCache.keys().next().value
          if (firstKey) polytopeCache.delete(firstKey)
        }
        polytopeCache.set(key, geometry)
        return geometry
      }
    } catch (error) {
      console.warn('[Wythoff] IndexedDB read failed:', error)
    }
  }

  return null
}

/**
 * Check memory cache synchronously (fastest path).
 * Use this for sync functions that need immediate cache access.
 *
 * @param key - Cache key
 * @returns Cached geometry or null
 */
export function getFromMemoryCache(key: string): PolytopeGeometry | null {
  return polytopeCache.get(key) ?? null
}

/**
 * Clear all cached polytopes from memory.
 * Does not clear IndexedDB cache.
 */
export function clearMemoryCache(): void {
  polytopeCache.clear()
}

/**
 * Get current memory cache size.
 * @returns Number of cached polytopes
 */
export function getMemoryCacheSize(): number {
  return polytopeCache.size
}
