# PRD: N‑Dimensional Schrödinger Volume Visualizer (3D slice through 3D–11D)

## 1) Summary

We will add a new “Schrödinger (ND)” object type that renders **slowly morphing, organic volumetric structures** derived from the **time-dependent Schrödinger equation** in **D dimensions (3 ≤ D ≤ 11)**.

The key idea is to render a **3D slice** through an **N‑dimensional complex wavefunction** \(\psi(\mathbf{x}, t)\) by reusing the current Mandelbulb pipeline’s **rotating 3D slice plane**:

\[
\mathbf{x}_{ND} = \mathbf{uOrigin} + x\,\mathbf{uBasisX} + y\,\mathbf{uBasisY} + z\,\mathbf{uBasisZ}
\]

This exact mapping is already used by the Mandelbulb renderer (see uniforms comment: `c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ`).

Instead of a fractal distance estimator, we will evaluate a **density field**
\[
\rho(\mathbf{x},t) = |\psi(\mathbf{x},t)|^2
\]
and perform **true volume raymarching** (Beer–Lambert absorption + emission), which produces continuous, “blobby” organic volumes (not particle-like).

## 2) Goals

### Must-have
- Render **organic volumes** that **slowly morph over time** (continuous deformation; no particle system look).
- Support **D = 3..11** dimensions.
- Reuse the existing **ND rotation + slice plane system** (rotations around any plane, and extra-dimension “slice/origin” motion).
- Maintain interactive performance with adaptive quality (fast mode while rotating, higher quality when stable).
- Provide a parameter set that can generate **many visually distinct** results (seeded presets).

### Nice-to-have
- Multiple render modes:
  - “Volumetric” (primary)
  - “Isosurface” (secondary; thresholded density)
- Color modes based on wavefunction phase and/or density gradients.

### Non-goals
- Full general PDE solving on GPU for arbitrary potentials (too slow/complex for real-time).
- Physically accurate quantum simulation validation—this is a **visualizer** using well-defined analytic solutions.

## 3) Chosen Approach (Performance ↔ Fidelity ↔ Variety)

### We choose: **Superposition of separable eigenstates** in a **D‑dimensional harmonic oscillator (HO)** potential.
Reasoning:
- **Analytic eigenstates** → no expensive PDE solve.
- **Separable** in D dimensions → \(\psi\) is a product of 1D basis functions (cheap).
- **Superposition** of a few eigenstates → time-dependent interference → **slowly morphing** volume.
- Gaussian envelope → naturally bounded shapes (good for raymarching + early exits).
- Very large “design space” by varying:
  - quantum numbers per dimension
  - per-dimension frequencies
  - complex coefficients
  - slice plane rotation + origin drift

This is the best balance for:
- **Performance**: O(K · D) per sample where K is #terms (small: 4–8).
- **Fidelity**: smooth continuous density and gradients.
- **Visual variety**: interference patterns and rotating ND slices create rich evolving forms.

## 4) Math Deep Dive (What devs need)

### 4.1 Schrödinger Equation
Time-dependent Schrödinger equation:
\[
i\hbar \frac{\partial \psi}{\partial t} = \hat{H}\psi
\]
where the Hamiltonian is:
\[
\hat{H} = -\frac{\hbar^2}{2m}\nabla^2 + V(\mathbf{x})
\]

We will work in **dimensionless units** for the shader:
- set \(\hbar = 1\), \(m = 1\)
- all frequencies, lengths, and times are in “visual units”

### 4.2 Eigenstates and time evolution
If \(\phi_k(\mathbf{x})\) is an eigenstate of \(\hat{H}\) with energy \(E_k\):
\[
\hat{H}\phi_k = E_k\phi_k
\]
then the time evolution is:
\[
\psi_k(\mathbf{x},t) = \phi_k(\mathbf{x})e^{-iE_k t}
\]

A general solution can be expressed as a superposition:
\[
\psi(\mathbf{x},t) = \sum_{k=1}^{K} c_k\,\phi_k(\mathbf{x})\,e^{-iE_k t}
\]
where \(c_k\) are complex coefficients.

The rendered density is:
\[
\rho(\mathbf{x},t) = |\psi|^2 = \psi^*\psi
\]
Because of interference between terms with different energies, \(\rho\) changes over time → **morphing volumes**.

