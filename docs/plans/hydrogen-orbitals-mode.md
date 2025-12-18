# Implementation Plan: Hydrogen Orbitals Mode for Schrödinger Object

## Executive Summary

Add a second quantum physics mode ("Hydrogen Orbitals") to the Schrödinger object type, alongside the existing "Harmonic Oscillators" mode. This creates the famous s, p, d, f electron orbitals (spheres, dumbbells, donuts, and clovers) that define chemistry.

## Mathematical Foundation

### Current: Harmonic Oscillator (Cartesian)
```
ψ(x,y,z) = Π_j φ_nj(x_j)
φ_n(x) = H_n(αx) · e^{-½(αx)²}
```
- **Coordinate system**: Cartesian (x, y, z)
- **Separation**: Product of 1D functions
- **Basis functions**: Hermite polynomials
- **Quantum numbers**: n_x, n_y, n_z (independent per axis, 0-6)
- **Energy**: E = Σ ω_j(n_j + ½)

### New: Hydrogen Orbitals (Spherical/Coulomb)
```
ψ_nlm(r, θ, φ) = R_nl(r) · Y_lm(θ, φ)
R_nl(r) = N_nl · ρ^l · L^{2l+1}_{n-l-1}(ρ) · e^{-ρ/2}
Y_lm(θ, φ) = N_lm · P_l^{|m|}(cos θ) · e^{imφ}
```
Where:
- ρ = 2r/(n·a₀) (scaled radial coordinate)
- L^α_k = Associated Laguerre polynomial
- P_l^m = Associated Legendre polynomial
- a₀ = Bohr radius (scaling factor)

**Quantum number constraints:**
- n = 1, 2, 3, ... (principal quantum number)
- l = 0, 1, ..., n-1 (azimuthal, determines orbital shape)
- m = -l, ..., 0, ..., +l (magnetic, determines orientation)

**Orbital shapes by l:**
- l=0 (s): Sphere
- l=1 (p): Dumbbell (3 orientations: px, py, pz)
- l=2 (d): Cloverleaf/donut (5 orientations)
- l=3 (f): Complex multilobed (7 orientations)

---

## Implementation Architecture

### Phase 1: Type System & Configuration

#### 1.1 Add Quantum Mode Type
**File:** `src/lib/geometry/extended/types.ts`

```typescript
// New type for quantum physics mode
export type SchroedingerQuantumMode = 'harmonicOscillator' | 'hydrogenOrbital';

// Extend SchroedingerConfig interface
interface SchroedingerConfig {
  // ... existing fields ...

  // === Quantum Mode Selection ===
  /** Physics mode: harmonic oscillator vs hydrogen atom */
  quantumMode: SchroedingerQuantumMode;

  // === Hydrogen Orbital Parameters (when quantumMode === 'hydrogenOrbital') ===
  /** Principal quantum number n (1-7) */
  principalQuantumNumber: number;
  /** Azimuthal quantum number l (0 to n-1) */
  azimuthalQuantumNumber: number;
  /** Magnetic quantum number m (-l to +l) */
  magneticQuantumNumber: number;
  /** Use real spherical harmonics (px,py,pz) vs complex (m=-1,0,+1) */
  useRealOrbitals: boolean;
  /** Bohr radius scale factor (affects orbital size) */
  bohrRadiusScale: number;
  /** Radial probability mode (ψ² vs r²ψ² radial probability) */
  radialProbabilityMode: 'wavefunction' | 'radialProbability';
}
```

#### 1.2 Add Hydrogen Orbital Presets
**File:** `src/lib/geometry/extended/schroedinger/hydrogenPresets.ts` (new)

