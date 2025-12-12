# mdimension — Environment Upgrade Options (React + Three.js / R3F)

This document turns the environment suggestions into **buildable, developer-ready** work items for a browser-based React + Three.js stack (commonly React Three Fiber).
Goal: make the scene feel high-quality while preserving **mathematical clarity** and maintaining **performance control** via presets and quality tiers.

---

## Assumptions / stack

- Rendering: **Three.js** (direct) or **React Three Fiber** (recommended for componentization).
- Optional helpers: `@react-three/drei` (Environment, Grid, ContactShadows, etc.)
- Optional post: `postprocessing` via `@react-three/postprocessing` (SMAA/FXAA, SSAO, Bloom, SSR, GodRays).
- Target: desktop + mobile browsers. Effects should have toggles and quality tiers.

---

## Build strategy (high-level)

### 1) Environment presets
Implement a small set of **Environment Presets** that bundle multiple features:

- **Scientific Studio (default)**
- **Scientific Void**
- **Cosmic Exploration**
- **Museum**
- **Cinematic (opt-in)**

Each preset references a shared configuration object:

```ts
type QualityTier = "low" | "medium" | "high" | "ultra";

type EnvConfig = {
  presetId: string;
  quality: QualityTier;

  // Lighting
  toneMapping: "ACES" | "Neutral" | "None";
  exposure: number;
  keyLight: { intensity: number; castShadow: boolean; shadowRes: number };
  fillLight: { intensity: number };
  rimLight: { intensity: number };

  // Grounding
  contactShadows: { enabled: boolean; resolution: number; blur: number; opacity: number };

  // Background
  background: { mode: "gradient" | "hdri" | "none" | "shader"; params: any };

  // Reference cues
  grid: { enabled: boolean; fadeDistance: number; density: number; wireframeSafe: boolean };
  axes: { enabled: boolean; size: number; ticks: boolean };

  // Atmosphere
  fog: { enabled: boolean; type: "exp2" | "linear" | "post"; density: number; color: string };
  particles: { enabled: boolean; count: number; layers: number; size: number; opacity: number };

  // Post
  aa: { mode: "off" | "fxaa" | "smaa" | "msaa"; quality: number };
  bloom: { enabled: boolean; intensity: number; threshold: number };
  ssao: { enabled: boolean; samples: number; radius: number; intensity: number };
  reflections: { mode: "off" | "ssr" | "planar"; resolution: number; blur: number };
  godrays: { enabled: boolean; density: number; weight: number; resolution: number };

  // Learning overlays
  rotationScaffold: { enabled: boolean; opacity: number };
};
```

### 2) Quality tiers (performance knobs)
Quality tier drives resolution/sample counts. Example mapping:

- **low**: shadows 512, contact shadows 256, SSR off, SSAO off, AA FXAA, particles minimal
- **medium**: shadows 1024, contact 512, SSAO low, AA SMAA
- **high**: shadows 2048, contact 1024, SSAO medium, SSR medium, AA SMAA
- **ultra**: shadows 2048–4096, SSAO high, SSR high/planar, godrays optional

### 3) Progressive enhancement (don’t block first render)
- Render immediately with: gradient background + lights + grid (optional).
- Load heavier assets/effects asynchronously: HDRI, SSR, SSAO.
- Add a non-intrusive UI indicator while enhancing.

### 4) Render scheduling
- If your app doesn’t require continuous animation, use **demand-based rendering**:
  - R3F: `frameloop="demand"` and call `invalidate()` on interaction / transitions.
- Optionally reduce fps when idle: render at 30fps or only on changes.

---

# Suggestions (developer-ready build items)

Below are 14 environment upgrades. Each includes:
- **What** the user sees
- **What to build** (components + steps)
- **Parameters** to expose
- **Performance / pitfalls**
- **QA checklist**

---

## 1) Correct color management + tone mapping + exposure (baseline quality)

### What users see
- Less “flat/cheap” look; consistent brightness across presets; better highlights and contrast.

### What to build
1. Ensure renderer is configured correctly:
   - Three.js: `renderer.outputColorSpace` (modern) and correct texture encodings.
   - Choose a tone mapping operator: **ACES Filmic** as default.
2. Add a global `Exposure` control in settings and per-preset defaults.
3. Confirm material colors are authored in the expected space (sRGB for UI-picked colors).

### Parameters
- `toneMapping`: ACES / Neutral / None
- `exposure`: e.g. 0.6–1.8
- optional: `physicallyCorrectLights` toggle (if not already)

### Performance / pitfalls
- Performance cost is negligible.
- **Pitfall:** enabling tone mapping changes how existing colors look → you must re-tune lighting/material defaults.

