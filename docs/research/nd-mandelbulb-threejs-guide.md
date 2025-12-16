
# N‑Dimensional Mandelbulb Sets in React + Three.js – Developer Guide

This guide explains, from a **developer perspective**, how to:

1. Understand **Mandelbulb-like sets** beyond 2D.
2. Define a **practical n‑dimensional Mandelbulb function** for dimensions 3–11.
3. **Project** 3D–11D Mandelbulb sets into 3D space.
4. Render them with **Three.js** in a **React** app (ideally via React Three Fiber).

The goal is not to be mathematically perfect, but to give you a **clean, pluggable architecture** you can experiment with.

---

## 1. Quick Recap: Classic 2D Mandelbulb

### 1.1 Definition

For a complex number \(c \in \mathbb{C}\):

- Start with \(z_0 = 0\).
- Iterate:
  \[ z_{n+1} = z_n^2 + c \]
- The **Mandelbulb set** is the set of all \(c\) where the sequence \((z_n)\) stays bounded.

In practice, for each pixel representing a candidate point \(c\):

1. Run the iteration up to `maxIter` steps.
2. If \(|z_n| > R` (escape radius, often `R = 2.0`) at some step `n`, we say it **escaped**, and we store the escape iteration.
3. If it never escapes, we treat `c` as “inside” (or “near”) the set.

### 1.2 Why this generalizes nicely

Three concepts generalize very well to higher dimensions:

- **State** \(z_n\) is just a vector in some space.
- **Update rule** \(z_{n+1} = f(z_n, c)\) is a function from that space to itself.
- **Escape criterion** uses some norm \(\|z_n\|\) and a radius `R`.

We can keep these ideas and change the underlying space from \(\mathbb{C}\) (2D) to \(\mathbb{R}^D\) (D dimensions).

---

## 2. Representing N‑Dimensional Numbers in Code

We’ll work with plain numeric arrays:

```ts
export type NdPoint = number[]; // length = dimension, e.g. 4D: [x, y, z, w]

export interface NdMandelbulbParams {
  dimension: number;      // D between 3 and 11
  maxIter: number;        // e.g. 50–300
  escapeRadius: number;   // e.g. 4.0
}
```

Basic vector helpers:

```ts
export function ndZero(dimension: number): NdPoint {
  return new Array(dimension).fill(0);
}

export function ndAdd(a: NdPoint, b: NdPoint): NdPoint {
  const d = a.length;
  const out = new Array(d);
  for (let i = 0; i < d; i++) out[i] = a[i] + (b[i] ?? 0);
  return out;
}

export function ndNorm2(a: NdPoint): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
  return Math.sqrt(sum);
}
```

---

## 3. A Practical N‑Dimensional Mandelbulb Map

There are many mathematically sophisticated nD generalizations (multicomplex, Clifford algebras, quaternions, etc.).

For implementation, it’s often easier to define a **Mandelbulb‑like** function:

\[
z_{n+1} = F(z_n, c)
\]

where:

- `z` and `c` are **D‑dimensional vectors**.
- `F` is a nonlinear function that mixes components and has at least quadratic growth.

### 3.1 A simple, configurable map

Here’s one practical choice:

1. Interpret the first two coordinates as a complex number.
2. Apply the classic complex square there.
3. Apply 1D quadratic maps (with some coupling) on the remaining coordinates.

```ts
// z, c are D-dimensional vectors
export function mandelbulbStepND(z: NdPoint, c: NdPoint): NdPoint {
  const d = z.length;
  if (d < 2) {
    throw new Error("Need dimension >= 2 for complex core");
  }

  const [zx, zy] = z;
  const [cx, cy] = c;

  // classic complex square for first two coords
  const zx2 = zx * zx - zy * zy;
  const zy2 = 2 * zx * zy;

  const out: NdPoint = new Array(d);
  out[0] = zx2 + cx;
  out[1] = zy2 + cy;

  // remaining dimensions: simple coupled quadratics
  for (let i = 2; i < d; i++) {
    const zi = z[i];
    const ci = c[i];
    const coupling = zx * zi - zy * ci; // mild cross‑interaction
    out[i] = zi * zi - ci * ci + ci + 0.1 * coupling;
  }

  return out;
}
```

This is not “the” unique nD Mandelbulb but:

- It **reduces** to classic Mandelbulb if only the first 2 dimensions vary.
- Higher coordinates add richness and extra structure.
- It keeps the API simple: just swap out this function to experiment with different maps.

### 3.2 Escape iteration function

```ts
export function mandelbulbEscapeTimeND(
  c: NdPoint,
  params: NdMandelbulbParams,
  stepFn = mandelbulbStepND
): number {
  const { dimension, maxIter, escapeRadius } = params;
  if (c.length !== dimension) {
    throw new Error("c has wrong dimension");
  }

  let z = ndZero(dimension);
  const R = escapeRadius;

  for (let iter = 0; iter < maxIter; iter++) {
    z = stepFn(z, c);
    if (ndNorm2(z) > R) {
      return iter; // escaped at this iteration
    }
  }

  return maxIter; // treat as inside / near the set
}
```

You now have an **n‑dimensional Mandelbulb evaluator**.

---

## 4. From D‑Dimensional Space to 3D: Projection

You can’t “see” an 11D set directly, so you must:

1. Treat the D‑dimensional parameter \(c \in \mathbb{R}^D\) as fundamental.
2. For visualization, create a **3D slice** or **projection** of this space.
3. Map that slice into 3D coordinates for Three.js.

### 4.1 Projection configuration

```ts
export type Vec3 = [number, number, number];

