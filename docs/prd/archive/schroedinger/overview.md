# Schrödinger Visualization Improvement Plan

**Goal:** Transform the current Schrödinger wavefunction visualization from a mathematical prototype into a cinematic, high-fidelity quantum event.

**Strategy:** Leverage the existing quantum simulation data ($\psi$, Phase, Energy) to drive advanced volumetric rendering techniques, prioritizing high-impact/low-cost features first.

## Implementation Roadmap

### Phase 1: Core Physics & Materiality (High Impact / Low Cost)
These changes redefine *what* the object looks like by using quantum data to drive material properties.

| ID | Feature | Description | Perf Impact | File |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Phase-Dependent Materiality** | Use wavefunction phase to distinguish "Matter" (Plasma) from "Anti-Matter" (Dark Smoke). | 🟢 Low | `01-phase-materiality.md` |
| **02** | **Blackbody Radiation Coloring** | Map probability density to physical temperature (Blackbody) instead of abstract cosine palettes. | 🟢 Low | `02-blackbody-color.md` |
| **03** | **Interference Fringing** | Modulate density with high-frequency phase sine waves to visualize quantum interference patterns. | 🟢 Low | `03-interference-fringing.md` |
| **04** | **Depth-Based Absorption** | Wavelength-dependent absorption (e.g., absorb Blue faster than Red) for physical volume color. | 🟢 Low | `04-depth-absorption.md` |

### Phase 2: Volumetric Lighting & Integration (Medium Impact / Low Cost)
These changes improve how light interacts with the volume, adding depth and tangible presence.

| ID | Feature | Description | Perf Impact | File |
| :--- | :--- | :--- | :--- | :--- |
| **05** | **Anisotropic Scattering** | Implement Henyey-Greenstein phase function for "silver lining" backlighting effects. | 🟢 Low | `05-anisotropic-scattering.md` |
| **06** | **Dual-Scattering (Powder Effect)** | "Powder" approximation to simulate internal scattering, creating soft/bright edges. | 🟢 Low | `06-powder-effect.md` |
| **07** | **Soft Depth Intersection** | Z-feathering to prevent hard clipping artifacts where the cloud intersects scene geometry. | 🟢 Low | `07-soft-depth.md` |
| **08** | **Blue Noise Dithering** | Stochastic ray offset to remove wood-grain banding artifacts (relies on TAA). | 🟢 Low | `08-blue-noise.md` |

### Phase 3: Procedural Detail & Dynamics (High Impact / Medium Cost)
These changes break up the smooth mathematical shapes with fluid dynamics and energy filaments.

| ID | Feature | Description | Perf Impact | File |
| :--- | :--- | :--- | :--- | :--- |
| **09** | **Curl Noise Domain Warping** | Distort coordinate space with 3D Curl Noise for fluid-like turbulence. | 🟡 Medium | `09-curl-noise.md` |
| **10** | **Electric Arcs (Ridged Noise)** | High-frequency "lightning" filaments inside the core using ridged multifractal noise. | 🟡 Medium | `10-electric-arcs.md` |
| **11** | **Quantum Foam Noise** | Low-density background noise field to simulate vacuum fluctuations/zero-point energy. | 🟡 Medium | `11-quantum-foam.md` |
| **12** | **Probability Current Flow** | Animate internal flow based on density gradient magnitude (simulating flux). | 🟢 Low* | `12-probability-flow.md` |
_*Low cost if reusing gradient calculations from lighting._

### Phase 4: Advanced Rendering & Cinematic Polish (Highest Impact / High Cost)
These features provide the final "Wow" factor but come with significant performance considerations.

| ID | Feature | Description | Perf Impact | File |
| :--- | :--- | :--- | :--- | :--- |
| **13** | **Volumetric Self-Shadowing** | Raymarch towards the light source for deep, dramatic shadows and volume definition. | 🔴 High | `13-volumetric-shadows.md` |
| **14** | **Screen-Space God Rays** | Post-process radial blur to cast blinding light shafts from the high-energy core. | 🟡 Medium | `14-god-rays.md` |
| **15** | **Chromatic Density Dispersion** | Sample density at spectral offsets to create "quantum glitch" chromatic aberration. | 🔴 High | `15-chromatic-dispersion.md` |

## Performance Legend
*   🟢 **Low Cost:** Simple math or branchless logic. < 0.1ms impact.
*   🟡 **Medium Cost:** Adds texture lookups per ray-step or a separate render pass. ~0.5ms - 1.0ms impact.
*   🔴 **High Cost:** Multiplies the complexity of the raymarch loop (e.g., nested loops). > 2.0ms impact.
