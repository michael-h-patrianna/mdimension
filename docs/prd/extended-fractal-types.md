# ND Raymarch Fractals That Morph Well Under Rotation
*A developer-oriented guide: what it is, the core math idea, implementation sketch, gotchas, and what to animate (in addition to your ND slice rotations).*

This guide assumes your renderer samples a **3D slice** of an **N‑dimensional** space:
- You build a 3D point in slice space: `p3 = x*uBasisX + y*uBasisY + z*uBasisZ + uOrigin`
- You evaluate a fractal / distance estimator in **N dims**
- You raymarch in 3D using that DE and shading

The key to “organic morphing” is **strong cross‑coupling** between dimensions *inside the iteration* (so rotating the slice basis changes the dynamics, not just the viewpoint).

---

## Conventions used below

### Vector and helper ops
- `vecN` means an N‑dim vector (N = 3…11).
- `dot(a,b)` is the dot product.
- `len(a) = sqrt(dot(a,a))`.
- `abs(a)` is componentwise absolute value.
- `normalize(a)` returns `a / len(a)` (guard small length).

### Common “DE loop” structure
Most escape-time / bulb/box style DEs look like:

```glsl
float de(vecN p) {
  vecN z = p;
  float dr = 1.0;      // derivative accumulator for distance estimate
  float r  = 0.0;

  for (int i = 0; i < ITER; i++) {
    r = len(z);
    if (r > BAILOUT) break;

    // --- fractal-specific transform of z, update dr ---
    // z = F(z, params);  dr = update(dr, z, params);

  }

  // return distance estimate (varies by fractal family)
  return 0.5 * log(r) * r / dr;  // common pattern, not universal
}
```

You’ll see different updates per fractal type. Don’t worry about exact constants at first—get something stable and sculptable, then tune.

---

# 1) Quaternion / Hypercomplex Julia Sets (4D+)
### What it is
A Julia set generalizes “`z = z² + c`” from complex numbers to **4D quaternions** (and beyond). You iterate a hypercomplex number and measure escape. The 3D shape you raymarch is a slice through that 4D (or ND) dynamical system.

**Why it morphs well:** quaternion multiplication *mixes components strongly*, so changing slice orientation yields genuinely different structure (bubbles, tubes, blobby organs).

### Core math idea (lightweight)
Instead of complex `z = (x + i y)`, use quaternion:
- `q = (x, y, z, w)` (4 floats)
- multiply with quaternion rules (non-commutative)
- iterate `q = q*q + c`

### Implementation sketch
**Quaternion multiply:**
```glsl
// q = (x,y,z,w) where w is the scalar part
vec4 qmul(vec4 a, vec4 b) {
  vec3 av = a.xyz; float aw = a.w;
  vec3 bv = b.xyz; float bw = b.w;
  vec3 v  = aw*bv + bw*av + cross(av, bv);
  float w = aw*bw - dot(av, bv);
  return vec4(v, w);
}
```

**Quadratic Julia iterate:**
```glsl
vec4 q = vec4(p.xyz, p4);   // p4 from extra dimension (slice origin or parameter)
vec4 c = cParam;            // constant quaternion, animate this!

for i:
  q = qmul(q, q) + c;
  r = length(q);
  if (r > bailout) break;
```

**Distance estimate tip:** Start with **escape-time iso-surface** first (e.g., “hit” where `r` crosses a threshold with a smooth potential). DE is possible but more fiddly; many devs render a scalar field (potential) and raymarch an isosurface.

### What to look out for
- **Stability:** quaternions can explode fast; clamp or use gentle bailout (e.g. 4–16).
- **Banding:** use smooth iteration count / potential (`log(log(r))`) for shading.
- **Normals:** compute gradient numerically from your scalar field (potential) if DE isn’t solid.

### What to animate (besides rotations)
- **Julia constant `c`** along a slow 4D path:
  - `c = (a*sin(t), b*cos(1.3t), c*sin(0.7t), d*cos(0.9t))`
- **Power** (quadratic vs higher powers) if you implement `q^p` (start with p=2 and maybe p=3).
- **Slice origin** drift in the “w” dimension (and other extra dims).

---

# 2) “Kali” / Reciprocal‑Abs Fractals (ND)
### What it is
A family of iterators using **componentwise abs + reciprocal** feedback. The “reciprocal” step creates intense nonlinear folding that looks fluid, cellular, and “alive”.

A common pattern:
- `z = abs(z) / dot(z,z) + c` (or variants)

### Core math idea
Take the vector, fold it into a symmetric region (abs), then invert by magnitude (reciprocal), then bias by `c`.

