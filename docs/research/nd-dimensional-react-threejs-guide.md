
# N‑Dimensional Rendering in React + Three.js – Developer Guide

This document gives **practical, step‑by‑step instructions** for:

1. Creating common **n‑dimensional (nD) objects** (e.g. hypercubes).
2. Applying **transformations** in nD (translate, scale, rotate, shear/skew).
3. **Projecting** the result down to 3D so it can be rendered with **Three.js** in a **React** app.

It is a condensed, implementation‑focused version of our internal n‑dimensional rendering research. fileciteturn0file0

---

## 1. Data Model: How We Represent N‑Dimensional Geometry

### 1.1 Points and objects

We represent an nD point as a simple numeric array:

```ts
// nD point, e.g. 4D: [x, y, z, w]
export type NdPoint = number[];

// A mesh is just vertices + edges between them
export interface NdMesh {
  dimension: number;
  vertices: NdPoint[];      // length = vertexCount
  edges: [number, number][]; // pairs of vertex indices
}
```

You can extend `NdMesh` later with faces, cells, etc., but **vertices + edges** is enough to render wireframes and reason about transformations.

### 1.2 Homogeneous coordinates (optional)

For general nD math we can keep everything as **pure nD vectors** and use **n×n matrices**.

We only need **homogeneous (n+1)D coordinates** when you want:

- Perspective projection built into a matrix, or
- Coupling translation into matrix multiplication.

For now, we will:
- Use **n×n matrices** for rotations/scales/shears.
- Apply **translation** as `p' = p + t` (vector add).
- Do **projection** in code, not in a matrix.

This is easier to implement and reason about and still matches the math in the long document.

---

## 2. Creating N‑Dimensional Objects

### 2.1 N‑cube (hypercube)

An n‑cube has **2ⁿ vertices**. Each vertex is all combinations of coordinates in `{‑1, +1}`:

```ts
// Generate vertices for an n-dimensional hypercube in [-1, 1]^n
export function generateHypercubeVertices(dimension: number): NdPoint[] {
  const vertexCount = 1 << dimension; // 2^dimension
  const vertices: NdPoint[] = [];

  for (let i = 0; i < vertexCount; i++) {
    const v: NdPoint = [];
    for (let bit = 0; bit < dimension; bit++) {
      const isOne = (i >> bit) & 1;
      v.push(isOne ? 1 : -1);
    }
    vertices.push(v);
  }

  return vertices;
}

// Generate edges: connect vertices that differ in exactly one coordinate
export function generateHypercubeEdges(dimension: number): [number, number][] {
  const vertexCount = 1 << dimension;
  const edges: [number, number][] = [];

  for (let i = 0; i < vertexCount; i++) {
    for (let bit = 0; bit < dimension; bit++) {
      const j = i ^ (1 << bit); // flip one bit
      if (j > i) {
        edges.push([i, j]);
      }
    }
  }

  return edges;
}

export function generateHypercube(dimension: number): NdMesh {
  return {
    dimension,
    vertices: generateHypercubeVertices(dimension),
    edges: generateHypercubeEdges(dimension),
  };
}
```

This gives you an **nD hypercube** for any `dimension ≥ 2` (e.g. 4D tesseract when `dimension = 4`).

### 2.2 Other objects (optional)

- **n‑simplex** (triangle / tetrahedron / pentachoron / …) – smallest fully‑connected polytope in nD.
- **Custom data** – any array of n‑vectors can use the **same transform + projection** pipeline as the hypercube.

For now, if you only need a hypercube, you can skip simplexes.

---

## 3. N‑Dimensional Linear Algebra Utilities

We’ll implement minimal helpers for:

- Matrix creation (identity, rotation, scale, shear).
- Matrix × vector multiplication.
- Matrix × matrix multiplication.

All matrices are **square n×n**, represented as `number[][]` (row‑major).

```ts
export type NdMatrix = number[][]; // shape: [n][n]

export function identityMatrix(n: number): NdMatrix {
  const m: NdMatrix = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0);
    row[i] = 1;
    m.push(row);
  }
  return m;
}

export function multiplyMatrixVector(m: NdMatrix, v: NdPoint): NdPoint {
  const n = m.length;
  const result = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += m[i][j] * v[j];
    }
    result[i] = sum;
  }
  return result;
}

export function multiplyMatrices(a: NdMatrix, b: NdMatrix): NdMatrix {
  const n = a.length;
  const result = identityMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}
```

