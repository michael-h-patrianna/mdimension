/**
 * Precomputed Hermite polynomial coefficients H_n(x) = sum of c[k] * x^k
 *
 * Used by Schrödinger wavefunction shader to avoid recursive computation.
 * Hermite polynomials arise in the quantum harmonic oscillator solutions.
 *
 * Recurrence relation: H_{n+1}(x) = 2x * H_n(x) - 2n * H_{n-1}(x)
 *
 * H_0(x) = 1
 * H_1(x) = 2x
 * H_2(x) = 4x^2 - 2
 * H_3(x) = 8x^3 - 12x
 * H_4(x) = 16x^4 - 48x^2 + 12
 * H_5(x) = 32x^5 - 160x^3 + 120x
 * H_6(x) = 64x^6 - 480x^4 + 720x^2 - 120
 *
 * Each row contains coefficients [c_0, c_1, c_2, ..., c_n] where
 * H_n(x) = c_0 + c_1*x + c_2*x^2 + ... + c_n*x^n
 *
 * Padded to MAX_HERMITE_ORDER+1 coefficients per polynomial.
 */

/** Maximum supported Hermite polynomial order */
export const MAX_HERMITE_ORDER = 6

/** Number of coefficients per polynomial (order + 1) */
export const HERMITE_COEFF_COUNT = MAX_HERMITE_ORDER + 1

/**
 * Hermite polynomial coefficients as nested array.
 * Index by [order][coefficient_index]
 */
export const HERMITE_COEFFICIENTS: readonly number[][] = [
  // H_0(x) = 1
  [1, 0, 0, 0, 0, 0, 0],
  // H_1(x) = 2x
  [0, 2, 0, 0, 0, 0, 0],
  // H_2(x) = 4x^2 - 2
  [-2, 0, 4, 0, 0, 0, 0],
  // H_3(x) = 8x^3 - 12x
  [0, -12, 0, 8, 0, 0, 0],
  // H_4(x) = 16x^4 - 48x^2 + 12
  [12, 0, -48, 0, 16, 0, 0],
  // H_5(x) = 32x^5 - 160x^3 + 120x
  [0, 120, 0, -160, 0, 32, 0],
  // H_6(x) = 64x^6 - 480x^4 + 720x^2 - 120
  [-120, 0, 720, 0, -480, 0, 64],
]

/**
 * Flattened Hermite coefficients for GPU upload.
 * Layout: 7 polynomials x 7 coefficients = 49 floats
 * Access: coeffs[order * 7 + coeff_index]
 */
export const HERMITE_COEFFICIENTS_FLAT: Float32Array = (() => {
  const flat = new Float32Array(49)
  for (let order = 0; order <= MAX_HERMITE_ORDER; order++) {
    for (let i = 0; i < HERMITE_COEFF_COUNT; i++) {
      flat[order * HERMITE_COEFF_COUNT + i] = HERMITE_COEFFICIENTS[order]?.[i] ?? 0
    }
  }
  return flat
})()

/**
 * Evaluate Hermite polynomial H_n(x) using precomputed coefficients.
 * Uses Horner's method for numerical stability.
 *
 * @param n - Polynomial order (0-6)
 * @param x - Point to evaluate at
 * @returns H_n(x)
 */
export function hermiteEval(n: number, x: number): number {
  if (n < 0 || n > MAX_HERMITE_ORDER) {
    return 0
  }

  const coeffs = HERMITE_COEFFICIENTS[n]
  if (!coeffs) {
    return 0
  }

  // Horner's method: evaluate from highest to lowest power
  let result = coeffs[n] ?? 0
  for (let k = n - 1; k >= 0; k--) {
    result = result * x + (coeffs[k] ?? 0)
  }

  return result
}

/**
 * Generate GLSL code defining Hermite coefficients as a const array.
 * This is embedded directly in the shader to avoid uniform overhead.
 * @returns GLSL code string defining Hermite coefficient constants
 */
export function generateHermiteGLSL(): string {
  const lines = [
    '// Precomputed Hermite polynomial coefficients',
    '// H_n(x) = sum of HERMITE_COEFFS[n*7 + k] * x^k for k = 0 to n',
    `const int MAX_HERMITE_ORDER = ${MAX_HERMITE_ORDER};`,
    `const float HERMITE_COEFFS[${49}] = float[${49}](`,
  ]

  const values: string[] = []
  for (let order = 0; order <= MAX_HERMITE_ORDER; order++) {
    const coeffs = HERMITE_COEFFICIENTS[order] ?? []
    for (let i = 0; i < HERMITE_COEFF_COUNT; i++) {
      const value = coeffs[i] ?? 0
      values.push(`  ${value.toFixed(1)}`)
    }
  }

  lines.push(values.join(',\n'))
  lines.push(');')

  return lines.join('\n')
}

/**
 * GLSL function to evaluate Hermite polynomial using embedded coefficients.
 */
export const hermiteEvalGLSL = `
// Evaluate Hermite polynomial H_n(x) using precomputed coefficients
// Uses Horner's method: H_n(x) = c[n] + x*(c[n-1] + x*(c[n-2] + ... ))
float hermiteOptimized(int n, float x) {
  if (n < 0 || n > MAX_HERMITE_ORDER) return 0.0;

  int offset = n * 7;
  float result = HERMITE_COEFFS[offset + n];

  for (int k = n - 1; k >= 0; k--) {
    result = result * x + HERMITE_COEFFS[offset + k];
  }

  return result;
}
`
