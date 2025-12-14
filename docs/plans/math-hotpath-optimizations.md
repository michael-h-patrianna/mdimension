# Math Library Hot-Path Optimization Plan

## Overview

This document outlines optimizations for the N-dimensional math library to reduce GC pressure and improve JIT optimization in hot paths (per-vertex/per-frame operations).

**Target Files:**
- `src/lib/math/vector.ts`
- `src/lib/math/transform.ts`
- `src/lib/math/projection.ts`
- `src/lib/math/matrix.ts`
- `src/lib/math/rotation.ts`

**Goals:**
1. Replace `map`, `reduce`, `every`, spread (`[...]`) with `for` loops
2. Add optional `out` parameters to avoid allocations
3. Reuse scratch buffers where practical
4. Maintain backward compatibility (existing API unchanged)

---

## Hot-Path Analysis

### Per-Vertex/Per-Frame Functions (CRITICAL)

These functions are called in `useFrame` loops or per-vertex transformations:

| Function | File | Current Issues | Callers |
|----------|------|----------------|---------|
| `multiplyMatrixVector` | matrix.ts | ✅ Already optimized | useRotatedVertices, useTransformedVertices, PointCloudScene |
| `projectPerspective` | projection.ts | ✅ Already optimized | useProjectedVertices, PointCloudScene |
| `projectOrthographic` | projection.ts | ✅ Already optimized | useProjectedVertices, PointCloudScene |
| `addVectors` | vector.ts | ✅ Already optimized | useTransformedVertices |
| `subtractVectors` | vector.ts | ❌ Uses `map()` | Face calculations |
| `scaleVector` | vector.ts | ❌ Uses `map()` | normalize() |
| `dotProduct` | vector.ts | ❌ Uses `reduce()` | Depth calculations |
| `magnitude` | vector.ts | ❌ Uses `reduce()` | normalize() |
| `normalize` | vector.ts | ❌ Calls scaleVector (map) | Normal calculations |
| `vectorsEqual` | vector.ts | ❌ Uses `every()` | Comparisons |
| `copyVector` | vector.ts | ❌ Uses spread `[...]` | Multiple |

### Per-Rotation-Change Functions (MEDIUM)

Called when rotation angles change (60fps during animation):

| Function | File | Current Issues | Callers |
|----------|------|----------------|---------|
| `composeRotations` | rotation.ts | ❌ Creates maps, arrays | useRotatedVertices, HyperbulbMesh |
| `createRotationMatrix` | rotation.ts | Calls `createIdentityMatrix` | composeRotations |
| `multiplyMatrices` | matrix.ts | Calls `createZeroMatrix` | composeRotations |

### Setup-Only Functions (LOW PRIORITY)

Called once per dimension/object change:

| Function | File | Notes |
|----------|------|-------|
| `createIdentityMatrix` | matrix.ts | Uses nested loops, allocates |
| `createZeroMatrix` | matrix.ts | Uses `new Array().fill()` |
| `createScaleMatrix` | transform.ts | Calls createIdentityMatrix |
| `getRotationPlanes` | rotation.ts | ✅ Already cached |

---

## Detailed Changes

### 1. vector.ts

#### 1.1 `subtractVectors` - Add `out` parameter

**Current:**
```typescript
export function subtractVectors(a: VectorND, b: VectorND): VectorND {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
  }
  return a.map((val, i) => val - b[i]!);
}
```

**Optimized:**
```typescript
export function subtractVectors(a: VectorND, b: VectorND, out?: VectorND): VectorND {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
  }
  const result = out ?? new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i]! - b[i]!;
  }
  return result;
}
```

#### 1.2 `scaleVector` - Add `out` parameter

**Current:**
```typescript
export function scaleVector(v: VectorND, scalar: number): VectorND {
  return v.map(val => val * scalar);
}
```

**Optimized:**
```typescript
export function scaleVector(v: VectorND, scalar: number, out?: VectorND): VectorND {
  const result = out ?? new Array(v.length);
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i]! * scalar;
  }
  return result;
}
```

#### 1.3 `dotProduct` - Replace `reduce` with loop

**Current:**
```typescript
export function dotProduct(a: VectorND, b: VectorND): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
  }
  return a.reduce((sum, val, i) => sum + val * b[i]!, 0);
}
```

**Optimized:**
```typescript
export function dotProduct(a: VectorND, b: VectorND): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}
```

#### 1.4 `magnitude` - Replace `reduce` with loop

**Current:**
```typescript
export function magnitude(v: VectorND): number {
  const sumSquares = v.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumSquares);
}
```

**Optimized:**
```typescript
export function magnitude(v: VectorND): number {
  let sumSquares = 0;
  for (let i = 0; i < v.length; i++) {
    sumSquares += v[i]! * v[i]!;
  }
  return Math.sqrt(sumSquares);
}
```

