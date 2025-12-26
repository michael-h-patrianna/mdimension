/**
 * Dimension-specific Harmonic Oscillator ND Eigenfunction Variants
 *
 * These are fully unrolled versions of hoND() for each dimension 3-11.
 * GPU cannot effectively branch-predict early exit in loops, so we
 * provide compile-time specialized versions that eliminate the overhead.
 *
 * Each function:
 * 1. Computes the 3σ early exit check (unrolled)
 * 2. Computes the product of ho1D eigenfunctions (unrolled)
 *
 * This optimization reduces iterations from MAX_DIM=11 to the actual
 * dimension, improving performance significantly for lower dimensions.
 */

/**
 * Unrolled hoND for 3D (base case)
 */
export const hoND3dBlock = `
// ============================================
// Harmonic Oscillator ND - 3D (Unrolled)
// ============================================

float hoND3D(float xND[MAX_DIM], int termIdx) {
    // Unrolled 3σ early exit check
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];

    float distSq = u0*u0 + u1*u1 + u2*u2;
    if (distSq > 18.0) return 0.0;

    // Unrolled product computation
    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    return p;
}
`

/**
 * Unrolled hoND for 4D
 */
export const hoND4dBlock = `
// ============================================
// Harmonic Oscillator ND - 4D (Unrolled)
// ============================================

float hoND4D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    return p;
}
`

/**
 * Unrolled hoND for 5D
 */
export const hoND5dBlock = `
// ============================================
// Harmonic Oscillator ND - 5D (Unrolled)
// ============================================

float hoND5D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));
    float alpha4 = sqrt(max(uOmega[4], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];
    float u4 = alpha4 * xND[4];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3 + u4*u4;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 4], xND[4], uOmega[4]);
    return p;
}
`

/**
 * Unrolled hoND for 6D
 */
export const hoND6dBlock = `
// ============================================
// Harmonic Oscillator ND - 6D (Unrolled)
// ============================================

float hoND6D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));
    float alpha4 = sqrt(max(uOmega[4], 0.01));
    float alpha5 = sqrt(max(uOmega[5], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];
    float u4 = alpha4 * xND[4];
    float u5 = alpha5 * xND[5];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3 + u4*u4 + u5*u5;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 4], xND[4], uOmega[4]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 5], xND[5], uOmega[5]);
    return p;
}
`

/**
 * Unrolled hoND for 7D
 */
export const hoND7dBlock = `
// ============================================
// Harmonic Oscillator ND - 7D (Unrolled)
// ============================================

float hoND7D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));
    float alpha4 = sqrt(max(uOmega[4], 0.01));
    float alpha5 = sqrt(max(uOmega[5], 0.01));
    float alpha6 = sqrt(max(uOmega[6], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];
    float u4 = alpha4 * xND[4];
    float u5 = alpha5 * xND[5];
    float u6 = alpha6 * xND[6];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3 + u4*u4 + u5*u5 + u6*u6;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 4], xND[4], uOmega[4]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 5], xND[5], uOmega[5]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 6], xND[6], uOmega[6]);
    return p;
}
`

/**
 * Unrolled hoND for 8D
 */
export const hoND8dBlock = `
// ============================================
// Harmonic Oscillator ND - 8D (Unrolled)
// ============================================

float hoND8D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));
    float alpha4 = sqrt(max(uOmega[4], 0.01));
    float alpha5 = sqrt(max(uOmega[5], 0.01));
    float alpha6 = sqrt(max(uOmega[6], 0.01));
    float alpha7 = sqrt(max(uOmega[7], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];
    float u4 = alpha4 * xND[4];
    float u5 = alpha5 * xND[5];
    float u6 = alpha6 * xND[6];
    float u7 = alpha7 * xND[7];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3 + u4*u4 + u5*u5 + u6*u6 + u7*u7;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 4], xND[4], uOmega[4]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 5], xND[5], uOmega[5]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 6], xND[6], uOmega[6]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 7], xND[7], uOmega[7]);
    return p;
}
`

/**
 * Unrolled hoND for 9D
 */
export const hoND9dBlock = `
// ============================================
// Harmonic Oscillator ND - 9D (Unrolled)
// ============================================

float hoND9D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));
    float alpha4 = sqrt(max(uOmega[4], 0.01));
    float alpha5 = sqrt(max(uOmega[5], 0.01));
    float alpha6 = sqrt(max(uOmega[6], 0.01));
    float alpha7 = sqrt(max(uOmega[7], 0.01));
    float alpha8 = sqrt(max(uOmega[8], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];
    float u4 = alpha4 * xND[4];
    float u5 = alpha5 * xND[5];
    float u6 = alpha6 * xND[6];
    float u7 = alpha7 * xND[7];
    float u8 = alpha8 * xND[8];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3 + u4*u4 + u5*u5 + u6*u6 + u7*u7 + u8*u8;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 4], xND[4], uOmega[4]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 5], xND[5], uOmega[5]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 6], xND[6], uOmega[6]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 7], xND[7], uOmega[7]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 8], xND[8], uOmega[8]);
    return p;
}
`

