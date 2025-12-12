# Extended N‑Dimensional Objects in React + Three.js – Developer Guide

This document extends the main **N‑Dimensional Rendering in React + Three.js – Developer Guide** and describes how to **construct and render four additional families of n‑dimensional objects** in a React + Three.js app:

1. Hyperspheres (surface and solid)
2. Root system polytopes
3. Product manifolds (product polytopes and torus products)
4. Clifford torus in 4D embedded into higher dimensions

All objects are defined for **ambient dimension `n` between 3 and 11**, matching the app’s dimension selector.
It assumes the same core types and math utilities as the base guide:

```ts
export type NdPoint = number[];         // nD point
export interface NdMesh {
  dimension: number;
  vertices: NdPoint[];
  edges: [number, number][];
}
```

and the same projection pipeline (`NdProjectionConfig`, `projectNdTo3D`, etc.).

---

## 0. Shared Conventions

Before diving into each object family, we define some shared conventions.

### 0.1 Ambient dimension

- Let **`n`** be the current ambient dimension selected by the user.
- In this document, `n` is always in **[3, 11]**.
- Every generated vertex is an `NdPoint` of length `n`.

If a shape is naturally defined in fewer dimensions (e.g. 4D Clifford torus), we **embed it** into `n` dimensions by **padding with zeros** in unused coordinates, then let the nD rotation/projection pipeline handle the rest.

### 0.2 Mesh vs. point cloud

Not every object is naturally a polytope with a finite edge set. We’ll use:

- **NdMesh** for shapes that we represent as a graph (vertices + edges).
- **Point clouds** (just `NdPoint[]`) for shapes better rendered as **particles**.

You can still re‑use the projection helpers; only your Three.js geometry builder changes (points vs line segments).

A minimal point‑cloud type:

```ts
export interface NdPointCloud {
  dimension: number;
  points: NdPoint[];
}
```

### 0.3 User‑facing options

For each object we’ll recommend **UI options** and give the math/implementation to support them, e.g.:

- Resolution (sample count, grid steps)
- Radius / scaling
- Root system type
- Product factor dimensions
- etc.

---

## 1. Hyperspheres

### 1.1 Concept & ranges

A **hypersphere** in `n` dimensions (ambient) is:

- Either the **surface** (the (n‑1)‑sphere):
  \\( S^{n-1}(R) = \{ x \in \mathbb{R}^n : \lVert x \rVert = R \} \\)
- Or the **solid ball**:
  \\( B^{n}(R) = \{ x \in \mathbb{R}^n : \lVert x \rVert \le R \} \\)

Ambient `n` is the app dimension (3–11).

For interactive rendering, we approximate the sphere by:

- A **random or quasi‑random point cloud**, and optionally
- A **graph** by connecting nearby points (for a “wire” look).

### 1.2 User options

Suggested UI options for the “Hypersphere” object:

- `radius` (float; default 1.0)
- `mode`: `"surface"` | `"solid"`
- `sampleCount`: integer (e.g. 200–10,000)
- `samplingMethod`: `"gaussian"` | `"uniformBall"` (see below)
- `wireframeNeighbors`: integer `k` – if > 0, connect each point to its k nearest neighbors to generate edges (optional; O(N²) warning)
- `seed`: optional integer for deterministic pseudorandom sequences
- `colorByCoordinate`: toggle – color in Three.js based on one chosen coordinate or radius

### 1.3 Sampling the surface uniformly (Gaussian normalization)

To sample uniform points on \\( S^{n-1}(R) \\):

1. Sample each coordinate from a standard normal distribution \\( g_i \sim \mathcal{N}(0, 1) \\).
2. Form vector \\( g = (g_1, ..., g_n) \\).
3. Normalize: \\( x = R \cdot g / \lVert g \rVert \\).

This gives a uniform distribution on the hypersphere.

```ts
function randomNormal(seedState: { seed: number }): number {
  // Implement Box-Muller or use a seeded RNG lib; placeholder here:
  // Returns ~N(0,1). For now you can start with Math.random() and refactor later.
  const u1 = Math.random();
  const u2 = Math.random();
  const r = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return r * Math.cos(theta);
}

export function sampleHypersphereSurfacePoints(
  dimension: number,
  sampleCount: number,
  radius = 1
): NdPoint[] {
  const points: NdPoint[] = [];

  for (let k = 0; k < sampleCount; k++) {
    const g: number[] = [];
    for (let i = 0; i < dimension; i++) {
      g.push(randomNormal({ seed: 0 })); // replace with seeded RNG if needed
    }

    // compute norm
    let norm2 = 0;
    for (let i = 0; i < dimension; i++) norm2 += g[i] * g[i];
    const norm = Math.sqrt(norm2) || 1e-6;

    const x = g.map((v) => (radius * v) / norm);
    points.push(x);
  }

  return points;
}
```

