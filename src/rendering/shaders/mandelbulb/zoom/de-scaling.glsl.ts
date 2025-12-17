/**
 * Distance estimate scaling for zoomed Mandelbulb rendering
 *
 * CRITICAL: When zoom changes the coordinate scale, the distance
 * estimate (DE) computed in fractal-space must be scaled back to
 * object-space for correct raymarching.
 *
 * If we evaluate the fractal at p_fractal = p_object / uZoom, then:
 *   d_object = d_fractal * uZoom
 *
 * Without this scaling:
 * - Under-stepping: Too many iterations, slow rendering
 * - Over-stepping: Artifacts, missed surfaces
 *
 * This function MUST be applied to the raw distance estimate
 * returned by GetDist() before using it for raymarching steps.
 */
export const zoomDeScalingBlock = `
// === Zoom Distance Estimate Scaling ===

/**
 * Scale distance estimate from fractal-space to object-space.
 * MUST be called after GetDist() for stable raymarching with zoom.
 *
 * @param d Raw distance estimate in fractal-space
 * @return Scaled distance in object-space
 */
float scaleDistanceForZoom(float d) {
    if (!uZoomEnabled || uZoom <= 0.0) {
        return d;
    }
    return d * uZoom;
}
`
