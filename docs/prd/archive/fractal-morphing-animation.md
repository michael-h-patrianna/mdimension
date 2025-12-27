# Fractal Morphing Animation Enhancement

## Overview

This PRD defines the implementation of three animation techniques to eliminate the "flat" appearance during rotation for **Mandelbox**, **Menger**, and **Mandelbulb** fractal types. The goal is to transform static sculptures into breathing, morphing organisms.

## Problem Statement

Currently, rotating N-dimensional fractals produces a "just turning" effect - the shape spins but doesn't fundamentally change character. This is because:
1. Iteration formulas are mostly separable per-axis
2. The slice origin in extra dimensions is static
3. Every iteration applies identical transforms

## Solution: Three Animation Techniques

### Technique A: Dimension Mixing Inside Iteration

**Concept**: Apply a slightly non-orthogonal transformation (shearing/anisotropic) within each iteration to make "which dimension is which" matter dynamically.

**Implementation**:
- Create mixing matrix M with time-varying off-diagonal values
- Apply `z = M * z` before or after fold operations
- Off-diagonal terms use golden-ratio phase offsets for non-repeating patterns

**Formula**:
```
M[i][j] = sin(time * mixFrequency + phi_ij) * mixIntensity
where phi_ij = (i + j * goldenRatio) * 2π
```

### Technique B: Alternating Transforms Per Iteration

**Concept**: Instead of applying the same transform every iteration, alternate between different operations (period-2 or period-3).

**Variants by Fractal**:
- **Mandelbox**: Even=boxfold+spherefold, Odd=twist OR power OR shift
- **Menger**: Even=standard KIFS, Odd=rotated fold variant
- **Mandelbulb**: Even=basePower, Odd=alternatePower (creates hybrid bulbs)

### Technique C: Animated Slice Origin (Multi-Frequency Drift)

**Concept**: Add per-dimension oscillation with different frequencies to the slice origin in extra dimensions. Combined with rotation, this unlocks "feature birth/death".

**Formula**:
```
For dimension d >= 3:
  freq_d = driftBaseFrequency * (1 + (d-3) * driftFrequencySpread * 0.5)
  phase_d = d * goldenRatio * 2π * animationBias
  offset_d = driftAmplitude * sin(time * freq_d + phase_d)
  origin[d] = parameterValue[d] + offset_d
```

---

## Parameter Specifications

### Common Parameters (All Three Fractals)

#### Dimension Mixing (Technique A)
| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| dimensionMixEnabled | boolean | - | false | Enable dimension mixing |
| mixIntensity | number | 0.0 - 0.3 | 0.1 | Strength of off-diagonal mixing |
| mixFrequency | number | 0.1 - 2.0 | 0.5 | How fast mixing matrix evolves |

#### Origin Drift (Technique C)
| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| originDriftEnabled | boolean | - | false | Enable origin drift |
| driftAmplitude | number | 0.01 - 0.5 | 0.1 | Maximum displacement in extra dims |
| driftBaseFrequency | number | 0.05 - 0.5 | 0.1 | Base oscillation frequency |
| driftFrequencySpread | number | 0.0 - 1.0 | 0.3 | Per-dimension frequency variation |

### Mandelbox-Specific Parameters

#### Transform Alternation (Technique B)
| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| alternateTransformEnabled | boolean | - | false | Enable transform alternation |
| alternatePeriod | 2 \| 3 | - | 2 | Cycle period (even/odd or 3-phase) |
| alternateType | enum | twist/power/shift | twist | Which alternate operation |
| alternateIntensity | number | 0.0 - 1.0 | 0.5 | Blend factor for alternate transform |
| alternateTwistAngle | number | 0.0 - π/4 | π/8 | Rotation angle (twist type) |
| alternatePowerExponent | number | 1.5 - 4.0 | 2.0 | Power exponent (power type) |
| alternateAnimationEnabled | boolean | - | false | Animate intensity |
| alternateAnimationSpeed | number | 0.1 - 2.0 | 0.5 | Intensity oscillation speed |
| alternateAnimationAmplitude | number | 0.0 - 0.5 | 0.2 | Intensity oscillation range |

