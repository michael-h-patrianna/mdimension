import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '@/stores/uiStore'
import { UI_INITIAL_STATE } from '@/stores/slices/uiSlice'

describe('uiStore.opacity (invariants)', () => {
  beforeEach(() => {
    useUIStore.setState(UI_INITIAL_STATE)
  })

  it('changing opacity mode preserves other opacity settings', () => {
    useUIStore.getState().setSimpleAlphaOpacity(0.5)
    useUIStore.getState().setLayerCount(3)

    useUIStore.getState().setOpacityMode('layeredSurfaces')
    const s = useUIStore.getState().opacitySettings
    expect(s.mode).toBe('layeredSurfaces')
    expect(s.simpleAlphaOpacity).toBe(0.5)
    expect(s.layerCount).toBe(3)
  })

  it('setOpacitySettings clamps numeric fields and preserves unspecified fields', () => {
    // set a baseline value we want preserved
    useUIStore.getState().setOpacitySettings({
      mode: 'volumetricDensity',
      volumetricDensity: 1.5,
    })

    useUIStore.getState().setOpacitySettings({
      mode: 'simpleAlpha',
      simpleAlphaOpacity: 999, // clamp
      layerOpacity: 0, // clamp
      volumetricDensity: 999, // clamp
    })

    const s = useUIStore.getState().opacitySettings
    expect(s.mode).toBe('simpleAlpha')
    expect(s.simpleAlphaOpacity).toBe(1) // SIMPLE_ALPHA_RANGE.max
    expect(s.layerOpacity).toBe(0.1) // LAYER_OPACITY_RANGE.min
    expect(s.volumetricDensity).toBe(2.0) // VOLUMETRIC_DENSITY_RANGE.max
  })

  it('tracks the volumetric warning acknowledgement flag', () => {
    useUIStore.getState().setHasSeenVolumetricWarning(true)
    expect(useUIStore.getState().hasSeenVolumetricWarning).toBe(true)

    useUIStore.getState().setHasSeenVolumetricWarning(false)
    expect(useUIStore.getState().hasSeenVolumetricWarning).toBe(false)
  })
})

 
