# Schrödinger Visual Upgrade - Overview

## Executive Summary

This document outlines 15 visual enhancements for the Schrödinger quantum probability visualization. These upgrades range from nearly-free improvements that dramatically enhance appearance, to expensive "Ultra Quality" features for showcase scenarios. The enhancements are categorized into implementation tiers based on their impact-to-effort ratio.

## Current State

The Schrödinger object uses:
- Beer-Lambert absorption raymarching (16-128 samples)
- Basic ambient + diffuse + specular lighting with density gradient normals
- HSL color manipulation for density/phase visualization
- Horizon-style 1/4 resolution temporal accumulation with Bayer patterns

**Gap Analysis**: Missing state-of-the-art volumetric techniques including phase functions, multiple scattering approximation, self-shadowing, emission glow, edge detail, and advanced color palettes.

---

## Implementation Tiers

### Tier 1: "Free" Improvements (~7% total overhead)
**Do these first - maximum visual impact with minimal performance cost**

| Order | PRD | Feature | Overhead | Description |
|-------|-----|---------|----------|-------------|
| 1 | 02 | Beer-Powder Multiple Scattering | ~2% | Bright "silver lining" at edges via powder term |
| 2 | 04 | HDR Emission Glow | ~1% | High-density regions trigger bloom |
| 3 | 06 | Volumetric Fresnel/Rim | ~2% | View-dependent edge brightening |
| 4 | 12 | Cosine Gradient Palettes | ~1% | Rich multi-color artistic gradients |
| 5 | 13 | Atmospheric Depth Integration | ~1% | Scene fog integration |

**Expected Result**: 55+ FPS maintained, dramatically improved appearance

---

### Tier 2: "Cheap" Improvements (~15% additional overhead)
**Significant enhancement, still very playable**

| Order | PRD | Feature | Overhead | Description |
|-------|-----|---------|----------|-------------|
| 6 | 01 | Henyey-Greenstein Phase | ~5% | Anisotropic scattering (sun halos) |
| 7 | 11 | Subsurface Scattering | ~20% | Backlit translucency effect |
| 8 | 09 | Distance-Adaptive LOD | -10% to 0% | Performance optimization |
| 9 | 14 | GGX Specular Highlights | ~10% | Sharper, PBR-quality reflections |

**Expected Result**: ~50 FPS, professional-quality volumetric appearance

---

### Tier 3: "Moderate" Improvements (~35% additional overhead)
**Quality options - toggleable in settings**

| Order | PRD | Feature | Overhead | Description |
|-------|-----|---------|----------|-------------|
| 10 | 05 | Detail Noise Erosion | ~15% | Cloud-like edge detail (HZD technique) |
| 11 | 08 | Animated Curl Turbulence | ~20% | Flowing energy/smoke motion |
| 12 | 07 | Chromatic Dispersion | ~200%* | Prismatic RGB split (*optional toggle) |

**Expected Result**: ~35 FPS, maximum visual richness

---

### Tier 4: "Expensive" Improvements (~80%+ additional overhead)
**Ultra Quality presets only**

| Order | PRD | Feature | Overhead | Description |
|-------|-----|---------|----------|-------------|
| 13 | 03 | Volumetric Self-Shadowing | ~50% | Internal shadow structure |
| 14 | 10 | Volumetric Ambient Occlusion | ~60% | Self-occlusion depth cues |
| 15 | 15 | Quantum-Specific Effects | ~30% | Nodal surfaces, interference, collapse |

**Expected Result**: ~25-30 FPS, showcase/screenshot quality

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1-2)
Implement Tier 1 features for immediate visual uplift with minimal risk.

```
02 → 04 → 06 → 12 → 13
```

**Rationale**: These features require minimal shader changes, don't add new controls complexity, and provide the highest visual return on investment.

### Phase 2: Core Enhancements (Week 3-4)
Add Tier 2 features for professional-quality rendering.

```
01 → 14 → 09 → 11
```

**Rationale**: Phase function and GGX specular modernize the lighting model. LOD improves performance headroom. SSS adds dramatic backlighting.

### Phase 3: Quality Options (Week 5-6)
Implement Tier 3 as optional quality toggles.

```
05 → 08 → 07
```

**Rationale**: These features significantly impact performance and should be optional. Chromatic dispersion should be toggleable due to 3× density cost.

### Phase 4: Ultra Quality (Week 7-8)
Implement Tier 4 for showcase scenarios.

```
03 → 10 → 15
```

**Rationale**: These features are computationally expensive and should be "Ultra Quality" presets only. Quantum effects add unique educational value.

---

## Performance Impact Summary

| Configuration | Est. Overhead | Est. FPS | Use Case |
|---------------|---------------|----------|----------|
| Baseline | 0% | 60 FPS | Current |
| Tier 1 Only | +7% | 55+ FPS | Default |
| Tier 1+2 | +22% | ~48 FPS | High Quality |
| Tier 1+2+3 | +57% | ~38 FPS | Maximum Quality |
| All Features | +140%+ | ~25 FPS | Ultra/Screenshots |

