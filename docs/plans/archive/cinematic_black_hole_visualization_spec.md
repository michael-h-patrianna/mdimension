# Cinematic Black Hole Visualization (3–11 Dimensions)
**Developer Implementation Spec (Rule-of-Cool, not a physics simulation)**

This document replaces the earlier high-level outline with a complete, developer-friendly plan:
- what we are building (goal & scope),
- the render elements that create the “Interstellar-style” look,
- the math we will actually implement (kept simple and stable),
- step-by-step implementation plan,
- the full UI-exposed parameter list (types, ranges, defaults, meaning),
- how to integrate into our existing renderer stack (lights, PBR, AO, SSS, palettes, TAA, shadows).

> **Design principle:** *You never show the black hole itself. You show how light fails to escape its influence.*

---

## 0. Non-goals (to avoid confusion)
This feature is **not**:
- General Relativity / Kerr / Schwarzschild accurate simulation.
- A physically correct accretion disk model.
- A full volumetric participating-medium path tracer.

This feature **is**:
- A stable, controllable, real-time raymarched effect that looks “wow”.
- Deterministic and tunable with artist sliders.
- Dimension-agnostic: same code path works for **N = 3…11**.

---

## 1. Visual elements (what the user should see)

### 1.1 Horizon silhouette (negative space)
A hard “black cutout” circle/sphere around the center.  
Purpose: strong silhouette and “inevitable gravity” feeling.

### 1.2 Gravitational lensing (curved rays)
Camera rays bend around the center and can form:
- smooth arcs,
- “near-orbit” loops,
- duplicated rings/caustic-like structures.

This is the primary “Interstellar” cue.

### 1.3 Photon shell ring (stylized bright ring)
A narrow band around a configurable radius where:
- detail increases,
- glow increases,
- optional step size decreases for sharpness.

Purpose: guaranteed ring, even when the accretion structure is subtle.

### 1.4 Luminous manifold (accretion proxy)
A volumetric emissive structure (not a surface) that the bent rays sample.
In 3D it reads as a disk; in higher dimensions it becomes stranger (sheet/slab/field).

### 1.5 Background (starfield / environment map)
When the ray exits the influence region, sample the background **using the final bent direction**
to make lensing visible everywhere.

---

## 2. Coordinate spaces (3D camera ↔ N-D scene)

We render from a normal 3D camera, but the black-hole volume exists in N-D space.

### 2.1 N-D vectors
Represent points/directions in N-D as `vecN` (e.g. float array length N).

### 2.2 Embedding 3D rays into N-D
We maintain an **orthonormal basis** `B` of shape `N×3` with columns `b0,b1,b2`:
- `b0,b1,b2` are orthonormal N-D vectors defining the 3D “camera subspace” inside N-D.

Given a 3D camera ray `(origin3, dir3)`:
- `originN = originOffsetN + B * origin3`
- `dirN    = normalize(B * dir3)`

`originOffsetN` is typically the black hole center offset (often zero).

> Implementation note: if you already have “N-D rotation planes” UI, apply rotation to `B` (and any manifold orientation axes) rather than trying to rotate all points every step.

### 2.3 Projecting N-D back to 3D (for background sampling & effects)
We use a projection matrix `P` of shape `3×N`.
Default: `P = transpose(B)` (project back to the same 3D subspace).

For any N-D point/direction:
- `p3   = P * pN`
- `dir3 = normalize(P * dirN)`

Use `dir3` to sample your existing environment map / starfield.

---

## 3. Core “gravity” control function (artistic, stable)

We use a scalar “gravity strength” that increases near the center and increases with dimension:
\[
G(r,N) = k \cdot \frac{N^{\alpha}}{(r + \varepsilon)^{\beta}}
\]

Where:
- `r = length(pN)` (distance to center in N-D),
- `k` = gravityStrength (artist slider),
- `alpha` = dimension emphasis,
- `beta` = distance falloff,
- `epsilon` avoids singularities.

### Recommended defaults
- `k = 1.0`
- `alpha = 0.8`
- `beta = 1.6`
- `epsilon = 0.01 * R_h`
- clamp `G` to `lensingClamp` to prevent numeric issues.

---

