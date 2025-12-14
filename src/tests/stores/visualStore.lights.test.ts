/**
 * Tests for visualStore multi-light actions
 */

import { MAX_LIGHTS, MIN_LIGHTS } from '@/lib/lights/types'
import {
  DEFAULT_LIGHTS,
  DEFAULT_SELECTED_LIGHT_ID,
  DEFAULT_SHOW_LIGHT_GIZMOS,
  DEFAULT_TRANSFORM_MODE,
  useVisualStore,
} from '@/stores/visualStore'
import { beforeEach, describe, expect, it } from 'vitest'

describe('visualStore - Multi-Light System', () => {
  beforeEach(() => {
    useVisualStore.getState().reset()
  })

  describe('Initial State', () => {
    it('should have default lights array with one light', () => {
      const { lights } = useVisualStore.getState()
      expect(lights).toHaveLength(1)
      expect(lights).toEqual(DEFAULT_LIGHTS)
    })

    it('should have no selected light by default', () => {
      expect(useVisualStore.getState().selectedLightId).toBe(DEFAULT_SELECTED_LIGHT_ID)
      expect(DEFAULT_SELECTED_LIGHT_ID).toBe(null)
    })

    it('should have translate as default transform mode', () => {
      expect(useVisualStore.getState().transformMode).toBe(DEFAULT_TRANSFORM_MODE)
      expect(DEFAULT_TRANSFORM_MODE).toBe('translate')
    })

    it('should have light gizmos hidden by default', () => {
      expect(useVisualStore.getState().showLightGizmos).toBe(DEFAULT_SHOW_LIGHT_GIZMOS)
      expect(DEFAULT_SHOW_LIGHT_GIZMOS).toBe(false)
    })

    it('should have default light with correct properties', () => {
      const { lights } = useVisualStore.getState()
      const defaultLight = lights[0]!

      expect(defaultLight.id).toBe('light-default')
      expect(defaultLight.name).toBe('Main Light')
      expect(defaultLight.type).toBe('point')
      expect(defaultLight.enabled).toBe(true)
      expect(defaultLight.color).toBe('#FFFFFF')
      expect(defaultLight.intensity).toBe(1.0)
    })
  })

  describe('addLight', () => {
    it('should add a point light', () => {
      const id = useVisualStore.getState().addLight('point')
      const { lights } = useVisualStore.getState()

      expect(id).not.toBeNull()
      expect(lights).toHaveLength(2)
      expect(lights[1]!.type).toBe('point')
      expect(lights[1]!.name).toBe('Point Light 2')
    })

    it('should add a directional light', () => {
      const id = useVisualStore.getState().addLight('directional')
      const { lights } = useVisualStore.getState()

      expect(id).not.toBeNull()
      expect(lights[1]!.type).toBe('directional')
      expect(lights[1]!.name).toBe('Directional Light 2')
    })

    it('should add a spot light', () => {
      const id = useVisualStore.getState().addLight('spot')
      const { lights } = useVisualStore.getState()

      expect(id).not.toBeNull()
      expect(lights[1]!.type).toBe('spot')
      expect(lights[1]!.name).toBe('Spot Light 2')
      expect(lights[1]!.penumbra).toBe(0.2) // Spot-specific default
    })

    it('should return null when at MAX_LIGHTS', () => {
      // Add lights until max
      for (let i = 1; i < MAX_LIGHTS; i++) {
        useVisualStore.getState().addLight('point')
      }

      expect(useVisualStore.getState().lights).toHaveLength(MAX_LIGHTS)

      // Try to add one more
      const id = useVisualStore.getState().addLight('point')
      expect(id).toBeNull()
      expect(useVisualStore.getState().lights).toHaveLength(MAX_LIGHTS)
    })

    it('should auto-select newly added light', () => {
      const id = useVisualStore.getState().addLight('point')
      expect(useVisualStore.getState().selectedLightId).toBe(id)
    })

    it('should generate unique IDs', () => {
      const id1 = useVisualStore.getState().addLight('point')
      const id2 = useVisualStore.getState().addLight('point')

      expect(id1).not.toBe(id2)
    })
  })

  describe('removeLight', () => {
    it('should remove a light by ID', () => {
      const id = useVisualStore.getState().addLight('point')
      expect(useVisualStore.getState().lights).toHaveLength(2)

      useVisualStore.getState().removeLight(id!)
      expect(useVisualStore.getState().lights).toHaveLength(1)
    })

    it('should allow removing all lights (MIN_LIGHTS is 0)', () => {
      // Start with the default light
      const { lights } = useVisualStore.getState()
      expect(lights).toHaveLength(1)

      // Should be able to remove it since MIN_LIGHTS is 0
      useVisualStore.getState().removeLight(lights[0]!.id)
      expect(useVisualStore.getState().lights).toHaveLength(MIN_LIGHTS)
      expect(MIN_LIGHTS).toBe(0)
    })

    it('should deselect if removed light was selected', () => {
      const id = useVisualStore.getState().addLight('point')
      expect(useVisualStore.getState().selectedLightId).toBe(id)

      useVisualStore.getState().removeLight(id!)
      expect(useVisualStore.getState().selectedLightId).toBeNull()
    })

    it('should not affect selection if removed light was not selected', () => {
      const id1 = useVisualStore.getState().addLight('point')
      const id2 = useVisualStore.getState().addLight('directional')

      // id2 is selected (last added)
      expect(useVisualStore.getState().selectedLightId).toBe(id2)

      useVisualStore.getState().removeLight(id1!)
      expect(useVisualStore.getState().selectedLightId).toBe(id2)
    })

    it('should do nothing for non-existent ID', () => {
      const initialCount = useVisualStore.getState().lights.length
      useVisualStore.getState().removeLight('non-existent-id')
      expect(useVisualStore.getState().lights).toHaveLength(initialCount)
    })
  })

  describe('updateLight', () => {
    it('should update light name', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { name: 'Custom Name' })
      expect(useVisualStore.getState().lights[0]!.name).toBe('Custom Name')
    })

    it('should update light type', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { type: 'spot' })
      expect(useVisualStore.getState().lights[0]!.type).toBe('spot')
    })

    it('should update light enabled state', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { enabled: false })
      expect(useVisualStore.getState().lights[0]!.enabled).toBe(false)
    })

    it('should update light position', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { position: [1, 2, 3] })
      expect(useVisualStore.getState().lights[0]!.position).toEqual([1, 2, 3])
    })

    it('should update light rotation', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { rotation: [0.5, 1.0, 1.5] })
      expect(useVisualStore.getState().lights[0]!.rotation).toEqual([0.5, 1.0, 1.5])
    })

    it('should update light color', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { color: '#FF0000' })
      expect(useVisualStore.getState().lights[0]!.color).toBe('#FF0000')
    })

    it('should update light intensity with clamping', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { intensity: 2.5 })
      expect(useVisualStore.getState().lights[0]!.intensity).toBe(2.5)

      // Test clamping - minimum is now 0.1
      useVisualStore.getState().updateLight(lightId, { intensity: -1 })
      expect(useVisualStore.getState().lights[0]!.intensity).toBe(0.1)

      useVisualStore.getState().updateLight(lightId, { intensity: 10 })
      expect(useVisualStore.getState().lights[0]!.intensity).toBe(3)
    })

    it('should update cone angle with clamping', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { coneAngle: 45 })
      expect(useVisualStore.getState().lights[0]!.coneAngle).toBe(45)

      // Test clamping
      useVisualStore.getState().updateLight(lightId, { coneAngle: 0 })
      expect(useVisualStore.getState().lights[0]!.coneAngle).toBe(1)

      useVisualStore.getState().updateLight(lightId, { coneAngle: 180 })
      expect(useVisualStore.getState().lights[0]!.coneAngle).toBe(120)
    })

    it('should update penumbra with clamping', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, { penumbra: 0.7 })
      expect(useVisualStore.getState().lights[0]!.penumbra).toBe(0.7)

      // Test clamping
      useVisualStore.getState().updateLight(lightId, { penumbra: -0.5 })
      expect(useVisualStore.getState().lights[0]!.penumbra).toBe(0)

      useVisualStore.getState().updateLight(lightId, { penumbra: 2 })
      expect(useVisualStore.getState().lights[0]!.penumbra).toBe(1)
    })

    it('should update multiple properties at once', () => {
      const { lights } = useVisualStore.getState()
      const lightId = lights[0]!.id

      useVisualStore.getState().updateLight(lightId, {
        name: 'Multi Update',
        type: 'directional',
        color: '#00FF00',
        intensity: 2.0,
      })

      const updated = useVisualStore.getState().lights[0]!
      expect(updated.name).toBe('Multi Update')
      expect(updated.type).toBe('directional')
      expect(updated.color).toBe('#00FF00')
      expect(updated.intensity).toBe(2.0)
    })

    it('should do nothing for non-existent ID', () => {
      const originalLight = { ...useVisualStore.getState().lights[0]! }
      useVisualStore.getState().updateLight('non-existent', { name: 'Should Not Apply' })
      expect(useVisualStore.getState().lights[0]!.name).toBe(originalLight.name)
    })
  })

  describe('duplicateLight', () => {
    it('should duplicate a light', () => {
      const { lights } = useVisualStore.getState()
      const originalId = lights[0]!.id

      const newId = useVisualStore.getState().duplicateLight(originalId)
      expect(newId).not.toBeNull()
      expect(useVisualStore.getState().lights).toHaveLength(2)
    })

    it('should create copy with (Copy) suffix', () => {
      const newId = useVisualStore.getState().duplicateLight('light-default')
      const clone = useVisualStore.getState().lights.find((l) => l.id === newId)

      expect(clone!.name).toBe('Main Light (Copy)')
    })

    it('should offset position by 1 on X axis', () => {
      const originalPos = useVisualStore.getState().lights[0]!.position
      const newId = useVisualStore.getState().duplicateLight('light-default')
      const clone = useVisualStore.getState().lights.find((l) => l.id === newId)

      expect(clone!.position[0]).toBe(originalPos[0] + 1)
      expect(clone!.position[1]).toBe(originalPos[1])
      expect(clone!.position[2]).toBe(originalPos[2])
    })

    it('should copy all properties except id, name, position', () => {
      // First update the original light
      useVisualStore.getState().updateLight('light-default', {
        type: 'spot',
        enabled: false,
        color: '#FF0000',
        intensity: 2.5,
        coneAngle: 60,
        penumbra: 0.8,
        rotation: [0.1, 0.2, 0.3],
      })

      const newId = useVisualStore.getState().duplicateLight('light-default')
      const clone = useVisualStore.getState().lights.find((l) => l.id === newId)

      expect(clone!.type).toBe('spot')
      expect(clone!.enabled).toBe(false)
      expect(clone!.color).toBe('#FF0000')
      expect(clone!.intensity).toBe(2.5)
      expect(clone!.coneAngle).toBe(60)
      expect(clone!.penumbra).toBe(0.8)
      expect(clone!.rotation).toEqual([0.1, 0.2, 0.3])
    })

    it('should auto-select the duplicated light', () => {
      const newId = useVisualStore.getState().duplicateLight('light-default')
      expect(useVisualStore.getState().selectedLightId).toBe(newId)
    })

    it('should return null when at MAX_LIGHTS', () => {
      // Add lights until max
      for (let i = 1; i < MAX_LIGHTS; i++) {
        useVisualStore.getState().addLight('point')
      }

      const newId = useVisualStore.getState().duplicateLight('light-default')
      expect(newId).toBeNull()
    })

    it('should return null for non-existent ID', () => {
      const newId = useVisualStore.getState().duplicateLight('non-existent')
      expect(newId).toBeNull()
    })
  })

  describe('selectLight', () => {
    it('should select a light by ID', () => {
      useVisualStore.getState().selectLight('light-default')
      expect(useVisualStore.getState().selectedLightId).toBe('light-default')
    })

    it('should deselect light when passed null', () => {
      useVisualStore.getState().selectLight('light-default')
      expect(useVisualStore.getState().selectedLightId).toBe('light-default')

      useVisualStore.getState().selectLight(null)
      expect(useVisualStore.getState().selectedLightId).toBeNull()
    })

    it('should allow selecting non-existent ID (validation happens elsewhere)', () => {
      useVisualStore.getState().selectLight('any-id')
      expect(useVisualStore.getState().selectedLightId).toBe('any-id')
    })
  })

  describe('setTransformMode', () => {
    it('should set transform mode to translate', () => {
      useVisualStore.getState().setTransformMode('translate')
      expect(useVisualStore.getState().transformMode).toBe('translate')
    })

    it('should set transform mode to rotate', () => {
      useVisualStore.getState().setTransformMode('rotate')
      expect(useVisualStore.getState().transformMode).toBe('rotate')
    })

    it('should toggle between modes', () => {
      useVisualStore.getState().setTransformMode('rotate')
      expect(useVisualStore.getState().transformMode).toBe('rotate')

      useVisualStore.getState().setTransformMode('translate')
      expect(useVisualStore.getState().transformMode).toBe('translate')
    })
  })

  describe('setShowLightGizmos', () => {
    it('should show light gizmos', () => {
      useVisualStore.getState().setShowLightGizmos(true)
      expect(useVisualStore.getState().showLightGizmos).toBe(true)
    })

    it('should hide light gizmos', () => {
      useVisualStore.getState().setShowLightGizmos(true)
      useVisualStore.getState().setShowLightGizmos(false)
      expect(useVisualStore.getState().showLightGizmos).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset lights to default', () => {
      useVisualStore.getState().addLight('point')
      useVisualStore.getState().addLight('spot')
      expect(useVisualStore.getState().lights).toHaveLength(3)

      useVisualStore.getState().reset()
      expect(useVisualStore.getState().lights).toHaveLength(1)
      expect(useVisualStore.getState().lights[0]!.id).toBe('light-default')
    })

    it('should reset selectedLightId to null', () => {
      useVisualStore.getState().selectLight('light-default')
      useVisualStore.getState().reset()
      expect(useVisualStore.getState().selectedLightId).toBeNull()
    })

    it('should reset transformMode to translate', () => {
      useVisualStore.getState().setTransformMode('rotate')
      useVisualStore.getState().reset()
      expect(useVisualStore.getState().transformMode).toBe('translate')
    })

    it('should reset showLightGizmos to false', () => {
      useVisualStore.getState().setShowLightGizmos(true)
      useVisualStore.getState().reset()
      expect(useVisualStore.getState().showLightGizmos).toBe(false)
    })
  })
})