### 4.3 D‑dimensional harmonic oscillator eigenstates (separable)
We choose:
\[
V(\mathbf{x}) = \tfrac{1}{2}\sum_{j=1}^{D} \omega_j^2 x_j^2
\]

Eigenstates factorize:
\[
\phi_{\mathbf{n}}(\mathbf{x}) = \prod_{j=1}^{D} \varphi_{n_j}^{(\omega_j)}(x_j)
\]
where \(\mathbf{n} = (n_1,\dots,n_D)\) is a vector of nonnegative integers (“quantum numbers” per dimension).

Each 1D eigenfunction (up to a normalization constant) is:
\[
\varphi_{n}^{(\omega)}(x) = H_n(\alpha x)\,e^{-\tfrac{1}{2}(\alpha x)^2}
\quad\text{with}\quad
\alpha=\sqrt{\omega}
\]
and \(H_n\) is the Hermite polynomial.

Energy for the D‑dim HO state:
\[
E_{\mathbf{n}} = \sum_{j=1}^{D} \omega_j\left(n_j+\tfrac{1}{2}\right)
\]

**Implementation note:** we do **not** need exact physical normalization, only stable relative scaling. We will clamp/normalize visually (see §7).

### 4.4 Hermite polynomials (shader-friendly)
We only need low orders \(n \le 6\) (configurable). Use a recurrence:
- \(H_0(u)=1\)
- \(H_1(u)=2u\)
- \(H_{n+1}(u)=2uH_n(u)-2nH_{n-1}(u)\)

This avoids factorials and keeps the shader cheap.

### 4.5 ND → 3D slice mapping (reusing Mandelbulb infrastructure)
A pixel corresponds to a 3D point along a ray in “object space” \((x,y,z)\).
We map that point into D dimensions using the already-existing rotated basis vectors:
\[
\mathbf{x}_{ND} = \mathbf{uOrigin} + x\,\mathbf{uBasisX} + y\,\mathbf{uBasisY} + z\,\mathbf{uBasisZ}
\]

- Rotating in any ND plane changes the 3D slice orientation → evolving cross-sections.
- Animating \(\mathbf{uOrigin}\) in higher dimensions (“slice animation”) sweeps through the ND field, also yielding motion even when the wavefunction is stationary.

## 5) Rendering Model (Volumetric first)

### 5.1 Density field
Per ray sample:
1. compute \(\mathbf{x}_{ND}\)
2. compute \(\psi(\mathbf{x}_{ND},t)\)
3. compute \(\rho = |\psi|^2\)

For stability and dynamic range:
\[
s = \log(\rho + \epsilon)
\]
Use \(s\) for shading and thresholding (optional).

### 5.2 Volume integration (Beer–Lambert)
For step length \(\Delta l\):
- absorption coefficient: \(\sigma = \texttt{uDensityGain}\)
- local alpha:
\[
\alpha = 1 - e^{-\sigma \rho \Delta l}
\]
Accumulate:
- `color += transmittance * alpha * emissionColor(ρ, phase, grad)`
- `transmittance *= (1 - alpha)`
Early exit when transmittance is low.

This yields continuous “fog/ink” volumetric looks (organic).

### 5.3 Normals / lighting for “organic solid” look
Compute a pseudo-normal from the gradient of \(s=\log(\rho+\epsilon)\) in **3D sample space**:
\[
\nabla s \approx \left(
s(x+\delta,y,z)-s(x-\delta,y,z),
s(x,y+\delta,z)-s(x,y-\delta,z),
s(x,y,z+\delta)-s(x,y,z-\delta)
\right)
\]
Each \(s(\cdot)\) evaluation internally maps to ND via the basis vectors.
Normalize to get a normal for the existing lighting system.

## 6) Implementation Plan (Start from Mandelbulb copy)

### 6.1 Files to create
- `SchrodingerNDMesh.tsx` (copy of `MandelbulbMesh.tsx`)
- `schrodinger_nd.frag` (copy of `mandelbulb.frag`)
- `schrodinger_nd.vert` (copy of `mandelbulb.vert`, likely unchanged)

### 6.2 TSX changes (high-level)
Keep:
- ND rotation basis computation and caching
- uniforms `uBasisX`, `uBasisY`, `uBasisZ`, `uOrigin`
- adaptive quality behavior (fast mode during rotations)
- existing opacity/volumetric quality controls

