# Hyperbulb Soft Shadows - Implementation Plan

## Overview

This plan implements soft shadow rendering for hyperbulb fractals with user-configurable quality and softness settings, as specified in `docs/prd/hyperbulb_shadows.md`.

---

## Implementation Phases

### Phase 1: Foundation (Story 1 Dependency)

#### 1.1 Create Shadow Types (`src/lib/shadows/types.ts`)

```typescript
export type ShadowQuality = 'low' | 'medium' | 'high' | 'ultra';

/** Shadow behavior during camera rotation/animation */
export type ShadowAnimationMode = 'pause' | 'low' | 'full';

export interface ShadowSettings {
  enabled: boolean;
  quality: ShadowQuality;
  softness: number;
  animationMode: ShadowAnimationMode;
}

export const SHADOW_QUALITY_TO_INT: Record<ShadowQuality, number> = {
  low: 0,
  medium: 1,
  high: 2,
  ultra: 3,
};

export const INT_TO_SHADOW_QUALITY: Record<number, ShadowQuality> = {
  0: 'low',
  1: 'medium',
  2: 'high',
  3: 'ultra',
};

export const SHADOW_ANIMATION_MODE_TO_INT: Record<ShadowAnimationMode, number> = {
  pause: 0,  // Disable shadows during animation
  low: 1,    // Use low quality during animation
  full: 2,   // Keep full quality during animation
};
```

#### 1.2 Create Shadow Constants (`src/lib/shadows/constants.ts`)

```typescript
export const DEFAULT_SHADOW_ENABLED = false;
export const DEFAULT_SHADOW_QUALITY: ShadowQuality = 'medium';
export const DEFAULT_SHADOW_SOFTNESS = 1.0;
export const DEFAULT_SHADOW_ANIMATION_MODE: ShadowAnimationMode = 'pause';

export const SHADOW_SOFTNESS_RANGE = {
  min: 0.0,
  max: 2.0,
  step: 0.1,
  default: 1.0,
};

export const SHADOW_QUALITY_OPTIONS: ShadowQuality[] = ['low', 'medium', 'high', 'ultra'];

export const SHADOW_QUALITY_LABELS: Record<ShadowQuality, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

export const SHADOW_QUALITY_TOOLTIPS: Record<ShadowQuality, string> = {
  low: 'Fast rendering, visible stepping in shadow gradients',
  medium: 'Balanced quality and performance',
  high: 'Smooth shadows with minimal artifacts',
  ultra: 'Highest quality, recommended for screenshots only',
};

// Animation mode options
export const SHADOW_ANIMATION_MODE_OPTIONS: ShadowAnimationMode[] = ['pause', 'low', 'full'];

export const SHADOW_ANIMATION_MODE_LABELS: Record<ShadowAnimationMode, string> = {
  pause: 'Pause during animation',
  low: 'Low quality during animation',
  full: 'Full quality always',
};

export const SHADOW_ANIMATION_MODE_TOOLTIPS: Record<ShadowAnimationMode, string> = {
  pause: 'Disable shadows during rotation for best performance',
  low: 'Use low quality shadows during rotation for smooth interaction',
  full: 'Maintain selected quality always (may affect performance)',
};

// URL serialization keys
export const URL_KEY_SHADOW_ENABLED = 'se';
export const URL_KEY_SHADOW_QUALITY = 'sq';
export const URL_KEY_SHADOW_SOFTNESS = 'ss';
export const URL_KEY_SHADOW_ANIMATION_MODE = 'sa';
```

#### 1.3 Create Barrel Export (`src/lib/shadows/index.ts`)

```typescript
export * from './types';
export * from './constants';
```

#### 1.4 Update Visual Store (`src/stores/visualStore.ts`)

Add to state interface:
- `shadowEnabled: boolean`
- `shadowQuality: ShadowQuality`
- `shadowSoftness: number`
- `shadowAnimationMode: ShadowAnimationMode`

