# Option A (Hyperbulb): “Mandelbulb-style” fractal for 4D–11D (developer-friendly guide)

This guide explains how to extend your **3D Mandelbulb** idea to **any dimension D (2–11)** using **hyperspherical coordinates**.

You will:
1. Implement a **dimension-agnostic “power” function** `powMap(v, power)` for vectors in **D dimensions**.
2. Iterate like Mandelbrot: `v = powMap(v) + c`, starting from `v = 0`.
3. Visualize **a 3D slice/projection** of the D-dimensional parameter space.

No heavy math background required—follow the steps and copy the code snippets.

---

## 0) What you’re building

- **2D**: Mandelbrot set uses complex numbers.
- **3D**: Mandelbulb fakes “power” using spherical coordinates.
- **4D–11D (Option A)**: do the same in **hyperspherical coordinates**.

You are defining a *family* of fractals that “feel like” Mandelbulb in higher dimensions.

---

## 1) Values you need (parameters)

These are the values your app needs to run and render the higher-dimensional set.

### A. Fractal parameters
- **`D`**: dimension (integer), **2..11**
- **`power`**: exponent (float or int), common values:
  - `8` is classic for Mandelbulb-style shapes
  - `2` behaves more “quadratic” but still not the classic 2D Mandelbrot beyond 2D
- **`maxIter`**: maximum iterations, typical **30–200**
- **`bailout`**: escape radius threshold, typical **2–16**
  - Start with `bailout = 4` or `8` for stability in higher D
- **`epsilon`**: tiny number to avoid division by zero (e.g., `1e-12`)

### B. Viewing (how you map the D-dimensional space into something you can see)
You can’t directly “see” >3D. You must choose a mapping.

**Recommended simplest approach (Slice):**
- Choose which 3 dimensions become **x, y, z** (indices)
  - example: dims `[0,1,2]` map to x/y/z
- Fix the remaining dimensions to constants:
  - **`slice[]`**: array length `D`, where non-view dims have fixed values
  - example for 6D: `slice = [?, ?, ?, 0, 0, 0]` and the first three are filled per voxel/pixel

**Alternative approach (Linear projection):**
- Provide a 3×D projection matrix (or 3 orthonormal basis vectors)
- `p3 = P * vD`
- This is more flexible but harder to make intuitive at first

You’ll implement Slice first (recommended), then optionally add Projection.

### C. Sampling / volume parameters (for 3D rendering)
If you render a 3D volume (marching cubes / raymarch):
- **`gridSize`**: voxel resolution per axis (e.g., 64, 96, 128)
- **`bounds`**: region in “view space” (x/y/z) to sample, e.g.:
  - `min = [-2, -2, -2]`, `max = [2, 2, 2]`
- **`isoLevel`**: threshold for your isosurface (if using marching cubes)

---

## 2) Core iteration (Mandelbrot-style, but vector-valued)

We define the set in D dimensions via the iteration:

- Start: `v = (0,0,...,0)` (D components)
- For n in [0..maxIter):
  - `v = powMap(v, power) + c`
  - if `||v|| > bailout`, the point **escapes**

Here:
- `v` is the iterated state (D-dimensional vector)
- `c` is the parameter point (also D-dimensional) you’re testing

This matches the Mandelbrot pattern: “orbit of 0 under f_c”.

---

## 3) Hyperspherical coordinates (what you actually implement)

### 3.1 The idea
For a D-dimensional vector `v = [x0, x1, ... x(D-1)]`:
- radius: `r = sqrt(x0^2 + x1^2 + ... + x(D-1)^2)`
- angles: `theta[0..D-2]` (there are **D-1 angles**)

Then the “power” map is:
- `r' = r^power`
- `theta'[i] = theta[i] * power` for all angles
- convert back to Cartesian

This mirrors how the Mandelbulb does it in 3D.

### 3.2 Why this works for any D
Hyperspherical coordinates exist for any dimension. We’re using them as a convenient way to define a “rotate + scale” behavior that generalizes the 3D bulb method.

---

## 4) TypeScript implementation

Below is a practical implementation you can drop into a React/Three.js project.

### 4.1 Vector helpers

```ts
export function norm(v: Float32Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

export function addInto(out: Float32Array, a: Float32Array, b: Float32Array) {
  for (let i = 0; i < out.length; i++) out[i] = a[i] + b[i];
}

export function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
```

### 4.2 Convert Cartesian → hyperspherical (angles)

This produces:
- `r`
- `theta[0..D-2]`

Notes:
- This is the “standard” hyperspherical convention.
- We compute a sequence of “remaining norms” to avoid messy formulas.
- Last angle uses `atan2` to cover the full circle.

