# Hyperbulb Implementation Plan: 4D-11D Mandelbrot-like Fractals

## Overview

This plan implements proper higher-dimensional (4D-11D) Mandelbrot-like fractals using hyperspherical coordinates, following the guide at `docs/research/hyperbulb-guide.md`.

### Current State
- **2D**: Classic complex Mandelbrot (z² + c) ✅
- **3D**: Mandelbulb using spherical coordinates ✅
- **4D+**: Ad-hoc "coupled quadratics" ❌ (needs replacement)

### Target State
- **4D-11D**: True Hyperbulb fractals using hyperspherical coordinates

---

## Implementation Steps

### Step 1: Create `hyperspherical.ts` (Core Math)

**File**: `src/lib/geometry/extended/mandelbrot/hyperspherical.ts`

Implement dimension-agnostic hyperspherical coordinate transformations:

```typescript
// Types
export interface HypersphericalCoords {
  r: number;
  theta: Float32Array; // D-1 angles
}

// Core functions
export function toHyperspherical(v: Float32Array, eps?: number): HypersphericalCoords;
export function fromHyperspherical(r: number, theta: Float32Array): Float32Array;
export function powMap(v: Float32Array, power: number, eps?: number): Float32Array;
export function hyperbulbStep(z: VectorND, c: VectorND, power?: number, eps?: number): VectorND;
```

**Algorithm for `toHyperspherical`**:
1. Compute `r = ||v||`
2. If `r < eps`, return `{r: 0, theta: zeros}`
3. For `i = 0` to `D-3`: compute `theta[i] = acos(clamp(v[i] / tailNorm, -1, 1))`
4. Last angle: `theta[D-2] = atan2(v[D-1], v[D-2])`

**Algorithm for `fromHyperspherical`**:
1. Build products of sines progressively
2. `x[i] = r * prod * cos(theta[i])` for `i < D-2`
3. Last two: use `cos/sin(theta[D-2])`

**Algorithm for `powMap`**:
1. Convert to hyperspherical: `{r, theta} = toHyperspherical(v)`
2. `r' = r^power`
3. `theta'[i] = theta[i] * power` for all angles
4. Convert back: `fromHyperspherical(r', theta')`

---

### Step 2: Update `math.ts`

**File**: `src/lib/geometry/extended/mandelbrot/math.ts`

Replace the "coupled quadratics" heuristic with proper hyperbulb:

```typescript
import { hyperbulbStep } from './hyperspherical';

export function mandelbrotStep(z: VectorND, c: VectorND, power: number = 8): VectorND {
  const d = z.length;

  if (d === 2) {
    // Standard complex Mandelbrot (unchanged)
    return [zx*zx - zy*zy + cx, 2*zx*zy + cy];
  }

  if (d === 3) {
    // Mandelbulb (unchanged)
    return mandelbulbStep(z, c, power);
  }

  // Dimensions 4-11: Hyperbulb
  return hyperbulbStep(z, c, power);
}
```

---

### Step 3: Update `types.ts`

**File**: `src/lib/geometry/extended/types.ts`

Add/modify configuration parameters:

```typescript
export interface MandelbrotConfig {
  // ... existing fields ...

  /** Epsilon for numerical stability near origin. Default: 1e-12 */
  epsilon: number;
}

// Update default config
export const DEFAULT_MANDELBROT_CONFIG: MandelbrotConfig = {
  // ... existing ...
  epsilon: 1e-12,
};
```

Extend `escapeRadius` validation to allow up to 16 (guide recommends 8-16 for higher D).

---

### Step 4: Update `extendedObjectStore.ts`

**File**: `src/stores/extendedObjectStore.ts`

Update dimension initialization with recommended defaults:

```typescript
initializeMandelbrotForDimension: (dimension: number) => {
  const paramCount = Math.max(0, dimension - 3);

  // Dimension-specific defaults from hyperbulb guide
  const escapeRadius = dimension >= 4 ? 8.0 : 4.0;
  const power = dimension === 2 ? 2 : 8;
  const extent = dimension === 2 ? 1.75 : (dimension === 3 ? 1.5 : 2.0);
  const colorMode = dimension >= 3 ? 'boundaryOnly' : 'escapeTime';

  const center = dimension === 2
    ? [-0.5, 0]
    : new Array(dimension).fill(0);

  set((state) => ({
    mandelbrot: {
      ...state.mandelbrot,
      parameterValues: new Array(paramCount).fill(0),
      center,
      visualizationAxes: [0, 1, 2],
      colorMode,
      extent,
      escapeRadius,
      mandelbulbPower: power,
    },
  }));
},
```