Replace Mandelbulb-specific uniforms:
- remove/ignore `uPower`, `uIterations`, `uEscapeRadius`, etc.
Add Schrödinger uniforms (§6.4).

Important: keep the mental model that **the shader is still drawing a 3D slice in a cube**, but the field evaluation happens in ND.

### 6.3 Shader changes (conceptual “what to replace”)
In `mandelbulb.frag`, you currently have a field definition built around fractal iteration and/or DE-based raymarching. Replace that core evaluation with:

- `vec2 psi = evalPsi(xND, t);`
- `float rho = dot(psi, psi);`  (since psi is (re, im))
- Use `rho` (or `log(rho+eps)`) as your density scalar for volumetric march / shading.

Everything else (camera ray setup, temporal depth, lighting hooks) can remain largely intact.

### 6.4 New uniforms (shader interface)
Constants:
- `#define MAX_DIM 11`
- `#define MAX_TERMS 8` (tunable)

Uniforms:
- `int uDimension;` (3..11; keep naming consistent with existing infra)
- `int uTermCount;` (1..MAX_TERMS)
- `float uOmega[MAX_DIM];` (per-dimension frequency)
- `int uQuantum[MAX_TERMS * MAX_DIM];` (flattened n[k][j])
- `vec2 uCoeff[MAX_TERMS];` (complex coefficient \(c_k\))
- `float uEnergy[MAX_TERMS];` (optional; if not provided compute in shader)
- `float uTimeScale;` (slow motion control)
- `float uFieldScale;` (coordinate scale into oscillator basis)
- `float uDensityGain;` (volume opacity strength)
- `float uIsoThreshold;` (optional threshold in log-density space)
- `int uColorMode;` (0 density-only, 1 phase, 2 mixed, etc.)

Keep existing:
- `uBasisX/uBasisY/uBasisZ/uOrigin`
- `uTime`, `uFastMode`, `uQualityMultiplier`, `uSampleQuality`, `uVolumetricDensity` etc.

### 6.5 CPU-side generation of term lists (variety)
We want “seeded presets” that are visually rich but stable:
- Choose `uTermCount = 4..8`
- For each term k:
  - Choose quantum numbers \(n_{k,j} \in [0, N_{max}]\) (e.g. 0..5)
  - Prefer sparse patterns (most dims 0–2, a few dims higher) to keep polynomials stable.
  - Choose complex coefficient \(c_k = a_k e^{i\theta_k}\) with:
    - amplitudes \(a_k\) decreasing with energy (prevents noise)
    - random phases \(\theta_k\) (drives interference)
- Choose \(\omega_j\) slightly different per dimension (e.g. 0.8..1.3) for non-repeating motion.
- Compute energies:
\[
E_k = \sum_j \omega_j\left(n_{k,j}+\tfrac{1}{2}\right)
\]
Send as `uEnergy[k]`.

**Tip:** Add a “morph speed” by scaling time:
- shader uses `t = uTime * uTimeScale`

### 6.6 Reuse existing slice/origin animation for extra dimensions
The Mandelbulb implementation already animates extra-dimension slice coordinates with multi-frequency sine and golden-ratio phase offsets (the “Slice Animation” feature). Keep this behavior because it’s exactly what we need to make ND cross-sections evolve even for static states.

## 7) Shader Pseudocode (core functions)

### 7.1 Hermite
```glsl
float hermite(int n, float u) {
  if (n == 0) return 1.0;
  if (n == 1) return 2.0*u;
  float Hnm1 = 1.0;      // H0
  float Hn   = 2.0*u;    // H1
  for (int k=1; k<n; k++) {
    float Hnp1 = 2.0*u*Hn - 2.0*float(k)*Hnm1;
    Hnm1 = Hn;
    Hn = Hnp1;
  }
  return Hn;
}
```

### 7.2 1D HO basis (visual-normalized)
```glsl
float ho1D(int n, float x, float omega) {
  float a = sqrt(omega);
  float u = a * x;
  float gauss = exp(-0.5*u*u);
  float H = hermite(n, u);
  // Visual normalization: damp higher orders a bit to avoid blowup.
  float damp = 1.0 / (1.0 + 0.15*float(n)*float(n));
  return damp * H * gauss;
}
```

