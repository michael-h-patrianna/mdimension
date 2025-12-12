# Clifford Tori in Higher Dimensions – Developer Guide

This document explains how to construct and render **Clifford tori** in your N-dimensional React + Three.js app for ambient dimensions `n` between **3 and 11**.

It covers:

1. The **classic 2D Clifford torus in 4D** (living in S³ ⊂ ℝ⁴)
2. **Higher-dimensional generalizations** (“generalized Clifford tori”) living in S²ᵏ⁻¹ ⊂ ℝ²ᵏ
3. How to embed these objects into **ambient dimension `n`** and render them via your existing nD → 3D pipeline

We assume the usual nD types:

```ts
export type NdPoint = number[];         // nD point
export interface NdMesh {
  dimension: number;
  vertices: NdPoint[];
  edges: [number, number][];
}
```

and your existing projection & rotation utilities.

---

## 1. Conceptual Overview

A **Clifford torus** is (roughly) a **product of circles** sitting on a **sphere** in a higher-dimensional space.

There are two levels of generality that matter for your app:

1. **Classic Clifford torus (2D in 4D):**
   - A 2-torus \(T^2 = S^1 	imes S^1\) lying on the 3-sphere S³ in ℝ⁴.
   - This is the object most people mean when they say “Clifford torus”.

2. **Generalized Clifford torus (k-torus in 2k dimensions):**
   - A k-torus \(T^k = (S^1)^k\) lying on the (2k−1)-sphere S²ᵏ⁻¹ in ℝ²ᵏ, with all circle radii equal.
   - The classic case is k = 2 (T² ⊂ S³ ⊂ ℝ⁴).

Your app can support:

- A **“Classic 4D Clifford torus” mode**, intrinsically 4-dimensional but embeddable in any ambient `n ≥ 4`.
- A **“Generalized Clifford Tᵏ” mode**, intrinsically 2k-dimensional, with `2k ≤ n`.

For `n = 3`, there is no true Clifford torus in the original sense; you can either:

- **Disable** Clifford torus modes, or
- Offer a separate 3D “ordinary torus” object with different math (not covered here).

---

## 2. Classic Clifford Torus in 4D (T² ⊂ S³ ⊂ ℝ⁴)

### 2.1 Definition

Let S³(R) be the 3-sphere of radius R in ℝ⁴. The **classic Clifford torus** is:

\[
egin{aligned}
x_1 &= rac{R}{\sqrt{2}} \cos u, \
x_2 &= rac{R}{\sqrt{2}} \sin u, \
x_3 &= rac{R}{\sqrt{2}} \cos v, \
x_4 &= rac{R}{\sqrt{2}} \sin v,
\end{aligned}
\quad u, v \in [0, 2\pi).
\]

This satisfies:

\[
x_1^2 + x_2^2 + x_3^2 + x_4^2 = R^2,
\]

so the surface lies on the 3-sphere of radius R.

### 2.2 Ambient dimension and embedding

Your app’s ambient dimension is `n ∈ [3, 11]`.

For the **classic 4D Clifford torus**:

- Only makes sense **intrinsically** for n ≥ 4.
- For `n = 4`: we use exactly the coordinates (x₁,…,x₄) above.
- For `n > 4`: we embed into ℝⁿ by **padding with zeros**:

  \[
  (x_1, x_2, x_3, x_4, 0, 0, \dots, 0) \in \mathbb{R}^n.
  \]

Therefore:

- **Enable this mode only when `n ≥ 4`.**
- For `n = 3`, hide/disable this object type.

### 2.3 UI options

Suggested options for **“Clifford torus (4D)”**:

- `radius: number` – radius R of S³ (default `1.0`).
- `stepsU: number` – resolution in u (e.g. 32–128).
- `stepsV: number` – resolution in v (e.g. 32–128).
- `edgeMode: "grid" | "none"`:
  - `"grid"`: connect neighbors in the (u,v) grid with wrap-around.
  - `"none"`: render as point cloud only.
- (Inherited) `n: number` – ambient dimension from global selector; must be ≥ 4.

### 2.4 Point generation

Config:

```ts
interface CliffordTorus4DConfig {
  n: number;     // ambient dimension, must be >= 4
  radius: number;
  stepsU: number;
  stepsV: number;
}
```

Implementation:

```ts
export function generateCliffordTorus4DPoints(
  config: CliffordTorus4DConfig
): NdPoint[] {
  const { n, radius, stepsU, stepsV } = config;

  if (n < 4) {
    throw new Error("Classic Clifford torus requires n >= 4");
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
      // p[4..n-1] remain 0

      points.push(p);
    }
  }

  return points;
}
```