```typescript
export interface HydrogenOrbitalPreset {
  name: string;
  description: string;
  n: number;
  l: number;
  m: number;
  useReal: boolean;  // true for px/py/pz notation
}

export const HYDROGEN_ORBITAL_PRESETS: Record<string, HydrogenOrbitalPreset> = {
  // s orbitals (spherical)
  '1s': { name: '1s', description: 'Ground state - spherical', n: 1, l: 0, m: 0, useReal: true },
  '2s': { name: '2s', description: 'First excited s - spherical with radial node', n: 2, l: 0, m: 0, useReal: true },
  '3s': { name: '3s', description: 'Second excited s - two radial nodes', n: 3, l: 0, m: 0, useReal: true },

  // p orbitals (dumbbell)
  '2px': { name: '2px', description: 'Dumbbell along x-axis', n: 2, l: 1, m: 1, useReal: true },
  '2py': { name: '2py', description: 'Dumbbell along y-axis', n: 2, l: 1, m: -1, useReal: true },
  '2pz': { name: '2pz', description: 'Dumbbell along z-axis', n: 2, l: 1, m: 0, useReal: true },
  '3px': { name: '3px', description: 'Dumbbell with radial node', n: 3, l: 1, m: 1, useReal: true },

  // d orbitals (cloverleaf/donut)
  '3dxy': { name: '3dxy', description: 'Four-lobed in xy plane', n: 3, l: 2, m: 2, useReal: true },
  '3dxz': { name: '3dxz', description: 'Four-lobed in xz plane', n: 3, l: 2, m: 1, useReal: true },
  '3dyz': { name: '3dyz', description: 'Four-lobed in yz plane', n: 3, l: 2, m: -1, useReal: true },
  '3dz2': { name: '3dz²', description: 'Donut with lobes along z', n: 3, l: 2, m: 0, useReal: true },
  '3dx2y2': { name: '3dx²-y²', description: 'Four-lobed along axes', n: 3, l: 2, m: -2, useReal: true },

  // f orbitals (complex multilobed)
  '4fz3': { name: '4fz³', description: 'Triple dumbbell along z', n: 4, l: 3, m: 0, useReal: true },
  '4fxyz': { name: '4fxyz', description: 'Eight-lobed cubic', n: 4, l: 3, m: 2, useReal: true },
};
```

### Phase 2: Shader Implementation

#### 2.1 Associated Laguerre Polynomials
**File:** `src/rendering/shaders/schroedinger/quantum/laguerre.glsl.ts` (new)

```glsl
// Associated Laguerre polynomial L^α_k(x)
// Using recurrence relation for GPU efficiency:
// L^α_0(x) = 1
// L^α_1(x) = 1 + α - x
// (k+1)L^α_{k+1}(x) = (2k + 1 + α - x)L^α_k(x) - (k + α)L^α_{k-1}(x)

float laguerre(int k, float alpha, float x) {
    if (k < 0) return 0.0;
    if (k == 0) return 1.0;

    float L0 = 1.0;
    float L1 = 1.0 + alpha - x;
    if (k == 1) return L1;

    float Lk = L1;
    float Lkm1 = L0;

    for (int i = 1; i < k; i++) {
        float fi = float(i);
        float Lkp1 = ((2.0*fi + 1.0 + alpha - x)*Lk - (fi + alpha)*Lkm1) / (fi + 1.0);
        Lkm1 = Lk;
        Lk = Lkp1;
    }

    return Lk;
}
```

#### 2.2 Associated Legendre Polynomials
**File:** `src/rendering/shaders/schroedinger/quantum/legendre.glsl.ts` (new)

```glsl
// Associated Legendre polynomial P^m_l(x) for |x| <= 1
// Using recurrence relations

float legendre(int l, int m, float x) {
    int absM = abs(m);
    if (absM > l) return 0.0;

    // Start with P^m_m using double factorial formula
    float pmm = 1.0;
    if (absM > 0) {
        float somx2 = sqrt((1.0 - x) * (1.0 + x));
        float fact = 1.0;
        for (int i = 1; i <= absM; i++) {
            pmm *= -fact * somx2;
            fact += 2.0;
        }
    }

    if (l == absM) return pmm;

    // P^m_{m+1} = x(2m+1)P^m_m
    float pmmp1 = x * (2.0 * float(absM) + 1.0) * pmm;
    if (l == absM + 1) return pmmp1;

    // Recurrence: (l-m)P^m_l = x(2l-1)P^m_{l-1} - (l+m-1)P^m_{l-2}
    float pll = pmmp1;
    for (int ll = absM + 2; ll <= l; ll++) {
        float fll = float(ll);
        float fm = float(absM);
        pll = (x * (2.0*fll - 1.0) * pmmp1 - (fll + fm - 1.0) * pmm) / (fll - fm);
        pmm = pmmp1;
        pmmp1 = pll;
    }

    return pll;
}
```

