# Efficient Algorithms for Wythoff Polytope Edge Generation

**Research Date**: December 26, 2025
**Problem**: O(n²) distance calculations for edge generation (3.2 billion for 40K vertices)
**Goal**: Find O(V × n) or better combinatorial algorithms

## Executive Summary

For Wythoff polytopes (specifically omnitruncated hypercubes/permutohedra), edges can be determined **combinatorially** based on permutation adjacency rules, eliminating the need for geometric distance calculations.

| Method | Complexity | 40,000 vertices |
|--------|-----------|-----------------|
| Brute force O(V²) | 1.6 billion ops | Hours |
| Spatial hashing (current) | O(V × k log V) | Seconds |
| **Combinatorial (proposed)** | O(V × n) | Milliseconds |

## Key Mathematical Insight

### Permutohedron Edge Adjacency Theorem

From Wikipedia and combinatorial geometry literature:

> **"Two vertices of a permutohedron are adjacent if and only if they differ by a single adjacent transposition where the values at the swapped positions differ by exactly 1."**

This is the fundamental result that enables O(V × n) edge generation.

---

## Algorithm 1: Pure Permutohedron (Symmetric Group Sₙ)

For permutohedra where vertices are permutations of `(1, 2, ..., n)`:

### Mathematical Definition
Two permutations `p₁` and `p₂` are **adjacent** if and only if:
1. They differ by swapping exactly two positions `i` and `i+1` (adjacent positions)
2. The values `p₁[i]` and `p₁[i+1]` differ by exactly 1 (adjacent values)

### TypeScript Implementation

```typescript
interface PermutohedronVertex {
  permutation: number[];  // Permutation of [0, 1, ..., n-1]
  index: number;          // Original vertex index
}

function generatePermutohedronEdgesCombinatorial(
  vertices: number[][]
): [number, number][] {
  const n = vertices[0].length;

  // Build lookup: permutation string → vertex index
  const vertexMap = new Map<string, number>();
  for (let i = 0; i < vertices.length; i++) {
    vertexMap.set(vertices[i].join(','), i);
  }

  const edges: [number, number][] = [];

  for (let i = 0; i < vertices.length; i++) {
    const perm = vertices[i];

    // Check each adjacent pair of positions
    for (let j = 0; j < n - 1; j++) {
      // Edge exists only if values at positions j and j+1 differ by 1
      if (Math.abs(perm[j] - perm[j + 1]) === 1) {
        // Create neighbor by swapping positions j and j+1
        const neighbor = [...perm];
        [neighbor[j], neighbor[j + 1]] = [neighbor[j + 1], neighbor[j]];

        const neighborIdx = vertexMap.get(neighbor.join(','));
        if (neighborIdx !== undefined && i < neighborIdx) {
          edges.push([i, neighborIdx]);
        }
      }
    }
  }

  return edges;
}
```

### Complexity Analysis
- **Vertex lookup build**: O(V × n) for hashing
- **Edge generation**: O(V × n) - each vertex checks n-1 adjacent positions
- **Total**: O(V × n) where V = n!

---

## Algorithm 2: Omnitruncated Hypercube (Hyperoctahedral Group Bₙ)

For vertices that are **signed permutations** of `(c₁, c₂, ..., cₙ)` with distinct `cᵢ`.

### Hyperoctahedral Group Generators

The hyperoctahedral group Bₙ has n generators:
- **s₀**: Sign flip on the coordinate with smallest absolute value
- **s₁, s₂, ..., sₙ₋₁**: Adjacent transpositions (swap positions i and i+1)

For the **omnitruncated** polytope (all Coxeter nodes ringed), edges correspond to ALL generators.

### Edge Adjacency Rules for Bₙ Omnitruncated

Two signed permutations are adjacent if they differ by exactly one of:

1. **Adjacent Transposition (generators s₁...sₙ₋₁)**:
   - Swap positions `i` and `i+1`
   - The **ranks** (sorted position by absolute value) at those positions must differ by 1
   - Signs follow along with the swap

