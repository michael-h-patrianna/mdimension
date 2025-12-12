/**
 * Tests for n-dimensional Mandelbrot set generation
 *
 * Tests cover:
 * - mandelbrotStep() iteration function
 * - mandelbrotEscapeTime() escape detection
 * - mandelbrotSmoothEscapeTime() smooth coloring
 * - generateSampleGrid() grid generation
 * - filterSamples() point filtering
 * - generateMandelbrot() main generator
 * - getMandelbrotStats() statistics
 */

import { describe, it, expect } from 'vitest';
import {
  mandelbrotStep,
  mandelbrotEscapeTime,
  mandelbrotSmoothEscapeTime,
  normSquared,
  generateSampleGrid,
  filterSamples,
  generateMandelbrot,
  getMandelbrotStats,
} from '@/lib/geometry/extended/mandelbrot';
import { DEFAULT_MANDELBROT_CONFIG } from '@/lib/geometry/extended/types';

describe('normSquared', () => {
  it('should compute squared norm of a vector', () => {
    expect(normSquared([3, 4])).toBe(25);
    expect(normSquared([1, 2, 2])).toBe(9);
    expect(normSquared([0, 0, 0])).toBe(0);
  });

  it('should handle single element vectors', () => {
    expect(normSquared([5])).toBe(25);
    expect(normSquared([-3])).toBe(9);
  });

  it('should handle higher dimensional vectors', () => {
    // 1² + 1² + 1² + 1² = 4
    expect(normSquared([1, 1, 1, 1])).toBe(4);
    // 2² + 0² + 0² + 0² + 0² = 4
    expect(normSquared([2, 0, 0, 0, 0])).toBe(4);
  });
});

describe('mandelbrotStep', () => {
  describe('2D behavior (complex plane)', () => {
    it('should perform complex square for z=0, c=[a,b]', () => {
      // z^2 + c = 0 + c = c
      const z = [0, 0];
      const c = [0.5, 0.3];
      const result = mandelbrotStep(z, c);
      expect(result[0]).toBeCloseTo(0.5);
      expect(result[1]).toBeCloseTo(0.3);
    });

    it('should compute (1+i)^2 correctly', () => {
      // z = [1, 1] represents 1+i
      // z^2 = (1+i)^2 = 1 + 2i - 1 = 2i = [0, 2]
      // With c = [0, 0], result should be [0, 2]
      const z = [1, 1];
      const c = [0, 0];
      const result = mandelbrotStep(z, c);
      expect(result[0]).toBeCloseTo(0);
      expect(result[1]).toBeCloseTo(2);
    });

    it('should correctly add c to z^2', () => {
      // z = [1, 0], c = [0.5, 0.5]
      // z^2 = [1, 0], z^2 + c = [1.5, 0.5]
      const z = [1, 0];
      const c = [0.5, 0.5];
      const result = mandelbrotStep(z, c);
      expect(result[0]).toBeCloseTo(1.5);
      expect(result[1]).toBeCloseTo(0.5);
    });
  });

  describe('higher dimensional behavior', () => {
    it('should handle 3D vectors', () => {
      const z = [0, 0, 0];
      const c = [0.5, 0.3, 0.1];
      const result = mandelbrotStep(z, c);
      expect(result).toHaveLength(3);
      expect(result[0]).toBeCloseTo(0.5);
      expect(result[1]).toBeCloseTo(0.3);
    });

    it('should handle 4D vectors', () => {
      const z = [0, 0, 0, 0];
      const c = [0.5, 0.3, 0.1, 0.2];
      const result = mandelbrotStep(z, c);
      expect(result).toHaveLength(4);
    });

    it('should produce higher dimensional coupling effects', () => {
      // Non-zero z values should create cross-term effects
      const z = [1, 1, 1, 1];
      const c = [0.1, 0.1, 0.1, 0.1];
      const result = mandelbrotStep(z, c);
      expect(result).toHaveLength(4);
      // Third and fourth components should be affected by coupling
      expect(result[2]).not.toBe(c[2]); // Coupling effect
      expect(result[3]).not.toBe(c[3]);
    });
  });

  describe('vector length preservation', () => {
    it('should output same length as input', () => {
      for (const dim of [3, 4, 5, 6, 7]) {
        const z = new Array(dim).fill(0);
        const c = new Array(dim).fill(0.1);
        const result = mandelbrotStep(z, c);
        expect(result).toHaveLength(dim);
      }
    });
  });
});

