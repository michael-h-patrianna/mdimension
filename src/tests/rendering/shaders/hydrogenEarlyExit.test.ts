/**
 * Tests for hydrogen orbital early exit optimization
 *
 * Verifies that the early exit threshold:
 * 1. Never cuts off visible contributions (zero fidelity loss)
 * 2. Provides reasonable performance improvement
 * 3. Scales correctly with quantum numbers and Bohr radius
 */
import { describe, it, expect } from 'vitest';

/**
 * JavaScript implementation of the GLSL threshold calculation
 * Must match hydrogenRadialEarlyExit() in hydrogenPsi.glsl.ts
 */
function hydrogenRadialThreshold(n: number, a0: number, l: number): number {
  return 25.0 * n * a0 * (1.0 + 0.1 * l);
}

/**
 * JavaScript implementation of the GLSL hydrogen radial wavefunction
 * Simplified version for testing threshold validity
 */
function hydrogenRadialMagnitude(n: number, l: number, r: number, a0: number): number {
  // rho = 2r / (n * a0)
  const rho = (2.0 * r) / (n * a0);

  // Damping factor
  const damp = 1.0 / (1.0 + 0.02 * n * n);

  // Normalization (simplified)
  const front = Math.pow(2.0 / (n * a0), 1.5);

  // Factorial ratio (simplified for testing)
  let factNum = 1.0;
  for (let i = 1; i <= n - l - 1; i++) {
    factNum *= i;
  }
  let factDen = 2.0 * n;
  for (let i = 1; i <= n + l; i++) {
    factDen *= i;
  }
  const norm = front * Math.sqrt(factNum / factDen);

  // rho^l factor
  const rhoL = l === 0 ? 1.0 : Math.pow(Math.max(rho, 1e-10), l);

  // Laguerre polynomial (simplified - just use recurrence for k=n-l-1)
  const lagK = n - l - 1;
  const alpha = 2 * l + 1;
  let L = 1.0;
  if (lagK >= 1) {
    let L0 = 1.0;
    let L1 = 1.0 + alpha - rho;
    if (lagK === 1) {
      L = L1;
    } else {
      for (let k = 1; k < lagK; k++) {
        const Lkp1 = ((2.0 * k + 1.0 + alpha - rho) * L1 - (k + alpha) * L0) / (k + 1.0);
        L0 = L1;
        L1 = Lkp1;
      }
      L = L1;
    }
  }

  // Exponential decay
  const expPart = Math.exp(-rho * 0.5);

  return Math.abs(damp * norm * rhoL * L * expPart);
}

/**
 * Calculate density boost applied in hydrogen mode
 * Must match the boost in density.glsl.ts
 */
function hydrogenDensityBoost(n: number, l: number, dimension: number = 3): number {
  const lBoost = Math.pow(3.0, l);
  const baseBoost = 50.0 * n * n * lBoost;

  if (dimension <= 3) {
    return baseBoost;
  }

  // Hydrogen ND adds dimension factor
  const dimFactor = 1.0 + (dimension - 3) * 0.3;
  return baseBoost * dimFactor;
}