Add actions:
- `setShadowEnabled: (enabled: boolean) => void`
- `setShadowQuality: (quality: ShadowQuality) => void`
- `setShadowSoftness: (softness: number) => void`
- `setShadowAnimationMode: (mode: ShadowAnimationMode) => void`

Add to INITIAL_STATE with defaults.

---

### Phase 2: Shader Implementation (Stories 1, 4)

#### 2.1 Update Fragment Shader (`hyperbulb.frag`)

**Add uniforms after line 91:**
```glsl
// Shadow System uniforms
uniform bool uShadowEnabled;
uniform int uShadowQuality;        // 0=low, 1=medium, 2=high, 3=ultra
uniform float uShadowSoftness;     // 0.0-2.0
uniform int uShadowAnimationMode;  // 0=pause, 1=low, 2=full
```

**Add quality-aware soft shadow function (after calcSoftShadow ~line 1093):**
```glsl
// Quality-aware soft shadow with variable sample count
float calcSoftShadowQuality(vec3 ro, vec3 rd, float mint, float maxt, float softness, int quality) {
    // Sample counts: low=8, medium=16, high=24, ultra=32
    int maxSteps = 8 + quality * 8;

    float res = 1.0;
    float t = mint;
    float ph = 1e10;

    // Softness affects penumbra size (k parameter)
    // softness=0 -> k=64 (hard), softness=2 -> k=4 (very soft)
    float k = mix(64.0, 4.0, softness * 0.5);

    for (int i = 0; i < 32; i++) {
        if (i >= maxSteps || t > maxt) break;

        float h = GetDist(ro + rd * t);
        if (h < 0.001) return 0.0;

        // Improved soft shadow technique
        float y = h * h / (2.0 * ph);
        float d = sqrt(h * h - y * y);
        res = min(res, k * d / max(0.0, t - y));
        ph = h;

        t += clamp(h, 0.02, 0.25);
    }
    return clamp(res, 0.0, 1.0);
}
```

**Update lighting loop (inside for loop around line 1343-1346):**
```glsl
// Calculate shadow
float shadow = 1.0;
if (uShadowEnabled) {
    // Determine if we should render shadows based on animation mode
    // uShadowAnimationMode: 0=pause (skip in fast mode), 1=low (use low quality), 2=full (use selected quality)
    bool shouldRenderShadow = !uFastMode || uShadowAnimationMode > 0;

    if (shouldRenderShadow) {
        vec3 shadowOrigin = p + n * 0.02; // Offset to avoid self-shadowing
        vec3 shadowDir;
        float shadowMaxDist;

        if (lightType == LIGHT_TYPE_DIRECTIONAL) {
            shadowDir = l;
            shadowMaxDist = 10.0;
        } else {
            shadowDir = l;
            shadowMaxDist = length(uLightPositions[i] - p);
        }

        // Determine quality to use
        // In fast mode: use low (0) if animationMode=1, else use selected quality
        int effectiveQuality = uShadowQuality;
        if (uFastMode && uShadowAnimationMode == 1) {
            effectiveQuality = 0; // Force low quality during animation
        }

        // Spot lights: only calculate shadow within cone
        if (lightType == LIGHT_TYPE_SPOT) {
            vec3 lightToFrag = normalize(p - uLightPositions[i]);
            float spotEffect = getSpotAttenuation(i, lightToFrag);
            if (spotEffect < 0.001) {
                shadow = 1.0; // Outside spotlight cone, no shadow
            } else {
                shadow = calcSoftShadowQuality(shadowOrigin, shadowDir, 0.02, shadowMaxDist, uShadowSoftness, effectiveQuality);
            }
        } else {
            shadow = calcSoftShadowQuality(shadowOrigin, shadowDir, 0.02, shadowMaxDist, uShadowSoftness, effectiveQuality);
        }

        // Shadow intensity scales with light intensity
        shadow = mix(1.0, shadow, attenuation);
    }
}

// Apply shadow to diffuse (already present, modify to include shadow)
col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;
```

#### 2.2 Update HyperbulbMesh.tsx