### QA checklist
- Compare before/after screenshots: wireframe + solid + volumetric.
- Verify background gradients don’t band (use dither/grain lightly if needed).
- Validate consistent appearance across browsers.

---

## 2) Studio light rig preset (key + fill + rim) with selective shadows

### What users see
- Professional product-viz lighting: readable surfaces and edges; strong silhouette.

### What to build
1. Create a reusable `StudioLights` component.
2. Place:
   - **Key light**: directional/spot, angled ~45°, main intensity, optional shadows.
   - **Fill light**: softer, lower intensity, no shadows.
   - **Rim/back light**: highlights silhouette, no shadows.
3. Implement **single shadow caster** rule (usually key light only).
4. Tie shadow resolution to quality tier.

### Parameters
- Key intensity, position, angle
- Shadow enabled, shadow map size (512–2048/4096)
- Rim intensity and (optional) color temperature

### Performance / pitfalls
- Shadows are the main cost. Keep 1 caster.
- **Pitfall:** wrong shadow bias causes acne/peter-panning. Provide tuned defaults per object scale.

### QA checklist
- No shadow shimmering during orbit.
- Tesseract edges remain clear; faces not blown out.
- Shadows look consistent when object scale changes.

---

## 3) Contact shadows / shadow catcher (grounding without heavy shadows)

### What users see
- Object feels anchored; improved depth and scale even in “void” scenes.

### What to build
Option A (R3F/drei): `ContactShadows` under the object.
Option B (manual): shadow-catching plane with a blurred projected shadow.

Steps:
1. Add a ground-aligned contact shadow system that follows the object’s bounding box.
2. Auto-center and auto-scale the shadow area based on object size.
3. Expose opacity/blur controls; tie resolution to quality tier.

### Parameters
- `opacity`, `blur`, `distance/far`
- `resolution`: 256–2048
- `color` (usually near-black)

### Performance / pitfalls
- Cost scales with resolution + blur.
- **Pitfall:** shadow looks like a dark stain if opacity too high or blur too low.

### QA checklist
- Shadow is subtle at default.
- No clipping when rotating or changing dimensions.
- Mobile tier uses reduced resolution.

---

## 4) HDRI Image-Based Lighting (IBL) + optional blurred background

### What users see
- Rich highlights/reflections, better material response; can still keep background simple.

### What to build
1. Add HDRI environment loading + PMREM preprocessing.
2. Decouple “lighting environment” from “visible background”:
   - HDRI for reflections/lighting.
   - Gradient/shader for background unless user selects HDR background.
3. Add lazy-loading and caching for HDRIs.
4. Provide a small curated HDR pack (studio, soft room, subtle sci-fi).

### Parameters
- HDR selection
- `intensity` / environment strength
- `backgroundMode`: none / gradient / HDR visible
- `blur`: background blur amount (optional)

### Performance / pitfalls
- Bandwidth/memory heavy; compress where possible.
- **Pitfall:** busy HDR backgrounds distract from wireframes; keep visible background optional.

### QA checklist
- HDR loads async without freezing.
- Exposure and HDR intensity don’t overblow highlights.
- Works on WebGL2 and gracefully degrades.

---

## 5) Procedural gradient / aurora shader background (no textures)

### What users see
- A modern, alive background with subtle motion—without “asset pack” vibes.

### What to build
1. Implement `GradientBackground` as:
   - Large inverted sphere OR fullscreen quad behind scene.
2. Write a fragment shader with:
   - 2–3 color stops
   - soft noise (single octave) or time-based drift
   - optional vignette / radial falloff
3. Ensure `depthWrite=false` and render order behind all objects.

### Parameters
- Palette (scientific, cosmic, neon)
- Motion speed (0 to subtle)
- Vignette strength
- Noise strength

### Performance / pitfalls
- Keep shader simple (avoid heavy FBM loops).
- **Pitfall:** too bright reduces wireframe contrast. Provide safe palettes.

### QA checklist
- No visible banding on common monitors.
- Wireframe remains high-contrast on all palettes.
- Background does not “swim” distractingly.

---

## 6) Adaptive grid + axes + tick marks (math reference frame)

### What users see
- Better orientation and scale; object movement feels meaningful in space.

### What to build
1. Replace the single plane with a `ReferenceFrame` system:
   - Grid that fades with distance
   - Axes helper (X/Y/Z)
   - Optional tick marks (small lines or labels)
2. Make grid density adaptive:
   - Zoom in → finer grid
   - Zoom out → reduce density to avoid moiré
