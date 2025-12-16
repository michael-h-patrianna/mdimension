/**
 * useMandelbulbColors Hook
 *
 * Computes per-point colors for Mandelbulb visualization based on escape time values.
 * Colors are derived from the user's vertexColor setting for visual consistency.
 *
 * @see src/lib/geometry/extended/mandelbulb/colors.ts
 */

import { useMemo } from 'react';
import type { NdGeometry } from '@/lib/geometry/types';
import type { MandelbulbConfig } from '@/lib/geometry/extended/types';
import { generatePointColors } from '@/lib/geometry/extended/mandelbulb/colors';

/**
 * Hook to generate per-point colors for Mandelbulb visualization.
 *
 * Extracts normalizedEscapeValues from geometry metadata and generates
 * colors based on the current Mandelbulb configuration and user's vertex color.
 *
 * @param geometry - The geometry object (may or may not be Mandelbulb)
 * @param config - Mandelbulb configuration with color settings
 * @param baseColor - User's vertex color from appearanceStore
 * @returns Array of hex color strings, or undefined if not a Mandelbulb geometry
 *
 * @example
 * ```tsx
 * const { geometry } = useGeometryGenerator();
 * const mandelbulbConfig = useExtendedObjectStore((state) => state.mandelbulb);
 * const vertexColor = useAppearanceStore((state) => state.faceColor); // Using faceColor as base for Mandelbulb
 * const pointColors = useMandelbulbColors(geometry, mandelbulbConfig, vertexColor);
 *
 * <Scene
 *   vertices={projectedVertices}
 *   pointColors={pointColors}
 *   // ...
 * />
 * ```
 */
export function useMandelbulbColors(
  geometry: NdGeometry | null,
  config: MandelbulbConfig,
  baseColor: string
): string[] | undefined {
  return useMemo(() => {
    // Only process Mandelbulb geometries
    if (!geometry || geometry.type !== 'mandelbulb') {
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
