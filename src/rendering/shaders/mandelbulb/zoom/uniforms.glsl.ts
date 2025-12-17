/**
 * Zoom uniforms for Mandelbulb fractal rendering
 *
 * These uniforms control the zoom functionality:
 * - uZoomEnabled: Master toggle for zoom feature
 * - uZoom: Current zoom level (>0, default 1.0)
 *
 * Higher zoom values show smaller regions of fractal space,
 * effectively "zooming in" to reveal more detail.
 *
 * The zoom happens around uOrigin in D-dimensional fractal space.
 * The autopilot adjusts uOrigin to track interesting regions.
 */
export const zoomUniformsBlock = `
// === Zoom Uniforms ===

// Master toggle for zoom functionality
uniform bool uZoomEnabled;

// Current zoom level (>0, default 1.0)
// Higher values zoom in (show smaller region of fractal space)
// Zoom happens around uOrigin in D-dimensional fractal space
uniform float uZoom;
`
