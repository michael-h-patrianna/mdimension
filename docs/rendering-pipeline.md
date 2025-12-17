# Advanced Rendering Pipeline Guide for LLM Coding Agents

**Purpose**: Instructions for understanding and extending the modularized shader systems for polytopes, Mandelbulb, Julia, and Schroedinger fractals.

**Tech Stack**: Three.js + React Three Fiber + GLSL ES 3.00 (WebGL2)

---

## Rendering Architecture Overview

```
src/rendering/
├── renderers/              # Object-specific renderers (React components)
│   ├── Polytope/           # N-D polytope rendering (hypercube, simplex)
│   ├── Mandelbulb/         # Raymarched 3D-11D Mandelbulb fractals
│   ├── QuaternionJulia/    # Raymarched Quaternion Julia sets
│   ├── Schroedinger/       # Raymarched quantum wavefunction visualization
│   └── TubeWireframe/      # 3D tube wireframe edges
│
├── shaders/                # Modularized GLSL shader blocks
│   ├── shared/             # SHARED across ALL renderers
│   │   ├── core/           # Constants, uniforms, precision
│   │   ├── color/          # HSL, OKLab, cosine palettes
│   │   ├── lighting/       # Fresnel, multi-light system
│   │   ├── features/       # AO, shadows, temporal, opacity
│   │   └── raymarch/       # Core raymarching, normals, sphere intersection
│   │
│   ├── mandelbulb/         # Mandelbulb-specific SDF and main shader
│   │   ├── sdf/            # sdf3d.glsl.ts ... sdf11d.glsl.ts
│   │   ├── power.glsl.ts   # Optimized power functions
│   │   └── main.glsl.ts    # Fragment shader main()
│   │
│   ├── julia/              # Quaternion Julia-specific
│   │   ├── sdf/            # sdf3d.glsl.ts (quaternion SDF)
│   │   ├── quaternion.glsl.ts  # Quaternion math operations
│   │   └── compose.ts      # Shader composition
│   │
│   ├── schroedinger/       # Quantum wavefunction visualization
│   │   ├── sdf/            # sdf3d.glsl.ts ... sdf11d.glsl.ts
│   │   ├── quantum/        # Complex math, Hermite polynomials, HO eigenfunctions
│   │   └── volume/         # Volumetric absorption/emission
│   │
│   └── polytope/           # N-D polytope shaders
│       ├── transform-nd.glsl.ts  # N-D rotation and projection
│       ├── modulation.glsl.ts    # Vertex modulation effects
│       └── compose.ts      # Shader composition functions
│
└── Scene.tsx               # Main scene with UnifiedRenderer
```

---

## Render Modes (Decision Tree)

The `UnifiedRenderer` determines which renderer to use:

```typescript
// Decision logic in UnifiedRenderer.tsx
type RenderMode = 'polytope' | 'raymarch-mandelbulb' | 'raymarch-quaternion-julia' | 'raymarch-schroedinger' | 'none';

// If objectType is:
// - 'hypercube', 'simplex', 'cross-polytope' → 'polytope'
// - 'mandelbulb' → 'raymarch-mandelbulb'
// - 'quaternion-julia' → 'raymarch-quaternion-julia'
// - 'schroedinger' → 'raymarch-schroedinger'
```

---

## Modularized Shader System

### Shader Block Pattern

All GLSL code is organized into TypeScript template strings for composition:

```typescript
// Example: src/rendering/shaders/mandelbulb/power.glsl.ts
export const powerBlock = `
float getEffectivePower() {
    float basePower = uPowerAnimationEnabled ? uAnimatedPower : uPower;
    if (uAlternatePowerEnabled) {
        basePower = mix(basePower, uAlternatePowerValue, uAlternatePowerBlend);
    }
    return max(basePower, 2.0);
}

void optimizedPow(float r, float pwr, out float rPow, out float rPowMinus1) {
    if (pwr == 8.0) {
        // Fast integer power for common Mandelbulb power
        float r2 = r * r;
        float r4 = r2 * r2;
        rPowMinus1 = r4 * r2 * r;  // r^7
        rPow = rPowMinus1 * r;      // r^8
    } else {
        rPow = pow(r, pwr);
        rPowMinus1 = pow(max(r, EPS), pwr - 1.0);
    }
}
`;
```

