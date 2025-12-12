/**
 * Integration Tests for Render Pipeline
 * Tests the complete geometry → rotation → projection pipeline
 */

import { describe, it, expect } from 'vitest';
import { generatePolytope } from '@/lib/geometry';
import { multiplyMatrixVector, createIdentityMatrix } from '@/lib/math';
import { projectPerspective } from '@/lib/math/projection';
import type { MatrixND } from '@/lib/math/types';

/**
 * Creates a rotation matrix for a specific plane
 * @param dimension
 * @param axis1
 * @param axis2
 * @param angle
 */
function makeRotationMatrix(dimension: number, axis1: number, axis2: number, angle: number): MatrixND {
  const matrix = createIdentityMatrix(dimension);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  matrix[axis1]![axis1] = cos;
  matrix[axis2]![axis2] = cos;
  matrix[axis1]![axis2] = -sin;
  matrix[axis2]![axis1] = sin;

  return matrix;
}

describe('Render Pipeline Integration', () => {
  describe('Full Transform Pipeline', () => {
    it('should generate and transform a 4D hypercube', () => {
      // Step 1: Generate geometry
      const geometry = generatePolytope('hypercube', 4);

      expect(geometry.vertices.length).toBe(16); // 2^4
      expect(geometry.edges.length).toBe(32); // 4 * 2^3

      // Step 2: Apply rotation (XW plane = axes 0 and 3)
      const rotationMatrix = makeRotationMatrix(4, 0, 3, Math.PI / 4);
      const rotatedVertices = geometry.vertices.map((v) =>
        multiplyMatrixVector(rotationMatrix, v)
      );

      // Verify rotation changed the vertices
      const originalFirstVertex = geometry.vertices[0]!;
      const rotatedFirstVertex = rotatedVertices[0]!;

      // At least some coordinates should have changed
      const changed =
        Math.abs(originalFirstVertex[0]! - rotatedFirstVertex[0]!) > 0.01 ||
        Math.abs(originalFirstVertex[3]! - rotatedFirstVertex[3]!) > 0.01;
      expect(changed).toBe(true);

      // Step 3: Project to 3D
      const projectedVertices = rotatedVertices.map((v) =>
        projectPerspective(v, 5)
      );

      // All projected vertices should be 3D
      projectedVertices.forEach((v) => {
        expect(v.length).toBe(3);
      });
    });

    it('should generate and transform a 5D simplex', () => {
      // Step 1: Generate geometry
      const geometry = generatePolytope('simplex', 5);

      expect(geometry.vertices.length).toBe(6); // n + 1

      // Step 2: Compose multiple rotations using matrix multiplication
      const rotation1 = makeRotationMatrix(5, 0, 1, Math.PI / 6); // XY
      const rotation2 = makeRotationMatrix(5, 0, 3, Math.PI / 4); // XW
      const rotation3 = makeRotationMatrix(5, 1, 4, Math.PI / 3); // YV

      // Apply rotations sequentially
      let rotatedVertices = geometry.vertices;
      rotatedVertices = rotatedVertices.map((v) => multiplyMatrixVector(rotation1, v));
      rotatedVertices = rotatedVertices.map((v) => multiplyMatrixVector(rotation2, v));
      rotatedVertices = rotatedVertices.map((v) => multiplyMatrixVector(rotation3, v));

      // Step 3: Project to 3D
      const projectedVertices = rotatedVertices.map((v) =>
        projectPerspective(v, 5)
      );

      // All projected vertices should be 3D
      projectedVertices.forEach((v) => {
        expect(v.length).toBe(3);
        // Values should be finite
        v.forEach((coord) => {
          expect(isFinite(coord)).toBe(true);
        });
      });
    });

    it('should generate and transform a 6D cross-polytope', () => {
      // Step 1: Generate geometry
      const geometry = generatePolytope('cross-polytope', 6);

      expect(geometry.vertices.length).toBe(12); // 2n

      // Step 2: Apply rotation (WU plane = axes 3 and 5)
      const rotationMatrix = makeRotationMatrix(6, 3, 5, Math.PI / 4);
      const rotatedVertices = geometry.vertices.map((v) =>
        multiplyMatrixVector(rotationMatrix, v)
      );

      // Step 3: Project to 3D
      const projectedVertices = rotatedVertices.map((v) =>
        projectPerspective(v, 5)
      );

      // All projected vertices should be valid 3D points
      projectedVertices.forEach((v) => {
        expect(v.length).toBe(3);
        v.forEach((coord) => {
          expect(isFinite(coord)).toBe(true);
        });
      });
    });
  });

  describe('Identity Transform', () => {
    it('should preserve 3D geometry without rotation', () => {
      const geometry = generatePolytope('hypercube', 3);

      // No rotation - identity (angle = 0)
      const identityMatrix = makeRotationMatrix(3, 0, 1, 0);
      const transformedVertices = geometry.vertices.map((v) =>
        multiplyMatrixVector(identityMatrix, v)
      );

      // Vertices should be unchanged
      geometry.vertices.forEach((original, i) => {
        const transformed = transformedVertices[i]!;
        original.forEach((coord, j) => {
          expect(transformed[j]).toBeCloseTo(coord, 10);
        });
      });
    });
  });

  describe('Edge Preservation', () => {
    it('should maintain edge connectivity through transforms', () => {
      const geometry = generatePolytope('hypercube', 4);
      const originalEdgeCount = geometry.edges.length;

      // Apply rotation (XY plane = axes 0 and 1)
      const rotationMatrix = makeRotationMatrix(4, 0, 1, Math.PI / 3);
      const rotatedVertices = geometry.vertices.map((v) =>
        multiplyMatrixVector(rotationMatrix, v)
      );

      // Project
      const projectedVertices = rotatedVertices.map((v) =>
        projectPerspective(v, 5)
      );

      // Edge indices should still be valid
      geometry.edges.forEach(([i, j]) => {
        expect(projectedVertices[i]).toBeDefined();
        expect(projectedVertices[j]).toBeDefined();
      });

      // Edge count unchanged
      expect(geometry.edges.length).toBe(originalEdgeCount);
    });
  });

  describe('Projection Distance Effects', () => {
    it('should affect perspective based on distance', () => {
      const geometry = generatePolytope('hypercube', 4);

      // Apply same rotation but different projection distances (XW = axes 0, 3)
      const rotationMatrix = makeRotationMatrix(4, 0, 3, Math.PI / 4);
      const rotatedVertices = geometry.vertices.map((v) =>
        multiplyMatrixVector(rotationMatrix, v)
      );

      const nearProjection = rotatedVertices.map((v) =>
        projectPerspective(v, 3)
      );
      const farProjection = rotatedVertices.map((v) =>
        projectPerspective(v, 10)
      );

      // The projections should be different
      const nearPoint = nearProjection[0];
      const farPoint = farProjection[0];

      // Farther projection should generally have smaller perspective distortion
      // This is a simplified check - the actual relationship is more complex
      expect(nearPoint).not.toEqual(farPoint);
    });
  });

  describe('All Object Types', () => {
    const objectTypes = ['hypercube', 'simplex', 'cross-polytope'] as const;
    const dimensions = [3, 4, 5, 6];

    objectTypes.forEach((type) => {
      dimensions.forEach((dim) => {
        it(`should render ${type} in ${dim}D`, () => {
          const geometry = generatePolytope(type, dim);

          // Verify geometry is valid
          expect(geometry.vertices.length).toBeGreaterThan(0);
          expect(geometry.edges.length).toBeGreaterThan(0);

          // Apply transform and projection (XY = axes 0, 1)
          const rotation = makeRotationMatrix(dim, 0, 1, Math.PI / 4);
          const rotated = geometry.vertices.map((v) =>
            multiplyMatrixVector(rotation, v)
          );
          const projected = rotated.map((v) => projectPerspective(v, 5));

          // All projected vertices should be valid
          projected.forEach((v) => {
            expect(v.length).toBe(3);
            v.forEach((coord) => {
              expect(isFinite(coord)).toBe(true);
            });
          });
        });
      });
    });
  });
});