#### 2.3 Spherical Harmonics
**File:** `src/rendering/shaders/schroedinger/quantum/sphericalHarmonics.glsl.ts` (new)

```glsl
// Real spherical harmonics Y_lm(theta, phi)
// Returns real value for visualization

// Normalization factor
float sphericalHarmonicNorm(int l, int m) {
    int absM = abs(m);
    // K_l^m = sqrt((2l+1)/(4π) * (l-|m|)!/(l+|m|)!)
    float num = float(2*l + 1);
    float denom = 4.0 * PI;

    // Factorial ratio (l-|m|)!/(l+|m|)!
    float factRatio = 1.0;
    for (int i = l - absM + 1; i <= l + absM; i++) {
        factRatio *= float(i);
    }
    factRatio = 1.0 / factRatio;

    return sqrt(num * factRatio / denom);
}

// Compute real spherical harmonic
// theta: polar angle from z-axis [0, π]
// phi: azimuthal angle [0, 2π]
vec2 sphericalHarmonic(int l, int m, float theta, float phi) {
    float norm = sphericalHarmonicNorm(l, m);
    float P = legendre(l, abs(m), cos(theta));

    // Complex form: Y_l^m = N * P_l^|m|(cos θ) * e^{imφ}
    float mPhi = float(m) * phi;
    return norm * P * vec2(cos(mPhi), sin(mPhi));
}

// Real spherical harmonic (for px, py, pz etc.)
float realSphericalHarmonic(int l, int m, float theta, float phi, bool useReal) {
    if (!useReal) {
        vec2 Y = sphericalHarmonic(l, m, theta, phi);
        return length(Y);  // |Y_lm| for complex
    }

    // Real combinations
    float norm = sphericalHarmonicNorm(l, abs(m));
    float P = legendre(l, abs(m), cos(theta));

    if (m > 0) {
        // Y_lm^real = sqrt(2) * N * P * cos(m*phi)
        return sqrt(2.0) * norm * P * cos(float(m) * phi);
    } else if (m < 0) {
        // Y_l(-m)^real = sqrt(2) * N * P * sin(|m|*phi)
        return sqrt(2.0) * norm * P * sin(float(-m) * phi);
    } else {
        // m = 0: Y_l0 is already real
        return norm * P;
    }
}
```

#### 2.4 Hydrogen Radial Function
**File:** `src/rendering/shaders/schroedinger/quantum/hydrogenRadial.glsl.ts` (new)

```glsl
// Hydrogen atom radial wavefunction R_nl(r)
// R_nl(r) = N_nl * (2r/na₀)^l * L^{2l+1}_{n-l-1}(2r/na₀) * exp(-r/na₀)

float hydrogenRadial(int n, int l, float r, float bohrRadius) {
    if (n < 1 || l < 0 || l >= n) return 0.0;

    float a0 = bohrRadius;
    float rho = 2.0 * r / (float(n) * a0);

    // Normalization constant (simplified, visual approximation)
    float norm = pow(2.0 / (float(n) * a0), 1.5);

    // Factorial ratio for normalization
    // Full: sqrt((2/na₀)³ * (n-l-1)! / (2n*(n+l)!))

    // ρ^l factor
    float rhoL = pow(rho, float(l));

    // Associated Laguerre polynomial L^{2l+1}_{n-l-1}(ρ)
    int laguerreK = n - l - 1;
    float alpha = float(2 * l + 1);
    float L = laguerre(laguerreK, alpha, rho);

    // Exponential decay
    float expPart = exp(-rho * 0.5);

    // Damping for high n (visual stability)
    float damp = 1.0 / (1.0 + 0.1 * float(n * n));

    return damp * norm * rhoL * L * expPart;
}
```

#### 2.5 Full Hydrogen Wavefunction
**File:** `src/rendering/shaders/schroedinger/quantum/hydrogenPsi.glsl.ts` (new)

