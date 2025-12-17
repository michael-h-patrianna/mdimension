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
  /** Volumetric objects (Schroedinger) when temporal accumulation is enabled */
  VOLUMETRIC: 3,
} as const;

export type RenderLayer = (typeof RENDER_LAYERS)[keyof typeof RENDER_LAYERS];

/**
 * Check if temporal cloud accumulation needs separate volumetric pass.
 * When enabled, volumetric objects (Schroedinger) render to 1/4 res target
 * using Horizon Zero Dawn-style temporal accumulation with Bayer pattern cycling.
 *
 * The temporal accumulation pipeline:
 * 1. Renders volumetric at quarter resolution with Bayer offset
 * 2. Reprojects previous frame's accumulation to current view
 * 3. Reconstructs full resolution by blending new pixels with history
 * 4. Composites over the main scene
 * @param state
 * @param state.temporalCloudAccumulation
 * @param state.objectType
 */
export function needsVolumetricSeparation(state: {
  temporalCloudAccumulation?: boolean;
  objectType?: string;
}): boolean {
  return Boolean(state.temporalCloudAccumulation && state.objectType === 'schroedinger');
}

/**
 * Check if object-only depth pass is needed based on current effect settings.
 * Returns true if any effect requires depth that should exclude environment objects.
 *
 * @param state - Current post-processing state
 * @param state.ssrEnabled
 * @param state.refractionEnabled
 * @param state.bokehEnabled
 * @param state.bokehFocusMode
 * @param state.temporalReprojectionEnabled
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