**Add store subscriptions:**
```typescript
const shadowEnabled = useVisualStore((state) => state.shadowEnabled);
const shadowQuality = useVisualStore((state) => state.shadowQuality);
const shadowSoftness = useVisualStore((state) => state.shadowSoftness);
const shadowAnimationMode = useVisualStore((state) => state.shadowAnimationMode);
```

**Add uniforms to useMemo:**
```typescript
// Shadow System uniforms
uShadowEnabled: { value: false },
uShadowQuality: { value: 1 },
uShadowSoftness: { value: 1.0 },
uShadowAnimationMode: { value: 0 },
```

**Update uniforms in useFrame:**
```typescript
// Shadow System uniforms
if (material.uniforms.uShadowEnabled) {
  material.uniforms.uShadowEnabled.value = shadowEnabled;
}
if (material.uniforms.uShadowQuality) {
  material.uniforms.uShadowQuality.value = SHADOW_QUALITY_TO_INT[shadowQuality];
}
if (material.uniforms.uShadowSoftness) {
  material.uniforms.uShadowSoftness.value = shadowSoftness;
}
if (material.uniforms.uShadowAnimationMode) {
  material.uniforms.uShadowAnimationMode.value = SHADOW_ANIMATION_MODE_TO_INT[shadowAnimationMode];
}
```

---

### Phase 3: UI Controls (Stories 1, 2, 3)

#### 3.1 Update FacesSection.tsx MaterialTabContent

**Add to store subscriptions:**
```typescript
const {
  // ... existing
  shadowEnabled,
  shadowQuality,
  shadowSoftness,
  shadowAnimationMode,
  setShadowEnabled,
  setShadowQuality,
  setShadowSoftness,
  setShadowAnimationMode,
  lights,
} = useVisualStore(useShallow((state) => ({
  // ... existing
  shadowEnabled: state.shadowEnabled,
  shadowQuality: state.shadowQuality,
  shadowSoftness: state.shadowSoftness,
  shadowAnimationMode: state.shadowAnimationMode,
  setShadowEnabled: state.setShadowEnabled,
  setShadowQuality: state.setShadowQuality,
  setShadowSoftness: state.setShadowSoftness,
  setShadowAnimationMode: state.setShadowAnimationMode,
  lights: state.lights,
})));
```

**Add helper to check for enabled lights:**
```typescript
const hasEnabledLights = lights.some((light) => light.enabled);
```

**Add shadow controls section in MaterialTabContent (after opacity controls, before lighting controls):**
```tsx
{/* Shadow Controls - Only for Hyperbulb with enabled lights */}
{isHyperbulb && hasEnabledLights && (
  <>
    <SectionHeader title="Shadows" />

    <Switch
      checked={shadowEnabled}
      onCheckedChange={setShadowEnabled}
      label="Shadows"
      tooltip="Enable soft shadows (may reduce performance)"
    />

    {shadowEnabled && (
      <>
        {/* Shadow Quality */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">
            Shadow Quality
          </label>
          <select
            value={shadowQuality}
            onChange={(e) => setShadowQuality(e.target.value as ShadowQuality)}
            className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            title={SHADOW_QUALITY_TOOLTIPS[shadowQuality]}
          >
            {SHADOW_QUALITY_OPTIONS.map((quality) => (
              <option key={quality} value={quality}>
                {SHADOW_QUALITY_LABELS[quality]}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-secondary">
            {SHADOW_QUALITY_TOOLTIPS[shadowQuality]}
          </p>
        </div>

        {/* Shadow Softness */}
        <Slider
          label="Shadow Softness"
          min={SHADOW_SOFTNESS_RANGE.min}
          max={SHADOW_SOFTNESS_RANGE.max}
          step={SHADOW_SOFTNESS_RANGE.step}
          value={shadowSoftness}
          onChange={setShadowSoftness}
          onReset={() => setShadowSoftness(SHADOW_SOFTNESS_RANGE.default)}
          showValue
        />

        {/* Shadow Animation Mode */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">
            Animation Quality
          </label>
          <select
            value={shadowAnimationMode}
            onChange={(e) => setShadowAnimationMode(e.target.value as ShadowAnimationMode)}
            className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            title={SHADOW_ANIMATION_MODE_TOOLTIPS[shadowAnimationMode]}
          >
            {SHADOW_ANIMATION_MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {SHADOW_ANIMATION_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-secondary">
            {SHADOW_ANIMATION_MODE_TOOLTIPS[shadowAnimationMode]}
          </p>
        </div>
      </>
    )}
  </>
)}
```