#### 1.5 `normalize` - Add `out` parameter, use optimized scaleVector

**Current:**
```typescript
export function normalize(v: VectorND): VectorND {
  const mag = magnitude(v);
  if (mag < EPSILON) {
    throw new Error('Cannot normalize zero vector');
  }
  return scaleVector(v, 1 / mag);
}
```

**Optimized:**
```typescript
export function normalize(v: VectorND, out?: VectorND): VectorND {
  const mag = magnitude(v);
  if (mag < EPSILON) {
    throw new Error('Cannot normalize zero vector');
  }
  return scaleVector(v, 1 / mag, out);
}
```

#### 1.6 `vectorsEqual` - Replace `every` with early-exit loop

**Current:**
```typescript
export function vectorsEqual(a: VectorND, b: VectorND, epsilon = EPSILON): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((val, i) => Math.abs(val - b[i]!) < epsilon);
}
```

**Optimized:**
```typescript
export function vectorsEqual(a: VectorND, b: VectorND, epsilon = EPSILON): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) >= epsilon) {
      return false;
    }
  }
  return true;
}
```

#### 1.7 `copyVector` - Replace spread with loop + add `out` parameter

**Current:**
```typescript
export function copyVector(v: VectorND): VectorND {
  return [...v];
}
```

**Optimized:**
```typescript
export function copyVector(v: VectorND, out?: VectorND): VectorND {
  const result = out ?? new Array(v.length);
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i]!;
  }
  return result;
}
```

---

### 2. transform.ts

#### 2.1 `translateVector` - Add `out` parameter + use loop

**Current:**
```typescript
export function translateVector(vector: VectorND, translation: VectorND): VectorND {
  if (vector.length !== translation.length) {
    throw new Error(
      `Vector dimensions must match: ${vector.length} !== ${translation.length}`
    );
  }
  return vector.map((val, i) => val + translation[i]!);
}
```

**Optimized:**
```typescript
export function translateVector(vector: VectorND, translation: VectorND, out?: VectorND): VectorND {
  if (vector.length !== translation.length) {
    throw new Error(
      `Vector dimensions must match: ${vector.length} !== ${translation.length}`
    );
  }
  const result = out ?? new Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i]! + translation[i]!;
  }
  return result;
}
```

#### 2.2 `toHomogeneous` - Replace spread with loop + add `out` parameter

**Current:**
```typescript
export function toHomogeneous(vector: VectorND): VectorND {
  return [...vector, 1];
}
```

**Optimized:**
```typescript
export function toHomogeneous(vector: VectorND, out?: VectorND): VectorND {
  const len = vector.length;
  const result = out ?? new Array(len + 1);
  for (let i = 0; i < len; i++) {
    result[i] = vector[i]!;
  }
  result[len] = 1;
  return result;
}
```

#### 2.3 `fromHomogeneous` - Already uses loop, just verify

**Current implementation is acceptable** - uses a for loop already.

#### 2.4 `createUniformScaleMatrix` - Avoid intermediate array

**Current:**
```typescript
export function createUniformScaleMatrix(dimension: number, scale: number): MatrixND {
  if (dimension <= 0 || !Number.isInteger(dimension)) {
    throw new Error('Dimension must be a positive integer');
  }
  const scales = new Array(dimension).fill(scale);
  return createScaleMatrix(dimension, scales);
}
```

**Optimized:**
```typescript
export function createUniformScaleMatrix(dimension: number, scale: number): MatrixND {
  if (dimension <= 0 || !Number.isInteger(dimension)) {
    throw new Error('Dimension must be a positive integer');
  }
  const matrix = createIdentityMatrix(dimension);
  for (let i = 0; i < dimension; i++) {
    matrix[i]![i] = scale;
  }
  return matrix;
}
```

---

### 3. projection.ts

#### 3.1 `sortByDepth` - Avoid creating intermediate objects

**Current:**
```typescript
export function sortByDepth(vertices: VectorND[]): number[] {
  const depthIndices = vertices.map((vertex, index) => ({
    index,
    depth: calculateDepth(vertex),
  }));
  depthIndices.sort((a, b) => b.depth - a.depth);
  return depthIndices.map(item => item.index);
}
```

**Optimized:**
```typescript
// Scratch arrays for depth sorting (avoids per-call allocation)
let depthScratch: { index: number; depth: number }[] = [];

export function sortByDepth(vertices: VectorND[]): number[] {
  const len = vertices.length;

  // Resize scratch array if needed
  if (depthScratch.length < len) {
    depthScratch = new Array(len);
    for (let i = 0; i < len; i++) {
      depthScratch[i] = { index: 0, depth: 0 };
    }
  }

  // Fill scratch array
  for (let i = 0; i < len; i++) {
    depthScratch[i]!.index = i;
    depthScratch[i]!.depth = calculateDepth(vertices[i]!);
  }

  // Sort (only the portion we're using)
  const slice = depthScratch.slice(0, len);
  slice.sort((a, b) => b.depth - a.depth);

  // Extract indices
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = slice[i]!.index;
  }
  return result;
}
```

