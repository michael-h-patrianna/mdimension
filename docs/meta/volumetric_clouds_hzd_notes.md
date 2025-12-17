# Volumetric Clouds (Horizon Zero Dawn Style) — Developer Notes

This is a developer-focused extraction of technical ideas from **“The Real-time Volumetric Cloudscapes of Horizon Zero Dawn”** (Andrew Schneider, Guerrilla).

---

## 1) What “volumetric clouds” are in real-time

Volumetric clouds are rendered by defining a **3D density field** (a function returning how much “cloud matter” exists at a 3D position), then **ray marching** through that field along the camera ray to accumulate:

- **Opacity / alpha** (how much the cloud blocks the background)
- **Lighting / color** (how much light scatters toward the viewer)

In production, you typically cannot afford physically accurate multiple scattering, so the goal is to reproduce the key *perceptual* cues with approximations.

---

## 2) Data / Assets: Noise Textures Used (practical)

A key performance enabler is to **prebake noises into tiling textures**, minimizing runtime noise math and reducing texture reads via channel packing.

### 2.1 Base Shape Noise — 3D Texture #1 (128³, 4 channels)

Used to define the *low-frequency* (LF) cloud body.

- **Resolution:** `128 × 128 × 128`
- **Channels:**
  1. **Perlin–Worley** (Perlin “dilated/warped” by Worley)
  2–4. **Worley noise** at increasing frequencies  
- Used like fBm layers, but packed into channels for fewer reads.

**Perlin–Worley intuition:** Worley yields “packed billows.” Combined with Perlin it keeps connectivity while adding billowy structure.

### 2.2 Detail / Edge Erosion — 3D Texture #2 (32³, 3 channels)

Used for higher-frequency (HF) shaping: edge erosion + breakup.

- **Resolution:** `32 × 32 × 32`
- **Channels:** 3 Worley layers at increasing frequency
- **Purpose:** erode edges, add detail to the base cloud shape.

### 2.3 Distortion / Turbulence — 2D Curl Noise (128², 3 channels)

Used to fake turbulent flow.

- **Resolution:** `128 × 128`
- **Channels:** 3 “curl noise dimensions”
- Curl noise is **non-divergent**, producing swirling motion that reads as atmospheric turbulence.
- Used to **distort sampling coordinates**, especially for HF detail noise.

---

## 3) Cloud “Type” & Vertical Structure: Height Gradients + Coverage

Classic approach: `density = fBm * heightGradient`.  
The HZD approach uses multiple presets and blends between them based on weather/type signals.

### 3.1 Three Height Gradient Presets

Instead of one gradient, they use **3 presets** representing low-altitude cloud types:

- **Stratus**
- **Cumulus**
- **Cumulonimbus**

A “cloud type” signal determines blending between these vertical profiles at the sample position.

### 3.2 Coverage Signal (0..1)

A separate value controls how much cloud exists locally:

- `coverage ∈ [0,1]`
- Multiplies / modulates the density result.
- Used for artistic control and weather transitions.

---

## 4) Weather Map / System (drives placement and type)

Large-scale cloud placement/types are driven by a world-space weather representation.

### 4.1 Weather Texture Channels (RGB)

A small “weather map” represents world-space conditions:

- **Red = coverage**
- **Green = precipitation**
- **Blue = cloud type**

This map can be procedural/simulated and/or authored for art direction.

### 4.2 Precipitation → Cumulonimbus Transition

Precipitation pushes the system toward **cumulonimbus** at around **70% coverage** (as presented in the talk).

### 4.3 Horizon / World Scale Handling

Cloudscapes are drawn within a **large radius around the player**, approximately:

- **~35 km radius**
- Starting around **~15 km distance**

They bias the horizon toward “interesting” shapes by transitioning toward cumulus around ~50% coverage.

### 4.4 Cinematic Overrides

For scripted shots, they override weather signals with **custom painted textures**.

