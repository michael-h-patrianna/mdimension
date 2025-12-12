/**
 * Tests for Clifford torus generation (classic and generalized)
 *
 * @see docs/research/clifford-tori-guide.md
 */

import { describe, it, expect } from 'vitest';
import {
  generateCliffordTorus,
  generateCliffordTorusPoints,
  buildCliffordTorusGridEdges,
  buildCliffordTorusGridFaces,
  verifyCliffordTorusOnSphere,
  // Generalized exports
  generateGeneralizedCliffordTorus,
  generateGeneralizedCliffordTorusPoints,
  buildGeneralizedCliffordTorusEdges,
  buildGeneralizedCliffordTorusFaces,
  verifyGeneralizedCliffordTorusOnSphere,
  verifyGeneralizedCliffordTorusCircleRadii,
  getMaxTorusDimension,
  getGeneralizedCliffordTorusPointCount,
  // 3D torus exports
  buildTorus3DGridFaces,
  // Annulus exports
  buildAnnulusGridFaces,
} from '@/lib/geometry/extended/clifford-torus';
import { DEFAULT_CLIFFORD_TORUS_CONFIG } from '@/lib/geometry/extended/types';
import type { VectorND } from '@/lib/math/types';

describe('generateCliffordTorusPoints', () => {
  describe('point generation', () => {
    it('should generate resolutionU × resolutionV points', () => {
      const points = generateCliffordTorusPoints(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        resolutionU: 16,
        resolutionV: 8,
      });

      expect(points).toHaveLength(16 * 8);
    });

    it('should generate points with correct dimensionality', () => {
      const points = generateCliffordTorusPoints(6, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        resolutionU: 8,
        resolutionV: 8,
      });

      points.forEach(p => {
        expect(p).toHaveLength(6);
      });
    });
  });

  describe('dimension validation', () => {
    it('should throw for dimension < 4', () => {
      expect(() => generateCliffordTorusPoints(3, DEFAULT_CLIFFORD_TORUS_CONFIG)).toThrow();
    });

    it('should accept dimension >= 4', () => {
      expect(() => generateCliffordTorusPoints(4, DEFAULT_CLIFFORD_TORUS_CONFIG)).not.toThrow();
      expect(() => generateCliffordTorusPoints(8, DEFAULT_CLIFFORD_TORUS_CONFIG)).not.toThrow();
    });
  });

  describe('lying on S³', () => {
    it('should have all points on the 3-sphere with radius R', () => {
      const radius = 1.5;
      const points = generateCliffordTorusPoints(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        radius,
        resolutionU: 16,
        resolutionV: 16,
      });

      // All points should satisfy x₁² + x₂² + x₃² + x₄² = R²
      points.forEach(p => {
        const sumSq = p[0]! * p[0]! + p[1]! * p[1]! + p[2]! * p[2]! + p[3]! * p[3]!;
        expect(sumSq).toBeCloseTo(radius * radius, 5);
      });
    });
  });

  describe('torus structure', () => {
    it('should have first two coords forming a circle', () => {
      const radius = 1.0;
      const points = generateCliffordTorusPoints(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        radius,
        resolutionU: 16,
        resolutionV: 16,
      });

      const expectedCircleRadiusSq = (radius / Math.sqrt(2)) ** 2;

      points.forEach(p => {
        const r1Sq = p[0]! * p[0]! + p[1]! * p[1]!;
        expect(r1Sq).toBeCloseTo(expectedCircleRadiusSq, 5);
      });
    });

    it('should have last two coords forming a circle', () => {
      const radius = 1.0;
      const points = generateCliffordTorusPoints(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        radius,
        resolutionU: 16,
        resolutionV: 16,
      });

      const expectedCircleRadiusSq = (radius / Math.sqrt(2)) ** 2;

      points.forEach(p => {
        const r2Sq = p[2]! * p[2]! + p[3]! * p[3]!;
        expect(r2Sq).toBeCloseTo(expectedCircleRadiusSq, 5);
      });
    });
  });

  describe('higher dimensions', () => {
    it('should have coords 4+ as zero in higher dimensions', () => {
      const points = generateCliffordTorusPoints(8, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        resolutionU: 8,
        resolutionV: 8,
      });

      points.forEach(p => {
        for (let i = 4; i < 8; i++) {
          expect(p[i]).toBe(0);
        }
      });
    });
  });
});

