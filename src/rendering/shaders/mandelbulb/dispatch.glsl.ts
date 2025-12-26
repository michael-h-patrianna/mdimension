/**
 * Generate dimension-specific dispatch GLSL code
 * @param dimension - The dimension (3-11)
 * @returns GLSL dispatch code string
 */
export function generateDispatch(dimension: number): string {
  // Map dimension to function name
  // 3-11 are supported with unrolled versions
  let sdfName = 'sdfHighD'
  let simpleSdfName = 'sdfHighD_simple'
  let args = 'pos, uDimension, pwr, bail, maxIt'
  let argsTrap = 'pos, uDimension, pwr, bail, maxIt, trap'

  if (dimension >= 3 && dimension <= 11) {
    sdfName = `sdf${dimension}D`
    simpleSdfName = `sdf${dimension}D_simple`
    args = 'pos, pwr, bail, maxIt'
    argsTrap = 'pos, pwr, bail, maxIt, trap'
  }

  return `
// ============================================
// Optimized Dispatch (No branching)
// Dimension: ${dimension}
// ============================================

/**
 * Get distance to Mandelbulb surface (simple version).
 * Fixed values: iterations 32 (fast) / 64 (HQ), escape radius 8.0
 */
float GetDist(vec3 pos) {
    float pwr = getEffectivePower();
    float bail = 8.0;  // Fixed escape radius for optimal quality
    int maxIt = uFastMode ? 32 : 64;

    return ${simpleSdfName}(${args});
}

/**
 * Get distance to Mandelbulb surface with trap value output.
 * Fixed values: iterations 32 (fast) / 64 (HQ), escape radius 8.0
 */
float GetDistWithTrap(vec3 pos, out float trap) {
    float pwr = getEffectivePower();
    float bail = 8.0;  // Fixed escape radius for optimal quality
    int maxIt = uFastMode ? 32 : 64;

    return ${sdfName}(${argsTrap});
}
`
}