### Implementation sketch
```glsl
vecN z = p;
vecN c = cParam;     // ND constant (can be small)

for i:
  float r2 = dot(z, z) + eps;
  z = abs(z) / r2 + c;
  if (sqrt(r2) > bailout) break;
```

**Optional spice:** add a rotation/mix matrix inside the loop:
```glsl
z = M * z;           // M is a fixed ND matrix (slight shear/rotation)
```

### What to look out for
- **Singularity at 0:** always add `eps` to `r2`.
- **Over-symmetry:** pure `abs` can look too crystalline; break symmetry with:
  - a tiny per-iteration mix `M`
  - unequal scaling per axis
- **DE:** often easiest to render as a scalar potential (accumulated min distance to traps, or smooth escape potential).

### What to animate
- `cParam` (small amplitude) — this changes “cell” structure strongly.
- **Reciprocal strength:** `z = abs(z) / (r2*gain) + c`.
- **Axis weights:** `abs(z * w)` where `w` differs per dimension.

---

# 3) Newton / Root‑Finding Fractals (Field‑Based)
### What it is
Instead of escape-time iteration, you run **Newton’s method** to solve `F(z)=0`. The boundaries between basins of attraction are fractal and extremely detailed. In 3D slices, this can look like veins, membranes, and branching organs.

### Core math idea (developer view)
Newton iteration:
- `z_{n+1} = z_n - F(z_n) / F'(z_n)`
For vectors, use a Jacobian (hard). A practical approach is:
- Use **hypercomplex numbers** (complex/quaternion) where `F'` is defined
- Or use scalar fields and approximate gradients numerically

### Implementation sketch (quaternion polynomial)
Let `F(q) = q^3 - 1` (classic). Then:
- `F'(q) = 3*q^2`
```glsl
vec4 q = vec4(p.xyz, p4);

for i:
  vec4 q2 = qmul(q,q);
  vec4 F  = qmul(q2,q) - vec4(0,0,0,1);   // "-1" in scalar part
  vec4 dF = 3.0 * q2;

  // "divide" by dF: multiply by inverse quaternion
  vec4 step = qmul(F, qinv(dF));
  q = q - step;

  // measure convergence
  if (length(F) < tol) break;
```

Render a surface based on:
- **convergence speed** (iterations to converge)
- or `length(F)` isovalue
- or basin boundary measures (e.g. nearest root distance)

### What to look out for
- **Quaternion inverse:** need `qinv(q) = conj(q)/dot(q,q)`.
- **Too noisy:** Newton basins can flicker if tol/iters are tight. Smooth by:
  - lower frequency shading from continuous potential
  - temporal smoothing (or stable parameter motion)
- **Normals:** numerical gradient of your chosen scalar (`length(F)`, potential, etc.).

### What to animate
- Polynomial choice: `q^3 - k`, `q^4 - k`, etc.
- Move `k` (or coefficients) slowly in hypercomplex space.
- Tolerance / damping: `q = q - damp * step` (animate `damp` subtly).

---

# 4) Hybrid / Alternating Formulas (Mandelbulber‑Style)
### What it is
You alternate two (or more) transforms each iteration: e.g. one step is bulb-power, next is boxfold+spherefold. This breaks symmetry and creates competing “rules”, which produces rich morphing under rotation.

### Core math idea
Iteration is not one function `F`, but:
- `z = F0(z)` on even i
- `z = F1(z)` on odd i

### Implementation sketch
Example: **even = bulb power**, **odd = boxfold+spherefold** (in ND)

```glsl
for i:
  if ((i & 1) == 0) {
    // Bulb-like: map z to (r, angles...), apply power p, map back
    z = bulbPowerND(z, p);
    dr = dr * something; // approximate derivative growth
  } else {
    z = boxFold(z, foldLimit);
    z = sphereFold(z, minRad, fixedRad);
    z = z * scale + p;   // scale and add original point
    dr = dr * abs(scale) + 1.0;
  }
```

If ND bulb angles are painful, fake it with:
- normalize direction + radial power:
```glsl
float r = len(z);
vecN dir = z / (r + eps);
z = dir * pow(r, p);
```
It’s not the same as true angle-power but still useful in hybrids.

### What to look out for
- **Derivative tracking:** hybrids can make DE less “correct”. Accept it—aim for stable raymarching:
  - clamp step sizes
  - add safety factor (e.g. `dist *= 0.8`)
- **Parameter explosion:** keep few knobs; too many = hard to tune.

### What to animate
- Alternate weights: blend between F0 and F1 over time:
  - `z = mix(F0(z), F1(z), w(t))`
- Fold limits, sphere fold radii
- Scale factor
- Bulb power `p` (very effective)

---