---

### Phase 4: Performance Optimization (Story 5)

The shadow animation mode gives users control over shadow behavior during rotation:

| Mode | Behavior During Animation | Use Case |
|------|---------------------------|----------|
| `pause` | Shadows disabled | Best performance, smooth interaction |
| `low` | Low quality shadows | Balance of performance + visibility |
| `full` | Full selected quality | Maximum visual fidelity |

The existing `uFastMode` uniform is still used to detect when animation is happening. The new `uShadowAnimationMode` uniform controls what happens:
- Mode 0 (`pause`): Skip shadow calculation when `uFastMode` is true
- Mode 1 (`low`): Force `effectiveQuality = 0` when `uFastMode` is true
- Mode 2 (`full`): Use selected `uShadowQuality` regardless of `uFastMode`

Quality restores automatically after 150ms (existing QUALITY_RESTORE_DELAY_MS) when animation stops.

---

### Phase 5: URL Serialization (Story 6)

#### 5.1 Update state-serializer.ts

**Add to ShareableState interface:**
```typescript
shadowEnabled?: boolean;
shadowQuality?: ShadowQuality;
shadowSoftness?: number;
shadowAnimationMode?: ShadowAnimationMode;
```

**Add to serializeState():**
```typescript
// Shadow settings (omit defaults for shorter URLs)
if (state.shadowEnabled === true) {
  params.set(URL_KEY_SHADOW_ENABLED, '1');
}
if (state.shadowQuality && state.shadowQuality !== DEFAULT_SHADOW_QUALITY) {
  params.set(URL_KEY_SHADOW_QUALITY, state.shadowQuality);
}
if (state.shadowSoftness !== undefined && state.shadowSoftness !== DEFAULT_SHADOW_SOFTNESS) {
  params.set(URL_KEY_SHADOW_SOFTNESS, state.shadowSoftness.toFixed(1));
}
if (state.shadowAnimationMode && state.shadowAnimationMode !== DEFAULT_SHADOW_ANIMATION_MODE) {
  params.set(URL_KEY_SHADOW_ANIMATION_MODE, state.shadowAnimationMode);
}
```

**Add to deserializeState():**
```typescript
// Shadow settings
if (params.has(URL_KEY_SHADOW_ENABLED)) {
  state.shadowEnabled = params.get(URL_KEY_SHADOW_ENABLED) === '1';
}
if (params.has(URL_KEY_SHADOW_QUALITY)) {
  const quality = params.get(URL_KEY_SHADOW_QUALITY);
  if (SHADOW_QUALITY_OPTIONS.includes(quality as ShadowQuality)) {
    state.shadowQuality = quality as ShadowQuality;
  } else {
    // Invalid param = disable shadows (PRD AC: invalid defaults to OFF)
    state.shadowEnabled = false;
  }
}
if (params.has(URL_KEY_SHADOW_SOFTNESS)) {
  const softness = parseFloat(params.get(URL_KEY_SHADOW_SOFTNESS)!);
  if (!isNaN(softness) && softness >= SHADOW_SOFTNESS_RANGE.min && softness <= SHADOW_SOFTNESS_RANGE.max) {
    state.shadowSoftness = softness;
  }
}
if (params.has(URL_KEY_SHADOW_ANIMATION_MODE)) {
  const mode = params.get(URL_KEY_SHADOW_ANIMATION_MODE);
  if (SHADOW_ANIMATION_MODE_OPTIONS.includes(mode as ShadowAnimationMode)) {
    state.shadowAnimationMode = mode as ShadowAnimationMode;
  }
}
```

---

### Phase 6: Testing

#### 6.1 Unit Tests