## 4. Ray bending (curved-ray integration)

### 4.1 Why we do it this way
The earlier outline added a tangential vector directly to `dir` without step-size scaling.
That makes the look unstable when step count changes.

Instead, we rotate the direction by a small angle per step (stable & controllable).

### 4.2 Bending plane
At a point `pN`:
- `toC = normalize(-pN)` (toward center)
- Remove radial component from direction:
  - `tangentRaw = dirN - dot(dirN, toC) * toC`
  - if `|tangentRaw| < 1e-6`, skip bending this step
  - `tangent = normalize(tangentRaw)`

`tangent` points along the local “around the center” direction.

### 4.3 Apply a small rotation each step
Let `dt` be the current step length.

- `g = clamp(G(r,N), 0, lensingClamp)`
- `theta = clamp(g * dt * bendScale, 0, bendMaxPerStep)`  // radians
- `dirN = normalize( cos(theta) * dirN + sin(theta) * tangent )`

This increases “tangentialness” near the center, producing arcs & loops.

---

## 5. Horizon capture (silhouette)

### 5.1 Termination
If at any step:
- `r < R_h` then the ray is captured.

Return:
- `horizonMask = 1`
- final color is black **unless** you intentionally add “edge glow” outside the horizon.

### 5.2 Soft edge (optional)
For nicer edges at low resolution:
- `edge = smoothstep(R_h, R_h + edgeSoftness, r)`
Use `edge` in post (or to blend black → some small residual).

---

## 6. Photon shell ring (stylized)

### 6.1 Radius
Default:
- `R_p = R_h * (photonShellRadiusMul + photonShellRadiusDimBias * log(N))`

If you want simpler:
- `R_p = R_h * photonShellRadiusMul` (and ignore dim bias).

### 6.2 Band mask
- `Δ = photonShellWidth * R_h`
- `shellMask = 1 - smoothstep(Δ, 0, abs(r - R_p))`

### 6.3 What shellMask does
Typical uses (each independently togglable):
- **Glow:** `emission += shellMask * shellGlowColor * shellGlowStrength`
- **Detail boost:** increase manifoldIntensity/contrast in the band
- **Step size reduction:** `dt *= mix(1.0, shellStepMul, shellMask)`

Goal: a crisp ring at any settings.

---

## 7. Luminous manifold (accretion proxy) — concrete distance function

We need one function that works in N-D and can look like:
- disk (N=3),
- sheet/slab (N=4–6),
- field (N≥7),

without requiring new math per dimension.

### 7.1 Orientation axes
Choose two orthonormal N-D axes `u` and `v` that define the manifold “disk plane”.
(These axes rotate with the UI rotation planes.)

Compute:
- `pu = dot(pN, u)`
- `pv = dot(pN, v)`
- `pPlane = pu*u + pv*v`
- `wDist = length(pN - pPlane)`          // distance to the u–v plane (includes higher dims)
- `rDisk = sqrt(pu*pu + pv*pv)`          // radius inside the plane

### 7.2 Radial mask (inner/outer)
- `radial = smoothstep(R_in, R_in+soft, rDisk) * (1 - smoothstep(R_out-soft, R_out, rDisk))`

### 7.3 Dimension morph (thickness scaling)
We map dimension to “thickness” to get disk → sheet → slab → field:

- `dimT = clamp((N - 3) / 8, 0, 1)`             // 0 at N=3, ~1 near N=11
- `thickness = manifoldThickness * mix(1.0, thicknessPerDimMax, dimT)`
- `wScale = mix(1.0, highDimWScale, smoothstep(0.25, 0.75, dimT))`

Then:
- `dist = wDist * wScale`

### 7.4 Density and emission
Density:
- `rho = exp(-abs(dist) * falloff) * radial`

Optional breakup:
- apply noise/swirl in (pu,pv) space to modulate `rho`:
  - `rho *= (1 + noiseAmount * noise(pu*noiseScale, pv*noiseScale, time*timeScale))`

Emission:
- `emission = rho * baseColor * manifoldIntensity`

### 7.5 Multiple intersections (ring duplication)
Because rays can loop, they may intersect the manifold multiple times.
This is desirable; do **not** stop at first hit.