#### 3.2 `projectVertices` - Replace map with loop + add `out` parameter

**Current:**
```typescript
export function projectVertices(
  vertices: VectorND[],
  projectionDistance: number = DEFAULT_PROJECTION_DISTANCE,
  usePerspective = true
): Vector3D[] {
  // ... validation ...
  if (usePerspective) {
    return vertices.map(v => projectPerspective(v, projectionDistance));
  } else {
    return vertices.map(v => projectOrthographic(v));
  }
}
```

**Optimized:**
```typescript
export function projectVertices(
  vertices: VectorND[],
  projectionDistance: number = DEFAULT_PROJECTION_DISTANCE,
  usePerspective = true,
  out?: Vector3D[]
): Vector3D[] {
  if (vertices.length === 0) {
    return [];
  }

  // Validation...

  const len = vertices.length;
  const result = out ?? new Array(len);

  // Ensure output array has correct size
  if (result.length < len) {
    for (let i = result.length; i < len; i++) {
      result[i] = [0, 0, 0];
    }
  }

  // Pre-calculate normalization factor
  const dimension = vertices[0]!.length;
  const normFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1;

  if (usePerspective) {
    for (let i = 0; i < len; i++) {
      projectPerspective(vertices[i]!, projectionDistance, result[i], normFactor);
    }
  } else {
    for (let i = 0; i < len; i++) {
      projectOrthographic(vertices[i]!, result[i]);
    }
  }

  return result;
}
```

---

### 4. matrix.ts

#### 4.1 `multiplyMatrices` - Add `out` parameter

**Current implementation uses createZeroMatrix which allocates.**

**Optimized:**
```typescript
export function multiplyMatrices(a: MatrixND, b: MatrixND, out?: MatrixND): MatrixND {
  // Validation...

  const aRows = a.length;
  const aCols = a[0]!.length;
  const bCols = b[0]!.length;

  // Initialize or reuse output matrix
  const result = out ?? createZeroMatrix(aRows, bCols);

  // If reusing, ensure zeroed (may contain old values)
  if (out) {
    for (let i = 0; i < aRows; i++) {
      for (let j = 0; j < bCols; j++) {
        result[i]![j] = 0;
      }
    }
  }

  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i]![k]! * b[k]![j]!;
      }
      result[i]![j] = sum;
    }
  }

  return result;
}
```

#### 4.2 `copyMatrix` - Replace map+spread with loops + add `out` parameter

**Current:**
```typescript
export function copyMatrix(m: MatrixND): MatrixND {
  return m.map(row => [...row]);
}
```

**Optimized:**
```typescript
export function copyMatrix(m: MatrixND, out?: MatrixND): MatrixND {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const result = out ?? new Array(rows);

  for (let i = 0; i < rows; i++) {
    if (!result[i]) {
      result[i] = new Array(cols);
    }
    for (let j = 0; j < cols; j++) {
      result[i]![j] = m[i]![j]!;
    }
  }
  return result;
}
```

---

### 5. rotation.ts

#### 5.1 `composeRotations` - Optimize with scratch matrix

The current implementation creates a new identity matrix and rotation matrices for each plane. For animation loops, this is called at 60fps.

**Current:**
```typescript
export function composeRotations(
  dimension: number,
  angles: Map<string, number>
): MatrixND {
  let result = createIdentityMatrix(dimension);
  // ... creates new matrices per rotation ...
  result = multiplyMatrices(result, rotationMatrix);
  // ...
}
```