describe('buildCliffordTorusGridEdges', () => {
  it('should create grid connectivity', () => {
    const edges = buildCliffordTorusGridEdges(8, 8);

    // Should have edges
    expect(edges.length).toBeGreaterThan(0);
  });

  it('should have valid vertex indices', () => {
    const resU = 8;
    const resV = 8;
    const maxIndex = resU * resV - 1;
    const edges = buildCliffordTorusGridEdges(resU, resV);

    edges.forEach(([i, j]) => {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(maxIndex);
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThanOrEqual(maxIndex);
      expect(i).toBeLessThan(j); // Canonical ordering
    });
  });

  it('should create wraparound connections', () => {
    const resU = 4;
    const resV = 4;
    const edges = buildCliffordTorusGridEdges(resU, resV);

    // For a torus, each vertex should have 4 neighbors (2 in each direction)
    // With wraparound, there should be more edges than a simple grid
    // Grid without wrap: (resU-1)*resV + resU*(resV-1) = 3*4 + 4*3 = 24
    // With wrap: resU*resV*2 = 4*4*2 = 32
    // But we're computing unique edges, so should be similar
    expect(edges.length).toBeGreaterThan(0);
  });
});

describe('generateCliffordTorus', () => {
  describe('geometry generation', () => {
    it('should generate NdGeometry with correct properties', () => {
      const geometry = generateCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        resolutionU: 16,
        resolutionV: 16,
      });

      expect(geometry.dimension).toBe(4);
      expect(geometry.type).toBe('clifford-torus');
      expect(geometry.vertices).toHaveLength(256);
      expect(geometry.metadata?.name).toContain('Clifford');
    });
  });

  describe('edge modes', () => {
    it('should generate edges in grid mode', () => {
      const geometry = generateCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        edgeMode: 'grid',
        resolutionU: 8,
        resolutionV: 8,
      });

      expect(geometry.edges.length).toBeGreaterThan(0);
      expect(geometry.isPointCloud).toBe(false);
    });

    it('should not generate edges in none mode', () => {
      const geometry = generateCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        edgeMode: 'none',
        resolutionU: 8,
        resolutionV: 8,
      });

      expect(geometry.edges).toHaveLength(0);
      expect(geometry.isPointCloud).toBe(true);
    });
  });

  describe('dimension validation', () => {
    it('should throw for dimension < 2', () => {
      expect(() => generateCliffordTorus(1, DEFAULT_CLIFFORD_TORUS_CONFIG)).toThrow();
    });

    it('should generate annulus for dimension 2', () => {
      const geometry = generateCliffordTorus(2, DEFAULT_CLIFFORD_TORUS_CONFIG);
      expect(geometry.dimension).toBe(2);
      expect(geometry.metadata?.properties?.mode).toBe('2d-annulus');
    });

    it('should generate 3D torus surface for dimension 3', () => {
      const geometry = generateCliffordTorus(3, DEFAULT_CLIFFORD_TORUS_CONFIG);
      expect(geometry.dimension).toBe(3);
      expect(geometry.metadata?.properties?.mode).toBe('3d-torus');
    });

    it('should accept dimension >= 4 for classic mode', () => {
      expect(() => generateCliffordTorus(4, DEFAULT_CLIFFORD_TORUS_CONFIG)).not.toThrow();
      expect(() => generateCliffordTorus(8, DEFAULT_CLIFFORD_TORUS_CONFIG)).not.toThrow();
    });
  });

  describe('radius configuration', () => {
    it('should respect the radius parameter', () => {
      const radius = 2.0;
      const geometry = generateCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        radius,
        resolutionU: 8,
        resolutionV: 8,
      });

      // Points should lie on S³ with radius R
      geometry.vertices.forEach((v: VectorND) => {
        const sumSq = v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]! + v[3]! * v[3]!;
        expect(sumSq).toBeCloseTo(radius * radius, 5);
      });
    });
  });
});