### 1.4 Sampling a solid ball uniformly

To sample points uniformly inside \\( B^{n}(R) \\):

1. Sample a **surface point** `u` uniformly on the unit sphere `S^{n-1}(1)` as above.
2. Sample \\( t \sim U(0,1) \\).
3. Set \\( r = R \cdot t^{1/n} \\).
4. Return \\( x = r \cdot u \\).

```ts
export function sampleHypersphereSolidPoints(
  dimension: number,
  sampleCount: number,
  radius = 1
): NdPoint[] {
  const points: NdPoint[] = [];

  for (let k = 0; k < sampleCount; k++) {
    // 1) unit surface sample
    const u = sampleHypersphereSurfacePoints(dimension, 1, 1)[0];

    // 2) random radius with correct distribution
    const t = Math.random(); // or seeded
    const r = radius * Math.pow(t, 1 / dimension);

    // 3) scale
    const x = u.map((coord) => coord * r);
    points.push(x);
  }

  return points;
}
```

### 1.5 Optional wireframe: k‑nearest neighbor edges

For a “web” or “wire” effect, you can convert a point cloud into an `NdMesh` by connecting each point to its k nearest neighbors (in nD):

```ts
export function buildKnnEdges(
  points: NdPoint[],
  k: number
): [number, number][] {
  const n = points.length;
  const edges: [number, number][] = [];

  function dist2(a: NdPoint, b: NdPoint): number {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return s;
  }

  for (let i = 0; i < n; i++) {
    const dists: { j: number; d2: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      dists.push({ j, d2: dist2(points[i], points[j]) });
    }
    dists.sort((a, b) => a.d2 - b.d2);
    const neighbors = dists.slice(0, k);
    for (const { j } of neighbors) {
      if (j > i) edges.push([i, j]);
    }
  }

  return edges;
}
```

**Performance note:** This is O(N²). For large `sampleCount` you should:

- Cap N (e.g. 2000),
- Or approximate neighbors via spatial hashing / random subset.

### 1.6 Rendering in 3D

Use the existing `projectNdTo3D` helper to project each point to 3D, then:

- Render as **Points** (`THREE.Points`) for a particle cloud, or
- As **LineSegments** if you built edges.

```ts
const points3D = pointCloud.points.map((p) => projectNdTo3D(p, projConfig));
```

Everything else works exactly as in the base guide (buffer attributes, line or points material).

---

## 2. Root System Polytopes

### 2.1 Concept

A **root system** is a finite set of vectors (roots) in \\( \mathbb{R}^n \\) with strong symmetry properties. The **root polytope** is the convex hull of these roots.

We’ll support:

- Type **A\_{n‑1}** in dimension `n` (3–11)
- Type **D\_n** for `n ≥ 4`
- Special case **E\_8** when `n = 8` (precomputed coordinates)

These are mathematically interesting and visually rich as nD point sets projected to 3D.

### 2.2 User options

UI options for “Root system polytope”:

- `rootType`: `"A"` | `"D"` | `"E8"` (only enable `"E8"` when n = 8)
- `scale`: overall scale (float; default 1.0)
- `edgeMode`:
  - `"none"` – render only points
  - `"shortEdges"` – connect only nearest neighbors (based on minimal nonzero distance)
- `colorMode`:
  - `"bySignPattern"` – color roots by sign pattern or positive/negative root
  - `"byRootType"` – different colors for A/D/E (global)

### 2.3 A\_{n‑1} roots embedded in R^n

For ambient dimension `n`, we can realize the root system **A\_{n‑1}** as:

\[
\Phi(A\_{n-1}) = \{ e_i - e_j \;|\; 0 \le i \ne j < n \} \subset \mathbb{R}^n
\]

where `e_i` is the i‑th standard unit vector.

This yields `n * (n - 1)` roots of length \\( \sqrt{2} \\). We can rescale them to unit length if desired.