3. Add “wireframe-safe” mode:
   - lower opacity
   - fewer lines
   - stronger fade out

### Parameters
- Grid enable, opacity, density, fadeDistance
- Axes enable, size
- Tick enable and frequency

### Performance / pitfalls
- Cheap geometry, but aliasing can be an issue.
- **Pitfall:** moiré patterns and shimmering—pair with SMAA/MSAA and use fade.

### QA checklist
- No shimmering during orbit at typical speeds.
- Grid doesn’t overpower wireframes.
- Works with both perspective and orthographic cameras (if supported).

---

## 7) Rotation-plane scaffold overlay (environment as explanatory UI)

### What users see
- Active 4D/ND rotation plane(s) shown as faint rings/planes—controls become intuitive.

### What to build
1. Create `RotationScaffold` that:
   - Reads current rotation plane selections (e.g., XY, XW, YW…)
   - Renders translucent planes or rings indicating those axes
2. Render only when:
   - user is interacting with rotation controls OR
   - “Learning mode” is enabled
3. Use soft materials: additive or transparent with depth fade.

### Parameters
- Enable (learning mode toggle)
- Opacity
- Show rings vs planes
- Auto-hide timeout after interaction

### Performance / pitfalls
- Mostly UX complexity, not GPU cost.
- **Pitfall:** clutter if multiple planes shown; cap to active/selected planes.

### QA checklist
- Scaffold aligns with object axes consistently.
- Interaction feels helpful, not noisy.
- Scaffold never blocks object visibility too much.

---

## 8) Fog / atmospheric perspective (subtle depth cue)

### What users see
- Depth and scale; far geometry softens; scene feels less empty.

### What to build
Option A: Three.js `FogExp2` / `Fog` (cheap).
Option B: Post depth fog (more control, easier palette matching).

Steps:
1. Add fog to presets that benefit (Cosmic, Cinematic).
2. Provide a single “Atmosphere” slider per preset.
3. Auto-disable or reduce fog for wireframe clarity mode.

### Parameters
- Fog enabled
- Type: exp2 / linear / post
- Density / near-far
- Color (match background)

### Performance / pitfalls
- Built-in fog is cheap.
- **Pitfall:** wireframes lose crispness if fog too strong or too near.

### QA checklist
- Wireframe preset stays crisp.
- Fog matches palette; no harsh cutoff.
- No weird depth issues.

---

## 9) Reflections: SSR and/or planar reflector floor (premium toggle)

### What users see
- “Premium” depth and composition; great for showcase renders.

### What to build
Offer both modes:

**A) SSR reflections**
1. Add SSR via postprocessing.
2. Provide controls: resolution scale, max distance, blur/roughness.

**B) Planar reflections**
1. Add reflective ground using a reflector material (or `MeshReflectorMaterial`).
2. Render reflection at reduced resolution on medium tier.

### Parameters
- Mode: off / SSR / planar
- Resolution scale (0.25–1.0)
- Blur / roughness
- Fade distance and opacity

### Performance / pitfalls
- SSR has artifacts at edges/off-screen.
- Planar adds an extra render pass.
- **Pitfall:** reflections emphasize aliasing—pair with strong AA.

### QA checklist
- No flicker on orbit.
- SSR artifacts acceptable and documented.
- Planar doesn’t tank FPS in medium tier.

---

## 10) Subtle instanced particles (parallax depth layers)

### What users see
- Depth via parallax when orbiting; “air” in the scene.

### What to build
1. Create `ParticleField` with 2–3 depth layers around the object:
   - near sparse, mid moderate, far sparse
2. Use a single `Points` buffer or instanced sprites:
   - soft sprite
   - depth fade
   - optional subtle twinkle
3. Keep alpha overdraw low: small particles, low opacity.

### Parameters
- Enabled
- Count (per tier)
- Size, opacity
- Drift speed (0 default, optional subtle)

### Performance / pitfalls
- Overdraw is the main cost.
- **Pitfall:** looks like noise if too dense. Use strong depth falloff.

### QA checklist
- No “popping” or harsh patterns.
- Doesn’t obscure object.
- Mobile uses reduced count.

---

## 11) Museum pedestal preset (shareable renders / marketing)

### What users see
- Object presented like an exhibit; great screenshots.

### What to build
1. Add a simple pedestal mesh (cylinder/rounded box).
2. Material: matte stone/plastic, slightly rough.
3. Lighting: stronger rim + softer fill.
4. Auto-fit pedestal size based on object bounding box.

### Parameters
- Pedestal enabled
- Height/scale auto-fit
- Material roughness/color