**Optimized with `out` and scratch buffers:**
```typescript
// Module-level scratch matrices to avoid allocation
const scratchMatrices = new Map<number, { rotation: MatrixND; temp: MatrixND }>();

function getScratchMatrices(dimension: number): { rotation: MatrixND; temp: MatrixND } {
  let scratch = scratchMatrices.get(dimension);
  if (!scratch) {
    scratch = {
      rotation: createIdentityMatrix(dimension),
      temp: createIdentityMatrix(dimension),
    };
    scratchMatrices.set(dimension, scratch);
  }
  return scratch;
}

export function composeRotations(
  dimension: number,
  angles: Map<string, number>,
  out?: MatrixND
): MatrixND {
  if (dimension < 2) {
    throw new Error('Rotation requires at least 2 dimensions');
  }

  const result = out ?? createIdentityMatrix(dimension);

  // Reset to identity if reusing
  if (out) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        result[i]![j] = i === j ? 1 : 0;
      }
    }
  }

  if (angles.size === 0) {
    return result;
  }

  const validPlanes = getRotationPlanes(dimension);
  const validPlaneNames = new Set(validPlanes.map(p => p.name));
  const scratch = getScratchMatrices(dimension);

  for (const [planeName, angle] of angles.entries()) {
    if (!validPlaneNames.has(planeName)) {
      throw new Error(`Invalid plane name "${planeName}" for ${dimension}D space`);
    }

    const plane = validPlanes.find(p => p.name === planeName);
    if (!plane) {
      throw new Error(`Plane "${planeName}" not found`);
    }

    // Create rotation matrix in scratch buffer
    createRotationMatrixInto(
      scratch.rotation,
      dimension,
      plane.indices[0],
      plane.indices[1],
      angle
    );

    // Multiply: temp = result * rotation
    multiplyMatrices(result, scratch.rotation, scratch.temp);

    // Copy temp back to result
    copyMatrix(scratch.temp, result);
  }

  return result;
}

/**
 * Creates a rotation matrix directly into an output buffer
 */
function createRotationMatrixInto(
  out: MatrixND,
  dimension: number,
  planeIndex1: number,
  planeIndex2: number,
  angleRadians: number
): void {
  // Reset to identity
  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j < dimension; j++) {
      out[i]![j] = i === j ? 1 : 0;
    }
  }

  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);

  out[planeIndex1]![planeIndex1] = cos;
  out[planeIndex2]![planeIndex2] = cos;
  out[planeIndex1]![planeIndex2] = -sin;
  out[planeIndex2]![planeIndex1] = sin;
}
```

---

## Usage Updates Required

After implementing the optimizations, update the callers to use `out` parameters:

### useRotatedVertices.ts

```typescript
// Add scratch buffer
const scratchVerticesRef = useRef<VectorND[]>([]);

// In the map call, use scratch buffer:
const rotatedVertices = useMemo(() => {
  const scratch = scratchVerticesRef.current;
  if (scratch.length !== vertices.length) {
    scratchVerticesRef.current = vertices.map(v => new Array(v.length).fill(0));
    scratch = scratchVerticesRef.current;
  }
  for (let i = 0; i < vertices.length; i++) {
    multiplyMatrixVector(rotationMatrix, vertices[i]!, scratch[i]);
  }
  return [...scratch]; // New reference for React
}, [vertices, rotationMatrix]);
```

### useObjectTransformations.ts

Similar pattern - add scratch buffer and pass to `multiplyMatrixVector`.

---

## Implementation Order

### Phase 1: Zero-Allocation Updates (Breaking Nothing)
1. `dotProduct` - pure return value, no API change
2. `magnitude` - pure return value, no API change
3. `vectorsEqual` - pure return value, no API change

### Phase 2: Add `out` Parameters (Backward Compatible)
4. `subtractVectors` - add optional `out`
5. `scaleVector` - add optional `out`
6. `normalize` - add optional `out`
7. `copyVector` - add optional `out`
8. `translateVector` - add optional `out`
9. `toHomogeneous` - add optional `out`

### Phase 3: Matrix Operations
10. `multiplyMatrices` - add optional `out`
11. `copyMatrix` - add optional `out`

### Phase 4: Rotation Optimization
12. `composeRotations` - add `out` + scratch buffers + `createRotationMatrixInto`

### Phase 5: Projection Optimization
13. `sortByDepth` - use scratch arrays
14. `projectVertices` - add optional `out`

### Phase 6: Update Callers
15. Update `useRotatedVertices.ts` to use scratch buffers
16. Update `useObjectTransformations.ts` to use scratch buffers
17. Update `useTransformedVertices.ts` (already optimized, verify)
18. Update `useProjectedVertices.ts` (already optimized, verify)
19. Update `PointCloudScene.tsx` callers

---

## Testing Strategy

1. **Unit Tests:** All existing tests must pass (backward compatibility)
2. **Performance Tests:** Add benchmarks comparing allocation counts
3. **Visual Tests:** E2E tests to verify rendering unchanged
4. **Memory Profiling:** Use Chrome DevTools to verify reduced GC

---

## Estimated Impact

| Metric | Before | After (Est.) |
|--------|--------|--------------|
| Allocations per frame | ~500+ (many small arrays) | ~10-20 (buffer reuse) |
| GC pause frequency | Every ~50 frames | Every ~500+ frames |
| Time in math ops | 2-3ms/frame | 0.5-1ms/frame |

---

## Notes

- All `out` parameters are optional to maintain backward compatibility
- Scratch buffers are module-level singletons, safe for single-threaded JS
- TypedArrays (Float32Array) could provide further gains but would require type changes
- Consider `Float64Array` for precision-critical paths