```ts
export function generateARoots(dimension: number, scale = 1): NdPoint[] {
  const n = dimension;
  const roots: NdPoint[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const v = new Array(n).fill(0);
      v[i] = 1;
      v[j] = -1;
      // Optional: normalize to unit length (sqrt(2)) and scale
      const len = Math.sqrt(2);
      for (let k = 0; k < n; k++) {
        v[k] = (v[k] / len) * scale;
      }
      roots.push(v);
    }
  }

  return roots;
}
```

### 2.4 D\_n roots in R^n (n ≥ 4)

For ambient dimension `n ≥ 4`, type **D\_n** has roots:

\[
\Phi(D\_n) = \{ \pm e_i \pm e_j \;|\; 0 \le i < j < n \}
\]

We can generate them with all four sign combinations and optionally normalize.

```ts
export function generateDRoots(dimension: number, scale = 1): NdPoint[] {
  const n = dimension;
  if (n < 4) {
    throw new Error("D_n is only defined for n >= 4");
  }

  const roots: NdPoint[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const signPairs: [number, number][] = [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
      for (const [si, sj] of signPairs) {
        const v = new Array(n).fill(0);
        v[i] = si;
        v[j] = sj;
        const len = Math.sqrt(2);
        for (let k = 0; k < n; k++) {
          v[k] = (v[k] / len) * scale;
        }
        roots.push(v);
      }
    }
  }

  return roots;
}
```

### 2.5 E\_8 roots in R^8 (n = 8 only)

For `dimension = 8`, you can optionally support **E\_8** roots:

- 240 roots in R^8 with specific coordinates (standard description).
- In practice, store them in a static JSON or TS file and just **load them**.

Example interface:

```ts
// e8-roots.ts
export const E8_ROOTS: NdPoint[] = [
  // 240 8D points here (omitted for brevity)
];
```

Then:

```ts
export function generateE8Roots(scale = 1): NdPoint[] {
  return E8_ROOTS.map((p) => p.map((x) => x * scale));
}
```

Enable `"E8"` root type only when `dimension === 8`.

### 2.6 Building edges: shortEdges mode

For visually meaningful edges without having to know the exact combinatorics of each root system, we can:

1. Compute all pairwise distances \\( d\_{ij} = \lVert v_i - v_j \rVert \\).
2. Find the **minimum nonzero distance** `dMin`.
3. Create an edge between i and j if \\( d\_{ij} \le dMin + \epsilon \\) for a small epsilon.

```ts
export function buildRootSystemEdges(
  vertices: NdPoint[],
  epsilonFactor = 0.01
): [number, number][] {
  const n = vertices.length;
  if (n === 0) return [];

  function dist2(a: NdPoint, b: NdPoint): number {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return s;
  }

  let minNonZero = Infinity;

  // First pass: find minimal non-zero distance
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d2 = dist2(vertices[i], vertices[j]);
      if (d2 > 1e-9 && d2 < minNonZero) {
        minNonZero = d2;
      }
    }
  }

  const threshold = Math.sqrt(minNonZero) * (1 + epsilonFactor);
  const edges: [number, number][] = [];

  // Second pass: add edges under threshold
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d2 = dist2(vertices[i], vertices[j]);
      if (Math.sqrt(d2) <= threshold) {
        edges.push([i, j]);
      }
    }
  }

  return edges;
}
```

### 2.7 Packaging as NdMesh and rendering

```ts
export type RootSystemType = "A" | "D" | "E8";

export function generateRootSystemMesh(
  dimension: number,
  rootType: RootSystemType,
  scale = 1,
  edgeMode: "none" | "shortEdges" = "shortEdges"
): NdMesh {
  let vertices: NdPoint[];

  if (rootType === "E8") {
    if (dimension !== 8) {
      throw new Error("E8 only available in dimension 8");
    }
    vertices = generateE8Roots(scale);
  } else if (rootType === "A") {
    vertices = generateARoots(dimension, scale);
  } else {
    vertices = generateDRoots(dimension, scale);
  }

  const edges =
    edgeMode === "shortEdges" ? buildRootSystemEdges(vertices) : [];

  return {
    dimension,
    vertices,
    edges,
  };
}
```

Then project and render exactly as for any other `NdMesh` (line segments or points).

---

## 3. Product Manifolds

