# Math Core Performance Hyper-Optimization TODOs (React + Three.js + Zustand)

This TODO list is organized by **importance** and grouped by file. Each item includes **what to change**, **why**, and **notes on how** (implementation direction).

> Goal: **maximum runtime performance in browsers (Mac/Windows/Linux)** with minimal GC pressure and predictable JIT behavior.

---

## Importance Legend

- **P0 (Critical):** Likely to yield the largest wins in frame time + GC reductions.
- **P1 (High):** Strong wins, especially at scale (many vertices / high FPS).
- **P2 (Medium):** Useful improvements; do after P0/P1.
- **P3 (Low):** Polish, clarity, or niche scenarios.

---

## P0 (Critical) — Do These First

### 1) Replace allocation-heavy array methods in hot paths with tight loops + `out` parameters

**Files:** `vector.ts`, `transform.ts`, `projection.ts`, `matrix.ts` (some parts), `rotation.ts` (validation structures)

**What**
- Replace `map`, `reduce`, `every`, spread (`[...]`), intermediate arrays/objects created in loops with:
  - `for` loops
  - optional `out` arrays/typed arrays
  - reuse scratch buffers where practical

**Why**
- These functional helpers create **allocations** and can lead to **GC spikes** and reduced JIT optimization.
- Tight loops with stable shapes are the fastest pattern in JS engines.

**How (direction)**
- Any function used per-vertex/per-frame should support:
  - `out?: VectorND` / `out?: MatrixND`
  - or have a separate `Into()` variant like `multiplyMatricesInto(out, a, b)`.

---

### 2) Introduce `multiplyMatricesInto(out, a, b)` and eliminate intermediate matrix allocations in composition

**Files:** `matrix.ts`, `transform.ts`, `rotation.ts`

**What**
- Implement `multiplyMatricesInto(out, a, b)` and a `swap`-based composition strategy:
  - `tmp` and `result` buffers reused through loops
- Update:
  - `composeTransformations()` (in `transform.ts`)
  - `composeRotations()` (in `rotation.ts`) **if it must output a matrix**

**Why**
- Current composition patterns create a new matrix on every multiply → heavy GC + time.
- Reuse buffers → stable frame time and lower memory churn.

**How (direction)**
- Provide:
  - `createZeroMatrix(rows, cols)` (existing) for initial allocation
  - then repeatedly fill `out` and swap references.

---

### 3) Add a “write directly into Three.js buffers” projection API (no `Vector3D[]` allocations)

**Files:** `projection.ts`

**What**
- Add function(s) like:
  - `projectVerticesToPositions(vertices, positionsFloat32Array, ...)`
- Write projected `(x,y,z)` directly into a `Float32Array` suitable for `BufferAttribute.array`.

**Why**
- Creating `Vector3D[]` each frame is expensive (allocation + GC).
- Three.js prefers mutable typed arrays for geometry attributes.

**How (direction)**
- `positions[i*3 + 0] = x; positions[i*3 + 1] = y; positions[i*3 + 2] = z;`

---

### 4) Gate dimension validation + warnings behind `DEV` and keep production fast

**Files:** `matrix.ts`, `vector.ts`, `rotation.ts`, `transform.ts`, `projection.ts`

**What**
- Move argument validation out of hot paths, or guard checks like:
  - `if (import.meta.env.DEV) { ... }`

**Why**
- Dimension checks and string building (warnings/errors) can become a hidden per-frame tax.
- Keep correctness checks in dev; assume correctness in production.

---

## P1 (High) — Big Wins After P0

### 5) Avoid building rotation matrices for per-vertex rotation; apply plane rotations directly

**Files:** `rotation.ts` (and potentially a new `rotation_fast.ts`)

**What**
- Add a fast function that applies plane rotations *in place* on vectors or vertex buffers:
  - For each plane `(i, j)` with angle `θ`:
    - `xi = v[i]; xj = v[j];`
    - `v[i] = xi*cos - xj*sin;`
    - `v[j] = xi*sin + xj*cos;`

**Why**
- Building NxN matrices and multiplying vectors is far more expensive than direct plane updates.
- Direct plane rotation is typically the fastest for N-D rotation.

**How (direction)**
- Provide two APIs:
  - `applyPlaneRotationsInPlace(vector, rotations)`
  - `applyPlaneRotationsToVerticesInPlace(vertices, rotations)` or to flat typed buffers.

---

### 6) Cache rotation plane metadata by dimension (memoization)

**Files:** `rotation.ts`

**What**
- Memoize `getRotationPlanes(dimension)` and the plane-name-to-indices mapping.