export interface NdProjectionConfig {
  dimension: number;           // D
  axes: [number, number, number]; // which indices map to x,y,z
  depthAxis?: number;          // optional axis used for perspective
  depthDistance?: number;      // camera distance for depthAxis
}
```

### 4.2 Orthographic projection (drop extra axes)

Simplest: just pick three axes and ignore the rest:

```ts
export function projectNdTo3D_ortho(
  p: NdPoint,
  config: NdProjectionConfig
): Vec3 {
  const { axes } = config;
  return [
    p[axes[0]] ?? 0,
    p[axes[1]] ?? 0,
    p[axes[2]] ?? 0,
  ];
}
```

### 4.3 Perspective along a depth axis

To get a more “3D” feel, use an extra coordinate as depth:

```ts
export function projectNdTo3D(
  p: NdPoint,
  config: NdProjectionConfig
): Vec3 {
  const { axes, depthAxis, depthDistance = 4 } = config;
  const x = p[axes[0]] ?? 0;
  const y = p[axes[1]] ?? 0;
  const z = p[axes[2]] ?? 0;

  if (depthAxis == null) {
    return [x, y, z];
  }

  const w = p[depthAxis] ?? 0; // depth coordinate
  const denom = depthDistance - w;
  const safe = Math.abs(denom) < 1e-6 ? 1e-6 : denom;

  return [x / safe, y / safe, z / safe];
}
```

**Examples**:

- 3D Mandelbulb variant (D = 3): `axes = [0, 1, 2]`, `depthAxis = undefined` (no perspective).
- 4D: `axes = [0, 1, 2]`, `depthAxis = 3` (use the 4th coordinate for perspective).
- 11D: `axes = [0, 1, 2]`, `depthAxis = 3` or any index 3–10.

---

## 5. Building 3D Slices of 3D–11D Mandelbulb Sets

Three.js needs **3D positions** and some scalar per point (for color/intensity). We’ll construct those from samples of the D‑dimensional space.

### 5.1 Choosing a slice

For a given dimension `D` (3 ≤ D ≤ 11):

- Pick three axes you want to see: `axes = [a, b, c]`.
- Treat the coordinates along these axes as the 3D **world space**.
- Treat the remaining axes as **parameters** controlled by UI (sliders, time, etc.).

For a sample point `(x, y, z)` in world space:

1. Build a D‑dimensional vector `c`:
   - `c[a] = x`
   - `c[b] = y`
   - `c[c] = z`
   - For `k` not in `{a, b, c}`: `c[k] = param[k]` (user controls / animation).
2. Pass `c` into `mandelbulbEscapeTimeND`.
3. Use escape time to derive color/intensity.

This gives you a **3D slice** of the D‑dimensional Mandelbulb set.

### 5.2 Sampling strategies

There are two main ways to visualize in Three.js:

1. **Point cloud** (simpler, good for exploration).
2. **Isosurface mesh** (marching cubes over a 3D grid).

#### 5.2.1 Point cloud

For each sample point in a 3D grid or random 3D distribution:

- Compute `c` and its escape time.
- If inside / near the set, spawn a point (or use instancing).

```ts
interface SampleResult {
  position: Vec3;
  value: number; // e.g. normalized escape time
}