### Performance / pitfalls
- Very cheap.
- **Pitfall:** pedestal must not intersect object under rotations and dimension changes.

### QA checklist
- Pedestal never intersects object.
- Looks good across multiple object sizes.
- Screenshot mode frames consistently (optional camera preset).

---

## 12) SSAO (ambient occlusion) for solid-face readability

### What users see
- Better depth in overlaps; complex solids read clearly.

### What to build
1. Add SSAO post effect for solid shading presets.
2. Keep defaults conservative.
3. Downsample SSAO buffer for medium/low tiers.

### Parameters
- Enabled
- Samples (tiered)
- Radius
- Intensity
- Downsample factor

### Performance / pitfalls
- Medium–high cost.
- **Pitfall:** AO can look dirty if overdone. Make subtle and user-adjustable.

### QA checklist
- Clear improvement without darkening everything.
- No halo artifacts at edges.
- Works with your render pipeline (especially transparency cases).

---

## 13) Anti-aliasing strategy (wireframe premium requirement)

### What users see
- Cleaner lines, less shimmer in motion.

### What to build
Provide AA modes:
- FXAA (cheap baseline)
- SMAA (better for lines)
- MSAA render target (WebGL2) if supported

Steps:
1. Add AA selection to the post pipeline.
2. Detect WebGL2 for MSAA targets; fall back automatically.
3. Tie defaults to quality tiers.

### Parameters
- Mode: off / FXAA / SMAA / MSAA
- Quality factor (SMAA preset)

### Performance / pitfalls
- MSAA can be memory-heavy.
- **Pitfall:** some wireframe shimmer remains if line thickness too thin; consider a minimum line width or alternative line rendering approach.

### QA checklist
- Orbit test shows significantly reduced shimmer.
- No UI blur.
- Fallback behavior is correct per device.

---

## 14) Cinematic volumetrics / god rays (beauty mode)

### What users see
- Dramatic beams and glow; ideal for raymarched objects and “wow” mode.

### What to build
1. Add “Cinematic” post stack:
   - Bloom (subtle, tuned)
   - Fog (optional)
   - God rays from a bright light or emissive object
2. Quality-gate via downsampling.
3. Make it opt-in to protect clarity and performance.

### Parameters
- Enabled
- Density/weight
- Resolution scale
- Bloom intensity/threshold

### Performance / pitfalls
- High cost; should be opt-in with quality settings.
- **Pitfall:** obscures detail; default should remain clarity-first.

### QA checklist
- Cinematic looks impressive without hiding the object.
- No major banding.
- Performance drop is acceptable and controlled by tier.

---

# Recommended preset bundles (ship these first)

## A) Scientific Studio (default)
- Tone mapping + exposure
- Studio lights (1 shadow caster)
- Contact shadows
- Adaptive grid + axes (wireframe-safe)
- AA: SMAA (or FXAA on low)
- Background: subtle gradient shader

## B) Scientific Void
- Dark radial gradient background
- Minimal grid fade (optional)
- Particles: subtle
- Bloom: very low
- Fog: off or minimal

## C) Cosmic Exploration
- Nebula/aurora shader background
- Particles: 2–3 layers
- Fog: subtle
- Optional grid/axes toggle

## D) Museum
- Pedestal + studio/rim lighting
- Contact shadows
- Background: clean gradient
- Optional HDRI lighting (not visible background)

## E) Cinematic (opt-in)
- Reflections: SSR or planar
- Fog + bloom + god rays
- SSAO (solids only)
- Higher AA / higher resolution where possible

---

# Acceptance criteria (global)

1. User can switch presets without reload; transitions are smooth.
2. User can choose Quality tier (low/med/high/ultra) and see effects scale.
3. Default preset prioritizes clarity and performance while looking premium.
4. Heavy effects (SSAO/SSR/godrays/planar reflections) are opt-in and degrade gracefully.
5. Scene remains readable in:
   - wireframe
   - solid faces
   - raymarched/volumetric objects

---

# Implementation checklist (engineering)

- [ ] Central `EnvConfig` store (state) + preset definitions
- [ ] `EnvironmentManager` component applying config to renderer, lights, post stack
- [ ] Background system: `GradientBackground` + optional HDR background
- [ ] Lighting system: `StudioLights` + shadow tuning
- [ ] Grounding: `ContactShadows` + optional reflector plane
- [ ] ReferenceFrame: adaptive grid + axes
- [ ] Learning overlays: RotationScaffold
- [ ] Post stack: AA + Bloom + optional SSAO + SSR + GodRays
- [ ] Progressive loading for HDR assets and heavy effects
- [ ] Performance tier mapping + auto fallback (optional)