**Why**
- Current `composeRotations()` recomputes planes and `Set`s each call.
- Rotation plane metadata is deterministic per dimension.

**How (direction)**
- Module-level `Map<number, { planes, nameToIndices }>`.

---

### 7) Optimize `multiplyMatrices` loop ordering and caching (even before flattening)

**Files:** `matrix.ts`

**What**
- Change triple loop ordering from `i-j-k` to `i-k-j`
- Cache row references (`aRow`, `bRow`, `rRow`)

**Why**
- Better cache locality and fewer property lookups in JS.

**How (direction)**
- `for i` → `for k` → `for j` with `rRow[j] += aRow[k] * bRow[j]`.

---

### 8) Replace per-frame object allocation in `sortByDepth`

**Files:** `projection.ts`

**What**
- Replace `[{index, depth}, ...]` allocation with:
  - reusable index array + depth array
- Sort indices by depth without allocating objects.

**Why**
- Sorting should avoid generating N temporary objects per frame.
- Object allocation during sort can become significant at vertex counts.

**How (direction)**
- Maintain:
  - `indices: Uint32Array | number[]` reused
  - `depths: Float32Array` reused
- Sort `indices` with a comparator that uses `depths[idx]`.

---

## P2 (Medium) — Good Improvements / Cleanup

### 9) Convert homogeneous helpers to `out` + avoid them when not necessary

**Files:** `transform.ts`

**What**
- Update:
  - `toHomogeneous(vector, out?)`
  - `fromHomogeneous(vector, out?)`
- Ensure they don’t use spread or allocate on every call.

**Why**
- Homogeneous conversion is easy to make allocation-free.
- In many pipelines, you may not need homogeneous vectors at all.

---

### 10) Reduce small allocations in scaling helpers

**Files:** `transform.ts`

**What**
- Change `createUniformScaleMatrix` to write diagonal directly (avoid `new Array().fill()`).
- Provide `createUniformScaleMatrixInto(out, dimension, scale)` if used often.

**Why**
- Small allocations add up in render loops.

---

### 11) Avoid building/reversing arrays of matrices in `createTransformMatrix`

**Files:** `transform.ts`

**What**
- Remove `matrices.push(...)` + `reverse()` pattern if in hot path.
- Prefer directly multiplying in the required order using scratch buffers.

**Why**
- Minimizes intermediate allocations and extra passes.

---

### 12) Projection-distance and depth calculations: avoid `sqrt` where possible

**Files:** `projection.ts`

**What**
- Where only ordering is needed (sorting), use depth² (no `Math.sqrt`).
- Inline `abs/max` loops if `calculateProjectionDistance` is called frequently.

**Why**
- Avoiding `sqrt` in large loops reduces CPU time.

---

### 13) Make `clipLine` allocation-free

**Files:** `projection.ts`

**What**
- Replace returning `{ shouldDraw, v1, v2 }` objects with:
  - return code `0|1` and write into `outV1/outV2`
  - or return boolean + mutate `out`

**Why**
- Avoid transient objects in geometry-heavy scenes.

---

### 14) Determinant: restrict usage or replace with LU for large dimensions

**Files:** `matrix.ts`

**What**
- Mark current Laplace expansion determinant as “slow” and avoid runtime usage for N>4.
- If needed for runtime on larger matrices, implement LU decomposition (O(n³)).

**Why**
- Current approach scales extremely poorly and can stall frames.

---

## P3 (Low) — Optional / Structural Refactors

### 15) Major refactor: move to typed arrays + flat matrices for the entire core

**Files:** `types.ts`, `vector.ts`, `matrix.ts`, `transform.ts`, `rotation.ts`, `projection.ts`, `index.ts`

**What**
- Replace:
  - `VectorND = number[]` with `Float32Array`/`Float64Array`
  - `MatrixND = number[][]` with flat `Float32Array`/`Float64Array` (length `n*n`)
- Add a “compat layer” if existing code expects arrays.

**Why**
- Best possible cache locality, smallest overhead, and easiest interoperability with Three.js buffers.
- Enables more advanced optimizations later (SIMD-friendly layout, fewer bounds checks).

**How (direction)**
- Introduce parallel “fast” types:
  - `type Vec = Float32Array`
  - `type Mat = Float32Array`
- Add new functions without breaking the old API:
  - `mulMatVecFlat(out, mat, vec, n)`
  - `mulMatMatFlat(out, a, b, n)`

---

### 16) Provide “batch” APIs that operate on flat vertex buffers