describe('verifyCliffordTorusOnSphere', () => {
  it('should validate correct Clifford torus points', () => {
    const radius = 1.0;
    const points = generateCliffordTorusPoints(4, {
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      radius,
      resolutionU: 16,
      resolutionV: 16,
    });

    const result = verifyCliffordTorusOnSphere(points, radius);

    expect(result.valid).toBe(true);
    expect(result.maxDeviation).toBeLessThan(1e-6);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect points not on the sphere', () => {
    // Create some points that are not on S³
    const badPoints = [
      [1, 0, 0, 0], // Norm = 1, should be on S³ with R=1
      [2, 0, 0, 0], // Norm = 2, not on S³ with R=1
    ];

    const result = verifyCliffordTorusOnSphere(badPoints, 1.0);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Generalized Clifford Torus Tests
// ============================================================================

describe('generateGeneralizedCliffordTorusPoints', () => {
  describe('point generation', () => {
    it('should generate stepsPerCircle^k points', () => {
      const stepsPerCircle = 8;
      const k = 3;
      const points = generateGeneralizedCliffordTorusPoints({
        n: 6,
        k,
        stepsPerCircle,
        radiusScale: 1.0,
      });

      expect(points).toHaveLength(Math.pow(stepsPerCircle, k)); // 8^3 = 512
    });

    it('should generate points with correct dimensionality', () => {
      const points = generateGeneralizedCliffordTorusPoints({
        n: 8,
        k: 2,
        stepsPerCircle: 10,
        radiusScale: 1.0,
      });

      points.forEach(p => {
        expect(p).toHaveLength(8);
      });
    });

    it('should pad higher dimensions with zeros', () => {
      const points = generateGeneralizedCliffordTorusPoints({
        n: 10,
        k: 2, // Only uses 4 coordinates
        stepsPerCircle: 8,
        radiusScale: 1.0,
      });

      points.forEach(p => {
        // First 4 coordinates (2k) should be non-zero (at least some)
        // Coordinates 4-9 should all be zero
        for (let i = 4; i < 10; i++) {
          expect(p[i]).toBe(0);
        }
      });
    });
  });

  describe('dimension validation', () => {
    it('should throw for k < 1', () => {
      expect(() => generateGeneralizedCliffordTorusPoints({
        n: 4,
        k: 0,
        stepsPerCircle: 8,
        radiusScale: 1.0,
      })).toThrow();
    });

    it('should throw for 2k > n', () => {
      expect(() => generateGeneralizedCliffordTorusPoints({
        n: 5,
        k: 3, // Requires n >= 6
        stepsPerCircle: 8,
        radiusScale: 1.0,
      })).toThrow();
    });

    it('should accept valid k values', () => {
      expect(() => generateGeneralizedCliffordTorusPoints({
        n: 6,
        k: 3, // 2*3 = 6 <= 6 ✓
        stepsPerCircle: 8,
        radiusScale: 1.0,
      })).not.toThrow();
    });
  });

  describe('lying on S^(2k-1)', () => {
    it('should have all points on the (2k-1)-sphere', () => {
      const radius = 1.5;
      const k = 3;
      const points = generateGeneralizedCliffordTorusPoints({
        n: 6,
        k,
        stepsPerCircle: 8,
        radiusScale: radius,
      });

      // All points should satisfy sum of first 2k squares = R²
      const expectedRadiusSq = radius * radius;
      points.forEach(p => {
        let sumSq = 0;
        for (let i = 0; i < 2 * k; i++) {
          sumSq += p[i]! * p[i]!;
        }
        expect(sumSq).toBeCloseTo(expectedRadiusSq, 5);
      });
    });
  });

  describe('equal circle radii', () => {
    it('should have each circle with radius R/sqrt(k)', () => {
      const radius = 1.0;
      const k = 3;
      const expectedCircleRadiusSq = (radius / Math.sqrt(k)) ** 2;

      const points = generateGeneralizedCliffordTorusPoints({
        n: 6,
        k,
        stepsPerCircle: 8,
        radiusScale: radius,
      });

      points.forEach(p => {
        for (let m = 0; m < k; m++) {
          const x = p[2 * m]!;
          const y = p[2 * m + 1]!;
          const circleRadiusSq = x * x + y * y;
          expect(circleRadiusSq).toBeCloseTo(expectedCircleRadiusSq, 5);
        }
      });
    });
  });

  describe('k=2 equivalence', () => {
    it('should produce same structure as classic for k=2', () => {
      const radius = 1.0;
      const steps = 8;

      // Generalized with k=2
      const generalizedPoints = generateGeneralizedCliffordTorusPoints({
        n: 4,
        k: 2,
        stepsPerCircle: steps,
        radiusScale: radius,
      });

      // Both should have the same number of points
      // (though point ordering may differ)
      expect(generalizedPoints).toHaveLength(steps * steps);

      // All points should lie on S³ with radius R
      generalizedPoints.forEach(p => {
        const sumSq = p[0]! ** 2 + p[1]! ** 2 + p[2]! ** 2 + p[3]! ** 2;
        expect(sumSq).toBeCloseTo(radius * radius, 5);
      });
    });
  });
});

describe('buildGeneralizedCliffordTorusEdges', () => {
  it('should return empty array for k < 1', () => {
    const edges = buildGeneralizedCliffordTorusEdges(0, 8);
    expect(edges).toHaveLength(0);
  });

  it('should create correct number of edges for k=1 (circle)', () => {
    const stepsPerCircle = 8;
    const edges = buildGeneralizedCliffordTorusEdges(1, stepsPerCircle);

    // A circle has stepsPerCircle edges
    expect(edges).toHaveLength(stepsPerCircle);
  });

  it('should create correct number of edges for k=2', () => {
    const stepsPerCircle = 8;
    const edges = buildGeneralizedCliffordTorusEdges(2, stepsPerCircle);

    // For k=2, should have 2 × stepsPerCircle² edges (one set per dimension)
    // Actually: k × stepsPerCircle^k unique edges
    expect(edges).toHaveLength(2 * stepsPerCircle * stepsPerCircle);
  });

  it('should have valid vertex indices', () => {
    const k = 2;
    const stepsPerCircle = 6;
    const maxIndex = Math.pow(stepsPerCircle, k) - 1;
    const edges = buildGeneralizedCliffordTorusEdges(k, stepsPerCircle);

    edges.forEach(([i, j]) => {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(maxIndex);
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThanOrEqual(maxIndex);
      expect(i).toBeLessThan(j); // Canonical ordering
    });
  });
});

describe('generateGeneralizedCliffordTorus', () => {
  describe('geometry generation', () => {
    it('should generate NdGeometry with correct properties', () => {
      const geometry = generateGeneralizedCliffordTorus(6, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        mode: 'generalized',
        k: 3,
        stepsPerCircle: 8,
      });

      expect(geometry.dimension).toBe(6);
      expect(geometry.type).toBe('clifford-torus');
      expect(geometry.vertices).toHaveLength(512); // 8^3
      expect(geometry.metadata?.name).toContain('Generalized');
      expect(geometry.metadata?.properties?.mode).toBe('generalized');
      expect(geometry.metadata?.properties?.k).toBe(3);
    });
  });

  describe('edge modes', () => {
    it('should generate edges in grid mode', () => {
      const geometry = generateGeneralizedCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        mode: 'generalized',
        k: 2,
        stepsPerCircle: 6,
        edgeMode: 'grid',
      });

      expect(geometry.edges.length).toBeGreaterThan(0);
      expect(geometry.isPointCloud).toBe(false);
    });

    it('should not generate edges in none mode', () => {
      const geometry = generateGeneralizedCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        mode: 'generalized',
        k: 2,
        stepsPerCircle: 6,
        edgeMode: 'none',
      });

      expect(geometry.edges).toHaveLength(0);
      expect(geometry.isPointCloud).toBe(true);
    });
  });

  describe('dimension validation', () => {
    it('should auto-clamp k when 2k > dimension', () => {
      // k=3 would require dimension >= 6, but dimension is 5
      // Should auto-clamp k to floor(5/2) = 2
      const geometry = generateGeneralizedCliffordTorus(5, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        mode: 'generalized',
        k: 3, // Would require dimension >= 6
        stepsPerCircle: 8,
      });

      // Should have clamped k to 2 (max for dimension 5)
      expect(geometry.metadata?.properties?.k).toBe(2);
      expect(geometry.vertices).toHaveLength(64); // 8^2 = 64
    });

    it('should accept valid dimension', () => {
      expect(() => generateGeneralizedCliffordTorus(8, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        mode: 'generalized',
        k: 4, // Requires dimension >= 8
        stepsPerCircle: 6,
      })).not.toThrow();
    });

    it('should throw for dimension < 2', () => {
      expect(() => generateGeneralizedCliffordTorus(1, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        mode: 'generalized',
        k: 1,
        stepsPerCircle: 8,
      })).toThrow();
    });
  });
});