“Product manifold” here means taking **cartesian products** of simpler shapes to form higher‑dimensional objects. We’ll cover two main families:

1. **Product polytopes** – e.g. hypercube × segment, simplex × square.
2. **Product tori** – multiple circles \\( (S^1)^k \) embedded in higher dimensions.

### 3.1 User options

Suggested UI options for “Product manifold”:

- `mode`: `"polytopeProduct"` | `"torusProduct"`
- For `"polytopeProduct"`:
  - `shapeA`: `"cube"` | `"simplex"`
  - `dimA`: integer ≥ 1
  - `shapeB`: `"cube"` | `"simplex"`
  - `dimB`: integer ≥ 1, with `dimA + dimB = n`
- For `"torusProduct"`:
  - `torusCount`: k (number of circles), with `2 * k <= n`
  - `radiusPerTorus`: number or array of numbers
  - `stepsPerTorus`: integer grid resolution per circle (e.g. 32)
- Common:
  - `scale`
  - `edgeMode` for polytopes: `"edgesAandB"` | `"none"` | `"fullGrid"`

---

### 3.2 Product polytopes: P × Q

Let:

- `P` be a polytope in \\( \mathbb{R}^{d_A} \) with vertices `p_i` and edges `E_P`.
- `Q` be a polytope in \\( \mathbb{R}^{d_B} \) with vertices `q_j` and edges `E_Q`.

The **cartesian product** \\( P \times Q \) lives in \\( \mathbb{R}^{d_A + d_B} \):

- Vertices: all pairs \\( (p_i, q_j) \\).
- Edges:
  - For each edge (p_i, p_k) in P and each vertex q_j in Q: edge between (p_i, q_j) and (p_k, q_j).
  - For each edge (q_j, q_l) in Q and each vertex p_i in P: edge between (p_i, q_j) and (p_i, q_l).

Implementation (assuming we already have generators for hypercube and simplex in lower dimensions):

```ts
export interface ProductPolytopeConfig {
  n: number; // ambient dimension
  dimA: number;
  dimB: number; // dimA + dimB must equal n
  shapeA: "cube" | "simplex";
  shapeB: "cube" | "simplex";
}

// Assumes generators for lower-dimensional shapes (e.g. 2..10):
// generateHypercube(dim), generateSimplex(dim)
export function generateProductPolytope(
  config: ProductPolytopeConfig
): NdMesh {
  const { n, dimA, dimB, shapeA, shapeB } = config;
  if (dimA + dimB !== n) {
    throw new Error("dimA + dimB must equal ambient dimension n");
  }

  const meshA =
    shapeA === "cube" ? generateHypercube(dimA) : generateSimplex(dimA);
  const meshB =
    shapeB === "cube" ? generateHypercube(dimB) : generateSimplex(dimB);

  const vertices: NdPoint[] = [];
  const edges: [number, number][] = [];

  const index = (i: number, j: number) => i * meshB.vertices.length + j;

  // 1) build vertices as concatenations (p, q)
  for (let i = 0; i < meshA.vertices.length; i++) {
    for (let j = 0; j < meshB.vertices.length; j++) {
      const p = meshA.vertices[i];
      const q = meshB.vertices[j];
      const v: NdPoint = new Array(n).fill(0);

      // First dimA coords from P
      for (let k = 0; k < dimA; k++) {
        v[k] = p[k] ?? 0;
      }
      // Next dimB coords from Q
      for (let k = 0; k < dimB; k++) {
        v[dimA + k] = q[k] ?? 0;
      }

      vertices.push(v);
    }
  }

  // 2) edges coming from edges of P
  for (const [i1, i2] of meshA.edges) {
    for (let j = 0; j < meshB.vertices.length; j++) {
      const a = index(i1, j);
      const b = index(i2, j);
      edges.push([a, b]);
    }
  }

  // 3) edges coming from edges of Q
  for (const [j1, j2] of meshB.edges) {
    for (let i = 0; i < meshA.vertices.length; i++) {
      const a = index(i, j1);
      const b = index(i, j2);
      edges.push([a, b]);
    }
  }

  return {
    dimension: n,
    vertices,
    edges,
  };
}
```

You can scale/rotate/translate this nD mesh using the existing matrix tools before projection.

---

### 3.3 Torus products: (S¹)ᵏ embedded in Rⁿ