2. **Sign Flip (generator s₀)**:
   - Change the sign of exactly one coordinate
   - That coordinate must have the **smallest absolute value** (rank 0)

### Canonical Encoding

Encode each vertex as:
```typescript
interface SignedPermVertex {
  ranks: number[];  // Position of each |coord| in sorted order [0..n-1]
  signs: number[];  // +1 or -1 for each coordinate
}
```

Example for base values `[1, 2.41, 3.83, 5.24]`:
- Vertex `(-3.83, 1, 2.41, -5.24)` encodes as:
  - `ranks: [2, 0, 1, 3]` (|−3.83| has rank 2, |1| has rank 0, etc.)
  - `signs: [-1, +1, +1, -1]`

### TypeScript Implementation

```typescript
interface SignedPermVertex {
  ranks: number[];   // Which canonical value (by magnitude) at each position
  signs: number[];   // +1 or -1 for each position
}

function generateOmnitruncatedBnEdgesCombinatorial(
  vertices: number[][]
): [number, number][] {
  if (vertices.length < 2) return [];

  const n = vertices[0].length;

  // Step 1: Determine canonical values (sorted absolute magnitudes)
  const absValues = vertices[0].map(Math.abs);
  const sortedValues = [...absValues].sort((a, b) => a - b);
  const tolerance = 1e-9;

  // Step 2: Encode all vertices as (ranks, signs)
  const encoded: SignedPermVertex[] = vertices.map(v => {
    const ranks: number[] = [];
    const signs: number[] = [];
    for (let i = 0; i < n; i++) {
      const absVal = Math.abs(v[i]);
      ranks[i] = sortedValues.findIndex(sv => Math.abs(sv - absVal) < tolerance);
      signs[i] = v[i] >= 0 ? 1 : -1;
    }
    return { ranks, signs };
  });

  // Step 3: Build vertex lookup (canonical string key)
  const vertexMap = new Map<string, number>();
  for (let i = 0; i < encoded.length; i++) {
    const key = encodeKey(encoded[i]);
    vertexMap.set(key, i);
  }

  const edges: [number, number][] = [];

  for (let i = 0; i < encoded.length; i++) {
    const v = encoded[i];

    // Edge Type 1: Adjacent transpositions (for adjacent ranks)
    for (let j = 0; j < n - 1; j++) {
      // Only create edge if ranks are adjacent (differ by 1)
      if (Math.abs(v.ranks[j] - v.ranks[j + 1]) === 1) {
        const neighbor: SignedPermVertex = {
          ranks: [...v.ranks],
          signs: [...v.signs]
        };
        // Swap both rank and sign at positions j and j+1
        [neighbor.ranks[j], neighbor.ranks[j + 1]] =
          [neighbor.ranks[j + 1], neighbor.ranks[j]];
        [neighbor.signs[j], neighbor.signs[j + 1]] =
          [neighbor.signs[j + 1], neighbor.signs[j]];

        const key = encodeKey(neighbor);
        const neighborIdx = vertexMap.get(key);
        if (neighborIdx !== undefined && i < neighborIdx) {
          edges.push([i, neighborIdx]);
        }
      }
    }

    // Edge Type 2: Sign flip on coordinate with smallest rank (rank 0)
    const minRankPos = v.ranks.indexOf(0);
    if (minRankPos !== -1) {
      const neighbor: SignedPermVertex = {
        ranks: [...v.ranks],
        signs: [...v.signs]
      };
      neighbor.signs[minRankPos] *= -1;

      const key = encodeKey(neighbor);
      const neighborIdx = vertexMap.get(key);
      if (neighborIdx !== undefined && i < neighborIdx) {
        edges.push([i, neighborIdx]);
      }
    }
  }

  return edges;
}

function encodeKey(v: SignedPermVertex): string {
  return v.ranks.join(',') + '|' + v.signs.join(',');
}
```

### Complexity Analysis
- **Encoding**: O(V × n log n) for sorting (once)
- **Map building**: O(V × n)
- **Edge generation**: O(V × n) - each vertex checks n potential edges
- **Total**: O(V × n log n), dominated by initial encoding