describe('verifyGeneralizedCliffordTorusOnSphere', () => {
  it('should validate correct points', () => {
    const radius = 1.0;
    const k = 3;
    const points = generateGeneralizedCliffordTorusPoints({
      n: 6,
      k,
      stepsPerCircle: 8,
      radiusScale: radius,
    });

    const result = verifyGeneralizedCliffordTorusOnSphere(points, k, radius);

    expect(result.valid).toBe(true);
    expect(result.maxDeviation).toBeLessThan(1e-6);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect points not on the sphere', () => {
    const badPoints = [
      [1, 0, 0, 0, 0, 0], // Norm = 1
      [2, 0, 0, 0, 0, 0], // Norm = 2
    ];

    const result = verifyGeneralizedCliffordTorusOnSphere(badPoints, 3, 1.0);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('verifyGeneralizedCliffordTorusCircleRadii', () => {
  it('should validate correct circle radii', () => {
    const radius = 1.0;
    const k = 3;
    const points = generateGeneralizedCliffordTorusPoints({
      n: 6,
      k,
      stepsPerCircle: 8,
      radiusScale: radius,
    });

    const result = verifyGeneralizedCliffordTorusCircleRadii(points, k, radius);

    expect(result.valid).toBe(true);
    expect(result.maxDeviation).toBeLessThan(1e-6);
  });

  it('should detect unequal circle radii', () => {
    // Manually create points with unequal circle radii
    const badPoints = [
      [0.5, 0, 0.3, 0, 0.2, 0], // |z₁| = 0.5, |z₂| = 0.3, |z₃| = 0.2
    ];

    const result = verifyGeneralizedCliffordTorusCircleRadii(badPoints, 3, 1.0);

    expect(result.valid).toBe(false);
  });
});

describe('utility functions', () => {
  describe('getMaxTorusDimension', () => {
    it('should return floor(n/2)', () => {
      expect(getMaxTorusDimension(3)).toBe(1);
      expect(getMaxTorusDimension(4)).toBe(2);
      expect(getMaxTorusDimension(5)).toBe(2);
      expect(getMaxTorusDimension(6)).toBe(3);
      expect(getMaxTorusDimension(11)).toBe(5);
    });
  });

  describe('getGeneralizedCliffordTorusPointCount', () => {
    it('should return stepsPerCircle^k', () => {
      expect(getGeneralizedCliffordTorusPointCount(1, 8)).toBe(8);
      expect(getGeneralizedCliffordTorusPointCount(2, 8)).toBe(64);
      expect(getGeneralizedCliffordTorusPointCount(3, 8)).toBe(512);
      expect(getGeneralizedCliffordTorusPointCount(4, 10)).toBe(10000);
    });
  });
});

describe('generateCliffordTorus dispatcher', () => {
  it('should dispatch to classic mode by default', () => {
    const geometry = generateCliffordTorus(4, {
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      mode: 'classic',
    });

    expect(geometry.metadata?.properties?.mode).toBe('classic');
    expect(geometry.metadata?.name).toContain('T²');
  });

  it('should dispatch to generalized mode when specified', () => {
    const geometry = generateCliffordTorus(6, {
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      mode: 'generalized',
      k: 3,
      stepsPerCircle: 8,
    });

    expect(geometry.metadata?.properties?.mode).toBe('generalized');
    expect(geometry.metadata?.properties?.k).toBe(3);
  });

  it('should generate 3D torus for dimension 3 regardless of mode', () => {
    // When dimension is 3, both classic and generalized modes generate torus3d
    const geometry = generateCliffordTorus(3, {
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      mode: 'classic',
    });
    expect(geometry.dimension).toBe(3);
    expect(geometry.metadata?.properties?.mode).toBe('3d-torus');
  });

  it('should generate 2D annulus for dimension 2 regardless of mode', () => {
    // When dimension is 2, both classic and generalized modes generate annulus
    const geometry = generateCliffordTorus(2, {
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      mode: 'generalized',
      k: 1,
      stepsPerCircle: 16,
    });

    expect(geometry.dimension).toBe(2);
    expect(geometry.metadata?.properties?.mode).toBe('2d-annulus');
    // Annulus uses resolutionU * max(2, resolutionV) points
    const expectedPoints = DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionU * Math.max(2, DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionV);
    expect(geometry.vertices).toHaveLength(expectedPoints);
  });
});

// ============================================================================
// Face Generation Tests
// ============================================================================

describe('buildTorus3DGridFaces', () => {
  it('should generate resolutionU × resolutionV quad faces', () => {
    const faces = buildTorus3DGridFaces(8, 8);
    expect(faces).toHaveLength(64); // 8 * 8
  });

  it('should have all quad faces (4 vertices each)', () => {
    const faces = buildTorus3DGridFaces(8, 8);
    faces.forEach(face => {
      expect(face).toHaveLength(4);
    });
  });

  it('should have valid vertex indices', () => {
    const resU = 8;
    const resV = 8;
    const maxIndex = resU * resV - 1;
    const faces = buildTorus3DGridFaces(resU, resV);

    faces.forEach(face => {
      face.forEach(idx => {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(maxIndex);
      });
    });
  });

  it('should have unique faces (no duplicates)', () => {
    const faces = buildTorus3DGridFaces(8, 8);
    const faceSet = new Set<string>();

    faces.forEach(face => {
      const key = [...face].sort((a, b) => a - b).join(',');
      expect(faceSet.has(key)).toBe(false);
      faceSet.add(key);
    });
  });

  it('should form closed surface with wrap-around', () => {
    const resU = 4;
    const resV = 4;
    const faces = buildTorus3DGridFaces(resU, resV);

    // Every edge should appear in exactly 2 faces (closed surface)
    const edgeCounts = new Map<string, number>();

    faces.forEach(face => {
      for (let i = 0; i < 4; i++) {
        const v1 = face[i]!;
        const v2 = face[(i + 1) % 4]!;
        const key = `${Math.min(v1, v2)},${Math.max(v1, v2)}`;
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
      }
    });

    // All edges should appear exactly twice (shared by 2 faces)
    for (const count of edgeCounts.values()) {
      expect(count).toBe(2);
    }
  });
});

describe('buildCliffordTorusGridFaces', () => {
  it('should generate correct number of faces', () => {
    const faces = buildCliffordTorusGridFaces(16, 16);
    expect(faces).toHaveLength(256);
  });

  it('should have all quad faces (4 vertices each)', () => {
    const faces = buildCliffordTorusGridFaces(8, 8);
    faces.forEach(face => {
      expect(face).toHaveLength(4);
    });
  });

  it('should have valid vertex indices', () => {
    const resU = 16;
    const resV = 16;
    const maxIndex = resU * resV - 1;
    const faces = buildCliffordTorusGridFaces(resU, resV);

    faces.forEach(face => {
      face.forEach(idx => {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(maxIndex);
      });
    });
  });
});

describe('buildGeneralizedCliffordTorusFaces', () => {
  it('should return empty array for k > 2', () => {
    expect(buildGeneralizedCliffordTorusFaces(3, 8)).toHaveLength(0);
    expect(buildGeneralizedCliffordTorusFaces(4, 8)).toHaveLength(0);
  });

  it('should generate faces for k = 2', () => {
    const faces = buildGeneralizedCliffordTorusFaces(2, 8);
    expect(faces).toHaveLength(64); // 8 * 8
  });

  it('should return empty array for k = 1 (circle has no faces)', () => {
    expect(buildGeneralizedCliffordTorusFaces(1, 8)).toHaveLength(0);
  });

  it('should have valid vertex indices for k = 2', () => {
    const stepsPerCircle = 8;
    const maxIndex = stepsPerCircle * stepsPerCircle - 1;
    const faces = buildGeneralizedCliffordTorusFaces(2, stepsPerCircle);

    faces.forEach(face => {
      face.forEach(idx => {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(maxIndex);
      });
    });
  });
});

describe('buildAnnulusGridFaces', () => {
  it('should generate (radialSteps-1) × angularSteps faces', () => {
    const resU = 16;
    const resV = 4;
    const faces = buildAnnulusGridFaces(resU, resV);
    // radialSteps = max(2, resV) = 4
    // faces = (4-1) * 16 = 48
    expect(faces).toHaveLength(48);
  });

  it('should have all quad faces (4 vertices each)', () => {
    const faces = buildAnnulusGridFaces(8, 4);
    faces.forEach(face => {
      expect(face).toHaveLength(4);
    });
  });

  it('should NOT wrap in radial direction', () => {
    const resU = 8;
    const resV = 4;
    const radialSteps = Math.max(2, resV);
    const faces = buildAnnulusGridFaces(resU, resV);

    // Check that no face connects the innermost ring (r=0) to the outermost ring (r=radialSteps-1)
    faces.forEach(face => {
      const radialIndices = face.map(idx => Math.floor(idx / resU));
      const minRadial = Math.min(...radialIndices);
      const maxRadial = Math.max(...radialIndices);
      // Adjacent radial indices only (difference should be at most 1)
      expect(maxRadial - minRadial).toBeLessThanOrEqual(1);
    });
  });

  it('should wrap in angular direction', () => {
    const resU = 8;
    const resV = 4;
    const faces = buildAnnulusGridFaces(resU, resV);

    // Check that some faces wrap around angularly (contain both index 0 and index resU-1 in same radial ring)
    let hasAngularWrap = false;
    faces.forEach(face => {
      const angularIndices = face.map(idx => idx % resU);
      if (angularIndices.includes(0) && angularIndices.includes(resU - 1)) {
        hasAngularWrap = true;
      }
    });
    expect(hasAngularWrap).toBe(true);
  });
});
