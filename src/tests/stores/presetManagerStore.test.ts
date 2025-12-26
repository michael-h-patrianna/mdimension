import { beforeEach, describe, expect, it } from 'vitest'
import { usePresetManagerStore } from '@/stores/presetManagerStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useAnimationStore } from '@/stores/animationStore'

describe('presetManagerStore', () => {
  beforeEach(() => {
    usePresetManagerStore.setState({ savedStyles: [], savedScenes: [] })
    useAppearanceStore.setState({ edgeColor: '#ffffff' }) // minimal reset for test
    useAnimationStore.getState().reset()
  })

  it('should save and load a style', () => {
    // Setup initial state
    useAppearanceStore.setState({ edgeColor: '#ff0000' })

    // Save style
    usePresetManagerStore.getState().saveStyle('Red Edge')

    // Check it's saved
    const [firstStyle] = usePresetManagerStore.getState().savedStyles
    expect(firstStyle).toBeDefined()
    expect(firstStyle!.name).toBe('Red Edge')
    expect(firstStyle!.data.appearance.edgeColor).toBe('#ff0000')

    // Change state
    useAppearanceStore.setState({ edgeColor: '#00ff00' })

    // Load style
    usePresetManagerStore.getState().loadStyle(firstStyle!.id)

    // Check it's restored
    expect(useAppearanceStore.getState().edgeColor).toBe('#ff0000')
  })

  it('should save and load a scene with animation', () => {
    // Setup animation state
    const animStore = useAnimationStore.getState()
    animStore.setSpeed(2.0)

    // Save scene
    usePresetManagerStore.getState().saveScene('Fast Scene')

    // Check saved
    const [firstScene] = usePresetManagerStore.getState().savedScenes
    expect(firstScene).toBeDefined()
    expect(firstScene!.data.animation.speed).toBe(2.0)

    // Check Set -> Array conversion (serialization shape)
    expect(Array.isArray(firstScene!.data.animation.animatingPlanes)).toBe(true)

    // Change state
    animStore.setSpeed(0.5)

    // Load scene
    usePresetManagerStore.getState().loadScene(firstScene!.id)

    // Check restored
    expect(useAnimationStore.getState().speed).toBe(2.0)
    expect(useAnimationStore.getState().animatingPlanes).toBeInstanceOf(Set)
  })

  it('should import and export styles', () => {
    const mockStyle = {
      id: 'test-id',
      name: 'Imported Style',
      timestamp: 123,
      data: { appearance: { edgeColor: '#0000ff' } }, // simplified
    }

    const json = JSON.stringify([mockStyle])

    const ok = usePresetManagerStore.getState().importStyles(json)
    expect(ok).toBe(true)

    const [saved] = usePresetManagerStore.getState().savedStyles
    expect(saved).toBeDefined()
    expect(saved!.name).toBe('Imported Style')

    const exported = usePresetManagerStore.getState().exportStyles()
    expect(JSON.parse(exported)).toHaveLength(1)
  })
})
