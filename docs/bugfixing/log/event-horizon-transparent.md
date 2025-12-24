# Bug Report: Event Horizon Appears Transparent

**Status:** UNRESOLVED
**Date:** 2024-12-24
**Affected Component:** Black Hole Shader (`src/rendering/shaders/blackhole/`)

---

## Bug Description

The event horizon of the black hole appears transparent in certain viewing angles, showing the skybox through what should be a solid black sphere. The transparency is angle-dependent - some parts of the horizon appear correctly black while others show the background.

### Observed Symptoms
1. Parts of the event horizon are transparent (showing skybox/background)
2. Other parts are black "despite being covered by the accretion disk" (disk color not showing where it should)
3. The issue is viewing-angle dependent - transparency varies based on camera position

### Expected Behavior
- The event horizon should always appear as a solid black sphere
- Accretion disk in front of the horizon should show disk color
- No skybox/background should be visible through the horizon area

---

## Codebase Architecture (Relevant Files)

| File | Purpose |
|------|---------|
| `src/rendering/shaders/blackhole/main.glsl.ts` | Main raymarch loop, accumulation logic |
| `src/rendering/shaders/blackhole/gravity/horizon.glsl.ts` | `isInsideHorizon()` function |
| `src/rendering/shaders/blackhole/gravity/lensing.glsl.ts` | Ray bending, `ndDistance()` calculation |
| `src/rendering/shaders/blackhole/gravity/disk-volumetric.glsl.ts` | Accretion disk density/emission |
| `src/rendering/shaders/blackhole/gravity/shell.glsl.ts` | Photon shell emission |
| `src/rendering/renderers/BlackHole/BlackHoleMesh.tsx` | React component, shader compilation |
| `src/rendering/renderers/BlackHole/useBlackHoleUniformUpdates.ts` | Uniform value updates |

---

## Key Insights from Investigation

### 1. Raymarch Loop Structure (main.glsl.ts:259-414)

The loop iterates with these exit conditions checked at the START of each iteration:
```glsl
for (int i = 0; i < 512; i++) {
  if (i >= effectiveMaxSteps) break;
  if (totalDist > maxDist) break;
  if (accum.transmittance < uTransmittanceCutoff) break;

  float ndRadius = ndDistance(pos);
  if (isInsideHorizon(ndRadius)) {
    accum.transmittance = 0.0;
    hitHorizon = true;
    break;
  }
  // ... ray stepping, disk sampling ...
}
```

After the loop:
```glsl
if (hitHorizon) {
  accum.transmittance = 0.0;  // No background added
} else if (accum.transmittance > 0.01) {
  vec3 bgColor = sampleBackground(bentDirection);
  accum.color += bgColor * accum.transmittance;  // TRANSPARENCY!
}
```

### 2. Horizon Detection (horizon.glsl.ts)

```glsl
bool isInsideHorizon(float ndRadius) {
  return ndRadius < uVisualEventHorizon;
}
```

- Uses `uVisualEventHorizon` which accounts for Kerr spin
- For spin=0: equals `uHorizonRadius` (Schwarzschild)
- For spin=0.9: ~72% of `uHorizonRadius`

### 3. N-Dimensional Distance Calculation (lensing.glsl.ts:32-40)

```glsl
float ndDistance(vec3 pos3d) {
  float dist3dSq = dot(pos3d, pos3d);
  float sumSq = dist3dSq + uOriginOffsetLengthSq;
  return sqrt(max(sumSq, 1e-10));
}
```

- Adds `uOriginOffsetLengthSq` (perpendicular distance in higher dimensions)
- For dimension=3 with no N-D offset: `uOriginOffsetLengthSq = 0`
- Minimum possible ndRadius = `sqrt(uOriginOffsetLengthSq)`

### 4. Ray Bending (lensing.glsl.ts:119-243)

- Uses "Magic Potential" approach from Starless raytracer
- **ARTISTIC DEPARTURE FROM PHYSICS** (lines 138-162): Reduces lensing for rays far from photon sphere
- For purely radial rays (`h² ≈ 0`): NO bending occurs (line 134-136)
- Frame dragging adds azimuthal acceleration causing rays to spiral

### 5. Transparency Mechanism

