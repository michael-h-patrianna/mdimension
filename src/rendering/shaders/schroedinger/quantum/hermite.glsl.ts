/**
 * Hermite polynomial evaluation using recurrence relation
 *
 * Hermite polynomials H_n(u) are used in quantum harmonic oscillator eigenfunctions.
 *
 * Recurrence relation:
 *   H_0(u) = 1
 *   H_1(u) = 2u
 *   H_{n+1}(u) = 2u·H_n(u) - 2n·H_{n-1}(u)
 *
 * First few values:
 *   H_0(u) = 1
 *   H_1(u) = 2u
 *   H_2(u) = 4u² - 2
 *   H_3(u) = 8u³ - 12u
 *   H_4(u) = 16u⁴ - 48u² + 12
 *   H_5(u) = 32u⁵ - 160u³ + 120u
 *   H_6(u) = 64u⁶ - 480u⁴ + 720u² - 120
 */
export const hermiteBlock = `
// ============================================
// Hermite Polynomial (Physicist's Convention)
// ============================================

// Maximum supported quantum number (n ≤ MAX_QUANTUM_N)
#define MAX_QUANTUM_N 6

// Evaluate Hermite polynomial H_n(u) using recurrence
// Stable for n ≤ 6, suitable for real-time rendering
float hermite(int n, float u) {
    // Base cases
    if (n == 0) return 1.0;
    if (n == 1) return 2.0 * u;

    // Recurrence: H_{n+1} = 2u·H_n - 2n·H_{n-1}
    float Hnm1 = 1.0;      // H_0
    float Hn = 2.0 * u;    // H_1

    for (int k = 1; k < MAX_QUANTUM_N; k++) {
        if (k >= n) break;
        float Hnp1 = 2.0 * u * Hn - 2.0 * float(k) * Hnm1;
        Hnm1 = Hn;
        Hn = Hnp1;
    }

    return Hn;
}
`;