We optionally boost the effect:
- Track `rhoMax` along the ray and/or accumulate a “hit count”
- `emission *= (1 + multiIntersectionGain * hitFactor)`

Keep it simple at first: just allow normal accumulation.

---

## 8. Raymarch algorithm (full, implementable)

### 8.1 Inputs
Per pixel:
- camera ray (origin3, dir3)
- current dimension N
- basis matrices B, P
- all parameters (see section 12)

### 8.2 Outputs (buffers)
Return a struct:
- `rgb color` (final)
- `float alpha` (optional; 1 - transmittance)
- `float horizonMask`
- `float shellMaskMax`
- `float lensingMax` (max G encountered)
- `vec3 normal3` (pseudo-normal for rim/palette/PBR integration)
- `float depthApprox` (optional)

### 8.3 Loop pseudocode
```cpp
RayOut renderBH(Pixel px)
{
  // 1) Embed 3D ray into N-D
  vecN p = originOffsetN + B * origin3;
  vecN dir = normalize(B * dir3);

  vec3 accum = vec3(0);
  float trans = 1.0;

  float lensingMax = 0;
  float shellMax = 0;
  float t = 0;

  float dt = stepBase;
  for (int i=0; i<maxSteps; i++)
  {
    float r = length(p);

    // Escape
    if (r > R_far) break;

    // Horizon capture
    if (r < R_h)
    {
      return { .color=vec3(0), .alpha=1.0, .horizonMask=1.0,
               .shellMaskMax=shellMax, .lensingMax=lensingMax };
    }

    // Gravity
    float g = clamp(G(r,N), 0, lensingClamp);
    lensingMax = max(lensingMax, g);

    // Photon shell mask
    float shell = computeShellMask(r, N);
    shellMax = max(shellMax, shell);

    // Step adapt (simple, stable)
    float dtAdaptive = dt;
    dtAdaptive *= 1.0 / (1.0 + stepAdaptG * g);
    dtAdaptive *= (1.0 + stepAdaptR * r);
    dtAdaptive = clamp(dtAdaptive, stepMin, stepMax);

    // Optional: extra detail near shell
    dtAdaptive *= mix(1.0, shellStepMul, shell);

    // Luminous manifold sampling
    float rho = manifoldDensity(p, N, time);
    vec3 emission = rho * baseColor * manifoldIntensity;

    // Photon ring glow (stylized)
    emission += shell * shellGlowColor * shellGlowStrength;

    // Optional absorption (helps make thick structures look volumetric)
    if (enableAbsorption)
      trans *= exp(-rho * absorption * dtAdaptive);

    accum += trans * emission * dtAdaptive;

    // Bend ray (dt-scaled rotation)
    dir = bendRay(dir, p, g, dtAdaptive);

    // Advance
    p += dir * dtAdaptive;
    t += dtAdaptive;

    // Early out if fully opaque
    if (trans < transmittanceCutoff) break;
  }

  // Background sample (use projected direction)
  vec3 dir3b = normalize(P * dir);
  vec3 bg = sampleEnvironment(dir3b);

  vec3 final = accum + trans * bg;

  // Pseudo-normal for effects
  vec3 p3 = P * p;
  vec3 n3 = normalize(p3);

  return { .color=final, .alpha=(1.0-trans), .horizonMask=0.0,
           .shellMaskMax=shellMax, .lensingMax=lensingMax, .normal3=n3 };
}
```

---

## 9. Rotation planes (user control)

Users can add “rotation planes” like (x–w), (y–u), etc.  
We treat these as artist controls that rotate:
- the camera embedding basis `B`,
- manifold axes `u,v`,
- optionally the background sampling direction.

### 9.1 Rotation data
Each plane entry:
- `axisA` (int in 0..N-1)
- `axisB` (int in 0..N-1, != axisA)
- `speed` (float radians/sec)
- `angle` (float radians) or accumulated angle

### 9.2 Applying rotation
Build an `N×N` rotation matrix `R` from all enabled planes (compose them).
Then:
- `B := R * B`
- `u := R * u`, `v := R * v`

