/**
 * Diagnostic script to verify hypercube face winding directions
 */

import { generateHypercube, generateHypercubeFaces } from '../src/lib/geometry/hypercube';

function to3D(v: number[]): number[] {
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
}

// Simple math functions to avoid import.meta.env issues
function subtractVectors(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - (b[i] ?? 0));
}

function crossProduct3D(a: number[], b: number[]): number[] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function verifyHypercubeWinding(dimension: number): void {
  console.log(`\n=== ${dimension}D Hypercube Winding Analysis ===\n`);

  const hypercube = generateHypercube(dimension, 1.0);
  const faceIndices = generateHypercubeFaces(dimension);

  console.log(`Vertices: ${hypercube.vertices.length}`);
  console.log(`Faces: ${faceIndices.length}`);

  // Compute centroid (should be origin for centered hypercube)
  const centroid = [0, 0, 0];

  let outwardCount = 0;
  let inwardCount = 0;
  let degenerateCount = 0;

  for (let i = 0; i < faceIndices.length; i++) {
    const face = faceIndices[i]!;

    // For quads, check first triangle (v0, v1, v2)
    const v0 = hypercube.vertices[face[0]!]!;
    const v1 = hypercube.vertices[face[1]!]!;
    const v2 = hypercube.vertices[face[2]!]!;

    // Compute edges
    const edge1 = subtractVectors(to3D(v1), to3D(v0));
    const edge2 = subtractVectors(to3D(v2), to3D(v0));

    // Compute normal
    const normal = crossProduct3D(edge1, edge2);

    // Compute face centroid (use all 4 vertices for quad)
    const v3 = hypercube.vertices[face[3]!]!;
    const faceCentroid = [
      (v0[0]! + v1[0]! + v2[0]! + v3[0]!) / 4,
      (v0[1]! + v1[1]! + v2[1]! + v3[1]!) / 4,
      (v0[2]! + v1[2]! + v2[2]!) / 4,
    ];

    // Vector from centroid to face center
    const toFace = subtractVectors(to3D(faceCentroid), centroid);

    // Dot product to check if normal points outward
    const dot = dotProduct(normal, toFace);

    if (Math.abs(dot) < 1e-10) {
      degenerateCount++;
      console.log(`Face ${i}: DEGENERATE (dot ≈ 0)`);
    } else if (dot > 0) {
      outwardCount++;
    } else {
      inwardCount++;
      // Print details for inward faces
      console.log(`Face ${i}: INWARD (dot = ${dot.toFixed(6)})`);
      console.log(`  Vertices: [${face.join(', ')}]`);
      console.log(`  v0: [${v0.map(x => x.toFixed(2)).join(', ')}]`);
      console.log(`  v1: [${v1.map(x => x.toFixed(2)).join(', ')}]`);
      console.log(`  v2: [${v2.map(x => x.toFixed(2)).join(', ')}]`);
      console.log(`  v3: [${v3.map(x => x.toFixed(2)).join(', ')}]`);
      console.log(`  normal: [${normal.map(x => x.toFixed(4)).join(', ')}]`);
      console.log(`  faceCentroid: [${faceCentroid.map(x => x.toFixed(2)).join(', ')}]`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Outward: ${outwardCount}`);
  console.log(`  Inward: ${inwardCount}`);
  console.log(`  Degenerate: ${degenerateCount}`);
  console.log(`  Total: ${faceIndices.length}`);

  if (inwardCount === 0) {
    console.log(`\n✅ All faces have correct outward winding`);
  } else {
    console.log(`\n❌ ${inwardCount} faces have incorrect winding`);
  }
}

// Test 3D, 4D, and 5D hypercubes
verifyHypercubeWinding(3);
verifyHypercubeWinding(4);
verifyHypercubeWinding(5);