---

## 5) Density Function: How the 3D cloud field is built

At each raymarch sample position `p`, the density function combines:

1) Low-frequency base shape  
2) Height/type modulation  
3) Coverage shaping  
4) Base reduction near bottoms  
5) Detail erosion at edges  
6) Distortion via curl noise

### 5.1 Step-by-step (pipeline)

**(1) Base cloud body**
- Sample 3D Texture #1 (Perlin–Worley + Worley channels)
- Multiply by blended **height gradient** (type-based)

**(2) Coverage + base shaping**
- Multiply by `coverage`
- Reduce density at the cloud bottom (fade/soften base)

**(3) Edge erosion & wisps**
- Sample 3D Texture #2 and **subtract it at edges** to erode silhouette
- Tip: **invert Worley at the base** to get wispy shapes

**(4) Distort detail field**
- Distort HF sampling coordinates with **2D curl noise** for swirly turbulence.

### 5.2 Conceptual pseudocode

```c
float sampleCloudDensity(float3 pWS)
{
    // 1) Weather signals
    Weather w = sampleWeatherMap(pWS.xz); // coverage/type/precip

    // 2) Vertical normalization within cloud layer
    float h = normalizeHeightInCloudLayer(pWS.y); // 0..1

    // 3) Height profile blend by type (stratus/cumulus/cb)
    float heightSignal =
        lerp( lerp(heightStratus(h), heightCumulus(h), w.typeBlend),
              heightCumulonimbus(h),
              w.precipBlend );

    // 4) Base shape (3D tex1)
    float base = sampleTex3D_1(pWS * baseScale).perlinWorley;
    base *= heightSignal;

    // 5) Coverage shaping + soften bottoms
    base *= w.coverage;
    base *= bottomFade(h);

    // 6) HF erosion (distorted)
    float2 curl = sampleCurl2D(pWS.xz * curlScale).xy * curlStrength;
    float3 pDetail = pWS + float3(curl.x, 0, curl.y);

    float detail = sampleTex3D_2(pDetail * detailScale).worleyCombo;

    // "Erode at edges"
    float density = base - detail * edgeErodeStrength;

    return saturate(density);
}
```

---

## 6) Ray Marching: How it’s rendered

### 6.1 Basic approach

- March along the view ray through the cloud volume.
- At each step:
  - Evaluate density
  - Accumulate alpha (opacity)
  - Compute lighting contribution and accumulate color
- Early exit when transmittance is low (nearly opaque).

### 6.2 Sample counts vary with view angle

Because ray length increases toward the horizon:

- Around **64 samples** looking more upward
- Up to **128 samples** toward the horizon  
(“potential” maximum; early-exit can terminate sooner)

---

## 7) Lighting: Approximations that sell realism

### 7.1 Beer’s Law (transmittance)

Used to model attenuation through participating media:

- **Transmittance:** `T = exp(-τ)` where `τ` is optical thickness.

Applied for:
- View ray attenuation through cloud depth
- Light ray attenuation toward the sun

### 7.2 Henyey–Greenstein phase (anisotropy)

Used to approximate view-dependent scattering (forward scattering near the sun).

Common form:

```text
P_HG(cosθ) = (1 - g^2) / (4π * (1 + g^2 - 2g cosθ)^(3/2))
```

- `g` controls forward scattering (`g≈0` isotropic; higher values = more forward)

### 7.3 “Powder effect” (cheap multiple-scattering cue)

A hack to mimic the brighter “puffy glow” near silhouettes / shallow depths.

- Beer: `E = exp(-d)`
- Powder: `E = 1 - exp(-d * k)` (k≈2 shown in slides)
- Combine to get the characteristic “Beer’s-Powder” look.

### 7.4 Conceptual energy model

They present a combined idea like:

- `Energy = exp(-d * r) * HG * P`