### Shader Composition Pattern

```typescript
// Example: src/rendering/shaders/mandelbulb/compose.ts
export function composeMandelbulbShader(config: ShaderConfig): string {
  const blocks: string[] = [
    precisionBlock,
    constantsBlock,
    uniformsBlock,
    // Conditional modules based on config
    config.shadows ? shadowsBlock : '',
    config.temporal ? temporalBlock : '',
    config.ambientOcclusion ? aoBlock : '',
    // SDF for specific dimension
    getSdfBlock(config.dimension),
    // Main shader
    mainBlock,
  ];
  return blocks.filter(Boolean).join('\n');
}
```

---

## Polytope Rendering System

### N-Dimensional Transformation Pipeline

Polytopes (hypercube, simplex, cross-polytope) use vertex shaders for N-D transformations:

```
1. Store base N-D vertices as attributes (position + aExtraDim0-6)
2. Apply N-D rotation matrix in vertex shader
3. Apply N-D → 3D perspective projection
4. Apply vertex modulation effects
```

### Key Math: N-D to 3D Projection

```glsl
// From src/rendering/shaders/polytope/transform-nd.glsl.ts
vec3 transformND() {
    // Scale all dimensions
    float scaledInputs[11];
    scaledInputs[0] = position.x * uScale4D.x;
    scaledInputs[1] = position.y * uScale4D.y;
    scaledInputs[2] = position.z * uScale4D.z;
    scaledInputs[3] = aExtraDim0 * uScale4D.w;
    // ... aExtraDim1-6 for dimensions 5-10

    // Apply 4D rotation matrix to first 4 components
    vec4 rotated = uRotationMatrix4D * vec4(scaledInputs[0..3]);

    // Add contributions from extra dimensions (5D+)
    for (int i = 0; i < 7; i++) {
        if (i + 5 <= uDimension) {
            rotated.xyz += uExtraRotationCols[i*4..i*4+2] * scaledInputs[i+4];
            rotated.w += uExtraRotationCols[i*4+3] * scaledInputs[i+4];
        }
    }

    // Perspective projection from N-D to 3D
    if (uProjectionType == 1) {
        float effectiveDepth = rotated.w + sum(uDepthRowSums * scaledInputs);
        effectiveDepth /= sqrt(uDimension - 3);  // Normalize for dimension
        float factor = 1.0 / (uProjectionDistance - effectiveDepth);
        return rotated.xyz * factor;
    }
    return rotated.xyz;  // Orthographic
}
```

---

## Mandelbulb SDF Math (3D-11D)

### Core Algorithm: Hyperspherical Power Map

The Mandelbulb uses hyperspherical coordinates to generalize z^n to N dimensions:

```
For 3D (standard Mandelbulb):
  z_{n+1} = z_n^power + c

In spherical coordinates (r, theta, phi):
  r_{n+1} = r_n^power
  theta_{n+1} = theta_n * power
  phi_{n+1} = phi_n * power
```

### SDF Implementation Pattern

```glsl
// From src/rendering/shaders/mandelbulb/sdf/sdf3d.glsl.ts
float sdf3D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // Map 3D sample point to N-D using rotated basis vectors
    // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];

    // Mandelbulb: z starts at c
    float zx = cx, zy = cy, zz = cz;
    float dr = 1.0;  // Derivative for distance estimation
    float r = 0.0;

    for (int i = 0; i < maxIt; i++) {
        r = sqrt(zx*zx + zy*zy + zz*zz);
        if (r > bail) break;

        // Distance estimation derivative
        float rp, rpMinus1;
        optimizedPow(r, pwr, rp, rpMinus1);
        dr = rpMinus1 * pwr * dr + 1.0;

        // Convert to spherical: z-axis primary (standard Mandelbulb convention)
        float theta = acos(clamp(zz / r, -1.0, 1.0));  // Angle from z-axis
        float phi = atan(zy, zx);                       // Angle in xy-plane

        // Power map: multiply angles by power
        float thetaN = theta * pwr;
        float phiN = phi * pwr;

        // Reconstruct from spherical
        zz = rp * cos(thetaN) + cz;
        zx = rp * sin(thetaN) * cos(phiN) + cx;
        zy = rp * sin(thetaN) * sin(phiN) + cy;
    }

    // Distance estimation formula
    return 0.5 * log(r) * r / dr;
}
```