---

## 4. N‑Dimensional Transformations

We’ll cover:

- **Translation**
- **Scaling**
- **Rotation (plane rotations)**
- **Shear / skew**

All transformations keep you in **nD**. Projection to 3D comes later.

### 4.1 Translation

Simple vector addition:

```ts
export function translatePoint(p: NdPoint, t: NdPoint): NdPoint {
  return p.map((v, i) => v + (t[i] ?? 0));
}

export function translateMesh(mesh: NdMesh, t: NdPoint): NdMesh {
  return {
    ...mesh,
    vertices: mesh.vertices.map((v) => translatePoint(v, t)),
  };
}
```

### 4.2 Scaling

Diagonal matrix with scale factors:

```ts
export function scalingMatrix(scale: NdPoint): NdMatrix {
  const n = scale.length;
  const m = identityMatrix(n);
  for (let i = 0; i < n; i++) {
    m[i][i] = scale[i];
  }
  return m;
}
```

Uniform scale is just `scale = Array(n).fill(s)`.

### 4.3 Rotation – Givens rotations (plane rotations)

In nD, the simplest building block is a **rotation in a 2D coordinate plane** `(i, j)` by angle `θ`:

For coordinates `(x_i, x_j)`:

```text
x'_i =  cosθ * x_i - sinθ * x_j
x'_j =  sinθ * x_i + cosθ * x_j
```

Everything else stays the same.

We encode that as a matrix:

```ts
// Rotation in plane (i, j) by angle theta (radians)
export function planeRotationMatrix(
  dimension: number,
  i: number,
  j: number,
  theta: number
): NdMatrix {
  const m = identityMatrix(dimension);
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  // rows i,j, cols i,j
  m[i][i] = c;
  m[i][j] = -s;
  m[j][i] = s;
  m[j][j] = c;

  return m;
}
```

To build a **full nD rotation**, multiply several plane rotations together once, then apply the **combined matrix** to all vertices:

```ts
// Example: 4D rotation using XY, XW, ZW planes
export function rotation4DComposite(
  angles: { xy?: number; xw?: number; zw?: number }
): NdMatrix {
  const n = 4;
  let R = identityMatrix(n);

  if (angles.xy) {
    R = multiplyMatrices(planeRotationMatrix(n, 0, 1, angles.xy), R);
  }
  if (angles.xw) {
    R = multiplyMatrices(planeRotationMatrix(n, 0, 3, angles.xw), R);
  }
  if (angles.zw) {
    R = multiplyMatrices(planeRotationMatrix(n, 2, 3, angles.zw), R);
  }

  return R;
}
```

Apply to a mesh:

```ts
export function transformMeshWithMatrix(mesh: NdMesh, m: NdMatrix): NdMesh {
  return {
    ...mesh,
    vertices: mesh.vertices.map((v) => multiplyMatrixVector(m, v)),
  };
}
```

### 4.4 Shear / Skew

A shear shifts one coordinate in proportion to another, e.g.:

```text
x' = x + s * y
y' = y
```

In matrix form, this is identity plus one off‑diagonal entry:

```ts
// Shear dimension `target` by `source` with factor `s`.
// Example in 3D: target=0 (x), source=1 (y) gives x' = x + s*y
export function shearMatrix(
  dimension: number,
  target: number,
  source: number,
  s: number
): NdMatrix {
  const m = identityMatrix(dimension);
  m[target][source] = s;
  return m;
}
```

You can compose multiple shears by multiplying their matrices just like rotations.

---

## 5. Projecting N‑Dimensional Points to 3D

Three.js wants **3D positions**. Our pipeline:

1. Start with an **nD mesh**.
2. Apply **nD transforms** (matrices + translations).
3. **Project nD → 3D in JavaScript**.
4. Give resulting 3D vertices to **Three.js** (which then does 3D → 2D with the camera).

### 5.1 Simple “drop dimensions” projection (orthographic)