```glsl
// Full hydrogen wavefunction ψ_nlm(r, θ, φ)

// Convert Cartesian to spherical coordinates
vec3 cartesianToSpherical(vec3 pos) {
    float r = length(pos);
    if (r < 1e-10) return vec3(0.0, 0.0, 0.0);

    float theta = acos(clamp(pos.z / r, -1.0, 1.0));  // [0, π]
    float phi = atan(pos.y, pos.x);  // [-π, π]
    if (phi < 0.0) phi += 2.0 * PI;  // [0, 2π]

    return vec3(r, theta, phi);
}

// Evaluate hydrogen orbital at 3D position
// Returns complex wavefunction as vec2(re, im)
vec2 evalHydrogenPsi(vec3 pos, int n, int l, int m, float bohrRadius, bool useReal) {
    vec3 sph = cartesianToSpherical(pos);
    float r = sph.x;
    float theta = sph.y;
    float phi = sph.z;

    // Radial part R_nl(r)
    float R = hydrogenRadial(n, l, r, bohrRadius);

    // Angular part Y_lm(θ, φ)
    if (useReal) {
        float Y = realSphericalHarmonic(l, m, theta, phi, true);
        return vec2(R * Y, 0.0);  // Real orbital
    } else {
        vec2 Y = sphericalHarmonic(l, m, theta, phi);
        return R * Y;  // Complex orbital
    }
}

// Evaluate with time evolution
vec2 evalHydrogenPsiTime(vec3 pos, int n, int l, int m, float bohrRadius, bool useReal, float t) {
    vec2 psi0 = evalHydrogenPsi(pos, n, l, m, bohrRadius, useReal);

    // Energy eigenvalue E_n = -13.6 eV / n² (in arbitrary units for visualization)
    float E = -1.0 / float(n * n);

    // Time evolution: ψ(t) = ψ(0) * e^{-iEt/ℏ}
    float phase = -E * t;
    vec2 timeFactor = vec2(cos(phase), sin(phase));

    return cmul(psi0, timeFactor);
}
```

#### 2.6 Unified Psi Block with Mode Switching
**File:** `src/rendering/shaders/schroedinger/quantum/psi.glsl.ts` (modify)

```glsl
// Add uniform for quantum mode
uniform int uQuantumMode;  // 0 = harmonic oscillator, 1 = hydrogen

// Add hydrogen-specific uniforms
uniform int uPrincipalN;      // n: 1-7
uniform int uAzimuthalL;      // l: 0 to n-1
uniform int uMagneticM;       // m: -l to +l
uniform float uBohrRadius;    // a₀ scale factor
uniform bool uUseRealOrbitals;

// Modified evalPsi to handle both modes
vec2 evalPsi(float xND[MAX_DIM], float t) {
    if (uQuantumMode == 1) {
        // Hydrogen orbital mode - use first 3 dimensions as Cartesian
        vec3 pos = vec3(xND[0], xND[1], xND[2]);
        return evalHydrogenPsiTime(pos, uPrincipalN, uAzimuthalL, uMagneticM,
                                    uBohrRadius, uUseRealOrbitals, t);
    }

    // Default: Harmonic oscillator mode (existing implementation)
    vec2 psi = vec2(0.0);
    for (int k = 0; k < MAX_TERMS; k++) {
        if (k >= uTermCount) break;
        float phase = -uEnergy[k] * t;
        vec2 timeFactor = cexp_i(phase);
        vec2 coeff = uCoeff[k];
        vec2 term = cmul(coeff, timeFactor);
        float spatial = hoND(xND, uDimension, k);
        psi += cscale(spatial, term);
    }
    return psi;
}
```

### Phase 3: UI Implementation

#### 3.1 Mode Selector in Geometry Tab
**File:** `src/components/sections/Geometry/SchroedingerControls.tsx` (modify)

Add a toggle at the top of the controls:

```tsx
// Mode selection
<Section title="Physics Mode" defaultOpen={true}>
  <div className="flex gap-2">
    <button
      className={`flex-1 px-3 py-1.5 text-xs rounded ${
        config.quantumMode === 'harmonicOscillator'
          ? 'bg-accent text-white'
          : 'bg-surface-tertiary text-text-secondary'
      }`}
      onClick={() => setQuantumMode('harmonicOscillator')}
    >
      Harmonic Oscillators
    </button>
    <button
      className={`flex-1 px-3 py-1.5 text-xs rounded ${
        config.quantumMode === 'hydrogenOrbital'
          ? 'bg-accent text-white'
          : 'bg-surface-tertiary text-text-secondary'
      }`}
      onClick={() => setQuantumMode('hydrogenOrbital')}
    >
      Hydrogen Orbitals
    </button>
  </div>
</Section>

// Conditional sections based on mode
{config.quantumMode === 'harmonicOscillator' ? (
  // Existing harmonic oscillator controls...
) : (
  // New hydrogen orbital controls
  <Section title="Orbital Selection" defaultOpen={true}>
    {/* Preset dropdown for s, p, d, f orbitals */}
    <select ...>
      <optgroup label="s Orbitals (Spherical)">
        <option value="1s">1s</option>
        <option value="2s">2s</option>
        <option value="3s">3s</option>
      </optgroup>
      <optgroup label="p Orbitals (Dumbbell)">
        <option value="2px">2px</option>
        <option value="2py">2py</option>
        <option value="2pz">2pz</option>
      </optgroup>
      <optgroup label="d Orbitals (Cloverleaf)">
        <option value="3dxy">3dxy</option>
        <option value="3dz2">3dz²</option>
        ...
      </optgroup>
      <optgroup label="f Orbitals (Complex)">
        ...
      </optgroup>
    </select>

    {/* Manual quantum number controls */}
    <Slider label="n (Principal)" min={1} max={7} ... />
    <Slider label="l (Azimuthal)" min={0} max={n-1} ... />
    <Slider label="m (Magnetic)" min={-l} max={l} ... />

    {/* Visualization options */}
    <Toggle label="Real Orbitals (px/py/pz)" ... />
    <Slider label="Bohr Radius Scale" min={0.5} max={3.0} ... />
  </Section>
)}
```

### Phase 4: Store Integration

#### 4.1 New Actions in Schroedinger Slice
**File:** `src/stores/slices/geometry/schroedingerSlice.ts` (modify)

```typescript
// Add new actions
setSchroedingerQuantumMode: (mode: SchroedingerQuantumMode) => void;
setSchroedingerPrincipalQuantumNumber: (n: number) => void;
setSchroedingerAzimuthalQuantumNumber: (l: number) => void;
setSchroedingerMagneticQuantumNumber: (m: number) => void;
setSchroedingerUseRealOrbitals: (useReal: boolean) => void;
setSchroedingerBohrRadiusScale: (scale: number) => void;
setSchroedingerHydrogenPreset: (presetName: string) => void;
```

### Phase 5: Renderer Integration

#### 5.1 Update SchroedingerMesh Uniforms
**File:** `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` (modify)

```typescript
// Add new uniforms
uQuantumMode: { value: config.quantumMode === 'hydrogenOrbital' ? 1 : 0 },
uPrincipalN: { value: config.principalQuantumNumber },
uAzimuthalL: { value: config.azimuthalQuantumNumber },
uMagneticM: { value: config.magneticQuantumNumber },
uBohrRadius: { value: config.bohrRadiusScale },
uUseRealOrbitals: { value: config.useRealOrbitals },
```

#### 5.2 Update Shader Composition
**File:** `src/rendering/shaders/schroedinger/compose.ts` (modify)

Add hydrogen-specific blocks:
```typescript
// Add new imports
import { laguerreBlock } from './quantum/laguerre.glsl';
import { legendreBlock } from './quantum/legendre.glsl';
import { sphericalHarmonicsBlock } from './quantum/sphericalHarmonics.glsl';
import { hydrogenRadialBlock } from './quantum/hydrogenRadial.glsl';
import { hydrogenPsiBlock } from './quantum/hydrogenPsi.glsl';

// Include after Hermite/HO blocks
blocks.push(laguerreBlock);
blocks.push(legendreBlock);
blocks.push(sphericalHarmonicsBlock);
blocks.push(hydrogenRadialBlock);
blocks.push(hydrogenPsiBlock);
```

---

## Dimension Handling

### 3D Mode
- Hydrogen orbitals work natively in 3D (spherical coordinates)
- Full visualization of s, p, d, f shapes

### 4D+ Mode (Extended)
For dimensions > 3, the hydrogen mode will:
1. Compute the 3D hydrogen orbital in the first 3 dimensions
2. Apply Gaussian envelope to extra dimensions (like HO mode)
3. Allow superposition of orbitals with different n, l, m