### Higher-Dimensional SDFs (4D-11D)

Each dimension adds one more hyperspherical angle:

| Dimension | Angles | Formula Pattern |
|-----------|--------|-----------------|
| 3D | theta, phi | Standard spherical |
| 4D | theta, phi, psi | 4D hyperspherical |
| 5D | theta, phi, psi, chi | 5D hyperspherical |
| ... | ... | ... |
| 11D | 10 angles | Full hyperspherical |

```glsl
// 4D example from sdf4d.glsl.ts
float sdf4D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // c = 4D point from rotated basis
    float cx = uOrigin[0] + pos.x*uBasisX[0] + ...;
    // ... cy, cz, cw

    for (int i = 0; i < maxIt; i++) {
        r = sqrt(zx*zx + zy*zy + zz*zz + zw*zw);

        // 4D hyperspherical: 3 angles
        float theta = acos(zz / r);           // From z-axis
        float rxyw = sqrt(zx*zx + zy*zy + zw*zw);
        float phi = acos(zx / rxyw);          // From x in xyw subspace
        float psi = atan(zw, zy);             // In yw plane

        // Power map all angles
        float thetaN = theta * pwr;
        float phiN = phi * pwr;
        float psiN = psi * pwr;

        // Reconstruct 4D point
        zz = rp * cos(thetaN);
        zx = rp * sin(thetaN) * cos(phiN);
        zy = rp * sin(thetaN) * sin(phiN) * cos(psiN);
        zw = rp * sin(thetaN) * sin(phiN) * sin(psiN);
    }
}
```

---

## Quaternion Julia SDF Math

### Key Difference from Mandelbulb

| Property | Mandelbulb | Quaternion Julia |
|----------|------------|------------------|
| Iteration | z_{n+1} = z_n^n + c | z_{n+1} = z_n^n + c |
| c value | c = sample point | c = fixed constant |
| z_0 | z_0 = c | z_0 = sample point |
| Derivative | dr = n * r^(n-1) * dr + 1 | dr = n * r^(n-1) * dr |

### Quaternion Operations

```glsl
// From src/rendering/shaders/julia/quaternion.glsl.ts

// Quaternion multiplication: (a,b,c,d) * (e,f,g,h)
vec4 quatMul(vec4 q1, vec4 q2) {
    return vec4(
        q1.x*q2.x - q1.y*q2.y - q1.z*q2.z - q1.w*q2.w,
        q1.x*q2.y + q1.y*q2.x + q1.z*q2.w - q1.w*q2.z,
        q1.x*q2.z - q1.y*q2.w + q1.z*q2.x + q1.w*q2.y,
        q1.x*q2.w + q1.y*q2.z - q1.z*q2.y + q1.w*q2.x
    );
}

// Quaternion power using hyperspherical: q^n = r^n * (cos(n*theta) + sin(n*theta) * v_hat)
vec4 quatPow(vec4 q, float n) {
    float r = length(q);
    vec3 v = q.yzw;
    float vLen = length(v);

    float theta = acos(q.x / r);
    vec3 vHat = v / vLen;

    float rn = pow(r, n);
    return vec4(rn * cos(n*theta), rn * sin(n*theta) * vHat);
}
```

### Julia SDF Implementation

```glsl
// From src/rendering/shaders/julia/sdf/sdf3d.glsl.ts
float sdfJulia3D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // z starts at sample position (NOT c like Mandelbulb)
    vec4 z = vec4(
        uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0],
        uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1],
        uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2],
        uDimension >= 4 ? uOrigin[3] + ... : 0.0
    );

    // c is FIXED Julia constant (uniform)
    vec4 c = uJuliaConstant;

    for (int i = 0; i < maxIt; i++) {
        float r = length(z);
        if (r > bail) break;

        // Derivative: no +1 term since c is constant
        dr = pwr * pow(r, pwr - 1.0) * dr;

        // Julia iteration: z = z^n + c
        z = (pwr == 2.0) ? quatSqr(z) + c : quatPow(z, pwr) + c;
    }

    return 0.5 * log(r) * r / dr;
}
```