For data where extra dimensions are just “attributes” and not spatial depth, you can:

- Keep the first 3 coordinates as `(x, y, z)`.
- Ignore the rest.

```ts
export type Vec3 = [number, number, number];

export function projectNdTo3D_orthographic(p: NdPoint): Vec3 {
  return [
    p[0] ?? 0,
    p[1] ?? 0,
    p[2] ?? 0,
  ];
}
```

This corresponds to an **orthographic projection** that “looks” along higher dimensions.

### 5.2 4D → 3D perspective projection

For 4D (x, y, z, w), a standard perspective projection uses `w` as a **depth** in 4D and “camera distance” `d`:

```text
x' = x / (d - w)
y' = y / (d - w)
z' = z / (d - w)
```

Implementation:

```ts
export function project4DTo3D_perspective(
  p: NdPoint,
  d = 4 // distance of 4D camera along +w
): Vec3 {
  const [x, y, z, w = 0] = p;
  const denom = d - w;
  const safeDenom = Math.abs(denom) < 1e-6 ? 1e-6 : denom;

  return [
    x / safeDenom,
    y / safeDenom,
    z / safeDenom,
  ];
}
```

**How to generalize for nD:**

- Pick one dimension as the “4D‑like depth” to divide by (e.g. last dimension).
- Optionally run **multiple projections** (nD → 4D → 3D) if you need more structure, but in most cases **nD → 3D in one step** by choosing three “visual” axes and one “depth” axis is enough.

### 5.3 Generic configurable projection helper

Make a configurable projection that can handle both orthographic and perspective:

```ts
export interface NdProjectionConfig {
  dimension: number;         // n
  axes: [number, number, number]; // which axes map to x,y,z (e.g. [0,1,2])
  depthAxis?: number;        // if set, use perspective along this axis
  depthDistance?: number;    // "camera distance" for that axis
}

export function projectNdTo3D(
  p: NdPoint,
  config: NdProjectionConfig
): Vec3 {
  const { axes, depthAxis, depthDistance = 4 } = config;

  const x = p[axes[0]] ?? 0;
  const y = p[axes[1]] ?? 0;
  const z = p[axes[2]] ?? 0;

  if (depthAxis == null) {
    // orthographic
    return [x, y, z];
  }

  const w = p[depthAxis] ?? 0;
  const denom = depthDistance - w;
  const safeDenom = Math.abs(denom) < 1e-6 ? 1e-6 : denom;

  return [x / safeDenom, y / safeDenom, z / safeDenom];
}
```

**Examples:**

- 4D tesseract: `axes = [0,1,2]`, `depthAxis = 3`.
- 5D data: `axes = [0,1,2]`, `depthAxis = 4`.

---

## 6. Wiring It into Three.js + React

We’ll use **React Three Fiber** (R3F) for simplicity, but the same geometry logic works with raw Three.js.

### 6.1 Converting our 3D vertices into Three.js geometry

We want to draw a **wireframe hypercube** using `LineSegments`. Three.js only needs **3D vertices**, even if we compute them from 4D or nD.

```ts
import * as THREE from 'three';

interface BuildHypercubeLineGeometryParams {
  hypercube: NdMesh;               // e.g. 4D
  projection: (p: NdPoint) => Vec3;
}

export function buildHypercubeLineGeometry({
  hypercube,
  projection,
}: BuildHypercubeLineGeometryParams): THREE.BufferGeometry {
  const positions: number[] = [];

  for (const [i, j] of hypercube.edges) {
    const v1 = projection(hypercube.vertices[i]);
    const v2 = projection(hypercube.vertices[j]);

    positions.push(...v1, ...v2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  return geometry;
}
```

### 6.2 React component (React Three Fiber)

