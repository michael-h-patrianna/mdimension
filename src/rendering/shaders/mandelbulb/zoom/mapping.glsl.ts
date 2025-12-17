/**
 * Zoom coordinate mapping for Mandelbulb fractal rendering
 *
 * Applies zoom scaling to 3D object-space coordinates before
 * mapping to fractal space. This effectively changes the scale
 * of the slice basis, showing smaller/larger regions.
 *
 * The zoom effect:
 * - uZoom > 1: Shows smaller region (zoom in) around uOrigin
 * - uZoom < 1: Shows larger region (zoom out) from uOrigin
 * - uZoom = 1: No change (default)
 *
 * Mathematically, dividing pos by zoom means:
 *   c = uOrigin + (pos.x*basisX + pos.y*basisY + pos.z*basisZ) / zoom
 *
 * This zooms around uOrigin in D-dimensional fractal space.
 * The autopilot adjusts uOrigin to track interesting regions.
 */
export const zoomMappingBlock = `
// === Zoom Coordinate Mapping ===

/**
 * Apply zoom scaling to position.
 * Dividing by zoom effectively scales the basis contribution,
 * zooming around uOrigin in D-dimensional fractal space.
 *
 * @param pos Object-space position (raymarch point)
 * @return Scaled position for fractal evaluation
 */
vec3 applyZoomToPosition(vec3 pos) {
    if (!uZoomEnabled || uZoom <= 0.0) {
        return pos;
    }
    // Divide by zoom: c = uOrigin + (pos * basis) / zoom
    // This zooms around uOrigin in D-dimensional fractal space
    return pos / uZoom;
}
`
