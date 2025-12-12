/**
 * useMandelbrotColors Hook
 *
 * Computes per-point colors for Mandelbrot visualization based on escape time values.
 * Colors are derived from the user's vertexColor setting for visual consistency.
 *
 * @see src/lib/geometry/extended/mandelbrot/colors.ts
 */

import { useMemo } from 'react';
import type { NdGeometry } from '@/lib/geometry/types';
import type { MandelbrotConfig } from '@/lib/geometry/extended/types';
import { generatePointColors } from '@/lib/geometry/extended/mandelbrot/colors';

/**
 * Hook to generate per-point colors for Mandelbrot visualization.
 *
 * Extracts normalizedEscapeValues from geometry metadata and generates
 * colors based on the current Mandelbrot configuration and user's vertex color.
 *
 * @param geometry - The geometry object (may or may not be Mandelbrot)
 * @param config - Mandelbrot configuration with color settings
 * @param baseColor - User's vertex color from visualStore
 * @returns Array of hex color strings, or undefined if not a Mandelbrot geometry
 *
 * @example
 * ```tsx
 * const { geometry } = useGeometryGenerator();
 * const mandelbrotConfig = useExtendedObjectStore((state) => state.mandelbrot);
 * const vertexColor = useVisualStore((state) => state.vertexColor);
 * const pointColors = useMandelbrotColors(geometry, mandelbrotConfig, vertexColor);
 *
 * <Scene
 *   vertices={projectedVertices}
 *   pointColors={pointColors}
 *   // ...
 * />
 * ```
 */
export function useMandelbrotColors(
  geometry: NdGeometry | null,
  config: MandelbrotConfig,
  baseColor: string
): string[] | undefined {
  return useMemo(() => {
    // Only process Mandelbrot geometries
    if (!geometry || geometry.type !== 'mandelbrot') {
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
