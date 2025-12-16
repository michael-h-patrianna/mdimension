/**
 * useSchroedingerColors Hook
 *
 * Computes per-point colors for Schroedinger visualization based on escape time values.
 * Colors are derived from the user's vertexColor setting for visual consistency.
 *
 * @see src/lib/geometry/extended/schroedinger/colors.ts
 */

import { useMemo } from 'react';
import type { NdGeometry } from '@/lib/geometry/types';
import type { SchroedingerConfig } from '@/lib/geometry/extended/types';
import { generatePointColors } from '@/lib/geometry/extended/schroedinger/colors';

/**
 * Hook to generate per-point colors for Schroedinger visualization.
 *
 * Extracts normalizedEscapeValues from geometry metadata and generates
 * colors based on the current Schroedinger configuration and user's vertex color.
 *
 * @param geometry - The geometry object (may or may not be Schroedinger)
 * @param config - Schroedinger configuration with color settings
 * @param baseColor - User's vertex color from appearanceStore
 * @returns Array of hex color strings, or undefined if not a Schroedinger geometry
 *
 * @example
 * ```tsx
 * const { geometry } = useGeometryGenerator();
 * const schroedingerConfig = useExtendedObjectStore((state) => state.schroedinger);
 * const vertexColor = useAppearanceStore((state) => state.faceColor); // Using faceColor as base for Schroedinger
 * const pointColors = useSchroedingerColors(geometry, schroedingerConfig, vertexColor);
 *
 * <Scene
 *   vertices={projectedVertices}
 *   pointColors={pointColors}
 *   // ...
 * />
 * ```
 */
export function useSchroedingerColors(
  geometry: NdGeometry | null,
  config: SchroedingerConfig,
  baseColor: string
): string[] | undefined {
  return useMemo(() => {
    // Only process Schroedinger geometries
    if (!geometry || geometry.type !== 'schroedinger') {
      return undefined;
    }

    // Extract normalizedEscapeValues from geometry metadata
    const normalizedEscapeValues = geometry.metadata?.properties?.normalizedEscapeValues;

    if (!normalizedEscapeValues || !Array.isArray(normalizedEscapeValues)) {
      return undefined;
    }

    // Generate colors from escape values using the base color
    return generatePointColors(normalizedEscapeValues, config, baseColor);
  }, [geometry, config, baseColor]);
}