export function sampleSlicePointCloud(
  samples: Vec3[],                // 3D positions in world space
  params: NdMandelbulbParams,
  projection: (c: NdPoint) => Vec3,
  buildC: (world: Vec3) => NdPoint // maps world -> D-dimensional c
): SampleResult[] {
  return samples.map((world) => {
    const c = buildC(world);
    const t = mandelbulbEscapeTimeND(c, params);
    const value = t / params.maxIter;

    const pos = projection(c); // or projection(world) depending on design

    return { position: pos, value };
  });
}
```

You can also choose to project `world` directly and only use `c` for the escape computation. Both are valid; choose what looks better.

#### 5.2.2 Volume + marching cubes

For more solid structures:

1. Define a 3D grid in world space.
2. For each grid cell center, compute `c`, then get a scalar value (e.g. `value = t / maxIter`).
3. Treat values near inside as low (e.g. 0) and outside as high (e.g. 1).
4. Run marching cubes on that scalar field to generate a mesh.

This is heavier but yields a **surface** instead of points.

---

## 6. Wiring It into Three.js + React

### 6.1 Storing sampled data

For a point cloud, you can precompute positions + colors in JS and feed them to a Three.js `BufferGeometry`.

```ts
import * as THREE from 'three';

interface PointCloudBuildInput {
  samples: SampleResult[]; // from sampleSlicePointCloud
}

export function buildPointCloudGeometry(
  input: PointCloudBuildInput
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];

  for (const { position, value } of input.samples) {
    const [x, y, z] = position;
    positions.push(x, y, z);

    // simple gradient: inside (blue) -> outside (yellow)
    const r = value;
    const g = value;
    const b = 1 - value;
    colors.push(r, g, b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );

  return geometry;
}
```

### 6.2 React Three Fiber component for a D‑dimensional Mandelbulb slice

Here’s an example component that:

- Uses a 4D Mandelbulb (`dimension = 4`).
- Uses axes `[0,1,2]` as world coordinates (x, y, z).
- Treats the 4th coordinate as a parameter controlled by a prop.
- Renders a point cloud.

```tsx
// NdMandelbulbPointCloud.tsx
import React, { useMemo } from 'react';
import { Points } from '@react-three/drei';
import * as THREE from 'three';
import {
  NdMandelbulbParams,
  mandelbulbEscapeTimeND,
  ndZero,
} from './nd-mandelbulb-core';
import { buildPointCloudGeometry } from './pointcloud';

interface NdMandelbulbPointCloudProps {
  dimension: number;           // e.g. 4–11
  axisIndices: [number, number, number]; // which D-dim axes map to x,y,z
  paramValues: number[];       // length D, values for non-spatial axes
  params: NdMandelbulbParams;
  sampleCountPerAxis?: number; // e.g. 32
  extent?: number;             // world extent, e.g. 2 => [-2,2]^3
}

export const NdMandelbulbPointCloud: React.FC<NdMandelbulbPointCloudProps> = ({
  dimension,
  axisIndices,
  paramValues,
  params,
  sampleCountPerAxis = 32,
  extent = 2,
}) => {
  const geometry = useMemo(() => {
    const [ax, ay, az] = axisIndices;

    // pre-generate world sample points on a cubic grid
    const samplesWorld: [number, number, number][] = [];
    for (let ix = 0; ix < sampleCountPerAxis; ix++) {
      for (let iy = 0; iy < sampleCountPerAxis; iy++) {
        for (let iz = 0; iz < sampleCountPerAxis; iz++) {
          const tX = ix / (sampleCountPerAxis - 1);
          const tY = iy / (sampleCountPerAxis - 1);
          const tZ = iz / (sampleCountPerAxis - 1);

          const x = -extent + 2 * extent * tX;
          const y = -extent + 2 * extent * tY;
          const z = -extent + 2 * extent * tZ;

          samplesWorld.push([x, y, z]);
        }
      }
    }

    // map world -> D-dim c
    const buildC = (world: [number, number, number]): NdPoint => {
      const [x, y, z] = world;
      const c = [...paramValues];
      while (c.length < dimension) c.push(0); // ensure correct length

      c[ax] = x;
      c[ay] = y;
      c[az] = z;

      return c;
    };

    // evaluate Mandelbulb on the slice
    const sampleResults = samplesWorld.map((world) => {
      const c = buildC(world);
      const t = mandelbulbEscapeTimeND(c, params);
      const value = t / params.maxIter;

      return { position: world as [number, number, number], value };
    });

    return buildPointCloudGeometry({ samples: sampleResults });
  }, [
    dimension,
    axisIndices[0],
    axisIndices[1],
    axisIndices[2],
    paramValues,
    params.dimension,
    params.maxIter,
    params.escapeRadius,
    sampleCountPerAxis,
    extent,
  ]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.03}
        vertexColors
        sizeAttenuation
      />
    </points>
  );
};
```

Usage example in a React Three Fiber scene:

```tsx
// Scene.tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NdMandelbulbPointCloud } from './NdMandelbulbPointCloud';