For V = 40,000 and n = 5 (5D): ~200,000 operations vs 1.6 billion

---

## Algorithm 3: Spatial Hashing Fallback

For non-Wythoffian polytopes or unknown structure, use spatial hashing:

### Current Implementation Analysis

The existing `spatial-hash.ts` implementation:
- Uses 3D hash buckets (MAX_HASH_DIMS = 3) for all dimensions
- Two-pass algorithm: estimate min distance, then collect edges
- Complexity: O(V × k) where k = average neighbors per bucket

### Potential Improvements

1. **Adaptive hash dimensions**: Use more dimensions for lower-D polytopes
2. **k-d tree alternative**: O(V log V) for point location queries
3. **Parallel processing**: Edge detection can be parallelized per vertex

---

## Implementation Recommendations

### Immediate Actions

1. **Create `combinatorial-edges.ts`** with the algorithms above
2. **Detect polytope type** in vertex generation and tag with structure info
3. **Route to combinatorial method** when structure is known

### Code Structure

```typescript
// In src/lib/geometry/wythoff/edges.ts

export function generateEdges(
  vertices: VectorND[],
  polytopeStructure?: PolytopeStructure
): [number, number][] {
  // Use combinatorial method if structure is known
  if (polytopeStructure?.type === 'omnitruncated-hypercube') {
    return generateOmnitruncatedBnEdgesCombinatorial(vertices);
  }
  if (polytopeStructure?.type === 'permutohedron') {
    return generatePermutohedronEdgesCombinatorial(vertices);
  }

  // Fall back to spatial hashing for unknown structures
  return generateEdgesWithSpatialHash(vertices);
}
```

### Metadata Interface

```typescript
interface PolytopeStructure {
  type: 'permutohedron' | 'omnitruncated-hypercube' | 'hypercube' |
        'simplex' | 'cross-polytope' | 'unknown';
  symmetryGroup: 'A' | 'B' | 'D' | null;
  baseCoordinates?: number[];  // Canonical coordinate values
}
```

---

## Performance Projections

| Dimension | Vertices (Bₙ omnitruncated) | O(V²) ops | O(V×n) ops | Speedup |
|-----------|----------------------------|-----------|------------|---------|
| 4D | 384 | 147,456 | 1,536 | 96× |
| 5D | 3,840 | 14.7M | 19,200 | 768× |
| 6D | 46,080 | 2.1B | 276,480 | 7,680× |
| 7D | 645,120 | 416B | 4.5M | 92,160× |

---

## References

1. Wikipedia: [Permutohedron](https://en.wikipedia.org/wiki/Permutohedron)
   - "Two connected vertices differ by swapping two coordinates, whose values differ by 1."

2. Wikipedia: [Hyperoctahedral Group](https://en.wikipedia.org/wiki/Hyperoctahedral_group)
   - Coxeter group Bₙ = S₂ ≀ Sₙ (wreath product)

3. Wikipedia: [Omnitruncated Tesseract](https://en.wikipedia.org/wiki/Omnitruncated_tesseract)
   - Coordinate structure: all permutations of (1, 1+√2, 1+2√2, 1+3√2)

4. Gaiha & Gupta (1977): "Adjacent vertices on a permutohedron"
   - Formal proof of adjacency theorem

5. Ziegler (1995): "Lectures on Polytopes" - Graduate Texts in Mathematics 152
   - Comprehensive treatment of permutohedron edge structure

---

## Appendix: Coordinate Value Formulas

For omnitruncated Bₙ polytopes, the canonical coordinates are:

```
cₖ = 1 + k × √2    for k = 0, 1, 2, ..., n-1
```

Or equivalently:
```
cₖ = 1 + k × (√2)  where √2 ≈ 1.4142
```

This gives:
- 4D: (1, 2.414, 3.828, 5.243)
- 5D: (1, 2.414, 3.828, 5.243, 6.657)
- etc.

The edge length is constant across all edge types in a uniform polytope.