```ts
export type Hyper = { r: number; theta: Float32Array };

/**
 * Convert D-dim Cartesian vector to hyperspherical coordinates.
 * D must be >= 2.
 */
export function toHyperspherical(v: Float32Array, eps = 1e-12): Hyper {
  const D = v.length;
  const theta = new Float32Array(D - 1);

  // r = ||v||
  let r2 = 0;
  for (let i = 0; i < D; i++) r2 += v[i] * v[i];
  const r = Math.sqrt(r2);

  if (r < eps) {
    // Angles undefined at origin; choose 0s for stability.
    return { r: 0, theta };
  }

  // Compute angles theta[0..D-3] via arccos(x_i / ||tail||)
  // where tail norm is sqrt(x_i^2 + ... + x_{D-1}^2).
  let tail2 = r2;
  for (let i = 0; i < D - 2; i++) {
    // tail norm includes v[i..D-1]
    const tail = Math.sqrt(Math.max(tail2, eps));
    const c = clamp(v[i] / tail, -1, 1);
    theta[i] = Math.acos(c);

    // remove v[i]^2 from tail2 for next step
    tail2 -= v[i] * v[i];
  }

  // Last angle theta[D-2] is atan2(last, second last)
  theta[D - 2] = Math.atan2(v[D - 1], v[D - 2]);

  return { r, theta };
}
```

### 4.3 Convert hyperspherical → Cartesian

```ts
/**
 * Convert hyperspherical coords back to D-dim vector.
 * Uses the same convention as toHyperspherical().
 */
export function fromHyperspherical(r: number, theta: Float32Array): Float32Array {
  const D = theta.length + 1;
  const out = new Float32Array(D);

  if (D === 2) {
    // 2D polar
    out[0] = r * Math.cos(theta[0]);
    out[1] = r * Math.sin(theta[0]);
    return out;
  }

  // Build products of sines progressively
  // x0 = r cos(t0)
  // x1 = r sin(t0) cos(t1)
  // x2 = r sin(t0) sin(t1) cos(t2)
  // ...
  // x_{D-2} = r * prod_{k=0..D-3} sin(tk) * cos(t_{D-2})
  // x_{D-1} = r * prod_{k=0..D-3} sin(tk) * sin(t_{D-2})
  let prod = 1;

  for (let i = 0; i < D - 2; i++) {
    const ti = theta[i];
    out[i] = r * prod * Math.cos(ti);
    prod *= Math.sin(ti);
  }

  // last two coordinates use the last angle
  const tLast = theta[D - 2];
  out[D - 2] = r * prod * Math.cos(tLast);
  out[D - 1] = r * prod * Math.sin(tLast);

  return out;
}
```

### 4.4 The power map `powMap(v, power)`

```ts
/**
 * Hyperbulb-style power map in D dimensions:
 * 1) convert v -> (r, theta[])
 * 2) r' = r^power
 * 3) theta'[i] = theta[i] * power
 * 4) convert back
 */
export function powMap(v: Float32Array, power: number, eps = 1e-12): Float32Array {
  const { r, theta } = toHyperspherical(v, eps);

  if (r < eps) {
    // 0 stays 0 under the power map
    return new Float32Array(v.length);
  }

  const rP = Math.pow(r, power);
  const thetaP = new Float32Array(theta.length);
  for (let i = 0; i < theta.length; i++) thetaP[i] = theta[i] * power;

  return fromHyperspherical(rP, thetaP);
}
```

### 4.5 Escape-time function for a parameter point `c`

```ts
export function escapeTime(
  c: Float32Array,
  power: number,
  maxIter: number,
  bailout: number,
  eps = 1e-12
): number {
  const D = c.length;
  let v = new Float32Array(D); // starts at 0

  for (let i = 0; i < maxIter; i++) {
    const vP = powMap(v, power, eps);
    // v = vP + c
    for (let k = 0; k < D; k++) v[k] = vP[k] + c[k];

    if (norm(v) > bailout) return i; // escaped at iteration i
  }
  return maxIter; // did not escape
}
```

Use the returned value in shading:
- `escapeIter < maxIter` → outside
- `escapeIter == maxIter` → inside (or likely inside)

---

## 5) How to map D dimensions into a 3D display

This is the part that confuses people most, so here are **two concrete approaches**.

### Approach 1 (recommended): 3D slice of the D-dimensional parameter space

Think of the set as living in **D-dimensional c-space**.

To *see it*, you choose:
- three coordinates that vary: **x/y/z**
- the rest are constants: a **slice**

#### 5.1 Choose the view dimensions
Example for D=6:
- view dims = `[0, 1, 2]` meaning:
  - `c[0] = x`
  - `c[1] = y`
  - `c[2] = z`