**Note**: LOD (PRD 09) can offset 10-40% of overhead when viewing distant objects.

---

## Feature Dependencies

```
Independent Features (can implement in any order):
├── 02: Beer-Powder
├── 04: HDR Emission
├── 05: Detail Noise
├── 06: Volumetric Fresnel
├── 07: Chromatic Dispersion
├── 08: Animated Turbulence
├── 12: Cosine Palettes
├── 13: Atmospheric Fog
└── 15: Quantum Effects

Features with Synergies (implement together for best results):
├── 01 + 02: Phase Function + Powder (complete scattering model)
├── 03 + 10: Self-Shadow + AO (can share cone samples)
├── 04 + 06: Emission + Fresnel (edge enhancement)
└── 11 + 01: SSS + Phase Function (backlight enhancement)

System Integration:
├── 09: LOD (affects all other features)
└── 13: Fog (requires scene fog component)
```

---

## PRD Index

| # | Filename | Feature | Stories | Criteria |
|---|----------|---------|---------|----------|
| 01 | `01-henyey-greenstein-phase-function.md` | Anisotropic Scattering | 3 | 20 |
| 02 | `02-beer-powder-multiple-scattering.md` | Multiple Scattering Approx | 3 | 17 |
| 03 | `03-volumetric-self-shadowing.md` | Internal Shadows | 5 | 26 |
| 04 | `04-hdr-emission-glow.md` | Bloom-Triggering Emission | 5 | 30 |
| 05 | `05-detail-noise-erosion.md` | Edge Detail/Wisps | 5 | 30 |
| 06 | `06-volumetric-fresnel.md` | Rim Lighting | 5 | 27 |
| 07 | `07-chromatic-dispersion.md` | RGB Split/Iridescence | 5 | 26 |
| 08 | `08-animated-curl-noise-turbulence.md` | Flow Animation | 6 | 35 |
| 09 | `09-distance-adaptive-quality.md` | Level of Detail | 6 | 35 |
| 10 | `10-volumetric-ambient-occlusion.md` | Self-Occlusion | 6 | 35 |
| 11 | `11-subsurface-scattering-approximation.md` | Backlit Translucency | 6 | 35 |
| 12 | `12-dynamic-cosine-gradient-palettes.md` | Rich Color Gradients | 6 | 37 |
| 13 | `13-atmospheric-depth-integration.md` | Scene Fog | 5 | 30 |
| 14 | `14-ggx-specular-highlights.md` | PBR Specular | 6 | 36 |
| 15 | `15-quantum-specific-visual-effects.md` | Quantum Visualization | 7 | 44 |

**Totals**: 79 User Stories, 463 Acceptance Criteria

---

## Quality Preset Recommendations

### "Performance" Preset
- Tier 1 features only
- LOD enabled with aggressive settings
- ~55 FPS, good visual quality

### "Balanced" Preset (Recommended Default)
- Tier 1 + Tier 2 features
- LOD enabled with default settings
- ~48 FPS, professional quality

### "Quality" Preset
- Tier 1 + Tier 2 + Tier 3 features
- Chromatic dispersion OFF by default
- ~38 FPS, maximum visual richness

### "Ultra" Preset
- All features enabled
- For screenshots/showcases
- ~25 FPS, best possible appearance

### "Educational" Preset
- Tier 1 + Tier 2 + Quantum Effects (PRD 15)
- Focus on quantum visualization
- ~40 FPS, high educational value

---

## Technical Notes

### Temporal Accumulation Compatibility
All features should work with the existing Horizon-style temporal accumulation system. The 1/4 resolution + Bayer pattern approach provides headroom for additional per-sample calculations.

### Shader Modularity
Features should be implemented as conditional compilation blocks (`#ifdef`) to allow runtime toggling without shader recompilation where possible.

### UI Organization Suggestion
```
Schrödinger Settings
├── Color & Appearance
│   ├── Color Mode (Density/Phase/Mixed/Palette)
│   ├── Palette Settings (when Palette selected)
│   └── Emission Settings
├── Lighting & Shadows
│   ├── Phase Function (Scattering)
│   ├── Specular (GGX/Blinn-Phong)
│   ├── Rim Lighting
│   ├── SSS (Translucency)
│   ├── Self-Shadowing (Ultra)
│   └── Ambient Occlusion (Ultra)
├── Detail & Motion
│   ├── Edge Noise Erosion
│   ├── Flow Animation
│   └── Chromatic Dispersion
├── Environment
│   ├── Fog Integration
│   └── Internal Fog
├── Performance
│   ├── Quality Preset
│   └── LOD Settings
└── Quantum (Educational)
    ├── Nodal Surfaces
    ├── Energy Coloring
    ├── Interference
    ├── Uncertainty Shimmer
    └── Collapse Animation
```

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-12-17 | 1.0 | Claude | Initial PRD creation |
