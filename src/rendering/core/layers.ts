/**
 * Render Layer Constants
 *
 * Defines Three.js render layers for separating main objects from environment.
 * Used by PostProcessing to render object-only depth for SSR, refraction, and bokeh.
 *
 * Layer 0: Environment (walls, grid, gizmos, axes) - always visible
 * Layer 1: Main Object (polytope, mandelbulb, etc.) - used for depth-based effects
 * Layer 2: Skybox - excluded from normal buffer (skybox normals shouldn't affect SSR)
 */

/**
 * Render layer assignments for scene objects
 */
export const RENDER_LAYERS = {
  /** Environment elements: walls, grid, light gizmos, axes helper */
  ENVIRONMENT: 0,
  /** Main n-dimensional object: polytope, mandelbulb, point cloud */
  MAIN_OBJECT: 1,
  /** Skybox - excluded from normal pass to avoid polluting normal buffer */
  SKYBOX: 2,
} as const;

export type RenderLayer = (typeof RENDER_LAYERS)[keyof typeof RENDER_LAYERS];

/**
 * Check if object-only depth pass is needed based on current effect settings.
 * Returns true if any effect requires depth that should exclude environment objects.
 *
 * @param state - Current post-processing state
 * @returns True if object-only depth pass should be rendered
 */
export function needsObjectOnlyDepth(state: {
  ssrEnabled: boolean;
  refractionEnabled: boolean;
  bokehEnabled: boolean;
  bokehFocusMode: string;
  temporalReprojectionEnabled?: boolean;
}): boolean {
  // SSR and refraction always need object-only depth
  if (state.ssrEnabled || state.refractionEnabled) {
    return true;
  }

  // Bokeh always needs object-only depth so blur is based on main object, not walls
  if (state.bokehEnabled) {
    return true;
  }

  // Temporal reprojection needs depth for raymarching acceleration
  if (state.temporalReprojectionEnabled) {
    return true;
  }

  return false;
}