export function Scene() {
  const dimension = 5; // anything 3–11
  const params = {
    dimension,
    maxIter: 80,
    escapeRadius: 4,
  };

  // paramValues: initial values for all 5 dimensions
  // indices 0,1,2 will be overridden by world x,y,z
  const paramValues = [0, 0, 0, 0.3, -0.1];

  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} />

      <NdMandelbulbPointCloud
        dimension={dimension}
        axisIndices={[0, 1, 2]} // x,y,z
        paramValues={paramValues}
        params={params}
        sampleCountPerAxis={28}
        extent={2}
      />

      <OrbitControls />
    </Canvas>
  );
}
```

You can wire UI (sliders, time, etc.) to:

- `paramValues` (to move through higher dimensions).
- `dimension` (switch between 3D, 4D, …, 11D).
- `params.maxIter` and `params.escapeRadius` (detail level & structure).

---

## 7. Dimension‑Specific Notes (3D → 11D)

### 7.1 3D Mandelbulb‑like sets (D = 3)

Two common options:

1. **Direct 3D vector map**: just use `dimension = 3` and treat all 3 coords like the generic formula above.
2. **Mandelbulb style** (if you want classic 3D fractal):
   - Convert `(x, y, z)` into spherical coordinates.
   - Raise radius and angle by some power.
   - Convert back and add `c`.

The core & projection pipeline from above still works.

### 7.2 4D Mandelbulb‑like sets (D = 4)

- Use axes `[0,1,2]` as spatial, axis `3` as param/depth.
- You can also use `depthAxis = 3` in `projectNdTo3D` to get perspective along the 4th dimension.

### 7.3 5D–11D

For higher D:

- Choose 3 axes for spatial display.
- Treat the rest as parameters, e.g. controlled by sliders or time.
- Optionally assign one of the remaining axes as the `depthAxis` for perspective.

This lets you **fly through** different slices of a high‑dimensional Mandelbulb space by animating extra coordinates.

---

## 8. Performance Tips

- Start with a **low resolution** grid (e.g. 24³ samples) and increase only when needed.
- Precompute and **cache** results when parameters don’t change.
- Use **InstancedBufferGeometry** instead of standalone meshes per point.
- For heavier exploration, consider moving iteration to a **Web Worker** or even a **WebGL shader** (ray marching / 3D textures).

---

## 9. Implementation Checklist

For a working 3D–11D Mandelbulb visualization:

1. **Core math**
   - [ ] Implement `NdPoint`, `NdMandelbulbParams`.
   - [ ] Implement `ndZero`, `ndAdd`, `ndNorm2`.
   - [ ] Implement `mandelbulbStepND(z, c)`.
   - [ ] Implement `mandelbulbEscapeTimeND(c, params)`.

2. **Projection**
   - [ ] Implement `NdProjectionConfig`.
   - [ ] Implement orthographic `projectNdTo3D_ortho`.
   - [ ] Implement perspective `projectNdTo3D` (optional).

3. **Sampling & data**
   - [ ] Implement 3D world sample generation (grid or random points).
   - [ ] Implement `buildC(world)` mapping world space → D‑dimensional `c`.
   - [ ] Compute escape times, normalize to `[0,1]` values.

4. **Three.js integration**
   - [ ] Build a `BufferGeometry` for a point cloud or surface.
   - [ ] Render with React Three Fiber in a `<Canvas>`.
   - [ ] Add UI control for:
     - Dimension `D`.
     - Non‑spatial parameters (`paramValues`).
     - `maxIter`, `escapeRadius`, etc.

Once this is in place, you can experiment with different **n‑dimensional Mandelbulb maps**, projections, and rendering styles while keeping the same reusable architecture.