### Mandelbulb-Specific Parameters

#### Power Animation (Unique)
| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| powerAnimationEnabled | boolean | - | false | Enable power animation |
| powerCenter | number | 2.0 - 14.0 | 8.0 | Center of power oscillation |
| powerAmplitude | number | 0.5 - 6.0 | 2.0 | Amplitude of power oscillation |
| powerSpeed | number | 0.1 - 1.0 | 0.3 | Speed of power animation |

#### Alternate Power (Technique B Variant)
| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| alternatePowerEnabled | boolean | - | false | Enable power alternation |
| alternatePowerValue | number | 2.0 - 16.0 | 4.0 | Power for odd iterations |
| alternatePowerBlend | number | 0.0 - 1.0 | 0.5 | Blend between base and alternate |

### Menger-Specific Parameters

Menger already has existing animation parameters:
- foldTwistEnabled, foldTwistAngle, foldTwistSpeed
- scalePulseEnabled, scalePulseAmplitude, scalePulseSpeed
- sliceSweepEnabled, sliceSweepAmplitude, sliceSweepSpeed

New parameters (Dimension Mixing + Origin Drift) will be added alongside these.

---

## Animation Interaction Rules

### Speed Interaction
| Parameter | Interaction |
|-----------|-------------|
| mixFrequency | Multiplied by global animation speed |
| driftBaseFrequency | Multiplied by global animation speed |
| alternateAnimationSpeed | Multiplied by global animation speed |
| powerSpeed | Multiplied by global animation speed |

### Bias Interaction
| Parameter | Effect at Bias=0 | Effect at Bias=1 |
|-----------|------------------|------------------|
| Dimension mixing | All phases synchronized | Golden-ratio phase spread |
| Origin drift | All dims same frequency | Per-dim frequency spread active |
| Transform alternation | N/A | N/A |

### Animation Curves
- **Dimension Mixing**: Sinusoidal with golden-ratio phase offsets
- **Origin Drift**: Multi-sine (different frequency per dimension)
- **Transform Alternation**: Sinusoidal intensity when animated
- **Power Animation**: Sinusoidal between powerCenter ± powerAmplitude

---

## UI Design

### Location
`src/components/layout/TimelineControls.tsx` - "Fractal Controls" drawer

### Structure

```
FRACTAL CONTROLS (drawer)
├── DIMENSION MIXING (all fractals)
│   ├── [toggle] Enable
│   ├── [slider] Mix Intensity (0.0 - 0.3)
│   └── [slider] Mix Frequency (0.1 - 2.0)
│
├── ORIGIN DRIFT (all fractals)
│   ├── [toggle] Enable
│   ├── [slider] Drift Amplitude (0.01 - 0.5)
│   ├── [slider] Base Frequency (0.05 - 0.5)
│   └── [slider] Frequency Spread (0.0 - 1.0)
│
├── SCALE ANIMATION (mandelbox only - existing)
├── JULIA MODE (mandelbox only - existing)
│
├── TRANSFORM ALTERNATION (mandelbox only)
│   ├── [toggle] Enable
│   ├── [select] Period (2 / 3)
│   ├── [select] Type (Twist / Power / Shift)
│   ├── [slider] Intensity (0.0 - 1.0)
│   ├── [toggle] Animate Intensity
│   └── [slider] Animation Speed (0.1 - 2.0)
│
├── POWER ANIMATION (mandelbulb only)
│   ├── [toggle] Enable
│   ├── [slider] Power Center (2.0 - 14.0)
│   ├── [slider] Power Amplitude (0.5 - 6.0)
│   └── [slider] Power Speed (0.1 - 1.0)
│
├── ALTERNATE POWER (mandelbulb only)
│   ├── [toggle] Enable
│   ├── [slider] Alternate Power (2.0 - 16.0)
│   └── [slider] Blend Factor (0.0 - 1.0)
│
├── FOLD TWIST (menger only - existing)
├── SCALE PULSE (menger only - existing)
└── SLICE SWEEP (menger only - existing)
```