Where:
- `d` = depth through cloud
- `r` = shadowing term from light sampling
- `HG` = Henyey–Greenstein phase
- `P` = powder term

---

## 8) Light visibility sampling (performance-aware)

### 8.1 Cone sampling toward the sun (≈6 samples)

Instead of a costly shadow raymarch:
- Sample **~6 times in a cone toward the sun**
- Helps reduce banding vs. very low step counts
- Includes a **final far sample** to pick up shadows from distant clouds

### 8.2 Adaptive shading based on alpha

Optimization:
- Once accumulated alpha reaches ~**0.3**, switch to a cheaper lighting path.
- Reported as roughly **~2× faster** for that section.

---

## 9) Color composition & atmospheric blending (high level)

Common production assumptions used to achieve believable results:
- Ambient sky contribution increases with height
- Direct light is dominated by sun direction/color
- Distance/atmosphere attenuates and tints clouds toward horizon

They also carry a depth/coverage-like signal to aid atmospheric blending.

---

## 10) High altitude clouds (cheap 2D layer)

After volumetric, add a separate **2D** cloud layer for high altitude clouds (thin, far, cirrus-like) to get complexity without volumetric cost.

---

## 11) Major performance tricks (what makes it shippable)

### 11.1 Temporal reprojection + partial updates (“checkerboarding”)

Critical approach:
- Compute clouds in a **quarter resolution buffer**
- Update only **1 out of 16 pixels** per frame (per 4×4 block)
- Reproject previous frame for the rest

### 11.2 Fallback where reprojection fails

At reprojection failure areas (e.g., edges/disocclusions), fill from available low-res buffers.

### 11.3 Half-res rendering + upscale

Rendering at half/quarter res + upscale yields huge speedups (presented as **10×+** improvements in practice).

### 11.4 Performance target

They aimed for roughly **~2 ms** total, with instruction count being a major driver.

---

## 12) Recommended implementation plan (if you’re building this)

### Step A — Offline noise asset generation
- Generate & pack:
  - `Tex3D_1 (128³ RGBA)`: Perlin–Worley + 3 Worley octaves
  - `Tex3D_2 (32³ RGB)`: 3 Worley octaves for erosion/detail
  - `Tex2D_curl (128² RGB)`: curl noise for distortion

### Step B — Weather map system
- Maintain a world-space weather map:
  - `R=coverage`, `G=precip`, `B=type`
- Allow:
  - procedural evolution + authored override textures

### Step C — Density function in shader
- Base noise * height profile blend * coverage
- Bottom fade
- Detail erosion (subtract at edges)
- Curl distortion for HF noise coords

### Step D — Raymarch
- Intersect view ray with cloud layer bounds
- March N steps (64..128; early-exit)
- Output:
  - RGB lighting
  - Alpha
  - Optional depth/aux channel for blending

### Step E — Lighting
- 6-sample cone toward sun for visibility
- Apply Beer + HG + powder approximations
- Switch to cheaper shading above alpha ~0.3

### Step F — Temporal / resolution methods
- Render volumetrics at half/quarter res
- Temporal reprojection + 1/16 pixel update per frame
- Upscale + fallback for invalid reprojection

---

## 13) Quick “copy these” checklist

- ✅ Perlin–Worley base noise (connected shapes + billows)
- ✅ Worley erosion noise (edge breakup)
- ✅ Curl distortion for turbulence
- ✅ Height-profile presets (stratus/cumulus/cb) blended by weather
- ✅ Weather map RGB encoding (coverage/precip/type)
- ✅ 6-sample cone light visibility toward the sun (+ far sample)
- ✅ Powder term to fake multiple scattering feel
- ✅ Variable ray steps (64→128 with horizon angle)
- ✅ Alpha threshold (~0.3) to switch to cheaper lighting
- ✅ Quarter-res temporal reprojection (update 1/16 pixels per frame)
- ✅ Half/quarter res + upscale for large performance gains