---

## Schroedinger Wavefunction Visualization

### Quantum Harmonic Oscillator Eigenfunctions

The Schroedinger renderer visualizes probability densities |psi|^2 of quantum states:

```
phi_n(x) = (normalization) * H_n(alpha*x) * exp(-0.5 * (alpha*x)^2)

Where:
- H_n = Hermite polynomial of order n
- alpha = sqrt(m*omega/hbar)
- n = quantum number (0, 1, 2, ...)
```

### Hermite Polynomial Implementation

```glsl
// From src/rendering/shaders/schroedinger/quantum/hermite.glsl.ts

// Recurrence relation: H_{n+1}(u) = 2u*H_n(u) - 2n*H_{n-1}(u)
float hermite(int n, float u) {
    if (n == 0) return 1.0;
    if (n == 1) return 2.0 * u;

    float Hnm1 = 1.0;      // H_0
    float Hn = 2.0 * u;    // H_1

    for (int k = 1; k < n; k++) {
        float Hnp1 = 2.0 * u * Hn - 2.0 * float(k) * Hnm1;
        Hnm1 = Hn;
        Hn = Hnp1;
    }
    return Hn;
}

// First few Hermite polynomials:
// H_0(u) = 1
// H_1(u) = 2u
// H_2(u) = 4u^2 - 2
// H_3(u) = 8u^3 - 12u
// H_4(u) = 16u^4 - 48u^2 + 12
```

### 1D Harmonic Oscillator Eigenfunction

```glsl
// From src/rendering/shaders/schroedinger/quantum/ho1d.glsl.ts
float ho1D(int n, float x, float omega) {
    float alpha = sqrt(omega);
    float u = alpha * x;

    // Gaussian envelope
    float gauss = exp(-0.5 * u * u);

    // Hermite polynomial
    float H = hermite(n, u);

    // Damping to prevent blowup at higher n
    float damp = 1.0 / (1.0 + 0.15 * float(n * n));

    return damp * H * gauss;
}
```

### N-Dimensional Separable Eigenfunction

```glsl
// Product of 1D eigenfunctions for D dimensions
float hoND(float xND[MAX_DIM], int dim, int termIdx) {
    float product = 1.0;

    for (int j = 0; j < dim; j++) {
        int n = uQuantum[termIdx * MAX_DIM + j];  // Quantum number for this dimension
        float omega = uOmega[j];                   // Frequency for this dimension
        product *= ho1D(n, xND[j], omega);
    }

    return product;
}
```

### Complex Number Operations for Time Evolution

```glsl
// From src/rendering/shaders/schroedinger/quantum/complex.glsl.ts

// Complex multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i
vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

// Complex exponential of imaginary: e^(i*theta) = cos(theta) + i*sin(theta)
vec2 cexp_i(float theta) {
    return vec2(cos(theta), sin(theta));
}

// Complex modulus squared: |z|^2 = a^2 + b^2 (probability density)
float cmod2(vec2 z) {
    return dot(z, z);
}
```

---

## Raymarching Core System

### Sphere Tracing Algorithm

```glsl
// From src/rendering/shaders/shared/raymarch/core.glsl.ts
float RayMarch(vec3 ro, vec3 rd, vec3 worldRayDir, out float trap, out bool usedTemporal) {
    // Bounding sphere intersection for early exit
    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) return maxDist + 1.0;  // Miss

    float dO = max(0.0, tSphere.x);  // Start at sphere entry

    // Temporal reprojection: start from previous frame's depth
    #ifdef USE_TEMPORAL
    float temporalDepth = getTemporalDepth(ro, rd, worldRayDir);
    if (temporalDepth > 0.0) {
        dO = max(dO, temporalDepth * 0.95);  // Safety margin
        usedTemporal = true;
    }
    #endif

    // Adaptive quality: interpolate between LQ and HQ based on multiplier
    int maxSteps = uFastMode ? MAX_MARCH_STEPS_LQ :
        int(mix(MAX_MARCH_STEPS_LQ, MAX_MARCH_STEPS_HQ, uQualityMultiplier));
    float surfDist = uFastMode ? SURF_DIST_LQ :
        mix(SURF_DIST_LQ, SURF_DIST_HQ, uQualityMultiplier);

    // Relaxed sphere tracing with overrelaxation (omega > 1)
    float omega = mix(1.0, 1.2, uQualityMultiplier);

    for (int i = 0; i < maxSteps; i++) {
        vec3 p = ro + rd * dO;
        float dS = GetDistWithTrap(p, trap);

        if (dS < surfDist) return dO;  // Hit!

        // Overrelaxation step with safety check
        float step = dS * omega;
        if (step > prevDist + dS) step = dS;  // Conservative fallback

        dO += step;
        if (dO > maxT) break;
    }
    return maxDist + 1.0;  // Miss
}
```