---

## Implementation Plan

### Phase 1: Shared Infrastructure
1. Add shared animation interfaces to `types.ts`
2. Create `src/lib/animation/originDrift.ts` - drift calculation utility
3. Create `src/lib/animation/dimensionMix.ts` - mixing matrix utility

### Phase 2: Origin Drift (All Fractals)
1. Add origin drift params to config interfaces
2. Add store actions to mandelboxSlice, mengerSlice, mandelbulbSlice
3. Implement CPU-side drift calculation in mesh components
4. Add UI controls to TimelineControls
5. Test across all dimensions

### Phase 3: Dimension Mixing (All Fractals)
1. Add mixing uniforms to mesh components
2. Implement mixing functions in fragment shaders
3. Integrate into iteration loops
4. Add UI controls
5. Test stability

### Phase 4: Fractal-Specific Features
1. **Mandelbox**: Transform alternation (shader + UI)
2. **Mandelbulb**: Power animation + alternate power (shader + UI)
3. **Menger**: Verify compatibility with existing animations

### Phase 5: Testing & Polish
1. Unit tests for store actions
2. Component tests for mesh components
3. Integration tests for animation interactions
4. Performance profiling
5. Documentation updates

---

## Files to Modify

### Types & Store
| File | Changes |
|------|---------|
| `src/lib/geometry/extended/types.ts` | Add animation config interfaces |
| `src/stores/slices/geometry/mandelboxSlice.ts` | Add dimension mix, origin drift, alternate transform actions |
| `src/stores/slices/geometry/mengerSlice.ts` | Add dimension mix, origin drift actions |
| `src/stores/slices/geometry/mandelbulbSlice.ts` | Add dimension mix, origin drift, power animation, alternate power actions |

### Animation Utilities (New)
| File | Purpose |
|------|---------|
| `src/lib/animation/originDrift.ts` | Multi-frequency drift calculation |
| `src/lib/animation/dimensionMix.ts` | Mixing matrix computation |

### Mesh Components
| File | Changes |
|------|---------|
| `src/rendering/renderers/Mandelbox/MandelboxMesh.tsx` | Add uniforms, drift calc, animation time |
| `src/rendering/renderers/Menger/MengerMesh.tsx` | Add uniforms, drift calc |
| `src/rendering/renderers/Mandelbulb/MandelbulbMesh.tsx` | Add uniforms, drift calc, power animation |

### Shaders
| File | Changes |
|------|---------|
| `src/rendering/renderers/Mandelbox/mandelbox.frag` | Mixing function, alternate transform |
| `src/rendering/renderers/Menger/menger.frag` | Mixing function |
| `src/rendering/renderers/Mandelbulb/mandelbulb.frag` | Mixing function, alternate power |

### UI
| File | Changes |
|------|---------|
| `src/components/layout/TimelineControls.tsx` | Unified Fractal Controls with conditional sections |

---

## Performance Considerations

### Computational Cost per Iteration
- **Dimension Mixing**: ~6 sin() calls + matrix multiply
- **Transform Alternation**: 1 conditional + transform operations
- **Origin Drift**: CPU-only, negligible

### Mitigations
1. Mixing matrix precomputed per-frame (not per-iteration)
2. Fast mode reduces iteration count during animation
3. Progressive refinement restores quality after interaction stops

### Risk Areas
1. Shader stability at 9D-11D with mixing enabled
2. Some parameter combinations may produce visual chaos
3. Menger's KIFS may respond differently to mixing

---

## Success Criteria

1. All three fractals support dimension mixing and origin drift
2. Mandelbox supports transform alternation
3. Mandelbulb supports power animation and alternate power
4. Animations interact correctly with speed and bias controls
5. No performance regression during normal use
6. All existing tests pass
7. New tests cover animation parameters
8. UI is intuitive and responsive
