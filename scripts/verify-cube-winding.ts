/**
 * Verify 3D cube face winding order
 * Run with: npx tsx scripts/verify-cube-winding.ts
 */

import { generateHypercube, generateHypercubeFaces } from '../src/lib/geometry/hypercube';

// Generate 3D cube
const cube = generateHypercube(3);
const vertices = cube.vertices;
const faces = generateHypercubeFaces(3);

console.log('=== 3D CUBE VERTICES ===');
vertices.forEach((v, i) => {
  console.log(`  ${i}: [${v.map(x => x.toFixed(1)).join(', ')}]`);
});

console.log('\n=== 3D CUBE FACES ===');

function crossProduct(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function subtract(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

let wrongWindingCount = 0;

faces.forEach((face, i) => {
  const [i0, i1, i2, i3] = face;
  const v0 = vertices[i0];
  const v1 = vertices[i1];
  const v2 = vertices[i2];
  const v3 = vertices[i3];

  // Calculate face centroid
  const centroid = [
    (v0[0] + v1[0] + v2[0] + v3[0]) / 4,
    (v0[1] + v1[1] + v2[1] + v3[1]) / 4,
    (v0[2] + v1[2] + v2[2] + v3[2]) / 4
  ];

  // Calculate normal from first triangle (v0, v1, v2)
  const edge1 = subtract(v1, v0);
  const edge2 = subtract(v2, v0);
  const normal = crossProduct(edge1, edge2);

  // Check if normal points outward (same direction as centroid from origin)
  const dotProduct = dot(normal, centroid);
  const isOutward = dotProduct > 0;

  console.log(`Face ${i}: vertices [${face.join(', ')}]`);
  console.log(`  Centroid: [${centroid.map(x => x.toFixed(2)).join(', ')}]`);
  console.log(`  Normal: [${normal.map(x => x.toFixed(2)).join(', ')}]`);
  console.log(`  dot(normal, centroid) = ${dotProduct.toFixed(4)}`);
  console.log(`  Winding: ${isOutward ? '✓ OUTWARD (correct)' : '✗ INWARD (WRONG!)'}`);

  if (!isOutward) wrongWindingCount++;
});

console.log('\n=== SUMMARY ===');
console.log(`Total faces: ${faces.length}`);
console.log(`Wrong winding: ${wrongWindingCount}`);

if (wrongWindingCount > 0) {
  console.log('\n❌ WINDING ORDER BUG DETECTED!');
} else {
  console.log('\n✓ All faces have correct outward winding');
}