We can form a **k‑torus** \\( T^k = (S^1)^k \) embedded in \\( \mathbb{R}^n \) with `2 * k <= n` by assigning **two coordinates per circle**:

For each circle j (0 ≤ j < k) with radius R_j and angle θ_j:

- \\( x_{2j}   = R_j \cos(\theta_j) \\)
- \\( x_{2j+1} = R_j \sin(\theta_j) \\)

All remaining coordinates (from 2k to n−1) are initially 0.

#### 3.3.1 Sampling grid points on (S¹)ᵏ

Let `stepsPerTorus` be the number of samples per circle. We sample a k‑dimensional grid over angles.

```ts
interface TorusProductConfig {
  n: number;           // ambient dimension
  k: number;           // number of circles, 2*k <= n
  radius: number | number[];  // per-circle radii
  stepsPerTorus: number;      // resolution per circle
}

export function generateTorusProductPoints(
  config: TorusProductConfig
): NdPoint[] {
  const { n, k, radius, stepsPerTorus } = config;
  if (2 * k > n) {
    throw new Error("Need 2*k <= n for torus product embedding");
  }

  const radii: number[] =
    typeof radius === "number"
      ? Array(k).fill(radius)
      : radius.slice(0, k);

  const points: NdPoint[] = [];

  // Recursive grid over k angles
  function recurse(level: number, angles: number[]) {
    if (level === k) {
      const v = new Array(n).fill(0);
      for (let j = 0; j < k; j++) {
        const theta = angles[j];
        const Rj = radii[j] ?? 1;
        v[2 * j] = Rj * Math.cos(theta);
        v[2 * j + 1] = Rj * Math.sin(theta);
      }
      points.push(v);
      return;
    }

    for (let s = 0; s < stepsPerTorus; s++) {
      const theta = (2 * Math.PI * s) / stepsPerTorus;
      recurse(level + 1, [...angles, theta]);
    }
  }

  recurse(0, []);

  return points;
}
```

> Note: The number of points grows as `stepsPerTorus^k`. For interactivity, keep `k` small (e.g. 1–3) and steps moderate.

You can similarly build edges by connecting neighbors in each angular coordinate, but for higher k we recommend rendering as a **point cloud**.

---

## 4. Clifford Torus in 4D Embedded into Higher D

### 4.1 Concept

The **Clifford torus** is a special, highly symmetric 2D torus sitting inside the 3‑sphere S³ in R⁴. In coordinates (x₁, x₂, x₃, x₄):

\[
\begin{aligned}
x_1 &= \tfrac{R}{\sqrt{2}} \cos u, \\
x_2 &= \tfrac{R}{\sqrt{2}} \sin u, \\
x_3 &= \tfrac{R}{\sqrt{2}} \cos v, \\
x_4 &= \tfrac{R}{\sqrt{2}} \sin v,
\end{aligned}
\]

where u, v ∈ [0, 2π).

This lies on the 3‑sphere of radius R in R⁴:

\[
x_1^2 + x_2^2 + x_3^2 + x_4^2 = R^2.
\]

We then embed this 4D object into ambient **dimension n ≥ 4** by padding with zeros.

For **n = 3**, we recommend **disabling this shape** or falling back to a regular 3D torus (different math). To keep semantics clean, the simplest rule is: **Clifford torus only available for n ∈ [4, 11]**.

### 4.2 User options

UI options for “Clifford torus”:

- `radius` R (default 1.0)
- `stepsU`, `stepsV` – grid resolution (e.g. 64 × 64)
- `n` (ambient dimension, from global app selector; must be ≥ 4)
- `edgeMode`:
  - `"grid"` – connect neighbors in the (u,v) grid with wrap-around
  - `"none"` – points only
- Optional: `colorMode` `"byU"` | `"byV"` | `"byCurvatureApprox"` (the latter is just a visual trick; true curvature is constant)

### 4.3 Generating 4D coordinates

We first generate the 4D torus (R⁴), then embed into Rⁿ.