---

## How to Add a New Fractal Type

### Step 1: Create SDF Block

```typescript
// src/rendering/shaders/newfractal/sdf/sdf3d.glsl.ts
export const sdf3dBlock = `
float sdf3D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // Map 3D position to N-D using basis vectors
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    // ... your fractal iteration here ...
    return distance_estimate;
}

float sdf3D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    // Same without orbit trap (for normals)
    return distance_estimate;
}
`;
```

### Step 2: Create Dispatch Generator

```typescript
// src/rendering/shaders/newfractal/dispatch.glsl.ts
export function generateDispatch(dimension: number): string {
    return `
float GetDist(vec3 pos) {
    float pwr = getEffectivePower();
    float bail = max(uEscapeRadius, 2.0);
    int maxIt = uFastMode ? MAX_ITER_LQ : MAX_ITER_HQ;
    return sdf${dimension}D_simple(pos, pwr, bail, maxIt);
}

float GetDistWithTrap(vec3 pos, out float trap) {
    // Same with trap output
}
`;
}
```

### Step 3: Create Composer

```typescript
// src/rendering/shaders/newfractal/compose.ts
export function composeNewFractalShader(config: ShaderConfig): string {
    return [
        precisionBlock,
        constantsBlock,
        uniformsBlock,
        // Your custom blocks
        yourMathBlock,
        getSdfBlock(config.dimension),
        config.shadows ? shadowsBlock : '',
        mainBlock,
    ].join('\n');
}
```

### Step 4: Create React Component

```typescript
// src/rendering/renderers/NewFractal/NewFractalMesh.tsx
const NewFractalMesh = () => {
    const dimension = useGeometryStore((state) => state.dimension);

    const fragmentShader = useMemo(() =>
        composeNewFractalShader({ dimension, shadows: true, temporal: true }),
        [dimension]
    );

    // ... useFrame for uniform updates ...

    return <mesh ref={meshRef} geometry={sphereGeometry} material={material} />;
};
```

### Step 5: Register in UnifiedRenderer

```typescript
// src/rendering/renderers/UnifiedRenderer.tsx
{renderMode === 'raymarch-newfractal' && <NewFractalMesh />}
```

---

## Common Mistakes

**Shader Module Composition:**

- Do NOT: Put GLSL code directly in React components
- Do: Use TypeScript template strings in `*.glsl.ts` files and compose them

**SDF Basis Vectors:**

- Do NOT: Use raw 3D position without basis transformation
- Do: Always transform through `uOrigin + pos.x*uBasisX + pos.y*uBasisY + pos.z*uBasisZ`

**Distance Estimation:**

- Do NOT: Return raw radius or iteration count
- Do: Use proper DE formula: `0.5 * log(r) * r / dr`

**Quaternion Julia vs Mandelbulb:**

- Do NOT: Confuse which variable is the sample point
- Do: Mandelbulb: c = sample, z_0 = c. Julia: z_0 = sample, c = constant

**WebGL2 Syntax:**

- Do NOT: Use `attribute`, `varying`, `gl_FragColor` (WebGL1)
- Do: Use `in`, `out`, `layout(location=0) out vec4 gColor` (WebGL2/GLSL ES 3.00)

**Performance Uniforms:**

- Do NOT: Ignore `uFastMode` and `uQualityMultiplier`
- Do: Always use adaptive iteration counts based on performance mode

**Temporal Reprojection:**

- Do NOT: Skip the fallback when temporal hints miss
- Do: Always implement `RayMarchNoTemporal` as fallback