Alternative approach for 4D+:
- Use hyperspherical harmonics (generalization to n-dimensions)
- This is mathematically complex but provides true higher-dimensional orbitals

---

## Animation Considerations

### Hydrogen Orbital Animations
1. **Time Evolution**: Already handled via `e^{-iEt}` phase factor
2. **Orbital Morphing**: Animate between different n, l, m values
3. **Superposition Animation**: Blend multiple orbitals (hydrogen analog of existing HO superposition)

### Animation Drawer Updates
**File:** `src/components/layout/TimelineControls/SchroedingerAnimationDrawer.tsx`

When in hydrogen mode:
- Keep Time Evolution (works with both modes)
- Add "Orbital Transition" animation (morph between presets)
- Remove/modify irrelevant HO-specific animations

---

## Testing Plan

1. **Unit Tests:**
   - Laguerre polynomial evaluation correctness
   - Legendre polynomial evaluation correctness
   - Spherical harmonic normalization
   - Hydrogen radial function at known values (e.g., 1s at r=a₀)

2. **Visual Tests:**
   - 1s orbital appears spherical
   - 2p orbitals appear as dumbbells along correct axes
   - 3d orbitals show correct cloverleaf/donut shapes
   - Nodes appear at correct radii

3. **Integration Tests:**
   - Mode switching preserves other settings
   - Preset selection works correctly
   - Quantum number constraints enforced (l < n, |m| ≤ l)

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `src/lib/geometry/extended/schroedinger/hydrogenPresets.ts` | Preset definitions for s,p,d,f orbitals |
| `src/rendering/shaders/schroedinger/quantum/laguerre.glsl.ts` | Associated Laguerre polynomials |
| `src/rendering/shaders/schroedinger/quantum/legendre.glsl.ts` | Associated Legendre polynomials |
| `src/rendering/shaders/schroedinger/quantum/sphericalHarmonics.glsl.ts` | Spherical harmonics Y_lm |
| `src/rendering/shaders/schroedinger/quantum/hydrogenRadial.glsl.ts` | Radial wavefunction R_nl |
| `src/rendering/shaders/schroedinger/quantum/hydrogenPsi.glsl.ts` | Full hydrogen ψ_nlm |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/geometry/extended/types.ts` | Add `SchroedingerQuantumMode`, hydrogen config fields |
| `src/lib/geometry/extended/schroedinger/presets.ts` | Export hydrogen presets alongside HO presets |
| `src/rendering/shaders/schroedinger/quantum/psi.glsl.ts` | Add mode switching to evalPsi |
| `src/rendering/shaders/schroedinger/compose.ts` | Include hydrogen shader blocks |
| `src/rendering/shaders/schroedinger/uniforms.glsl.ts` | Add hydrogen uniforms |
| `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` | Pass hydrogen uniforms |
| `src/components/sections/Geometry/SchroedingerControls.tsx` | Add mode toggle and hydrogen UI |
| `src/components/layout/TimelineControls/SchroedingerAnimationDrawer.tsx` | Mode-aware animation controls |
| `src/stores/slices/geometry/schroedingerSlice.ts` | Add hydrogen state actions |
| `src/stores/slices/geometry/types.ts` | Add hydrogen state interface |

---

## Research Sources

- [Chemistry LibreTexts - Hydrogen Atom Wavefunctions](https://chem.libretexts.org/Bookshelves/Physical_and_Theoretical_Chemistry_Textbook_Maps/Physical_Chemistry_for_the_Biosciences_(LibreTexts)/11:_Quantum_Mechanics_and_Atomic_Structure/11.10:_The_Schrodinger_Wave_Equation_for_the_Hydrogen_Atom)
- [SHTOOLS - Real Spherical Harmonics](https://shtools.github.io/SHTOOLS/real-spherical-harmonics.html)
- [Wolfram MathWorld - Associated Laguerre Polynomials](https://mathworld.wolfram.com/AssociatedLaguerrePolynomial.html)
- [Boost C++ - Laguerre Recurrence](https://beta.boost.org/doc/libs/1_54_0/libs/math/doc/html/math_toolkit/sf_poly/laguerre.html)