### 2.5 Grid edges

To render as a wireframe, we connect each grid sample to its neighbors in `u` and `v`:

```ts
export function buildCliffordTorus4DGridEdges(
  stepsU: number,
  stepsV: number
): [number, number][] {
  const edges: [number, number][] = [];
  const index = (i: number, j: number) => i * stepsV + j;

  for (let i = 0; i < stepsU; i++) {
    for (let j = 0; j < stepsV; j++) {
      const iNext = (i + 1) % stepsU;
      const jNext = (j + 1) % stepsV;

      const idx  = index(i, j);
      const idxU = index(iNext, j);
      const idxV = index(i, jNext);

      if (idxU > idx) edges.push([idx, idxU]); // along u
      if (idxV > idx) edges.push([idx, idxV]); // along v
    }
  }

  return edges;
}
```

### 2.6 Packaging as NdMesh

```ts
export function generateCliffordTorus4DMesh(
  config: CliffordTorus4DConfig,
  edgeMode: "grid" | "none" = "grid"
): NdMesh {
  const vertices = generateCliffordTorus4DPoints(config);
  const edges =
    edgeMode === "grid"
      ? buildCliffordTorus4DGridEdges(config.stepsU, config.stepsV)
      : [];

  return {
    dimension: config.n,
    vertices,
    edges,
  };
}
```

---

## 3. Generalized Clifford Tori (Tᵏ ⊂ S²ᵏ⁻¹ ⊂ ℝ²ᵏ)

The classic Clifford torus is the special case `k = 2`. We can generalize this:

- Consider ℂᵏ ≅ ℝ²ᵏ, with coordinates \(z_1, \dots, z_k\).
- Consider the unit sphere S²ᵏ⁻¹:

  \[
  \sum_{m=1}^{k} |z_m|^2 = 1.
  \]

- The **generalized Clifford torus** is the subset where all |z_m| are *equal*:

  \[
  |z_1| = |z_2| = \dots = |z_k| = rac{1}{\sqrt{k}}.
  \]

We parametrize with angles θ₁,…,θ_k:

\[
z_m = rac{1}{\sqrt{k}} e^{i	heta_m}, \quad 	heta_m \in [0, 2\pi).
\]

In real coordinates, for m = 1…k:

\[
egin{aligned}
x_{2m-1} &= rac{1}{\sqrt{k}} \cos 	heta_m, \
x_{2m}   &= rac{1}{\sqrt{k}} \sin 	heta_m.
\end{aligned}
\]

This lies on the unit sphere S²ᵏ⁻¹ and is a **k-torus** \( T^k = (S^1)^k \).

For k = 2, these formulas reduce (up to an overall radius R) to the 4D case above.

### 3.1 Ambient dimension and embedding

Your app has ambient dimension `n ∈ [3, 11]`.

For a **generalized Clifford Tᵏ**:

- Its “natural” ambient dimension is `2k`.
- For given `n`, you must have `2k ≤ n`.
- A natural **default** is `k = floor(n / 2)` (maximal k) or allow the user to choose any k with `2k ≤ n`.

Embedding into ℝⁿ:

- Compute the 2k real coordinates as above.
- Pad with zeros in coordinates 2k..(n−1).

### 3.2 UI options

Object type: **“Generalized Clifford torus (Tᵏ)”**

Recommended options:

- `n: number` – ambient dimension (3–11).
- `k: number` – torus dimension:
  - Integer, `1 ≤ k ≤ floor(n / 2)`.
  - For k = 1 you get a circle S¹ on S¹ ⊂ ℝ² (a trivial case but harmless).
- `radiusScale: number` – optional global scaling of the sphere (default `1.0`).
  - The construction gives a torus on S²ᵏ⁻¹(1). You can scale all coordinates by `radiusScale` if you want a different radius.
- `stepsPerCircle: number` – angular resolution per θₘ (e.g. 8–32).
- Rendering mode:
  - Typically a **point cloud** (edges quickly explode in number).

### 3.3 Point generation

Config:

```ts
interface GeneralizedCliffordConfig {
  n: number;            // ambient dimension
  k: number;            // torus dimension, 1 <= k <= floor(n/2)
  stepsPerCircle: number;
  radiusScale: number;  // default 1.0
}
```

Implementation:

```ts
export function generateGeneralizedCliffordPoints(
  config: GeneralizedCliffordConfig
): NdPoint[] {
  const { n, k, stepsPerCircle, radiusScale } = config;

  if (k < 1) {
    throw new Error("k must be >= 1");
  }
  if (2 * k > n) {
    throw new Error("Need 2*k <= n for generalized Clifford torus");
  }

  const points: NdPoint[] = [];
  const baseRadius = 1 / Math.sqrt(k);    // each |z_m| = 1/sqrt(k)
  const R = baseRadius * radiusScale;     // optional global scale

  // We build a k-dimensional grid over angles θ_1..θ_k.
  function recurse(level: number, angles: number[]) {
    if (level === k) {
      const p = new Array(n).fill(0);

      for (let m = 0; m < k; m++) {
        const theta = angles[m];
        p[2 * m]     = R * Math.cos(theta); // x_{2m}
        p[2 * m + 1] = R * Math.sin(theta); // x_{2m+1}
      }

      points.push(p);
      return;
    }

    for (let s = 0; s < stepsPerCircle; s++) {
      const theta = (2 * Math.PI * s) / stepsPerCircle;
      recurse(level + 1, [...angles, theta]);
    }
  }

  recurse(0, []);

  return points;
}
```

**Point count:** `stepsPerCircle^k`.
For interactivity:

- Keep `k` modest (e.g. 1–3).
- Use moderate `stepsPerCircle` (e.g. 8–16 for k = 3).

### 3.4 Rendering strategy

Because the number of grid edges grows very fast with k, this object is best rendered as a **point cloud**:

1. Generate points with `generateGeneralizedCliffordPoints`.
2. Apply your existing nD rotations.
3. Project to 3D.
4. Render via `THREE.Points`.

If you really want edges, you can:

- Connect neighbors in each θₘ direction (generalization of the 2D grid), but:
  - You must manage combinatorial growth carefully.
  - For most visual purposes, a dense point cloud looks great and is simpler.

---

## 4. Integration in the App

You can support both the **classic 4D version** and **generalized higher-dimensional versions** under separate modes or object types.

### 4.1 Object type variants

Example object type enumeration:

```ts
type CliffordMode =
  | "clifford4D"         // classic T^2 in S^3 ⊂ R^4, embedded in R^n
  | "cliffordGeneral";   // generalized T^k in S^{2k-1} ⊂ R^{2k}, embedded in R^n
```

For ambient dimension `n`:

- Enable `"clifford4D"` only if `n >= 4`.
- Enable `"cliffordGeneral"` if `n >= 2` and you have a valid k with `2*k <= n` (k ≥ 1).

### 4.2 Typical construction flow

Given user selection:

```ts
function generateCliffordObject(
  mode: CliffordMode,
  n: number,
  options: any
): NdMesh | { dimension: number; points: NdPoint[] } {
  if (mode === "clifford4D") {
    // 2D torus in S^3 ⊂ R^4, embedded in R^n
    const mesh = generateCliffordTorus4DMesh(
      {
        n,
        radius: options.radius,
        stepsU: options.stepsU,
        stepsV: options.stepsV,
      },
      options.edgeMode
    );
    return mesh;
  }

  if (mode === "cliffordGeneral") {
    // k-dimensional torus T^k in S^{2k-1} ⊂ R^{2k}, embedded in R^n
    const points = generateGeneralizedCliffordPoints({
      n,
      k: options.k,
      stepsPerCircle: options.stepsPerCircle,
      radiusScale: options.radiusScale ?? 1.0,
    });

    return {
      dimension: n,
      points,
    };
  }

  throw new Error("Unsupported Clifford mode");
}
```

Rendering:

- If the result is an `NdMesh`: render edges as `LineSegments` and/or vertices as `Points`.
- If the result is a point cloud: render via `THREE.Points`.

In both cases:

1. Apply your existing nD rotation matrices to each `NdPoint`.
2. Project to 3D.
3. Use your existing Three.js geometry builder.

---

## 5. Summary

- The **classic Clifford torus** is a 2D torus in **4D** (T² ⊂ S³ ⊂ ℝ⁴).
  - In your app, it can be embedded into any ambient dimension `n ≥ 4` by padding zeros.
- There are **natural higher-dimensional generalizations**:
  - k-tori **Tᵏ** sitting on spheres S²ᵏ⁻¹ in ℝ²ᵏ with equal circle radii.
  - These can be embedded into any ambient dimension `n` satisfying `2k ≤ n`.
- For your app, it is convenient to support:
  - A **“Clifford torus (4D)”** mode (intrinsically 4D).
  - A **“generalized Clifford Tᵏ”** mode built from k angles and 2k coordinates.

This gives users both the familiar **4D Clifford torus** and a family of **higher-dimensional Clifford tori** that showcase increasingly complex projections as `n` (and k) increase.
