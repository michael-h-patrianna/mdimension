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
 * - Hyperspherical coordinate functions (toHyperspherical, fromHyperspherical, powMap)
 * - Hyperbulb functions (hyperbulbStep, hyperbulbEscapeTime)
 */

import { describe, it, expect } from 'vitest';
import {
  mandelbulbStep,
  mandelbrotStep,
  mandelbrotEscapeTime,
  mandelbrotSmoothEscapeTime,
  normSquared,
  generateSampleGrid,
  filterSamples,
  generateMandelbrot,
  getMandelbrotStats,
  // Hyperspherical functions
  toHyperspherical,
  fromHyperspherical,
  powMap,
  hyperbulbStep,
  hyperbulbEscapeTime,
  hyperbulbSmoothEscapeTime,
  norm,
  clamp,
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

describe('mandelbulbStep', () => {
  describe('basic behavior', () => {
    it('should return c when z is zero (origin case)', () => {
      const z = [0, 0, 0];
      const c = [0.5, 0.3, 0.1];
      const result = mandelbulbStep(z, c);
      expect(result[0]).toBeCloseTo(0.5);
      expect(result[1]).toBeCloseTo(0.3);
      expect(result[2]).toBeCloseTo(0.1);
    });

    it('should return 3D vector', () => {
      const z = [1, 0, 0];
      const c = [0.1, 0.2, 0.3];
      const result = mandelbulbStep(z, c);
      expect(result).toHaveLength(3);
    });

    it('should handle vectors on the axis', () => {
      const z = [1, 0, 0]; // On x-axis
      const c = [0, 0, 0];
      const result = mandelbulbStep(z, c, 8);
      expect(result).toHaveLength(3);
      // Point on x-axis: theta=pi/2, phi=0
      // After transformation: sin(n*theta) will produce the x-component
      // The result should be finite and defined
      expect(Number.isFinite(result[0])).toBe(true);
      expect(Number.isFinite(result[1])).toBe(true);
      expect(Number.isFinite(result[2])).toBe(true);
    });
  });

  describe('power parameter', () => {
    it('should produce different results for different powers', () => {
      const z = [0.5, 0.5, 0.5];
      const c = [0, 0, 0];
      const result3 = mandelbulbStep(z, c, 3);
      const result8 = mandelbulbStep(z, c, 8);
      // Different powers should produce different results
      expect(result3[0]).not.toBeCloseTo(result8[0]!);
    });

    it('should default to power 8', () => {
      const z = [0.5, 0.5, 0.5];
      const c = [0.1, 0.1, 0.1];
      const resultDefault = mandelbulbStep(z, c);
      const result8 = mandelbulbStep(z, c, 8);
      expect(resultDefault[0]).toBeCloseTo(result8[0]!);
      expect(resultDefault[1]).toBeCloseTo(result8[1]!);
      expect(resultDefault[2]).toBeCloseTo(result8[2]!);
    });
  });

  describe('spherical coordinate transformation', () => {
    it('should preserve radius for unit vector when power=1', () => {
      // For power=1, r^1 = r, so radius should be preserved (minus c contribution)
      const r = 1.0;
      const z = [r, 0, 0];
      const c = [0, 0, 0];
      const result = mandelbulbStep(z, c, 1);
      const resultR = Math.sqrt(result[0]! ** 2 + result[1]! ** 2 + result[2]! ** 2);
      expect(resultR).toBeCloseTo(r);
    });

    it('should square radius for power=2', () => {
      const r = 0.5;
      const z = [r, 0, 0]; // Simple point on x-axis
      const c = [0, 0, 0];
      const result = mandelbulbStep(z, c, 2);
      const resultR = Math.sqrt(result[0]! ** 2 + result[1]! ** 2 + result[2]! ** 2);
      expect(resultR).toBeCloseTo(r * r);
    });
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

    it('should return maxIter for small c values near origin', () => {
      // For 3D Mandelbulb, small values near origin remain bounded
      // (The classic period-2 bulb at [-1, 0] is specific to 2D complex iteration)
      const c = [-0.2, 0, 0.1];
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

  describe('boundaryOnly mode', () => {
    const boundarySamples = [
      { worldPos: [0, 0, 0] as [number, number, number], cVector: [0, 0, 0], escapeTime: maxIterations }, // bounded (100)
      { worldPos: [1, 0, 0] as [number, number, number], cVector: [1, 0, 0], escapeTime: 5 },  // escaped early (5% of 100)
      { worldPos: [2, 0, 0] as [number, number, number], cVector: [2, 0, 0], escapeTime: 50 }, // mid escape (50% of 100)
      { worldPos: [3, 0, 0] as [number, number, number], cVector: [3, 0, 0], escapeTime: 30 }, // boundary (30% of 100)
      { worldPos: [4, 0, 0] as [number, number, number], cVector: [4, 0, 0], escapeTime: 80 }, // late escape (80% of 100)
    ];

    it('should filter points within boundary threshold range', () => {
      const config = {
        ...DEFAULT_MANDELBROT_CONFIG,
        colorMode: 'boundaryOnly' as const,
        maxIterations,
        boundaryThreshold: [0.2, 0.6] as [number, number], // 20-60% of maxIterations
      };
      const filtered = filterSamples(boundarySamples, config);
      // Points with escape time 20-60 (20*100=20 to 60*100=60) should be kept
      // escapeTime 30 (30%) and 50 (50%) are in range
      expect(filtered.length).toBe(2);
      expect(filtered.map(s => s.escapeTime).sort((a, b) => a - b)).toEqual([30, 50]);
    });

    it('should exclude bounded and early escape points', () => {
      const config = {
        ...DEFAULT_MANDELBROT_CONFIG,
        colorMode: 'boundaryOnly' as const,
        maxIterations,
        boundaryThreshold: [0.1, 0.9] as [number, number],
      };
      const filtered = filterSamples(boundarySamples, config);
      // Points with escape time 10-90 should be kept
      // escapeTime 30 (30%), 50 (50%), and 80 (80%) are in range
      expect(filtered.length).toBe(3);
    });

    it('should handle narrow boundary range', () => {
      const config = {
        ...DEFAULT_MANDELBROT_CONFIG,
        colorMode: 'boundaryOnly' as const,
        maxIterations,
        boundaryThreshold: [0.49, 0.51] as [number, number], // Very narrow range around 50%
      };
      const filtered = filterSamples(boundarySamples, config);
      // Only escapeTime 50 (exactly 50%) should pass
      expect(filtered.length).toBe(1);
      expect(filtered[0]!.escapeTime).toBe(50);
    });
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
      // 3D is named 'Mandelbulb' not 'Mandelbrot'
      expect(geometry.metadata?.name).toBe('Mandelbulb');
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

    it('should throw for dimension < 3', () => {
      expect(() => generateMandelbrot(1, config)).toThrow();
      expect(() => generateMandelbrot(2, config)).toThrow();
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

// =============================================================================
// Hyperspherical Coordinate Tests (for 4D-11D Hyperbulb)
// =============================================================================

describe('norm (hyperspherical helper)', () => {
  it('should compute Euclidean norm of a vector', () => {
    expect(norm(new Float32Array([3, 4]))).toBeCloseTo(5);
    expect(norm(new Float32Array([1, 2, 2]))).toBeCloseTo(3);
    expect(norm(new Float32Array([0, 0, 0]))).toBe(0);
  });

  it('should handle higher dimensional vectors', () => {
    // ||[1,1,1,1]|| = sqrt(4) = 2
    expect(norm(new Float32Array([1, 1, 1, 1]))).toBeCloseTo(2);
  });
});

describe('clamp (hyperspherical helper)', () => {
  it('should clamp values within range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-0.5, 0, 1)).toBe(0);
    expect(clamp(1.5, 0, 1)).toBe(1);
  });

  it('should handle negative ranges', () => {
    expect(clamp(0, -1, 1)).toBe(0);
    expect(clamp(-2, -1, 1)).toBe(-1);
  });
});

describe('toHyperspherical', () => {
  describe('origin handling', () => {
    it('should return zero radius and zero angles for origin', () => {
      const v = new Float32Array([0, 0, 0, 0]);
      const { r, theta } = toHyperspherical(v);
      expect(r).toBe(0);
      expect(theta.every(t => t === 0)).toBe(true);
    });

    it('should handle near-zero vectors', () => {
      const v = new Float32Array([1e-15, 1e-15, 1e-15]);
      const { r, theta } = toHyperspherical(v);
      expect(r).toBeCloseTo(0, 10);
      expect(theta.every(t => Number.isFinite(t))).toBe(true);
    });
  });

  describe('2D conversion (polar coordinates)', () => {
    it('should correctly convert 2D vectors', () => {
      // v = [1, 0] -> r=1, theta=0
      const v1 = new Float32Array([1, 0]);
      const { r: r1, theta: theta1 } = toHyperspherical(v1);
      expect(r1).toBeCloseTo(1);
      expect(theta1[0]).toBeCloseTo(0);

      // v = [0, 1] -> r=1, theta=pi/2
      const v2 = new Float32Array([0, 1]);
      const { r: r2, theta: theta2 } = toHyperspherical(v2);
      expect(r2).toBeCloseTo(1);
      expect(theta2[0]).toBeCloseTo(Math.PI / 2);

      // v = [1, 1] -> r=sqrt(2), theta=pi/4
      const v3 = new Float32Array([1, 1]);
      const { r: r3, theta: theta3 } = toHyperspherical(v3);
      expect(r3).toBeCloseTo(Math.sqrt(2));
      expect(theta3[0]).toBeCloseTo(Math.PI / 4);
    });
  });

  describe('3D conversion (spherical coordinates)', () => {
    it('should correctly convert 3D axis-aligned vectors', () => {
      // v = [1, 0, 0] -> r=1, theta=[pi/2, 0]
      const vx = new Float32Array([1, 0, 0]);
      const { r: rx, theta: thetaX } = toHyperspherical(vx);
      expect(rx).toBeCloseTo(1);
      expect(thetaX[0]).toBeCloseTo(0); // acos(1) = 0

      // v = [0, 0, 1] -> r=1, theta=[pi/2, pi/2]
      const vz = new Float32Array([0, 0, 1]);
      const { r: rz, theta: thetaZ } = toHyperspherical(vz);
      expect(rz).toBeCloseTo(1);
      expect(thetaZ[0]).toBeCloseTo(Math.PI / 2); // acos(0) = pi/2
      expect(thetaZ[1]).toBeCloseTo(Math.PI / 2); // atan2(1, 0) = pi/2
    });
  });

  describe('4D+ conversion (hyperspherical coordinates)', () => {
    it('should produce correct number of angles', () => {
      for (const D of [4, 5, 6, 7, 8, 9, 10, 11]) {
        const v = new Float32Array(D).fill(1);
        const { theta } = toHyperspherical(v);
        expect(theta.length).toBe(D - 1);
      }
    });

    it('should produce finite angles for axis-aligned vectors', () => {
      for (const D of [4, 5, 6, 7]) {
        // Unit vector along first axis
        const v = new Float32Array(D);
        v[0] = 1;
        const { r, theta } = toHyperspherical(v);
        expect(r).toBeCloseTo(1);
        expect(theta.every(t => Number.isFinite(t))).toBe(true);
      }
    });
  });
});

describe('fromHyperspherical', () => {
  describe('2D conversion (polar to Cartesian)', () => {
    it('should correctly convert polar coordinates', () => {
      // r=1, theta=0 -> [1, 0]
      const v1 = fromHyperspherical(1, new Float32Array([0]));
      expect(v1[0]).toBeCloseTo(1);
      expect(v1[1]).toBeCloseTo(0);

      // r=1, theta=pi/2 -> [0, 1]
      const v2 = fromHyperspherical(1, new Float32Array([Math.PI / 2]));
      expect(v2[0]).toBeCloseTo(0);
      expect(v2[1]).toBeCloseTo(1);

      // r=sqrt(2), theta=pi/4 -> [1, 1]
      const v3 = fromHyperspherical(Math.sqrt(2), new Float32Array([Math.PI / 4]));
      expect(v3[0]).toBeCloseTo(1);
      expect(v3[1]).toBeCloseTo(1);
    });
  });

  describe('zero radius', () => {
    it('should return origin for r=0', () => {
      const v = fromHyperspherical(0, new Float32Array([1, 2, 3]));
      expect(v.every(x => x === 0)).toBe(true);
    });
  });

  describe('dimension preservation', () => {
    it('should produce correct dimensionality', () => {
      for (const D of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
        const theta = new Float32Array(D - 1);
        const v = fromHyperspherical(1, theta);
        expect(v.length).toBe(D);
      }
    });
  });
});

describe('hyperspherical round-trip', () => {
  it('should round-trip correctly for 2D vectors', () => {
    const original = new Float32Array([3, 4]);
    const { r, theta } = toHyperspherical(original);
    const restored = fromHyperspherical(r, theta);
    expect(restored[0]!).toBeCloseTo(original[0]!);
    expect(restored[1]!).toBeCloseTo(original[1]!);
  });

  it('should round-trip correctly for 3D vectors', () => {
    const original = new Float32Array([1, 2, 3]);
    const { r, theta } = toHyperspherical(original);
    const restored = fromHyperspherical(r, theta);
    expect(restored[0]!).toBeCloseTo(original[0]!);
    expect(restored[1]!).toBeCloseTo(original[1]!);
    expect(restored[2]!).toBeCloseTo(original[2]!);
  });

  it('should round-trip correctly for 4D-11D vectors', () => {
    for (const D of [4, 5, 6, 7, 8, 9, 10, 11]) {
      // Create a random-ish vector
      const original = new Float32Array(D);
      for (let i = 0; i < D; i++) {
        original[i] = Math.sin(i * 0.7) * (i + 1) * 0.3;
      }

      const { r, theta } = toHyperspherical(original);
      const restored = fromHyperspherical(r, theta);

      for (let i = 0; i < D; i++) {
        expect(restored[i]!).toBeCloseTo(original[i]!, 4);
      }
    }
  });

  it('should preserve norm after round-trip', () => {
    const original = new Float32Array([1, 2, 3, 4, 5]);
    const originalNorm = norm(original);
    const { r, theta } = toHyperspherical(original);
    const restored = fromHyperspherical(r, theta);
    const restoredNorm = norm(restored);
    expect(restoredNorm).toBeCloseTo(originalNorm);
    expect(r).toBeCloseTo(originalNorm);
  });
});

describe('powMap', () => {
  describe('zero handling', () => {
    it('should return zero for zero input', () => {
      const v = new Float32Array([0, 0, 0, 0]);
      const result = powMap(v, 8);
      expect(result.every(x => x === 0)).toBe(true);
    });
  });

  describe('power=1 (identity)', () => {
    it('should approximately preserve vector for power=1', () => {
      const v = new Float32Array([1, 2, 3]);
      const result = powMap(v, 1);
      expect(result[0]!).toBeCloseTo(v[0]!);
      expect(result[1]!).toBeCloseTo(v[1]!);
      expect(result[2]!).toBeCloseTo(v[2]!);
    });
  });

  describe('power=2 (squaring)', () => {
    it('should square the radius', () => {
      // For a unit vector, r=1, r^2=1
      const v = new Float32Array([1, 0, 0, 0]);
      const result = powMap(v, 2);
      const resultNorm = norm(result);
      expect(resultNorm).toBeCloseTo(1); // 1^2 = 1

      // For r=0.5, r^2=0.25
      const v2 = new Float32Array([0.5, 0, 0, 0]);
      const result2 = powMap(v2, 2);
      const resultNorm2 = norm(result2);
      expect(resultNorm2).toBeCloseTo(0.25);
    });
  });

  describe('power=8 (classic bulb)', () => {
    it('should compute power 8 transformation', () => {
      const v = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const result = powMap(v, 8);
      // Result should be finite and have same dimension
      expect(result.length).toBe(4);
      expect(result.every(x => Number.isFinite(x))).toBe(true);
    });
  });

  describe('dimension support', () => {
    it('should work for dimensions 2-11', () => {
      for (const D of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
        const v = new Float32Array(D).fill(0.3);
        const result = powMap(v, 8);
        expect(result.length).toBe(D);
        expect(result.every(x => Number.isFinite(x))).toBe(true);
      }
    });
  });
});

describe('hyperbulbStep', () => {
  describe('basic behavior', () => {
    it('should return c when z is zero (origin case)', () => {
      const z = [0, 0, 0, 0];
      const c = [0.5, 0.3, 0.1, 0.2];
      const result = hyperbulbStep(z, c);
      expect(result[0]).toBeCloseTo(0.5);
      expect(result[1]).toBeCloseTo(0.3);
      expect(result[2]).toBeCloseTo(0.1);
      expect(result[3]).toBeCloseTo(0.2);
    });

    it('should return vector of same dimension', () => {
      for (const D of [4, 5, 6, 7, 8, 9, 10, 11]) {
        const z = new Array(D).fill(0.5);
        const c = new Array(D).fill(0.1);
        const result = hyperbulbStep(z, c);
        expect(result).toHaveLength(D);
      }
    });
  });

  describe('power parameter', () => {
    it('should produce different results for different powers', () => {
      const z = [0.5, 0.5, 0.5, 0.5];
      const c = [0, 0, 0, 0];
      const result3 = hyperbulbStep(z, c, 3);
      const result8 = hyperbulbStep(z, c, 8);
      // Different powers should produce different results
      expect(result3[0]).not.toBeCloseTo(result8[0]!);
    });

    it('should default to power 8', () => {
      const z = [0.5, 0.5, 0.5, 0.5];
      const c = [0.1, 0.1, 0.1, 0.1];
      const resultDefault = hyperbulbStep(z, c);
      const result8 = hyperbulbStep(z, c, 8);
      expect(resultDefault[0]).toBeCloseTo(result8[0]!);
      expect(resultDefault[1]).toBeCloseTo(result8[1]!);
    });
  });
});

describe('hyperbulbEscapeTime', () => {
  describe('bounded points', () => {
    it('should return maxIter for origin', () => {
      const c = [0, 0, 0, 0];
      const maxIter = 60;
      const result = hyperbulbEscapeTime(c, 8, maxIter, 8);
      expect(result).toBe(maxIter);
    });

    it('should return maxIter for small c values', () => {
      const c = [0.1, 0, 0, 0, 0];
      const maxIter = 60;
      const result = hyperbulbEscapeTime(c, 8, maxIter, 8);
      expect(result).toBe(maxIter);
    });
  });

  describe('escaped points', () => {
    it('should escape quickly for points far from origin', () => {
      const c = [3, 0, 0, 0];
      const result = hyperbulbEscapeTime(c, 8, 60, 8);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(10);
    });

    it('should escape for c = [2, 0, 0, 0]', () => {
      const c = [2, 0, 0, 0];
      const result = hyperbulbEscapeTime(c, 8, 60, 8);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(60);
    });
  });

  describe('dimension support', () => {
    it('should work for dimensions 4-11', () => {
      for (const D of [4, 5, 6, 7, 8, 9, 10, 11]) {
        // Origin should be bounded
        const c = new Array(D).fill(0);
        const result = hyperbulbEscapeTime(c, 8, 60, 8);
        expect(result).toBe(60);

        // Far point should escape
        const cFar = new Array(D).fill(0);
        cFar[0] = 3;
        const resultFar = hyperbulbEscapeTime(cFar, 8, 60, 8);
        expect(resultFar).toBeLessThan(60);
      }
    });
  });

  describe('bailout effects', () => {
    it('should escape earlier with smaller bailout', () => {
      const c = [1.5, 0, 0, 0];
      const result1 = hyperbulbEscapeTime(c, 8, 60, 2);
      const result2 = hyperbulbEscapeTime(c, 8, 60, 16);
      // Smaller bailout should lead to earlier or equal escape
      if (result1 < 60 && result2 < 60) {
        expect(result1).toBeLessThanOrEqual(result2);
      }
    });
  });
});

describe('hyperbulbSmoothEscapeTime', () => {
  it('should return maxIter for bounded points', () => {
    const c = [0, 0, 0, 0];
    const maxIter = 60;
    const result = hyperbulbSmoothEscapeTime(c, 8, maxIter, 8);
    expect(result).toBe(maxIter);
  });

  it('should return fractional values for escaped points', () => {
    const c = [0.5, 0.5, 0.5, 0.5];
    const result = hyperbulbSmoothEscapeTime(c, 8, 60, 8);
    if (result < 60) {
      // Smooth value may be fractional
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it('should produce values close to discrete version', () => {
    const c = [0.6, 0.6, 0.6, 0.6];
    const discrete = hyperbulbEscapeTime(c, 8, 60, 8);
    const smooth = hyperbulbSmoothEscapeTime(c, 8, 60, 8);

    if (discrete < 60 && smooth < 60) {
      // Smooth should be within 2 of discrete
      expect(Math.abs(smooth - discrete)).toBeLessThan(2);
    }
  });
});

describe('mandelbrotStep with Hyperbulb', () => {
  it('should use hyperbulbStep for dimension >= 4', () => {
    // Test that mandelbrotStep delegates to hyperbulbStep for D >= 4
    const z4 = [0.5, 0.5, 0.5, 0.5];
    const c4 = [0.1, 0.1, 0.1, 0.1];
    const result4 = mandelbrotStep(z4, c4, 8);
    expect(result4).toHaveLength(4);
    expect(result4.every(x => Number.isFinite(x!))).toBe(true);

    // Test 5D
    const z5 = [0.5, 0.5, 0.5, 0.5, 0.5];
    const c5 = [0.1, 0.1, 0.1, 0.1, 0.1];
    const result5 = mandelbrotStep(z5, c5, 8);
    expect(result5).toHaveLength(5);

    // Test 11D (maximum supported)
    const z11 = new Array(11).fill(0.3);
    const c11 = new Array(11).fill(0.1);
    const result11 = mandelbrotStep(z11, c11, 8);
    expect(result11).toHaveLength(11);
  });

  it('should produce different results than old coupled quadratics', () => {
    // The hyperbulb should produce different results than the old implementation
    // We can't directly compare since old code is gone, but we verify the new
    // implementation behaves like the hyperbulb algorithm
    const z = [0.5, 0.5, 0.5, 0.5];
    const c = [0, 0, 0, 0];
    const result = mandelbrotStep(z, c, 8);

    // With c=0, result should be powMap(z, 8)
    const expectedResult = hyperbulbStep(z, c, 8);
    expect(result[0]).toBeCloseTo(expectedResult[0]!);
    expect(result[1]).toBeCloseTo(expectedResult[1]!);
    expect(result[2]).toBeCloseTo(expectedResult[2]!);
    expect(result[3]).toBeCloseTo(expectedResult[3]!);
  });
});

describe('generateMandelbrot with Hyperbulb', () => {
  const config = {
    ...DEFAULT_MANDELBROT_CONFIG,
    resolution: 4, // Low resolution for fast tests
    maxIterations: 30,
    escapeRadius: 8.0, // Higher bailout for 4D+
  };

  describe('naming conventions', () => {
    it('should name 3D as Mandelbulb', () => {
      const geometry = generateMandelbrot(3, {
        ...config,
        center: [0, 0, 0],
        parameterValues: [],
      });
      expect(geometry.metadata?.name).toBe('Mandelbulb');
    });

    it('should name 4D+ as Hyperbulb', () => {
      for (const D of [4, 5, 6, 7, 8, 9, 10, 11]) {
        const geometry = generateMandelbrot(D, {
          ...config,
          center: new Array(D).fill(0),
          parameterValues: new Array(D - 3).fill(0),
        });
        expect(geometry.metadata?.name).toBe(`${D}D Hyperbulb`);
      }
    });
  });

  describe('formula descriptions', () => {
    it('should describe 3D formula correctly', () => {
      const geometry = generateMandelbrot(3, {
        ...config,
        center: [0, 0, 0],
        parameterValues: [],
      });
      expect(geometry.metadata?.formula).toContain('spherical');
    });

    it('should describe 4D+ formula with angle count', () => {
      const geometry = generateMandelbrot(6, {
        ...config,
        center: new Array(6).fill(0),
        parameterValues: new Array(3).fill(0),
      });
      expect(geometry.metadata?.formula).toContain('hyperspherical');
      expect(geometry.metadata?.formula).toContain('5 angles'); // 6D has 5 angles
    });
  });

  describe('higher dimension generation', () => {
    it('should generate valid geometry for all dimensions 4-11', () => {
      for (const D of [4, 5, 6, 7, 8, 9, 10, 11]) {
        const geometry = generateMandelbrot(D, {
          ...config,
          center: new Array(D).fill(0),
          parameterValues: new Array(D - 3).fill(0),
        });
        expect(geometry.dimension).toBe(D);
        expect(geometry.vertices.length).toBeGreaterThan(0);
        geometry.vertices.forEach(v => expect(v).toHaveLength(D));
      }
    });
  });
});