### 9.3 Horizon damping (keeps the core “anchored”)
Near the horizon, suppress rotation influence:
- `damp = smoothstep(R_h*dampInnerMul, R_h*dampOuterMul, r)`
- use `angleEffective = angleUser * damp` when building `R` for point `p`

Simpler (first version): damp only in shading space (manifold & background),
not in the core lensing, to preserve “heavy core”.

---

## 10. Integration with existing renderer features

Our renderer already has:
- ambient light, multiple dynamic lights, PBR (diffuse/specular/roughness),
- AO, SSS, Fresnel rim,
- raymarch self-shadowing,
- palette coloring based on normals and other fields,
- temporal reprojection / TAA.

The black hole effect is best treated as **a raymarched emissive volume** + **a hard occluder**.

### 10.1 What this object outputs
Add a “CinematicBlackHole” render path that produces:
- `emissiveColor` (accumulated)
- `transmittance` (or `alpha`)
- `horizonMask`
- `shellMask`
- `lensingMax`
- `normal3` (pseudo-normal)
- `depthApprox` (optional; t at max density or at shell)

### 10.2 How it participates in lighting & PBR
Two modes (UI toggle):

#### Mode A (default): **Emissive-only**
- Ignore scene lights for the accretion/ring; they are the light.
- Still allow ambient tint (small multiplier).

Pros: fastest, consistent, most cinematic.

#### Mode B (optional): **Fake-lit volume using pseudo-normal**
Use `normal3` (and/or density gradient) to reuse your PBR code:
- `albedo` comes from palette mapping (radius/shell/normal)
- `roughness`, `specular` are user sliders
- Fresnel rim uses existing pipeline (driven by normal3)

This is not physically correct; it is a stylistic match to your system.

### 10.3 Shadows / self-shadowing
Implement volumetric self-shadowing similarly to your existing raymarchers:
- For each light, cast a short ray from sample point toward light.
- Accumulate optical depth using `rho` (straight shadow rays — do NOT lens them).
- Multiply emission by `shadowTerm`.

Expose:
- `shadowEnabled` (bool)
- `shadowSteps` (int)
- `shadowDensity` (float)

### 10.4 AO / SSS
- AO: treat as “local density occlusion” (cheap probe or reuse rhoMax).
- SSS: implement as a purely artistic “wrap lighting / forward scatter” slider.

### 10.5 Palette integration
Drive palette inputs from:
- `normal3` (existing normal-based palette algorithms)
- `r`, `rDisk`, `shellMask`, `lensingMax`

Recommended palette modes:
- DiskGradient (by rDisk)
- NormalBased (use normal3)
- ShellOnly (ring dominant)
- Heatmap (by lensingMax)

### 10.6 Temporal reprojection (TAA)
Curved rays cause more “history mismatch” than typical surfaces.
Use a **reactive mask** to reduce history weight where needed:
- `reactive = max(shellMask, saturate(lensingMax / G_ref), horizonEdgeMask)`

Then:
- `historyWeight = lerp(baseHistoryWeight, minHistoryWeight, reactive * taaReactiveStrength)`

Expose TAA knobs (see section 12).

---

## 11. Implementation plan (logical steps)

### Step 1 — MVP silhouette + background lensing
- Implement embedding (B) and projection (P).
- Implement `G(r,N)` and dt-scaled bending.
- Implement horizon capture.
- Sample background at the final bent direction.
**Success criteria:** black hole silhouette + obvious lensing distortions in starfield.

### Step 2 — Photon shell ring
- Add `R_p`, `shellMask`, `shellGlow`.
- Add shell-driven step reduction.
**Success criteria:** stable bright ring at all dimensions.

### Step 3 — Luminous manifold (accretion proxy)
- Implement `u,v` plane, radial mask, thickness scaling with N.
- Add noise/swirl modulation.
**Success criteria:** disk-like structure in 3D; thickening/alien behavior as N increases.

### Step 4 — Integration buffers + palette
- Output normal3/shell/lensing buffers.
- Plug into palette system (normal/radius/shell).
**Success criteria:** users can recolor and get “different looks” without changing core math.

### Step 5 — Optional lighting/shadows
- Add emissive-only mode (default).
- Add fake-lit mode using pseudo-normal.
- Add volumetric self-shadowing (straight shadow rays).
**Success criteria:** matches the rest of the scene style when desired.