```tsx
// Hypercube4D.tsx
import React, { useMemo } from 'react';
import { LineSegments } from '@react-three/drei';
import { generateHypercube, rotation4DComposite, transformMeshWithMatrix } from './nd-math';
import { project4DTo3D_perspective } from './projection';
import { buildHypercubeLineGeometry } from './three-helpers';

interface Hypercube4DProps {
  angles?: { xy?: number; xw?: number; zw?: number };
}

export const Hypercube4D: React.FC<Hypercube4DProps> = ({ angles = {} }) => {
  const geometry = useMemo(() => {
    // 1) create base 4D hypercube
    const base = generateHypercube(4);

    // 2) build rotation matrix from angles
    const R = rotation4DComposite(angles);

    // 3) rotate all vertices
    const rotated = transformMeshWithMatrix(base, R);

    // 4) project rotated 4D vertices into 3D
    const projected: NdMesh = {
      ...rotated,
      vertices: rotated.vertices.map((p) => project4DTo3D_perspective(p)),
    };

    // 5) create Three.js geometry for a wireframe
    return buildHypercubeLineGeometry({
      hypercube: projected,
      projection: (v) => v as Vec3, // already 3D
    });
  }, [angles.xy, angles.xw, angles.zw]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="white" />
    </lineSegments>
  );
};
```

Then in your R3F `<Canvas>`:

```tsx
// Scene.tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Hypercube4D } from './Hypercube4D';

export function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} />

      {/* Animate angles with React state, spring, or useFrame */}
      <Hypercube4D angles={{ xy: 0.6, xw: 0.8, zw: 0.4 }} />

      <OrbitControls />
    </Canvas>
  );
}
```

This pattern generalizes to any **nD** mesh:

1. Build `NdMesh`.
2. Apply nD transform matrices (scale, rotate, shear) + translations.
3. Project to 3D with `projectNdTo3D`.
4. Build a Three.js `BufferGeometry` from the projected vertices.

### 6.3 Applying multiple transformations

Typical flow for each frame (or each time params change):

```ts
function applyTransformsAndProject(
  mesh: NdMesh,
  {
    scale,
    rotations,
    shears,
    translation,
    projectionConfig,
  }: {
    scale?: NdPoint;
    rotations?: { plane: [number, number]; angle: number }[];
    shears?: { target: number; source: number; factor: number }[];
    translation?: NdPoint;
    projectionConfig: NdProjectionConfig;
  }
): Vec3[] {
  const n = mesh.dimension;
  let M = identityMatrix(n);

  // scale
  if (scale) {
    M = multiplyMatrices(scalingMatrix(scale), M);
  }

  // rotations
  rotations?.forEach(({ plane: [i, j], angle }) => {
    M = multiplyMatrices(planeRotationMatrix(n, i, j, angle), M);
  });

  // shears
  shears?.forEach(({ target, source, factor }) => {
    M = multiplyMatrices(shearMatrix(n, target, source, factor), M);
  });

  // apply matrix + translation + projection
  return mesh.vertices.map((v) => {
    let p = multiplyMatrixVector(M, v);
    if (translation) {
      p = translatePoint(p, translation);
    }
    return projectNdTo3D(p, projectionConfig);
  });
}
```

You can then plug the resulting `Vec3[]` into your geometry builder.

---

## 7. Implementation Checklist

### 7.1 Minimal for a 4D hypercube demo

- [ ] Implement `NdPoint`, `NdMesh`.
- [ ] Implement `generateHypercube(dimension)`.
- [ ] Implement `identityMatrix`, `multiplyMatrixVector`, `multiplyMatrices`.
- [ ] Implement `planeRotationMatrix` and a `rotation4DComposite` helper.
- [ ] Implement `project4DTo3D_perspective`.
- [ ] Implement `buildHypercubeLineGeometry` (3D edges → `BufferGeometry`).
- [ ] Implement `<Hypercube4D />` React component (R3F) that:
  - Builds base hypercube.
  - Applies rotation + projection.
  - Renders as `lineSegments`.

### 7.2 To extend to general nD

- [ ] Use `projectNdTo3D` with configurable `axes` + optional `depthAxis`.
- [ ] Build reusable `applyTransformsAndProject` pipeline.
- [ ] Add UI controls (sliders) for:
  - Plane rotation angles.
  - Shear factors.
  - Projection configuration (choose axes, depth axis, distance).
- [ ] Add support for other polytopes (n‑simplex) if needed.

Once these pieces are in place, developers can:

- Drop in any **nD object**, 
- Compose transforms with matrices,
- And always end up with **3D positions** that plug directly into **Three.js**.
