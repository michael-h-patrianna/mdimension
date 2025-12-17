# Combining Rotation Morphing + “Zoom” for a Higher‑Dimensional Mandelbulb Slice

You can combine the evolving look you’re currently getting from **rotating the slice planes in D dimensions** with the classic Mandelbrot/Mandelbulb **zoom** effect.

The key idea: your renderer already maps a 3D point `pos` (in raymarch/object space) into a **D‑dimensional sample point** `c` using an origin and basis vectors. A “zoom” is simply changing the *scale* of that mapping over time.

---

## 1) Where zoom belongs in your pipeline

You likely have (conceptually) something like:

```glsl
c = uOrigin
  + pos.x * uBasisX
  + pos.y * uBasisY
  + pos.z * uBasisZ;
```

This is perfect for zooming because the “slice basis” defines how much D‑space you cover when `pos` ranges across the screen.

---

## 2) Add zoom by scaling the slice basis

### Clean approach (recommended)
Introduce a uniform:

```glsl
uniform float uZoom; // > 0, e.g. starts at 1.0 and grows to zoom in
```

Then scale the *basis contribution*:

```glsl
c = uOrigin
  + (pos.x * uBasisX
   + pos.y * uBasisY
   + pos.z * uBasisZ) / uZoom;
```

Interpretation:

- `uZoom` increasing ⇒ you sample a **smaller neighborhood** in D‑space ⇒ classic “zoom in”.
- You can animate in log space:
  - `logZoom += zoomSpeed * dt;`
  - `uZoom = exp(logZoom);`

### Equivalent approach
Instead of dividing the basis term, you could also scale `pos` before mapping, but basis scaling is usually cleaner in this architecture.

---

## 3) Important: keep raymarching stable by scaling the distance estimate

When you change the coordinate scale, your distance estimate (DE) now lives in **fractal-space units**, but the raymarch steps must be in **object-space units**.

If you evaluate the fractal at `pFractal = pObject / uZoom`, then:

- `dObject ≈ dFractal * uZoom`

So the standard fix is:

1. Compute distance in fractal space (using scaled coordinates).
2. Multiply the returned distance by `uZoom`.

### Minimal pattern
Wrap your distance function once:

```glsl
float GetDistZoomed(vec3 p) {
    // map p into your D-space sample point using /uZoom in the basis contribution
    float d = GetDist(p);      // where GetDist internally uses uZoomed mapping
    return d * uZoom;          // convert back to object-space distance
}
```

This avoids:
- **Under-stepping** (slow, too many iterations),
- **Over-stepping** (artifacts / missed surfaces).

---

## 4) Combining zoom with your existing multi-dimensional motion

You already have three “motion knobs” (even if currently implicit):

1. **Rotate planes in D**  
   Changes *which D‑dimensional cross-section* you’re seeing.

2. **Origin motion in extra dimensions**  
   Changes *where the slice lives* in D-space (often the “morphing” feel).

3. **Zoom** (new)  
   Changes *scale* of the neighborhood you’re sampling.

A visually strong combo is:

- Zoom in exponentially (log scale),
- Rotate continuously but not too fast,
- Drift the origin slowly (especially in extra dims),
- Add a feedback system so you don’t drift into a boring void.

---

## 5) The real problem: avoid “zooming into void” (boring regions)

In 2D Mandelbrot zooms, “interesting” often means “near the boundary.”  
Same here: you want to keep your slice near a visually rich boundary/surface region.

Below are three practical strategies.

---

## 6) Strategy A — Center-ray lock (simple + effective)

Goal: keep the **center ray** hitting a surface at a “nice” depth while zooming.

### Loop
1. Probe the center pixel raymarch result:
   - hit/miss
   - hit distance `tHit`
   - optional: trap/iteration metric

2. Steering:
   - If **miss** ⇒ likely void: reduce zoom speed or nudge origin.
   - If **hit but too deep/too shallow** ⇒ adjust origin slightly along a direction that maintains a stable hit region.

### Implementation note (efficient)
Don’t read back full frames.

- Render a tiny **probe pass** (1×1 or 4×4) to an offscreen texture.
- Output:
  - hit flag (0/1)
  - hit distance
  - trap value (if useful)
- `readPixels()` that tiny texture at ~10–30 Hz.
- Use the result to steer `uOrigin` / zoom speed.

This works extremely well in practice for “autopilot zooms.”

---

## 7) Strategy B — Maximize an “interest score” (robust autopilot)

Define a simple scalar score that correlates with “interesting visuals”:

- Hit ratio (avoid all-black / all-empty)
- Edge strength / variance at low resolution (avoid flat regions)
- Mean/variance of orbit trap or iteration outputs (often great for fractals)

### Hill-climb approach
Every N frames:

1. Render a low-res offscreen image (e.g., 64×64).
2. Try a few candidate nudges:
   - `uOrigin + δ` along a handful of D axes (include extra dims!)
3. Compute the score on CPU from pixels.
4. Pick the best candidate and ease the origin toward it.
5. Keep zooming.

This gives you a “guided zoom” that tends to stay in rich regions.

---

## 8) Strategy C — Boundary targeting (most Mandelbrot-like)

Pick a probe point (often center pixel) and aim for a target “borderline” behavior.

Heuristic (proxy boundary condition):
- Escapes too fast ⇒ outside (empty-ish): move origin toward the set.
- Never escapes / trap is too stable ⇒ deep interior (flat): move outward.
- Target “barely escaping / barely not escaping” band.

Even if your bulb variant isn’t a classic escape-time set, *trap + DE* is usually an excellent boundary proxy.

---

## 9) A good default recipe (works well quickly)

If you want something that looks good without overengineering:

1. **Zoom**  
   Animate in log space:

   ```js
   logZoom += zoomSpeed * dt;
   uZoom = Math.exp(logZoom);
   ```

2. **Mapping**  
   Divide the basis contribution by `uZoom`.

3. **DE scaling**  
   Multiply returned DE by `uZoom` (object-space distance).

4. **Feedback**  
   Add a simple responsiveness:
   - If hit ratio is dropping (more misses), slow drift / back off zoom speed.
   - If image variance is dropping (flat), slightly increase origin drift amplitude or rotate a bit faster.

This gives you the classic “zoom into complexity” feel while still leveraging your multidimensional rotation morphing.

---

## 10) Minimal GLSL sketch

Below is a schematic sketch (adapt to your actual data structures):

```glsl
uniform float uZoom;
uniform vecN  uOrigin;  // N-dimensional
uniform vecN  uBasisX;
uniform vecN  uBasisY;
uniform vecN  uBasisZ;

vecN MapToFractal(vec3 pos) {
    return uOrigin
         + (pos.x * uBasisX
          + pos.y * uBasisY
          + pos.z * uBasisZ) / uZoom;
}

float GetDistZoomed(vec3 pos) {
    vecN c = MapToFractal(pos);
    float dFractal = SDF_HyperBulb(c);   // your existing DE/SDF
    return dFractal * uZoom;             // scale back for raymarching
}
```

---

## 11) Next steps (if you want “autopilot zoom”)

If you want, I can also provide:

- A tiny “probe pass” fragment shader output format (hit/tHit/trap),
- A small JS/TS controller loop for:
  - reading back the probe,
  - steering `uOrigin` in D,
  - adapting zoom speed smoothly.

(That’s usually ~50–150 lines and transforms random zooms into consistently good ones.)