- fixed slice dims `[3,4,5]`:
  - `c[3] = slice3`
  - `c[4] = slice4`
  - `c[5] = slice5`

#### 5.2 Construct `c` from a voxel position
Suppose you sample a voxel at `(x, y, z)`.
You build the D-dimensional parameter point like this:

```ts
export function makeCFromSlice(
  D: number,
  viewDims: [number, number, number],
  slice: Float32Array, // length D, contains fixed values; you can ignore indices in viewDims
  x: number,
  y: number,
  z: number
): Float32Array {
  const c = new Float32Array(D);
  c.set(slice);
  c[viewDims[0]] = x;
  c[viewDims[1]] = y;
  c[viewDims[2]] = z;
  return c;
}
```

#### 5.3 Rendering pipeline (volume)
1. Loop over a 3D grid (voxels).
2. For each voxel center `(x,y,z)`:
   - create `c = makeCFromSlice(...)`
   - compute `t = escapeTime(c, ...)`
3. Convert `t` into a density/scalar value, e.g.:
   - `density = 1 - t/maxIter`
4. Use:
   - **Marching Cubes** to create a mesh, or
   - **Raymarching** in a shader through a 3D texture

**This produces a real 3D object**—a slice of the D-dimensional set.

#### 5.4 Why slicing is great
- Easy mental model
- Stable and debuggable
- You can let users scroll extra dimensions:
  - sliders for `slice[3]..slice[D-1]`

---

### Approach 2: Linear projection from D dimensions down to 3D

Instead of fixing extra dimensions, you “squash” them into 3D:

\na 3×D matrix **P**:
- `p3.x = dot(P0, vD)`
- `p3.y = dot(P1, vD)`
- `p3.z = dot(P2, vD)`

#### 5.5 When projection helps
- You want the user to “rotate” in higher dimensions
- You want a single view that mixes all dimensions

#### 5.6 Minimal implementation
Define three basis vectors in D dimensions:

```ts
export type Basis3 = { bx: Float32Array; by: Float32Array; bz: Float32Array };

export function projectTo3(v: Float32Array, B: Basis3): [number, number, number] {
  const dot = (a: Float32Array, b: Float32Array) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  };
  return [dot(B.bx, v), dot(B.by, v), dot(B.bz, v)];
}
```

**Important:** If you use projection for the *parameter space* `c`, it’s not enough by itself.
You must decide what 3D points you sample from (a 3D grid in projected space?) and how to invert that into D dims (generally not possible uniquely).

So projection is most useful for:
- projecting **state vectors** (for visualization/debug)
- or projecting **a slice** result after you already defined a 3D slice in D dims

**Recommendation:** implement slicing first. Add projection later as a “view transform” on top.

---

## 6) Common gotchas (and how to avoid them)

### A. Origin / near-origin instability
At `r ≈ 0` the angles are undefined. We handle this by:
- returning `r=0` and angles=0 in `toHyperspherical`
- making `powMap(0) = 0`

### B. `acos` input drift
Floating-point errors can push values slightly outside [-1,1]. Always clamp.

### C. Bailout tuning
Higher D can “escape faster” or behave differently. If everything escapes instantly:
- increase `bailout`
- reduce `power`
- reduce sample bounds (zoom in)

### D. Performance
3D volumes are expensive:
- start with `gridSize=48` or `64`
- keep `maxIter` around `40–80`
- consider GPU compute (fragment shader / compute shader) later

---

## 7) Suggested defaults for a good first result

Try these as starter settings:

- `D = 4..11`
- `power = 8`
- `maxIter = 60`
- `bailout = 8`
- `bounds = [-2,2]` in each view axis
- `viewDims = [0,1,2]`
- `slice[k] = 0` for k >= 3
- Add sliders for slice dims in range `[-2,2]`

---

## 8) What “4D Mandelbrot” means in your UI

If your UI says “Mandelbrot” for D>2, consider labeling it as:
- **“Hyperbulb (Mandelbulb generalization)”**
or
- **“Mandelbrot-like (hyperspherical power)”**

Because it’s not the canonical Mandelbrot set anymore (that’s uniquely defined in 2D complex numbers).

---

## 9) Next steps (if you want nicer surfaces)
If you want smoother surfaces and prettier renders:
- implement **smooth escape-time coloring**
- consider a **distance estimator** (more math, but better raymarching)
- accelerate sampling on the GPU

If you want, tell me your current 3D pipeline (marching cubes vs raymarch shader vs points),
and I can tailor a concrete “drop-in” implementation for that pipeline (including recommended scalar fields and iso levels).