### Step 6 — TAA tuning
- Add reactive mask and per-feature history control.
**Success criteria:** no smeary ring; stable shimmer that looks intentional.

### Step 7 — Performance & quality
- Adaptive steps, early outs, transmittance cutoff.
- Quality presets (Low/Med/High).
**Success criteria:** stable frame time across resolutions.

---

## 12. UI-exposed parameters (types, ranges, defaults)

### 12.1 Basic (artist-facing)
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `N` | int | 3 | 3…11 | Dimension of the effect |
| `R_h` | float | 1.0 | 0.05…20 | Horizon radius (scene units) |
| `gravityStrength` (`k`) | float | 1.0 | 0…10 | Overall lensing strength |
| `manifoldIntensity` | float | 1.0 | 0…20 | Brightness of accretion structure |
| `manifoldThickness` | float | 0.15 | 0…2 | Thickness/fieldness of the manifold |
| `photonShellWidth` | float | 0.05 | 0…0.3 | Band width as fraction of R_h |
| `timeScale` | float | 1.0 | 0…5 | Speeds noise/swirl/rotation |
| `baseColor` | color | warm white | — | Emission tint |
| `paletteMode` | enum | DiskGradient | see 10.5 | How palette is applied |
| `bloomBoost` | float | 1.0 | 0…5 | Extra bloom contribution |

### 12.2 Lensing (advanced)
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `alpha` | float | 0.8 | 0…2 | Dimension emphasis in G |
| `beta` | float | 1.6 | 0.5…4 | Distance falloff in G |
| `epsilonMul` | float | 0.01 | 1e-5…0.5 | epsilon = epsilonMul * R_h |
| `bendScale` | float | 1.0 | 0…5 | Multiplier on theta |
| `bendMaxPerStep` | float | 0.25 | 0…0.8 | Max radians per step |
| `lensingClamp` | float | 10 | 0…100 | Clamp G |

### 12.3 Photon shell (advanced)
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `photonShellRadiusMul` | float | 1.3 | 1.0…2.0 | Base R_p multiplier |
| `photonShellRadiusDimBias` | float | 0.1 | 0…0.5 | Bias * log(N) |
| `shellGlowStrength` | float | 3.0 | 0…20 | Ring glow intensity |
| `shellGlowColor` | color | white | — | Ring glow tint |
| `shellStepMul` | float | 0.35 | 0.05…1 | Step scale near shell |
| `shellContrastBoost` | float | 1.0 | 0…3 | Optional post/curve |

### 12.4 Manifold / accretion (advanced)
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `manifoldType` | enum | AutoByN | AutoByN, Disk, Sheet, Slab, Field | Override dimension mapping |
| `falloff` | float | 6.0 | 0…40 | Density falloff in rho |
| `diskInnerRadiusMul` | float | 1.2 | 0…10 | R_in = mul * R_h |
| `diskOuterRadiusMul` | float | 8.0 | 0.1…200 | R_out = mul * R_h |
| `radialSoftnessMul` | float | 0.2 | 0…2 | softness = mul * R_h |
| `thicknessPerDimMax` | float | 4.0 | 1…10 | Max thickness scaling by dim |
| `highDimWScale` | float | 2.0 | 1…10 | Scales wDist in high dims |
| `swirlAmount` | float | 0.6 | 0…2 | Swirl warp strength |
| `noiseScale` | float | 1.0 | 0.1…10 | Noise frequency |
| `noiseAmount` | float | 0.25 | 0…1 | Noise modulation amplitude |
| `multiIntersectionGain` | float | 1.0 | 0…3 | Boost repeated hits |

### 12.5 Rotation planes
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `rotationPlanes` | list | [] | up to N*(N-1)/2 | Each: axisA, axisB, speed, enabled |
| `backgroundCounterRotation` | float | 0.05 | 0…1 | Optional counter-rot for bg |
| `dampInnerMul` | float | 1.2 | 1…2 | Damping inner radius |
| `dampOuterMul` | float | 3.0 | 1.2…8 | Damping outer radius |