### 7.3 Evaluate \(\psi\)
```glsl
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }

vec2 cexp_i(float theta) { return vec2(cos(theta), sin(theta)); } // e^{i theta}

vec2 evalPsi(float xND[MAX_DIM], float t) {
  vec2 psi = vec2(0.0);

  for (int k = 0; k < MAX_TERMS; k++) {
    if (k >= uTermCount) break;

    // phase: e^{-i E t} = e^{i(-E t)}
    float phase = -uEnergy[k] * t;
    vec2 term = cmul(uCoeff[k], cexp_i(phase));

    // multiply by separable spatial eigenfunction
    float amp = 1.0;
    for (int j=0; j<MAX_DIM; j++) {
      if (j >= uDimension) break;
      int n = uQuantum[k*MAX_DIM + j];
      amp *= ho1D(n, xND[j] * uFieldScale, uOmega[j]);
    }

    psi += term * amp;
  }

  return psi;
}
```

### 7.4 Density and log-density
```glsl
float rhoFromPsi(vec2 psi) { return dot(psi, psi); } // re^2 + im^2
float sFromRho(float rho)  { return log(rho + 1e-8); }
```

## 8) Performance Strategy

### 8.1 Complexity budget
Per ray sample cost is ~O(K·D) multiplications + a few exp/cos/sin.
Target defaults:
- `MAX_TERMS = 6` in HQ, `4` in fast mode
- `Nmax = 5`
- sample count governed by existing `uSampleQuality` and `uQualityMultiplier`

### 8.2 Early exits and bounds
- Use the existing cube bounds to limit raymarch.
- Gaussian envelope makes density fall off quickly; allow early exits when `rho` is below a small cutoff for several steps.

### 8.3 Stability clamps
- Use log-density for thresholds and gradients.
- Apply mild dampening for higher Hermite orders (see `damp`).
- Optional: clamp `rho` before converting to alpha to avoid single-step blowouts.

## 9) UX / Controls (Developer-facing spec)

### Required controls
- Dimension `D` (3..11)
- Term count `K` (1..8)
- Seed (rebuild coefficients + quantum numbers + frequencies)
- Time scale (slow morph speed)
- Field scale (zoom)
- Density gain (opacity)
- Slice animation on/off + speed + amplitude (reuse existing controls)
- Rotation controls for any ND plane (reuse existing controls)

### Optional controls
- Nmax (max quantum number per dimension)
- Frequency spread (range of \(\omega_j\))
- Color mode (density vs phase vs mixed)
- Isosurface threshold (if isosurface mode implemented)

## 10) Acceptance Criteria (QA-ready)

1. **Morphing volume:** With default preset (D=6, K=6), the object is a continuous volume that changes shape smoothly over time (no popping, no separate particles).
2. **Dimensional rotation:** Rotating in any plane produces a visibly different cross-section, and motion remains stable.
3. **D range:** Works for D=3 and D=11 without shader compilation errors; visuals remain bounded and stable.
4. **Performance:** In “fast mode” (during rotation) the framerate remains interactive; quality increases again after rotation stops.
5. **No NaNs:** No NaN/Inf artifacts across reasonable parameter ranges (seeded presets, time scale up to 2× default).
6. **Opacity modes:** Existing opacity/volumetric settings still function (solid/transparent modes behave correctly).

## 11) Milestones

1. **MVP (1):** Copy Mandelbulb, replace field with HO density, basic volumetric render.
2. **MVP (2):** Add superposition terms + time evolution + seed presets.
3. **Quality (1):** Gradient-based normals + lighting polish.
4. **Quality (2):** Parameter UI wiring (seed, K, time scale, field scale, density gain, Nmax).
5. **Perf pass:** Fast mode reductions, early exits, clamp tuning.
6. **Optional:** Isosurface mode + phase-based coloring.

---

## Appendix A: Why not “solve Schrödinger directly” with finite differences?
A real-time ND PDE solver would require a grid in D dimensions. Even modest resolutions explode in memory/compute (e.g., \(64^{11}\) is impossible). The analytic-eigenstate approach gives us Schrödinger-consistent math with runtime costs that scale linearly in D and term count, which is what makes 11D interactive rendering feasible.