/**
 * Unrolled hoND for 10D
 */
export const hoND10dBlock = `
// ============================================
// Harmonic Oscillator ND - 10D (Unrolled)
// ============================================

float hoND10D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));
    float alpha4 = sqrt(max(uOmega[4], 0.01));
    float alpha5 = sqrt(max(uOmega[5], 0.01));
    float alpha6 = sqrt(max(uOmega[6], 0.01));
    float alpha7 = sqrt(max(uOmega[7], 0.01));
    float alpha8 = sqrt(max(uOmega[8], 0.01));
    float alpha9 = sqrt(max(uOmega[9], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];
    float u4 = alpha4 * xND[4];
    float u5 = alpha5 * xND[5];
    float u6 = alpha6 * xND[6];
    float u7 = alpha7 * xND[7];
    float u8 = alpha8 * xND[8];
    float u9 = alpha9 * xND[9];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3 + u4*u4 + u5*u5 + u6*u6 + u7*u7 + u8*u8 + u9*u9;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 4], xND[4], uOmega[4]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 5], xND[5], uOmega[5]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 6], xND[6], uOmega[6]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 7], xND[7], uOmega[7]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 8], xND[8], uOmega[8]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 9], xND[9], uOmega[9]);
    return p;
}
`

/**
 * Unrolled hoND for 11D (maximum dimension)
 */
export const hoND11dBlock = `
// ============================================
// Harmonic Oscillator ND - 11D (Unrolled)
// ============================================

float hoND11D(float xND[MAX_DIM], int termIdx) {
    float alpha0 = sqrt(max(uOmega[0], 0.01));
    float alpha1 = sqrt(max(uOmega[1], 0.01));
    float alpha2 = sqrt(max(uOmega[2], 0.01));
    float alpha3 = sqrt(max(uOmega[3], 0.01));
    float alpha4 = sqrt(max(uOmega[4], 0.01));
    float alpha5 = sqrt(max(uOmega[5], 0.01));
    float alpha6 = sqrt(max(uOmega[6], 0.01));
    float alpha7 = sqrt(max(uOmega[7], 0.01));
    float alpha8 = sqrt(max(uOmega[8], 0.01));
    float alpha9 = sqrt(max(uOmega[9], 0.01));
    float alpha10 = sqrt(max(uOmega[10], 0.01));

    float u0 = alpha0 * xND[0];
    float u1 = alpha1 * xND[1];
    float u2 = alpha2 * xND[2];
    float u3 = alpha3 * xND[3];
    float u4 = alpha4 * xND[4];
    float u5 = alpha5 * xND[5];
    float u6 = alpha6 * xND[6];
    float u7 = alpha7 * xND[7];
    float u8 = alpha8 * xND[8];
    float u9 = alpha9 * xND[9];
    float u10 = alpha10 * xND[10];

    float distSq = u0*u0 + u1*u1 + u2*u2 + u3*u3 + u4*u4 + u5*u5 + u6*u6 + u7*u7 + u8*u8 + u9*u9 + u10*u10;
    if (distSq > 18.0) return 0.0;

    int base = termIdx * MAX_DIM;
    float p = ho1D(uQuantum[base + 0], xND[0], uOmega[0]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 1], xND[1], uOmega[1]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 2], xND[2], uOmega[2]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 3], xND[3], uOmega[3]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 4], xND[4], uOmega[4]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 5], xND[5], uOmega[5]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 6], xND[6], uOmega[6]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 7], xND[7], uOmega[7]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 8], xND[8], uOmega[8]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 9], xND[9], uOmega[9]);
    if (abs(p) < 1e-10) return 0.0;

    p *= ho1D(uQuantum[base + 10], xND[10], uOmega[10]);
    return p;
}
`

/**
 * Generate dimension-specific dispatch block.
 * Instead of a #if/#elif chain that references undefined functions,
 * we generate a direct call to the specific dimension's function.
 */
export function generateHoNDDispatchBlock(dimension: number): string {
  const dim = Math.min(Math.max(dimension, 3), 11)
  return `
// ============================================
// Harmonic Oscillator ND - Compile-time Dispatch
// Dimension: ${dim}
// ============================================

// hoNDOptimized: Direct call to dimension-specific unrolled variant
// Generated at shader compile time for dimension ${dim}
float hoNDOptimized(float xND[MAX_DIM], int termIdx) {
    return hoND${dim}D(xND, termIdx);
}
`
}

// Legacy export for backwards compatibility (unused, kept for reference)
export const hoNDDispatchBlock = `
// This block is not used - see generateHoNDDispatchBlock() instead
float hoNDOptimized(float xND[MAX_DIM], int termIdx) {
    return hoND(xND, uDimension, termIdx);
}
`

