/**
 * TSL Version Tracking for Dirty-Flag Optimization
 *
 * Granular version tracking to minimize uniform updates.
 * Only update uniforms when relevant store state changes.
 *
 * 100% parity with WebGL version tracking pattern.
 *
 * @module rendering/tsl/utils/version-tracking
 */

/**
 * Version tracking state
 */
export interface VersionTracking {
  /** Polytope geometry version */
  polytope: number
  /** Appearance settings version */
  appearance: number
  /** Lighting settings version */
  lighting: number
  /** IBL settings version */
  ibl: number
  /** PBR settings version */
  pbr: number
  /** Color algorithm version */
  color: number
  /** Shadow settings version */
  shadows: number
  /** SSS settings version */
  sss: number
  /** Fresnel settings version */
  fresnel: number
}

/**
 * Create initial version tracking state
 */
export function createVersionTracking(): VersionTracking {
  return {
    polytope: -1,
    appearance: -1,
    lighting: -1,
    ibl: -1,
    pbr: -1,
    color: -1,
    shadows: -1,
    sss: -1,
    fresnel: -1,
  }
}

/**
 * Check if any tracked version has changed
 *
 * @param current - Current version state
 * @param lastVersions - Last known versions
 * @returns Object with changed flags and new version state
 */
export function checkVersionChanges(
  current: Partial<VersionTracking>,
  lastVersions: VersionTracking
): {
  changed: {
    polytope: boolean
    appearance: boolean
    lighting: boolean
    ibl: boolean
    pbr: boolean
    color: boolean
    shadows: boolean
    sss: boolean
    fresnel: boolean
    any: boolean
  }
  newVersions: VersionTracking
} {
  const changed = {
    polytope: current.polytope !== undefined && current.polytope !== lastVersions.polytope,
    appearance: current.appearance !== undefined && current.appearance !== lastVersions.appearance,
    lighting: current.lighting !== undefined && current.lighting !== lastVersions.lighting,
    ibl: current.ibl !== undefined && current.ibl !== lastVersions.ibl,
    pbr: current.pbr !== undefined && current.pbr !== lastVersions.pbr,
    color: current.color !== undefined && current.color !== lastVersions.color,
    shadows: current.shadows !== undefined && current.shadows !== lastVersions.shadows,
    sss: current.sss !== undefined && current.sss !== lastVersions.sss,
    fresnel: current.fresnel !== undefined && current.fresnel !== lastVersions.fresnel,
    any: false,
  }

  changed.any =
    changed.polytope ||
    changed.appearance ||
    changed.lighting ||
    changed.ibl ||
    changed.pbr ||
    changed.color ||
    changed.shadows ||
    changed.sss ||
    changed.fresnel

  const newVersions: VersionTracking = {
    polytope: current.polytope ?? lastVersions.polytope,
    appearance: current.appearance ?? lastVersions.appearance,
    lighting: current.lighting ?? lastVersions.lighting,
    ibl: current.ibl ?? lastVersions.ibl,
    pbr: current.pbr ?? lastVersions.pbr,
    color: current.color ?? lastVersions.color,
    shadows: current.shadows ?? lastVersions.shadows,
    sss: current.sss ?? lastVersions.sss,
    fresnel: current.fresnel ?? lastVersions.fresnel,
  }

  return { changed, newVersions }
}

/**
 * React hook for version tracking with useRef
 *
 * Usage:
 * ```typescript
 * const versions = useVersionTracking()
 *
 * useFrame(() => {
 *   const { changed, update } = versions.check({
 *     polytope: extendedObjectStore.polytopeVersion,
 *     appearance: appearanceStore.appearanceVersion,
 *   })
 *
 *   if (changed.polytope) {
 *     // Update polytope-related uniforms
 *   }
 *
 *   if (changed.appearance) {
 *     // Update appearance-related uniforms
 *   }
 *
 *   update() // Apply new versions
 * })
 * ```
 */
export function createVersionTracker() {
  let lastVersions = createVersionTracking()
  let pendingVersions: VersionTracking | null = null

  return {
    check(current: Partial<VersionTracking>) {
      const result = checkVersionChanges(current, lastVersions)
      pendingVersions = result.newVersions

      return {
        changed: result.changed,
        update: () => {
          if (pendingVersions) {
            lastVersions = pendingVersions
            pendingVersions = null
          }
        },
      }
    },

    reset() {
      lastVersions = createVersionTracking()
      pendingVersions = null
    },
  }
}