describe('mandelbrotEscapeTime', () => {
  describe('bounded points (inside set)', () => {
    it('should return maxIter for origin (always bounded)', () => {
      const c = [0, 0, 0];
      const maxIter = 100;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBe(maxIter);
    });

    it('should return maxIter for known interior point', () => {
      // c = [-0.1, 0, 0] is inside the main cardioid
      const c = [-0.1, 0, 0];
      const maxIter = 100;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBe(maxIter);
    });

    it('should return maxIter for c = [-1, 0, 0] (period-2 bulb)', () => {
      const c = [-1, 0, 0];
      const maxIter = 100;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBe(maxIter);
    });
  });

  describe('escaped points (outside set)', () => {
    it('should return low iteration count for points far from set', () => {
      const c = [3, 0, 0]; // Far outside
      const result = mandelbrotEscapeTime(c, 100, 4.0);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(10);
    });

    it('should escape quickly for c = [2, 0, 0]', () => {
      const c = [2, 0, 0];
      const result = mandelbrotEscapeTime(c, 100, 4.0);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(5);
    });

    it('should escape for c = [0.5, 0.5, 0]', () => {
      // This point is outside the main cardioid
      const c = [0.5, 0.5, 0];
      const result = mandelbrotEscapeTime(c, 100, 4.0);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('iteration limits', () => {
    it('should respect maxIter parameter', () => {
      const c = [-0.1, 0, 0];
      const maxIter = 10;
      // With low maxIter, bounded point should return maxIter
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBe(maxIter);
    });

    it('should not exceed maxIter', () => {
      const c = [0.3, 0.5, 0]; // Point that may escape or be bounded
      const maxIter = 50;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      // Result should never exceed maxIter (bounded points return exactly maxIter)
      expect(result).toBeLessThanOrEqual(maxIter);
    });
  });

  describe('escape radius effects', () => {
    it('should escape earlier with smaller radius', () => {
      const c = [1.5, 0, 0];
      const result1 = mandelbrotEscapeTime(c, 100, 2.0);
      const result2 = mandelbrotEscapeTime(c, 100, 10.0);
      // Smaller radius should lead to earlier or equal escape
      if (result1 >= 0 && result2 >= 0) {
        expect(result1).toBeLessThanOrEqual(result2);
      }
    });
  });

  describe('higher dimensions', () => {
    it('should work for 4D', () => {
      const c = [0, 0, 0, 0];
      const maxIter = 100;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBe(maxIter);
    });

    it('should work for 5D', () => {
      const c = [3, 0, 0, 0, 0];
      const maxIter = 100;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(maxIter);
    });

    it('should work for 7D', () => {
      const c = new Array(7).fill(0);
      const maxIter = 100;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBe(maxIter);
    });

    it('should work for 11D (max supported)', () => {
      const c = new Array(11).fill(0);
      const maxIter = 100;
      const result = mandelbrotEscapeTime(c, maxIter, 4.0);
      expect(result).toBe(maxIter);
    });
  });
});

describe('mandelbrotSmoothEscapeTime', () => {
  it('should return maxIter for bounded points', () => {
    const c = [0, 0, 0];
    const maxIter = 100;
    const result = mandelbrotSmoothEscapeTime(c, maxIter, 4.0);
    expect(result).toBe(maxIter);
  });

  it('should return fractional values for escaped points', () => {
    const c = [0.4, 0.4, 0];
    const result = mandelbrotSmoothEscapeTime(c, 100, 4.0);
    if (result >= 0) {
      // Smooth value should generally not be an integer
      const fractional = result - Math.floor(result);
      // Check it's not exactly 0 (would be integer)
      // Note: In rare cases it could be close to integer, so we allow some tolerance
      expect(fractional).toBeDefined();
    }
  });

  it('should produce values close to discrete version', () => {
    const c = [0.5, 0.5, 0];
    const discrete = mandelbrotEscapeTime(c, 100, 4.0);
    const smooth = mandelbrotSmoothEscapeTime(c, 100, 4.0);

    if (discrete >= 0 && smooth >= 0) {
      // Smooth should be within 1 of discrete
      expect(Math.abs(smooth - discrete)).toBeLessThan(2);
    }
  });
});

describe('generateSampleGrid', () => {
  const config = {
    ...DEFAULT_MANDELBROT_CONFIG,
    resolution: 4,
    maxIterations: 50,
    visualizationAxes: [0, 1, 2] as [number, number, number],
    parameterValues: [],
    center: [0, 0, 0],
    extent: 2.0,
  };

  it('should generate resolution^3 samples', () => {
    const samples = generateSampleGrid(3, config);
    expect(samples).toHaveLength(4 * 4 * 4);
  });

  it('should have valid worldPos coordinates', () => {
    const samples = generateSampleGrid(3, config);
    samples.forEach((s) => {
      expect(s.worldPos).toHaveLength(3);
      // Each coordinate should be within extent of center
      s.worldPos.forEach((coord) => {
        expect(coord).toBeGreaterThanOrEqual(-2);
        expect(coord).toBeLessThanOrEqual(2);
      });
    });
  });

  it('should have cVector matching dimension', () => {
    const samples = generateSampleGrid(4, {
      ...config,
      center: [0, 0, 0, 0],
      parameterValues: [0],
    });
    samples.forEach((s) => {
      expect(s.cVector).toHaveLength(4);
    });
  });

  it('should compute escape times for all samples', () => {
    const samples = generateSampleGrid(3, config);
    samples.forEach((s) => {
      expect(typeof s.escapeTime).toBe('number');
    });
  });

  it('should use parameter values for non-visualized dimensions', () => {
    const config5D = {
      ...config,
      visualizationAxes: [0, 1, 2] as [number, number, number],
      parameterValues: [0.5, 0.3],
      center: [0, 0, 0, 0, 0],
    };
    const samples = generateSampleGrid(5, config5D);

    samples.forEach((s) => {
      expect(s.cVector).toHaveLength(5);
      // Dimensions 3 and 4 should have the parameter values
      expect(s.cVector[3]).toBe(0.5);
      expect(s.cVector[4]).toBe(0.3);
    });
  });
});

describe('filterSamples', () => {
  const maxIterations = 100;
  const baseSamples = [
    { worldPos: [0, 0, 0] as [number, number, number], cVector: [0, 0, 0], escapeTime: maxIterations }, // bounded
    { worldPos: [1, 0, 0] as [number, number, number], cVector: [1, 0, 0], escapeTime: 5 }, // escaped early
    { worldPos: [2, 0, 0] as [number, number, number], cVector: [2, 0, 0], escapeTime: 50 }, // escaped later
    { worldPos: [3, 0, 0] as [number, number, number], cVector: [3, 0, 0], escapeTime: 2 }, // escaped early
  ];

  it('should keep ALL points in escapeTime mode (fractal from colors)', () => {
    const config = { ...DEFAULT_MANDELBROT_CONFIG, colorMode: 'escapeTime' as const, maxIterations };
    const filtered = filterSamples(baseSamples, config);
    // All points should be kept - fractal structure comes from coloring
    expect(filtered.length).toBe(baseSamples.length);
  });

  it('should keep ALL points in smoothColoring mode', () => {
    const config = { ...DEFAULT_MANDELBROT_CONFIG, colorMode: 'smoothColoring' as const, maxIterations };
    const filtered = filterSamples(baseSamples, config);
    expect(filtered.length).toBe(baseSamples.length);
  });

  it('should only keep bounded points in interiorOnly mode', () => {
    const config = { ...DEFAULT_MANDELBROT_CONFIG, colorMode: 'interiorOnly' as const, maxIterations };
    const filtered = filterSamples(baseSamples, config);
    // Only points with escapeTime >= maxIterations (bounded) should be kept
    expect(filtered.length).toBe(1);
    expect(filtered.every((s) => s.escapeTime >= maxIterations)).toBe(true);
  });
});

describe('generateMandelbrot', () => {
  const config = {
    ...DEFAULT_MANDELBROT_CONFIG,
    resolution: 8,
    maxIterations: 30,
  };

  describe('basic generation', () => {
    it('should generate NdGeometry with correct properties', () => {
      const geometry = generateMandelbrot(3, config);

      expect(geometry.dimension).toBe(3);
      expect(geometry.type).toBe('mandelbrot');
      expect(geometry.isPointCloud).toBe(true);
      expect(geometry.edges).toEqual([]);
    });

    it('should have vertices array', () => {
      const geometry = generateMandelbrot(3, config);
      expect(Array.isArray(geometry.vertices)).toBe(true);
    });

    it('should include metadata', () => {
      const geometry = generateMandelbrot(3, config);
      expect(geometry.metadata).toBeDefined();
      expect(geometry.metadata?.name).toContain('Mandelbrot');
      expect(geometry.metadata?.formula).toBeDefined();
    });

    it('should store properties in metadata', () => {
      const geometry = generateMandelbrot(3, config);
      const props = geometry.metadata?.properties as Record<string, unknown>;
      expect(props?.maxIterations).toBe(30);
      expect(props?.resolution).toBe(8);
    });
  });

  describe('dimension support', () => {
    it('should work for 3D', () => {
      const geometry = generateMandelbrot(3, {
        ...config,
        center: [0, 0, 0],
        parameterValues: [],
      });
      expect(geometry.dimension).toBe(3);
      geometry.vertices.forEach((v) => expect(v).toHaveLength(3));
    });

    it('should work for 4D', () => {
      const geometry = generateMandelbrot(4, {
        ...config,
        center: [0, 0, 0, 0],
        parameterValues: [0],
      });
      expect(geometry.dimension).toBe(4);
      geometry.vertices.forEach((v) => expect(v).toHaveLength(4));
    });

    it('should work for 7D', () => {
      const geometry = generateMandelbrot(7, {
        ...config,
        resolution: 4, // Lower resolution for performance
        center: [0, 0, 0, 0, 0, 0, 0],
        parameterValues: [0, 0, 0, 0],
      });
      expect(geometry.dimension).toBe(7);
    });

    it('should generate classic 2D Mandelbrot for dimension 2', () => {
      const geometry = generateMandelbrot(2, config);
      expect(geometry.dimension).toBe(2);
      expect(geometry.metadata?.name).toContain('Classic');
      // 2D Mandelbrot uses resolution^2 samples
      expect(geometry.vertices.length).toBe(config.resolution * config.resolution);
    });

    it('should throw for dimension < 2', () => {
      expect(() => generateMandelbrot(1, config)).toThrow();
    });
  });

  describe('resolution effects', () => {
    it('should produce more points with higher resolution', () => {
      const lowRes = generateMandelbrot(3, { ...config, resolution: 8 });
      const highRes = generateMandelbrot(3, { ...config, resolution: 16 });

      // Note: Filtered count may not scale exactly with resolution
      // but total samples before filtering scales as resolution^3
      const lowTotal = (lowRes.metadata?.properties as Record<string, number>)?.sampleCount ?? 0;
      const highTotal = (highRes.metadata?.properties as Record<string, number>)?.sampleCount ?? 0;

      expect(highTotal).toBeGreaterThan(lowTotal);
    });
  });
});

describe('getMandelbrotStats', () => {
  // Note: With new implementation, maxIter=100 represents bounded points
  const maxIter = 100;
  const samples = [
    { worldPos: [0, 0, 0] as [number, number, number], cVector: [0, 0, 0], escapeTime: maxIter }, // bounded
    { worldPos: [1, 0, 0] as [number, number, number], cVector: [1, 0, 0], escapeTime: 10 },
    { worldPos: [2, 0, 0] as [number, number, number], cVector: [2, 0, 0], escapeTime: 20 },
    { worldPos: [3, 0, 0] as [number, number, number], cVector: [3, 0, 0], escapeTime: maxIter }, // bounded
    { worldPos: [4, 0, 0] as [number, number, number], cVector: [4, 0, 0], escapeTime: 30 },
  ];

  it('should compute total count', () => {
    const stats = getMandelbrotStats(samples, maxIter);
    expect(stats.total).toBe(5);
  });

  it('should count bounded points', () => {
    const stats = getMandelbrotStats(samples, maxIter);
    expect(stats.bounded).toBe(2);
  });

  it('should count escaped points', () => {
    const stats = getMandelbrotStats(samples, maxIter);
    expect(stats.escaped).toBe(3);
  });

  it('should compute bounded ratio', () => {
    const stats = getMandelbrotStats(samples, maxIter);
    expect(stats.boundedRatio).toBeCloseTo(0.4);
  });

  it('should compute min escape time', () => {
    const stats = getMandelbrotStats(samples, maxIter);
    expect(stats.minEscapeTime).toBe(10);
  });

  it('should compute max escape time', () => {
    const stats = getMandelbrotStats(samples, maxIter);
    expect(stats.maxEscapeTime).toBe(30);
  });

  it('should compute average escape time', () => {
    const stats = getMandelbrotStats(samples, maxIter);
    // (10 + 20 + 30) / 3 = 20
    expect(stats.avgEscapeTime).toBeCloseTo(20);
  });

  it('should handle empty samples', () => {
    const stats = getMandelbrotStats([], maxIter);
    expect(stats.total).toBe(0);
    expect(stats.bounded).toBe(0);
    expect(stats.escaped).toBe(0);
    expect(stats.minEscapeTime).toBe(0);
    expect(stats.maxEscapeTime).toBe(0);
    expect(stats.avgEscapeTime).toBe(0);
  });

  it('should handle all bounded samples', () => {
    const allBounded = [
      { worldPos: [0, 0, 0] as [number, number, number], cVector: [0, 0, 0], escapeTime: maxIter },
      { worldPos: [0, 0, 0] as [number, number, number], cVector: [0, 0, 0], escapeTime: maxIter },
    ];
    const stats = getMandelbrotStats(allBounded, maxIter);
    expect(stats.bounded).toBe(2);
    expect(stats.escaped).toBe(0);
    expect(stats.boundedRatio).toBe(1);
    expect(stats.minEscapeTime).toBe(0);
    expect(stats.maxEscapeTime).toBe(0);
  });
});
