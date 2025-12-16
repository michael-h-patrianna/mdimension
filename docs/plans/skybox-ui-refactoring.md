# Skybox UI Refactoring Plan

## Overview
Simplify the skybox selection interface by replacing the current two-tier system (switch + dropdown + thumbnails) with a unified thumbnail grid showing all skybox options including a "None" option.

## Current State
- **Enable Skybox** toggle switch
- **Skybox Mode** dropdown with 4 options: Classic, Aurora, Nebula, Void
- **Classic mode**: 3x thumbnail grid (Deep Space, Nebula, Red Giant) + mode-specific controls
- **Procedural modes**: Sliders and controls for procedural parameters

## Target State
Single unified thumbnail grid with all options:
1. **None** - Disables skybox (black thumbnail)
2. **Deep Space** - Classic cubemap
3. **Nebula** - Classic cubemap
4. **Red Giant** - Classic cubemap
5. **Aurora** - Procedural
6. **Cosmic Nebula** - Procedural (renamed to distinguish from classic)
7. **The Void** - Procedural

Below the grid, mode-specific controls appear based on selection.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/stores/defaults/visualDefaults.ts` | Update `SkyboxTexture` type to include `'none'` |
| `src/stores/slices/skyboxSlice.ts` | Handle `'none'` texture state |
| `src/components/sections/Environment/SkyboxControls.tsx` | Complete UI overhaul |
| `src/rendering/environment/Skybox.tsx` | Handle `'none'` texture gracefully |

## New Assets to Create

None - procedural thumbnails use CSS gradients instead of image files.

---

## Implementation Steps

### Step 1: Update Type Definitions
**File:** `src/stores/defaults/visualDefaults.ts`

```typescript
// Before
export type SkyboxTexture = 'space_blue' | 'space_lightblue' | 'space_red' | 'none'

// After - Already includes 'none', just need to add procedural types
export type SkyboxSelection =
  | 'none'
  | 'space_blue'
  | 'space_lightblue'
  | 'space_red'
  | 'procedural_aurora'
  | 'procedural_nebula'
  | 'procedural_void'
```

Consider: Do we unify `SkyboxTexture` and `SkyboxMode` into a single type, or keep them separate?

**Recommendation:** Create new unified type `SkyboxSelection` that represents "what skybox is visually selected". The existing `skyboxMode` and `skyboxTexture` can be derived from this selection:
- `none` → `skyboxEnabled: false`
- `space_*` → `skyboxEnabled: true, skyboxMode: 'classic', skyboxTexture: space_*`
- `procedural_*` → `skyboxEnabled: true, skyboxMode: procedural_*`

### Step 2: Update Store Slice
**File:** `src/stores/slices/skyboxSlice.ts`

Option A: Add a new `skyboxSelection` state that derives `skyboxEnabled`, `skyboxMode`, and `skyboxTexture`:
```typescript
interface SkyboxSliceState {
  skyboxSelection: SkyboxSelection  // New unified selection
  // Keep existing for backwards compatibility during transition
  skyboxEnabled: boolean
  skyboxMode: SkyboxMode
  skyboxTexture: SkyboxTexture
  // ... rest unchanged
}
```

Option B: Simplify by computing `skyboxEnabled` from selection:
- Remove `skyboxEnabled` state entirely
- Derive it: `skyboxEnabled = skyboxSelection !== 'none'`

**Recommendation:** Option B is cleaner but more invasive. Option A is safer for incremental refactoring.

### Step 3: Procedural Thumbnails via CSS Gradients

Use Tailwind CSS gradient classes to approximate each procedural skybox appearance. No image assets needed.

```typescript
// Gradient styles for non-image thumbnails
const THUMBNAIL_GRADIENTS: Record<string, string> = {
  none: 'bg-black',
  procedural_aurora: 'bg-gradient-to-b from-cyan-400 via-emerald-600 to-slate-900',
  procedural_nebula: 'bg-gradient-to-br from-purple-500 via-fuchsia-600 to-slate-900',
  procedural_void: 'bg-[radial-gradient(circle_at_30%_30%,_#475569_0%,_#0f172a_50%,_#000_100%)]',
}
```

**Pros:**
- Zero asset files to manage
- Instant loading, no network requests
- Easy to tweak colors
- Lightweight

**Implementation:**
- Classic skyboxes continue using existing `thumbnail.png` images
- Procedural options + "None" use CSS gradient backgrounds
- Conditional rendering based on whether `option.thumbnail` exists

### Step 4: Refactor SkyboxControls Component
**File:** `src/components/sections/Environment/SkyboxControls.tsx`

#### New Data Structure
```typescript
interface SkyboxOption {
  id: SkyboxSelection
  name: string
  thumbnail: string | null       // Image path for classic skyboxes
  gradientClass: string | null   // Tailwind classes for procedural/none
  description: string
  type: 'none' | 'classic' | 'procedural'
}