# 5) IFS / Orbit‑Trap “Field Fractals” (Distance via Traps)
### What it is
Instead of a strict DE fractal surface, you iterate a transform and measure how close the orbit comes to **traps** (planes, spheres, torii, lines) defined in ND. The field you build often looks like soft tissue, foamy bubbles, or wispy membranes—great for animation.

### Core math idea
- Iterate `z = F(z)`
- Track `d = min(d, distanceToTrap(z))`
- Return `d` (or a shaped version) as your “distance” / isosurface field

### Implementation sketch
```glsl
float dTrap = BIG;
vecN z = p;

for i:
  z = F(z);                       // any stable transform
  dTrap = min(dTrap, trap(z));     // trap() returns scalar
return dTrap - iso;               // raymarch an isosurface
```

Trap examples:
- **Plane trap:** `abs(dot(z, n) - h)`
- **Sphere trap:** `abs(len(z - center) - R)`
- **Torus-like trap (in 3 dims of ND):** use selected axes

### What to look out for
- **Not a true SDF:** it’s a field. Raymarch with smaller steps or use sphere tracing with safety factor.
- **Temporal stability:** if traps move too fast, you get flicker. Animate slowly.

### What to animate
- Trap centers and radii (in ND!)
- Which dimensions define the torus/plane (swap axes over time)
- Blend multiple traps with weights that change slowly

---

# 6) Triplex / Multicomplex Julia Variants (6D+ “Complex‑Like”)
### What it is
Generalizations of complex numbers to higher dimensions (bicomplex/tricomplex, etc.). You get complex-style dynamics (Julia/Mandelbrot behavior) but in 4D/6D/8D spaces, which can slice into extremely intricate, organic structures.

### Core math idea
A practical developer approach:
- Represent your number as **pairs of complex numbers**
- Define multiplication with a chosen algebra (bicomplex/tricomplex)
- Iterate `z = z*z + c` in that algebra

### Implementation sketch (developer-friendly)
Start with **bicomplex** as “complex of complex”:
- `z = (a, b)` where `a` and `b` are complex (2D each) ⇒ 4D total.
- Define:
  - `z*z = (a*a - b*b, 2*a*b)` (like complex but each term is complex)

Represent complex as `vec2 (re, im)` and implement `cmul`.

Then:
```glsl
struct Bicomplex { vec2 a; vec2 b; };

Bicomplex bmul(Bicomplex x, Bicomplex y) {
  vec2 aa = cmul(x.a, y.a);
  vec2 bb = cmul(x.b, y.b);
  vec2 ab = cmul(x.a, y.b);
  vec2 ba = cmul(x.b, y.a);
  return Bicomplex( aa - bb, ab + ba );
}

for i:
  z = bmul(z, z);
  z.a += c.a; z.b += c.b;
  if (norm(z) > bailout) break;
```

### What to look out for
- **Algebra choices vary.** Don’t chase “purity”; pick a consistent multiplication and test.
- **Performance:** 6D/8D operations get heavy. Optimize:
  - lower iterations
  - early bailout
  - cheap norm estimate

### What to animate
- `c` in higher dimensions (big impact)
- Small mixing matrix inside loop (breaks symmetry)
- Power variants (`z^p + c`)

---

# 7) Coupled‑Map Fractals (Small ND Dynamical Systems)
### What it is
A “fractal-ish” approach that often looks extremely organic: iterate a **coupled nonlinear map** in ND (like coupled logistic/tanh maps). Render an isosurface of orbit density, potential, or escape measure.

This is less “classic fractal” and more “procedural dynamical sculpture”—but it’s fantastic for morphing.

### Core math idea
Each dimension influences others through a coupling matrix `A`:
- `z_{n+1} = f(A * z_n + b)`
where `f` is nonlinear per component (tanh, sin, logistic-like).

### Implementation sketch
```glsl
vecN z = p;
float acc = 0.0;

for i:
  vecN y = A * z + b;         // A is ND matrix (fixed or lightly animated)
  z = tanh(y);                // or sin(y), or y - y*y*y (cheap)
  acc += exp(-k * dot(z,z));  // orbit density / potential
```

Return:
- `field = acc / ITER` and raymarch an isosurface
- or `field = min(field, len(z - trapCenter))` style

### What to look out for
- **Not an SDF:** treat as a field (smaller steps, safety factor).
- **Parameter sensitivity:** tiny changes can flip behavior. Keep motion slow and bounded.
- **Banding:** accumulate smoothly, avoid hard thresholds.

### What to animate
- Coupling strength (scale `A`)
- Bias `b` (slow path in ND)
- Nonlinearity gain (`tanh(g*y)`, `sin(g*y)`)