**`src/tests/stores/visualStore.shadow.test.ts`**
- Test default values
- Test setShadowEnabled
- Test setShadowQuality with clamping
- Test setShadowSoftness with clamping
- Test reset clears shadow settings

**`src/tests/lib/url/shadow-serialization.test.ts`**
- Test serialize with defaults (no params)
- Test serialize with non-defaults
- Test deserialize valid params
- Test deserialize invalid quality (shadows disabled)
- Test deserialize invalid softness (ignored)

**`src/tests/lib/shadows/constants.test.ts`**
- Test SHADOW_QUALITY_OPTIONS includes all values
- Test SHADOW_SOFTNESS_RANGE values

#### 6.2 Component Tests

**`src/tests/components/sidebar/Faces/ShadowControls.test.tsx`**
- Test toggle visibility when hyperbulb + lights enabled
- Test toggle hidden when no lights
- Test toggle hidden when not hyperbulb
- Test quality dropdown changes
- Test softness slider changes
- Test controls hidden when shadows disabled

#### 6.3 E2E Tests

**`scripts/playwright/shadow-toggle.spec.ts`**
- Navigate to hyperbulb
- Enable a light
- Toggle shadows on
- Verify shadow visible in render
- Toggle shadows off
- Verify shadow gone

---

## File Summary

| File | Action | Story |
|------|--------|-------|
| `src/lib/shadows/types.ts` | Create | 1, 2, 5 |
| `src/lib/shadows/constants.ts` | Create | 1, 2, 3, 5, 6 |
| `src/lib/shadows/index.ts` | Create | - |
| `src/stores/visualStore.ts` | Modify | 1, 2, 3, 5 |
| `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag` | Modify | 1, 4, 5 |
| `src/components/canvas/renderers/Hyperbulb/HyperbulbMesh.tsx` | Modify | 1, 5 |
| `src/components/sidebar/Faces/FacesSection.tsx` | Modify | 1, 2, 3, 5 |
| `src/lib/url/state-serializer.ts` | Modify | 6 |
| `src/tests/stores/visualStore.shadow.test.ts` | Create | - |
| `src/tests/lib/url/shadow-serialization.test.ts` | Create | - |
| `src/tests/lib/shadows/constants.test.ts` | Create | - |
| `src/tests/components/sidebar/Faces/ShadowControls.test.tsx` | Create | - |
| `scripts/playwright/shadow-toggle.spec.ts` | Create | - |

### New State Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `shadowEnabled` | `boolean` | `false` | Master toggle for shadows |
| `shadowQuality` | `ShadowQuality` | `'medium'` | Static quality (low/medium/high/ultra) |
| `shadowSoftness` | `number` | `1.0` | Penumbra softness (0.0-2.0) |
| `shadowAnimationMode` | `ShadowAnimationMode` | `'pause'` | Behavior during animation |

### URL Parameters

| Key | Values | Description |
|-----|--------|-------------|
| `se` | `0`/`1` | Shadow enabled |
| `sq` | `low`/`medium`/`high`/`ultra` | Shadow quality |
| `ss` | `0.0`-`2.0` | Shadow softness |
| `sa` | `pause`/`low`/`full` | Animation mode |

---

## Open Questions from PRD

1. **Should shadow quality automatically reduce for dimensions 8D+?**
   - Recommendation: Yes - add dimension check in shader to cap quality at 'medium' for D >= 8

2. **Should there be a global "max shadow distance" setting?**
   - Recommendation: No for initial implementation - use fixed reasonable max (10.0 units)

---

## Acceptance Criteria Coverage

| Story | ACs | Covered By |
|-------|-----|------------|
| 1 | 8 | visualStore, FacesSection, hyperbulb.frag |
| 2 | 8 | visualStore, FacesSection, hyperbulb.frag |
| 3 | 8 | visualStore, FacesSection, hyperbulb.frag |
| 4 | 8 | hyperbulb.frag (light type handling) |
| 5 | 7 | Existing uFastMode + shader integration |
| 6 | 6 | state-serializer.ts |

Total: 44 acceptance criteria covered.