Transparency occurs when:
1. `hitHorizon = false` (ray never triggered `isInsideHorizon()`)
2. `accum.transmittance > 0.01` (ray didn't accumulate enough opacity)
3. Background color is added to accumulated color

### 6. Uniform Values (verified via debug output)

- `uHorizonRadius`: Valid (default 0.5)
- `uVisualEventHorizon`: Valid (computed from Kerr formula)
- `uFarRadius`: Valid
- All uniforms confirmed to have non-zero, reasonable values

---

## Fix Attempts

### Attempt 1: Remove Kill Sphere Multiplier

**Change:** In `horizon.glsl.ts`, changed:
```glsl
// From:
return ndRadius < uVisualEventHorizon * 0.1;
// To:
return ndRadius < uVisualEventHorizon;
```

**Rationale:** The original code only triggered horizon at 10% of the visual horizon radius (a "kill sphere" near the singularity). This left the zone between 10% and 100% unhandled.

**Outcome:** No visible change. User reported "nothing has changed" - the kill sphere had already been eliminated in previous work.

---

### Attempt 2: Force Black Color on Horizon Hit

**Change:** In main.glsl.ts, when `hitHorizon = true`:
```glsl
accum.color = vec3(0.0);  // Force black
accum.transmittance = 0.0;
```

**Rationale:** Ensure accumulated color is reset to black when horizon is hit.

**Outcome:** FAILED - "overpainting parts of the accretion disc black and the part that should be black is transparent." This change caused disk areas to incorrectly turn black. Change was reverted.

---

### Attempt 3: Add SHADER_VERSION for Cache Busting

**Change:** Added `SHADER_VERSION` constant to `BlackHoleMesh.tsx` useMemo dependencies:
```typescript
const SHADER_VERSION = 1  // Increment to force recompilation
```

**Rationale:** React's useMemo was caching the compiled shader, preventing GLSL changes from taking effect.

**Outcome:** Shader now recompiles when version changes, but underlying bug persists.

---

### Attempt 4: Immediate Horizon Check After Step

**Change:** In main.glsl.ts, added horizon check immediately after ray position update:
```glsl
pos += dir * stepSize;
totalDist += stepSize;

// === IMMEDIATE HORIZON CHECK ===
{
  float postStepRadius = ndDistance(pos);
  if (isInsideHorizon(postStepRadius)) {
    accum.transmittance = 0.0;
    hitHorizon = true;
    break;
  }
}
```

**Rationale:** Race condition hypothesis - if a ray crosses into the horizon on step N, but the loop exits at the start of step N+1 due to `maxDist` or `maxSteps`, the horizon check never runs for that step.

**Outcome:** FAILED - Bug still present. The race condition hypothesis was incorrect or incomplete.

---

## Hypotheses Not Yet Tested

### 1. Lensing Causes Rays to Miss Horizon
The "artistic departure" in lensing reduces bending for far rays. Combined with frame dragging (spin > 0), rays might spiral and accumulate distance without ever getting close enough to trigger the horizon check.

### 2. Adaptive Step Size Issue
The `adaptiveStepSize()` function reduces step size near the horizon, but the minimum step (`uStepMin = 0.01`) might still be too large relative to the horizon radius, causing rays to "jump over" the detection zone.

### 3. N-Dimensional Geometry Mismatch
For higher dimensions, `uOriginOffsetLengthSq` adds to the distance calculation. If this value exceeds `uVisualEventHorizon²`, no ray can ever reach the horizon because the 3D slice doesn't intersect the N-D event horizon sphere.

### 4. Bounding Sphere Clipping
`farRadius = uFarRadius * uHorizonRadius` defines the bounding sphere. Rays that should hit the horizon might exit the bounding sphere first (`totalDist > maxDist`) before reaching the horizon check, especially for grazing angles.

### 5. Ray Direction Normalization Issues
After bending, rays are renormalized. Numerical precision issues near the horizon (where gravity is strongest) might cause rays to be deflected unexpectedly.

### 6. Transmittance Cutoff Early Exit
The `uTransmittanceCutoff` check could cause early exit if disk absorption reduces transmittance below threshold before the horizon is reached, but `hitHorizon` remains false.

---

## Debug Approaches for Future Investigation

1. **Visual Debug Output:** Render `ndRadius / uVisualEventHorizon` as color to see how close rays actually get to the horizon

2. **Trace Specific Rays:** Add debug mode that outputs the full path of rays at screen center

3. **Loop Exit Reason:** Track which exit condition triggers (maxSteps, maxDist, transmittance, horizon) and visualize as color

4. **Minimum Distance Tracking:** Track the minimum `ndRadius` achieved by each ray and render as heatmap

5. **Step Count Visualization:** Render number of steps taken per ray to identify rays that exhaust their step budget

---

## Files Modified (Current State)

| File | Modification |
|------|--------------|
| `main.glsl.ts` | Added immediate horizon check after step (lines 318-334) |
| `horizon.glsl.ts` | Uses `uVisualEventHorizon` directly (no 0.1 multiplier) |
| `BlackHoleMesh.tsx` | Added SHADER_VERSION = 2 |
| `absorption-debug.test.ts` | Updated tests to match current implementation |

---

## Recommendations

1. **Deeper Ray Tracing Analysis:** Instrument the shader to output detailed per-ray information about why transparency occurs

2. **Compare with Reference:** Find a working reference implementation (e.g., original Starless) and compare ray behavior step-by-step

3. **Simplify to Debug:** Temporarily disable all features except basic horizon detection to isolate the core issue

4. **GPU Debugger:** Use RenderDoc or similar to inspect actual shader execution and variable values per fragment