```ts
interface CliffordTorusConfig {
  n: number; // ambient dimension, >= 4
  radius: number;
  stepsU: number;
  stepsV: number;
}

export function generateCliffordTorusPoints(
  config: CliffordTorusConfig
): NdPoint[] {
  const { n, radius, stepsU, stepsV } = config;
  if (n < 4) {
    throw new Error("Clifford torus requires ambient dimension >= 4");
  }

  const points: NdPoint[] = [];
  const factor = radius / Math.sqrt(2); // R / sqrt(2)

  for (let i = 0; i < stepsU; i++) {
    const u = (2 * Math.PI * i) / stepsU;
    const cu = Math.cos(u);
    const su = Math.sin(u);

    for (let j = 0; j < stepsV; j++) {
      const v = (2 * Math.PI * j) / stepsV;
      const cv = Math.cos(v);
      const sv = Math.sin(v);

      const p = new Array(n).fill(0);
      p[0] = factor * cu;
      p[1] = factor * su;
      p[2] = factor * cv;
      p[3] = factor * sv;
      // coordinates 4..(n-1) remain 0 initially

      points.push(p);
    }
  }

  return points;
}
```

### 4.4 Building grid edges (optional)

If `edgeMode = "grid"`, we connect each grid point to its neighbors in u and v, with wrap‑around.

We index grid positions as `idx = i * stepsV + j`.

```ts
export function buildCliffordTorusGridEdges(
  stepsU: number,
  stepsV: number
): [number, number][] {
  const edges: [number, number][] = [];

  const index = (i: number, j: number) => i * stepsV + j;

  for (let i = 0; i < stepsU; i++) {
    for (let j = 0; j < stepsV; j++) {
      const iNext = (i + 1) % stepsU;
      const jNext = (j + 1) % stepsV;

      const idx = index(i, j);
      const idxU = index(iNext, j);
      const idxV = index(i, jNext);

      // Edge along u
      if (idxU > idx) edges.push([idx, idxU]);
      // Edge along v
      if (idxV > idx) edges.push([idx, idxV]);
    }
  }

  return edges;
}
```

### 4.5 Packaging and rendering

```ts
export function generateCliffordTorusMesh(
  config: CliffordTorusConfig,
  edgeMode: "grid" | "none" = "grid"
): NdMesh {
  const points = generateCliffordTorusPoints(config);
  const edges =
    edgeMode === "grid"
      ? buildCliffordTorusGridEdges(config.stepsU, config.stepsV)
      : [];

  return {
    dimension: config.n,
    vertices: points,
    edges,
  };
}
```

Once you have the `NdMesh`, the rest is:

1. Apply nD transforms (rotations, etc.).
2. Project to 3D using `projectNdTo3D`.
3. Build a Three.js `BufferGeometry` for lines or points.

---

## 5. Integration Checklist

To integrate these shapes into the existing app:

1. **Reuse base types and utilities**
   - `NdPoint`, `NdMesh`
   - Matrix utilities: identity, multiply, plane rotations, etc.
   - Projection: `NdProjectionConfig`, `projectNdTo3D` fileciteturn0file0

2. **Add new generators**
   - Hypersphere:
     - `sampleHypersphereSurfacePoints`
     - `sampleHypersphereSolidPoints`
     - (optional) `buildKnnEdges`
   - Root systems:
     - `generateARoots`
     - `generateDRoots`
     - `generateE8Roots` (if you include E8)
     - `buildRootSystemEdges`
     - `generateRootSystemMesh`
   - Product manifolds:
     - `generateProductPolytope`
     - `generateTorusProductPoints`
   - Clifford torus:
     - `generateCliffordTorusPoints`
     - `buildCliffordTorusGridEdges`
     - `generateCliffordTorusMesh`

3. **Wire to UI**
   - Add an “Object type” dropdown including:
     - `Hypercube`, `Simplex`, etc. (existing)
     - `Hypersphere`
     - `Root system`
     - `Product manifold`
     - `Clifford torus`
   - For each type, show the relevant option controls described above.
   - Disable incompatible options (e.g. E8 when `n != 8`; Clifford torus when `n < 4`).

4. **Rendering modes**
   - For meshes with edges (root systems, product polytopes, Clifford torus):
     - render as `LineSegments`, optionally also as `Points`.
   - For pure point clouds (hypersphere, torus products with high k):
     - render as `Points` only.

5. **Performance tips**
   - Cap sample counts / grid resolutions for interactive framerates.
   - Avoid O(N²) neighbor computations for N > ~2000 (or approximate).
   - Precompute static root systems like E8 at build time.

With these generators and options in place, your app becomes a small **higher‑dimensional geometry lab**, capable of visualizing key objects from both **pure math** and **higher‑dimensional physics** in 3D through nD rotations and projections.
