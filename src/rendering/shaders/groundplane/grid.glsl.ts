/**
 * Ground Plane Grid Shader Functions
 *
 * Procedural grid rendering for ground plane surfaces.
 * Replaces drei Grid component to support MRT output.
 */

export const gridUniformsBlock = `
// ============================================
// Grid Uniforms
// ============================================
uniform bool uShowGrid;
uniform vec3 uGridColor;
uniform vec3 uSectionColor;
uniform float uGridSpacing;
uniform float uSectionSpacing;
uniform float uGridThickness;
uniform float uSectionThickness;
uniform float uGridFadeDistance;
uniform float uGridFadeStrength;
`

export const gridFunctionsBlock = `
// ============================================
// Grid Functions (adapted from drei Grid)
// ============================================

/**
 * Compute grid pattern - exact drei algorithm.
 * Uses LOCAL position (before model transformation) for stable grid.
 * Returns grid intensity (0 = no line, 1 = on line).
 *
 * @param localXY - Local XY coordinates from vertex shader (before rotation)
 */
float getGrid(vec2 localXY, float size, float thickness) {
  vec2 r = localXY / size;
  vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
  float line = min(grid.x, grid.y) + 1.0 - thickness;
  return 1.0 - min(line, 1.0);
}

/**
 * Apply grid overlay to surface color.
 * Uses LOCAL position (vLocalPosition.xy) for grid calculation.
 * This works for all wall orientations since PlaneGeometry is always XY.
 *
 * @param surfaceColor - Base surface color
 * @param localXY - Local XY position before model transformation
 * @param worldPos - World position for distance fade
 * @param cameraPos - Camera position for distance fade
 */
vec3 applyGrid(vec3 surfaceColor, vec2 localXY, vec3 worldPos, vec3 cameraPos) {
  if (!uShowGrid) {
    return surfaceColor;
  }

  // Compute cell and section grid lines using LOCAL coordinates
  // This ensures consistent grid for all wall orientations
  float g1 = getGrid(localXY, uGridSpacing, uGridThickness);
  float g2 = getGrid(localXY, uSectionSpacing, uSectionThickness);

  // Distance-based fade using world position
  float dist = length(worldPos - cameraPos);
  float d = 1.0 - min(dist / uGridFadeDistance, 1.0);
  d = pow(d, uGridFadeStrength);

  // Color mixing (drei style)
  vec3 color = mix(uGridColor, uSectionColor, min(1.0, uSectionThickness * g2));

  // Alpha calculation (drei style)
  float alpha = (g1 + g2) * d;
  alpha = mix(0.75 * alpha, alpha, g2);

  // Blend grid over surface
  return mix(surfaceColor, color, alpha);
}
`