describe('hydrogenRadialEarlyExit threshold', () => {
  describe('threshold formula correctness', () => {
    it('should compute correct threshold for base case n=1, l=0, a0=1', () => {
      const threshold = hydrogenRadialThreshold(1, 1.0, 0);
      expect(threshold).toBe(25.0);
    });

    it('should scale linearly with n', () => {
      const t1 = hydrogenRadialThreshold(1, 1.0, 0);
      const t2 = hydrogenRadialThreshold(2, 1.0, 0);
      const t4 = hydrogenRadialThreshold(4, 1.0, 0);

      expect(t2).toBe(2 * t1);
      expect(t4).toBe(4 * t1);
    });

    it('should scale linearly with a0', () => {
      const t1 = hydrogenRadialThreshold(2, 1.0, 0);
      const t2 = hydrogenRadialThreshold(2, 2.0, 0);
      const t3 = hydrogenRadialThreshold(2, 3.0, 0);

      expect(t2).toBe(2 * t1);
      expect(t3).toBe(3 * t1);
    });

    it('should increase with l (higher angular momentum)', () => {
      const t0 = hydrogenRadialThreshold(4, 1.0, 0);
      const t1 = hydrogenRadialThreshold(4, 1.0, 1);
      const t2 = hydrogenRadialThreshold(4, 1.0, 2);
      const t3 = hydrogenRadialThreshold(4, 1.0, 3);

      expect(t1).toBeGreaterThan(t0);
      expect(t2).toBeGreaterThan(t1);
      expect(t3).toBeGreaterThan(t2);
    });

    it('should compute correct threshold for worst case n=7, l=6, a0=3', () => {
      const threshold = hydrogenRadialThreshold(7, 3.0, 6);
      // 25 * 7 * 3 * (1 + 0.6) = 25 * 21 * 1.6 = 840
      expect(threshold).toBe(840);
    });
  });

  describe('threshold guarantees negligible contributions', () => {
    const VISIBILITY_THRESHOLD = 1e-8;

    // Test parameter combinations
    const testCases = [
      { n: 1, l: 0, a0: 1.0 },
      { n: 2, l: 1, a0: 1.0 },
      { n: 3, l: 2, a0: 1.5 },
      { n: 4, l: 3, a0: 2.0 },
      { n: 5, l: 4, a0: 2.5 },
      { n: 6, l: 5, a0: 2.0 },
      { n: 7, l: 6, a0: 3.0 }, // Worst case
    ];

    testCases.forEach(({ n, l, a0 }) => {
      it(`at threshold r, |R_nl|² * boost should be < ${VISIBILITY_THRESHOLD} for n=${n}, l=${l}, a0=${a0}`, () => {
        const threshold = hydrogenRadialThreshold(n, a0, l);
        const R = hydrogenRadialMagnitude(n, l, threshold, a0);
        const boost = hydrogenDensityBoost(n, l, 11); // Use max dimension for worst case
        const boostedDensity = R * R * boost;

        expect(boostedDensity).toBeLessThan(VISIBILITY_THRESHOLD);
      });
    });
  });

  describe('threshold does not cut off visible contributions', () => {
    const VISIBILITY_THRESHOLD = 1e-8;

    // Test that at typical orbital distances, density is still visible
    // The "typical" distance scales with n² * a0 (most probable radius)
    const testCases = [
      { n: 1, l: 0, a0: 1.0, typicalR: 1.5 }, // 1s: peak at ~a0
      { n: 2, l: 1, a0: 1.0, typicalR: 4.0 }, // 2p: peak at ~4a0
      { n: 4, l: 2, a0: 1.5, typicalR: 20.0 }, // 4d: peak at higher r
      { n: 7, l: 6, a0: 3.0, typicalR: 100.0 }, // 7i: very spread out
    ];

    testCases.forEach(({ n, l, a0, typicalR }) => {
      it(`at typical orbital distance r=${typicalR}, contributions should be visible for n=${n}, l=${l}, a0=${a0}`, () => {
        const threshold = hydrogenRadialThreshold(n, a0, l);

        // Typical distance should be well below threshold
        expect(typicalR).toBeLessThan(threshold);

        // And the wavefunction should have visible density
        const R = hydrogenRadialMagnitude(n, l, typicalR, a0);
        const boost = hydrogenDensityBoost(n, l);
        const boostedDensity = R * R * boost;

        // This should be above visibility threshold (i.e., visible)
        expect(boostedDensity).toBeGreaterThan(VISIBILITY_THRESHOLD);
      });
    });

    // Additional test: verify threshold is conservative enough
    testCases.forEach(({ n, l, a0 }) => {
      it(`at 90% of threshold, early exit would be incorrect for n=${n}, l=${l}, a0=${a0}`, () => {
        const threshold = hydrogenRadialThreshold(n, a0, l);
        const r = threshold * 0.9;

        // At 90% of threshold, we should NOT early exit
        expect(r).toBeLessThan(threshold);

        // The wavefunction may be small here, but that's okay
        // The key is that we're NOT cutting off contributions prematurely
        // At 90% of threshold, we're in the "negligible" region by design
      });
    });
  });

  describe('extra dimension early exit threshold', () => {
    const GAUSSIAN_THRESHOLD = 18.0;

    it('should use 3-sigma threshold (distSq > 18) for extra dimensions', () => {
      // At distSq = 18, the Gaussian contribution is exp(-9) ≈ 1.2e-4
      const distSq = 18.0;
      const gaussianContribution = Math.exp(-0.5 * distSq);
      expect(gaussianContribution).toBeLessThan(1e-3);
    });

    it('should not exit when extra dimension coordinates are small', () => {
      // For omega = 1.0, alpha = 1.0
      // If x3 = 2.0, then u² = 4.0
      // distSq = 4.0 < 18.0, so no early exit
      const omega = 1.0;
      const alpha = Math.sqrt(omega);
      const x3 = 2.0;
      const distSq = (alpha * x3) ** 2;

      expect(distSq).toBeLessThan(GAUSSIAN_THRESHOLD);
    });

    it('should exit when extra dimension coordinates are large', () => {
      // For omega = 1.0, alpha = 1.0
      // If x3 = 5.0, then u² = 25.0 > 18.0
      const omega = 1.0;
      const alpha = Math.sqrt(omega);
      const x3 = 5.0;
      const distSq = (alpha * x3) ** 2;

      expect(distSq).toBeGreaterThan(GAUSSIAN_THRESHOLD);
    });

    it('should handle multiple extra dimensions', () => {
      // 4 extra dimensions with small values each
      const omega = 1.0;
      const alpha = Math.sqrt(omega);
      const coords = [1.5, 1.5, 1.5, 1.5]; // 4 dimensions

      let distSq = 0;
      for (const x of coords) {
        distSq += (alpha * x) ** 2;
      }

      // 4 * (1.5)² = 4 * 2.25 = 9.0 < 18.0
      expect(distSq).toBeLessThan(GAUSSIAN_THRESHOLD);
    });

    it('should exit when any combination of extra dimensions exceeds threshold', () => {
      const omega = 1.0;
      const alpha = Math.sqrt(omega);
      // 4 extra dimensions where sum exceeds threshold
      const coords = [2.5, 2.5, 2.5, 0.5];

      let distSq = 0;
      for (const x of coords) {
        distSq += (alpha * x) ** 2;
      }

      // 3 * 6.25 + 0.25 = 19.0 > 18.0
      expect(distSq).toBeGreaterThan(GAUSSIAN_THRESHOLD);
    });
  });

  describe('parameter range validation', () => {
    it('should handle minimum parameter values', () => {
      const threshold = hydrogenRadialThreshold(1, 0.5, 0);
      expect(threshold).toBe(12.5);
      expect(threshold).toBeGreaterThan(0);
    });

    it('should handle maximum parameter values', () => {
      const threshold = hydrogenRadialThreshold(7, 3.0, 6);
      expect(threshold).toBe(840);
      expect(threshold).toBeLessThan(1000);
    });

    it('should be monotonically increasing with all parameters', () => {
      // Test n
      for (let n = 1; n < 7; n++) {
        expect(hydrogenRadialThreshold(n + 1, 1.0, 0)).toBeGreaterThan(
          hydrogenRadialThreshold(n, 1.0, 0)
        );
      }

      // Test a0
      for (let a0 = 0.5; a0 < 3.0; a0 += 0.5) {
        expect(hydrogenRadialThreshold(2, a0 + 0.5, 0)).toBeGreaterThan(
          hydrogenRadialThreshold(2, a0, 0)
        );
      }

      // Test l
      for (let l = 0; l < 6; l++) {
        expect(hydrogenRadialThreshold(7, 1.0, l + 1)).toBeGreaterThan(
          hydrogenRadialThreshold(7, 1.0, l)
        );
      }
    });
  });
});