const ALL_SKYBOX_OPTIONS: SkyboxOption[] = [
  { id: 'none', name: 'None', thumbnail: null, gradientClass: 'bg-black', description: 'No skybox', type: 'none' },
  { id: 'space_blue', name: 'Deep Space', thumbnail: spaceBlueThumb, gradientClass: null, description: 'Cold, deep space', type: 'classic' },
  { id: 'space_lightblue', name: 'Nebula', thumbnail: spaceLightBlueThumb, gradientClass: null, description: 'Bright nebula', type: 'classic' },
  { id: 'space_red', name: 'Red Giant', thumbnail: spaceRedThumb, gradientClass: null, description: 'Warm red space', type: 'classic' },
  { id: 'procedural_aurora', name: 'Aurora', thumbnail: null, gradientClass: 'bg-gradient-to-b from-cyan-400 via-emerald-600 to-slate-900', description: 'Northern lights', type: 'procedural' },
  { id: 'procedural_nebula', name: 'Cosmic Nebula', thumbnail: null, gradientClass: 'bg-gradient-to-br from-purple-500 via-fuchsia-600 to-slate-900', description: 'Volumetric clouds', type: 'procedural' },
  { id: 'procedural_void', name: 'The Void', thumbnail: null, gradientClass: 'bg-[radial-gradient(circle_at_30%_30%,_#475569_0%,_#0f172a_50%,_#000_100%)]', description: 'Dark gradient', type: 'procedural' },
]
```

#### New UI Structure
```tsx
<div className="space-y-6">
  {/* Reset button only */}
  <div className="flex justify-end">
    <button onClick={resetSkyboxSettings}>Reset</button>
  </div>

  {/* Unified thumbnail grid - 3 columns, 3 rows (7 items including None) */}
  <div className="grid grid-cols-3 gap-3">
    {ALL_SKYBOX_OPTIONS.map(option => (
      <SkyboxThumbnail
        key={option.id}
        option={option}
        isSelected={currentSelection === option.id}
        onClick={() => handleSelection(option.id)}
      />
    ))}
  </div>

  {/* Mode-specific controls */}
  {isClassicMode && <ClassicModeControls />}
  {isProceduralMode && <ProceduralModeControls />}
</div>
```

### Step 5: Handle "None" in Rendering
**File:** `src/rendering/environment/Skybox.tsx`

Ensure the Skybox component handles `skyboxEnabled: false` gracefully (already does, but verify no regression).

### Step 6: Update Tests
- Update existing skybox tests to reflect new selection model
- Add tests for "None" selection behavior
- Add tests for procedural thumbnail loading

---

## Visual Design Considerations

### Thumbnail Grid Layout
With 7 items in a 3-column grid:
```
[None]       [Deep Space]  [Nebula]
[Red Giant]  [Aurora]      [Cosmic Nebula]
[The Void]   [empty?]      [empty?]
```

Option A: Keep 3 columns, accept asymmetry
Option B: Add 2 more skybox options to fill grid
Option C: Use 4 columns (better fit for 7 items + 1 for future)
Option D: Use 2 columns for larger thumbnails

**Recommendation:** Keep 3 columns. The asymmetry is fine, and it leaves room for future skyboxes.

### Thumbnail Styling

**Classic skyboxes:** Use existing `thumbnail.png` images via `<img>` tag

**Procedural + None:** Use CSS gradient backgrounds via Tailwind classes:
- **None**: `bg-black` - Pure black
- **Aurora**: `bg-gradient-to-b from-cyan-400 via-emerald-600 to-slate-900` - Vertical cyan-green
- **Cosmic Nebula**: `bg-gradient-to-br from-purple-500 via-fuchsia-600 to-slate-900` - Diagonal purple-pink
- **The Void**: `bg-[radial-gradient(...)]` - Radial dark with subtle highlight

**Thumbnail component logic:**
```tsx
{option.thumbnail ? (
  <img src={option.thumbnail} alt={option.name} className="w-full h-full object-cover" />
) : (
  <div className={`w-full h-full ${option.gradientClass}`} />
)}
```

---

## Migration Notes

- The refactoring changes the mental model from "enable/disable + mode selection + texture selection" to "single selection from all options"
- Existing presets/saves using `skyboxEnabled: false` should map to `selection: 'none'`
- Need to ensure backwards compatibility with any saved configurations

---

## Testing Checklist

- [ ] "None" selection disables skybox rendering
- [ ] Classic skybox selection shows correct texture
- [ ] Procedural skybox selection shows correct shader mode
- [ ] Mode-specific controls appear/disappear correctly
- [ ] Reset button restores default (Deep Space)
- [ ] All thumbnails load correctly
- [ ] Selection state persists correctly
- [ ] No visual regression in 3D scene
- [ ] Performance: no extra WebGL contexts created