**Files:** `projection.ts`, `transform.ts`, `rotation.ts`

**What**
- Add APIs that transform many vertices in one call:
  - `transformVerticesNDToPositions(...)`
  - `applyRotationPlanesToVertexBuffer(...)`

**Why**
- Batch functions reduce call overhead and enable better loop optimizations.
- Best match for rendering pipelines.

---

## Concrete Per-File TODO Breakdown

### `vector.ts`
- **P0:** Rewrite hot ops to use loops and optional `out`:
  - `subtractVectors`, `scaleVector`, `dotProduct`, `magnitude`, `vectorsEqual`, `copyVector`
- **P1:** Add `addInPlace`, `scaleInPlace` variants if frequently used in place
- **P2:** Ensure all new/updated ops have `DEV` dimension guards only

---

### `matrix.ts`
- **P0:** Add `multiplyMatricesInto(out, a, b)` + reuse buffers in composition callers
- **P1:** Optimize `multiplyMatrices` with `i-k-j` ordering + row caching
- **P2:** Add `identityInto(out)` and `zeroInto(out)` helpers (reduce allocations)
- **P2:** Guard dimension checks with `DEV`
- **P2:** Mark Laplace determinant as slow; optionally implement LU determinant for large N

---

### `transform.ts`
- **P0:** Replace allocation-heavy `translateVector`, `toHomogeneous` (spread), `fromHomogeneous` (alloc) with loop + `out`
- **P0:** Update `composeTransformations` to use `multiplyMatricesInto` + scratch swap
- **P2:** Remove `reverse()`/array build in `createTransformMatrix` if used per-frame
- **P2:** Optimize uniform scaling matrix creation (no `fill` array)

---

### `rotation.ts`
- **P1:** Add fast plane-rotation in-place APIs (avoid matrix creation for per-vertex paths)
- **P1:** Memoize `getRotationPlanes` and name→indices maps by dimension
- **P0/P1:** Gate validation and Set creation behind `DEV`
- **P0/P1:** If matrices still needed, use `multiplyMatricesInto` + scratch swap

---

### `projection.ts`
- **P0:** Add `projectVerticesToPositions()` writing directly into `Float32Array`
- **P1:** Rewrite `sortByDepth` to avoid `{index, depth}` allocations; reuse buffers
- **P2:** Avoid `sqrt` for sorting (depth²)
- **P2:** Make `clipLine` allocation-free (out params / return codes)

---

### `types.ts`
- **P3:** Introduce optional “fast types”:
  - `Vec = Float32Array`, `Mat = Float32Array`
- **P0/P1:** Ensure type-level changes don’t force runtime allocations

---

### `index.ts`
- **P2/P3:** Re-export both “classic” and “fast” APIs clearly:
  - `export * from './vector'`
  - `export * from './vector_fast'` (if you choose to split)
- **P2:** Document which functions are intended for render-time loops

---

## React + Three.js + Zustand Integration TODOs (Non-math but crucial)

### A) Keep render buffers out of Zustand state
- **P0:** Store `Float32Array` vertex buffers in refs (or Three.js geometry attributes), not in Zustand state updates per frame.
- **Why:** Zustand updates trigger React subscription overhead; per-frame state updates can kill performance.

### B) Mutate `BufferAttribute.array` and set `needsUpdate = true`
- **P0:** Use your new projection/transforms to write into `geometry.attributes.position.array`.
- **Why:** This is the fast path for Three.js dynamic geometry.

### C) Avoid per-frame allocations in `useFrame`
- **P0:** Preallocate scratch arrays / buffers once; reuse each frame.
- **Why:** Prevent GC spikes and keep frame time stable.

---

## Acceptance Criteria (for “done”)

- No `map/reduce/every/spread` in hot-path math functions used per-frame.
- Composition routines reuse buffers (no intermediate matrix allocations).
- Vertex projection/transformation can write directly into a `Float32Array` positions buffer.
- Dimension validation is `DEV`-only in hot paths.
- Rotation can be applied without building matrices (plane-rotation fast path).
- Profiling shows reduced allocations/frame and improved stable FPS under load.

---

## Suggested Implementation Order (Fastest ROI)

1. **P0 vector/transform loop rewrites + out params**
2. **P0 multiplyMatricesInto + update composition functions**
3. **P0 projectVerticesToPositions buffer write**
4. **P1 plane-rotation in place + memoized plane metadata**
5. **P1 sortByDepth rewrite**
6. **P2 cleanup tasks**
7. **P3 typed-array + flat-matrix refactor (optional major upgrade)**