### 12.6 Rendering quality
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `maxSteps` | int | 128 | 16…512 | March iterations |
| `stepBase` | float | 0.08 | 0.001…1 | Base step |
| `stepMin` | float | 0.01 | 0.0001…0.5 | Min step |
| `stepMax` | float | 0.2 | 0.001…5 | Max step |
| `stepAdaptG` | float | 1.0 | 0…5 | Step shrink by g |
| `stepAdaptR` | float | 0.2 | 0…2 | Step grow by distance |
| `enableAbsorption` | bool | false | — | Volumetric absorption |
| `absorption` | float | 1.0 | 0…10 | Absorption strength |
| `transmittanceCutoff` | float | 0.01 | 0…0.2 | Early out threshold |

### 12.7 Lighting integration (optional)
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `lightingMode` | enum | EmissiveOnly | EmissiveOnly, FakeLit | Whether to apply PBR |
| `roughness` | float | 0.6 | 0…1 | For FakeLit mode |
| `specular` | float | 0.2 | 0…1 | For FakeLit mode |
| `ambientTint` | float | 0.1 | 0…1 | Ambient influence |
| `shadowEnabled` | bool | false | — | Enable volumetric shadows |
| `shadowSteps` | int | 16 | 4…64 | Shadow march quality |
| `shadowDensity` | float | 2.0 | 0…10 | Shadow optical depth |

### 12.8 Temporal reprojection / TAA
| Parameter | Type | Default | Range | Meaning |
|---|---|---:|---|---|
| `taaReactiveStrength` | float | 1.0 | 0…4 | How strongly reactive areas kill history |
| `G_ref` | float | 2.0 | 0.1…20 | Lensing threshold for reactivity |
| `taaMinHistoryWeight` | float | 0.05 | 0…0.5 | Minimum history weight in reactive zones |
| `taaShellBoost` | float | 1.0 | 0…2 | Extra reactivity for shell |

---

## 13. Suggested parameter JSON schema (example)
Use this as a template for your existing parameter/Retool-driven UI.

```json
{
  "type": "CinematicBlackHole",
  "params": {
    "N": 3,
    "R_h": 1.0,
    "gravityStrength": 1.0,
    "alpha": 0.8,
    "beta": 1.6,
    "epsilonMul": 0.01,

    "manifoldIntensity": 1.0,
    "manifoldThickness": 0.15,
    "falloff": 6.0,
    "diskInnerRadiusMul": 1.2,
    "diskOuterRadiusMul": 8.0,

    "photonShellRadiusMul": 1.3,
    "photonShellWidth": 0.05,
    "shellGlowStrength": 3.0,

    "rotationPlanes": [
      { "axisA": 0, "axisB": 3, "speed": 0.2, "enabled": true }
    ],

    "lightingMode": "EmissiveOnly",
    "paletteMode": "DiskGradient",

    "maxSteps": 128,
    "stepBase": 0.08,
    "stepMin": 0.01,
    "stepMax": 0.2
  }
}
```

---

## 14. Debug views (highly recommended)
To make iteration easy for non-physicists, add toggles:
- show `horizonMask`
- show `shellMask`
- show `lensingMax` (heatmap)
- show `rho` (density)
- show step size (`dt`) (heatmap)
- show manifold plane axes (u,v) in a gizmo

---

## 15. Acceptance checklist
The feature is “done” when:
- In N=3, users can produce an “Interstellar-like” black hole with a clear ring and lensing.
- Increasing N makes the effect feel more aggressive/alien without breaking stability.
- No parameter combination causes NaNs, exploding rays, or full-screen flicker.
- Works with our palette system and TAA without obvious smearing on the ring.
- Performance is predictable via quality presets.

---

## Appendix A — Quick reference formulas

**Gravity:**
- `G(r,N) = k * N^alpha / (r + epsilon)^beta`

**Photon shell:**
- `R_p = R_h * (photonShellRadiusMul + photonShellRadiusDimBias * log(N))`
- `Δ = photonShellWidth * R_h`
- `shellMask = 1 - smoothstep(Δ, 0, abs(r - R_p))`

**Manifold density:**
- `wDist = length(pN - (dot(pN,u)u + dot(pN,v)v))`
- `rho = exp(-abs(wDist*wScale) * falloff) * radialMask`

---