---

### Step 5: Update `index.ts` Exports

**File**: `src/lib/geometry/extended/mandelbrot/index.ts`

Add exports for new functions:

```typescript
export {
  toHyperspherical,
  fromHyperspherical,
  powMap,
  hyperbulbStep,
  type HypersphericalCoords,
} from './hyperspherical';
```

---

### Step 6: Update UI Controls

**File**: `src/components/controls/MandelbrotControls.tsx`

Add dynamic naming based on dimension:

```typescript
function getFractalName(dimension: number): string {
  if (dimension === 2) return 'Mandelbrot Set';
  if (dimension === 3) return 'Mandelbulb';
  return `${dimension}D Hyperbulb`;
}
```

Add helper text for higher dimensions:
- "Higher dimensions may need escape radius 8-16 for stability"
- Show formula: "v = powMap(v, power) + c using hyperspherical coordinates"

---

### Step 7: Comprehensive Tests

**File**: `src/tests/lib/geometry/extended/mandelbrot.test.ts` (expand)

#### Unit Tests for Hyperspherical Functions

```typescript
describe('Hyperspherical coordinates', () => {
  describe('toHyperspherical', () => {
    it('returns zero angles for origin');
    it('correctly converts 2D vector (compare with atan2)');
    it('correctly converts 3D vector (compare with spherical)');
    it('correctly converts 4D vector');
    it('handles edge cases near axis-aligned vectors');
    it('round-trips correctly for random vectors D=2..11');
  });

  describe('fromHyperspherical', () => {
    it('returns origin for r=0');
    it('correctly converts 2D polar');
    it('correctly converts 3D spherical');
    it('correctly converts 4D+ hyperspherical');
  });

  describe('powMap', () => {
    it('returns zero for zero input');
    it('squares correctly for power=2');
    it('applies power=8 correctly');
    it('matches 3D mandelbulb for comparison');
  });
});
```

#### Integration Tests

```typescript
describe('Hyperbulb fractal generation', () => {
  it.each([4, 5, 6, 7, 8, 9, 10, 11])('generates valid geometry for %dD', (dim) => {
    const geometry = generateMandelbrot(dim, config);
    expect(geometry.vertices.length).toBeGreaterThan(0);
    expect(geometry.dimension).toBe(dim);
  });

  it('produces different results for different slice values');
  it('produces consistent results for same parameters (deterministic)');
});
```

---

## Files Summary

| Action | File |
|--------|------|
| CREATE | `src/lib/geometry/extended/mandelbrot/hyperspherical.ts` |
| MODIFY | `src/lib/geometry/extended/mandelbrot/math.ts` |
| MODIFY | `src/lib/geometry/extended/mandelbrot/index.ts` |
| MODIFY | `src/lib/geometry/extended/types.ts` |
| MODIFY | `src/stores/extendedObjectStore.ts` |
| MODIFY | `src/components/controls/MandelbrotControls.tsx` |
| EXPAND | `src/tests/lib/geometry/extended/mandelbrot.test.ts` |

---

## Key Implementation Notes

### Numerical Stability (from guide section 6)
1. **Origin handling**: At `r ≈ 0`, angles are undefined. Return `r=0, theta=zeros`.
2. **acos clamping**: Always clamp input to `[-1, 1]` to prevent NaN.
3. **Bailout tuning**: Higher D can escape faster. Start with `bailout=8` for D≥4.

### Performance Considerations
- Start with `resolution=48` or `64` for 4D+
- Keep `maxIterations` around `40-80`
- Consider GPU compute for production (future enhancement)

### Recommended Defaults by Dimension

| Dimension | Name | Power | Bailout | Extent | Notes |
|-----------|------|-------|---------|--------|-------|
| 2 | Mandelbrot | 2 | 4 | 1.75 | Classic complex |
| 3 | Mandelbulb | 8 | 4 | 1.5 | Spherical coords |
| 4-11 | Hyperbulb | 8 | 8 | 2.0 | Hyperspherical coords |

---

## Verification Checklist

- [ ] All tests pass (`npm test`)
- [ ] 4D-11D fractals render visually correct 3D slices
- [ ] UI shows correct naming (Mandelbrot/Mandelbulb/Hyperbulb)
- [ ] Slice parameter sliders work for dimensions 4+
- [ ] No regression in 2D/3D fractal quality
- [ ] Performance acceptable at standard quality preset
