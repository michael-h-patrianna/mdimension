/**
 * Tests for visualStore multi-light actions
 */

import { MAX_LIGHTS, MIN_LIGHTS } from '@/lib/lights/types'
import { useLightingStore } from '@/stores/lightingStore';
import {
  DEFAULT_LIGHTS,
  DEFAULT_SELECTED_LIGHT_ID,
  DEFAULT_SHOW_LIGHT_GIZMOS,
  DEFAULT_TRANSFORM_MODE,
} from '@/stores/defaults/visualDefaults';
import { LIGHTING_INITIAL_STATE } from '@/stores/slices/lightingSlice';
import { beforeEach, describe, expect, it } from 'vitest'

describe('lightingStore', () => {
  beforeEach(() => {
    useLightingStore.setState(LIGHTING_INITIAL_STATE);
  });

  describe('Initial State', () => {
    it('should have default lights array with one light', () => {
      const { lights } = useLightingStore.getState()
      expect(lights).toHaveLength(1)
      expect(lights).toEqual(DEFAULT_LIGHTS)
    })

    it('should have no selected light by default', () => {
      expect(useLightingStore.getState().selectedLightId).toBe(DEFAULT_SELECTED_LIGHT_ID)
      expect(DEFAULT_SELECTED_LIGHT_ID).toBe(null)
    })

    it('should have translate as default transform mode', () => {
      expect(useLightingStore.getState().transformMode).toBe(DEFAULT_TRANSFORM_MODE)
      expect(DEFAULT_TRANSFORM_MODE).toBe('translate')
    })

    it('should have light gizmos hidden by default', () => {
      expect(useLightingStore.getState().showLightGizmos).toBe(DEFAULT_SHOW_LIGHT_GIZMOS)
      expect(DEFAULT_SHOW_LIGHT_GIZMOS).toBe(false)
    })

    it('should have default light with correct properties', () => {
      const { lights } = useLightingStore.getState()
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
      const id = useLightingStore.getState().addLight('point')
      const { lights } = useLightingStore.getState()

      expect(id).not.toBeNull()
      expect(lights).toHaveLength(2)
      expect(lights[1]!.type).toBe('point')
      expect(lights[1]!.name).toBe('Point Light 2')
    })

    it('should add a directional light', () => {
      const id = useLightingStore.getState().addLight('directional')
      const { lights } = useLightingStore.getState()

      expect(id).not.toBeNull()
      expect(lights[1]!.type).toBe('directional')
      expect(lights[1]!.name).toBe('Directional Light 2')
    })

    it('should add a spot light', () => {
      const id = useLightingStore.getState().addLight('spot')
      const { lights } = useLightingStore.getState()

      expect(id).not.toBeNull()
      expect(lights[1]!.type).toBe('spot')
      expect(lights[1]!.name).toBe('Spot Light 2')
      expect(lights[1]!.penumbra).toBe(0.2) // Spot-specific default
    })

    it('should return null when at MAX_LIGHTS', () => {
      // Add lights until max
      for (let i = 1; i < MAX_LIGHTS; i++) {
        useLightingStore.getState().addLight('point')
      }

      expect(useLightingStore.getState().lights).toHaveLength(MAX_LIGHTS)

      // Try to add one more
      const id = useLightingStore.getState().addLight('point')
      expect(id).toBeNull()
      expect(useLightingStore.getState().lights).toHaveLength(MAX_LIGHTS)
    })

    it('should auto-select newly added light', () => {
      const id = useLightingStore.getState().addLight('point')
      expect(useLightingStore.getState().selectedLightId).toBe(id)
    })

    it('should generate unique IDs', () => {
      const id1 = useLightingStore.getState().addLight('point')
      const id2 = useLightingStore.getState().addLight('point')

      expect(id1).not.toBe(id2)
    })
  })

  describe('removeLight', () => {
    it('should remove a light by ID', () => {
      const id = useLightingStore.getState().addLight('point')
      expect(useLightingStore.getState().lights).toHaveLength(2)

      useLightingStore.getState().removeLight(id!)
      expect(useLightingStore.getState().lights).toHaveLength(1)
    })

    it('should allow removing all lights (MIN_LIGHTS is 0)', () => {
      // Start with the default light
      const { lights } = useLightingStore.getState()
      expect(lights).toHaveLength(1)

      // Should be able to remove it since MIN_LIGHTS is 0
      useLightingStore.getState().removeLight(lights[0]!.id)
      expect(useLightingStore.getState().lights).toHaveLength(MIN_LIGHTS)
      expect(MIN_LIGHTS).toBe(0)
    })

    it('should deselect if removed light was selected', () => {
      const id = useLightingStore.getState().addLight('point')
      expect(useLightingStore.getState().selectedLightId).toBe(id)

      useLightingStore.getState().removeLight(id!)
      expect(useLightingStore.getState().selectedLightId).toBeNull()
    })

    it('should not affect selection if removed light was not selected', () => {
      const id1 = useLightingStore.getState().addLight('point')
      const id2 = useLightingStore.getState().addLight('directional')

      // id2 is selected (last added)
      expect(useLightingStore.getState().selectedLightId).toBe(id2)

      useLightingStore.getState().removeLight(id1!)
      expect(useLightingStore.getState().selectedLightId).toBe(id2)
    })

    it('should do nothing for non-existent ID', () => {
      const initialCount = useLightingStore.getState().lights.length
      useLightingStore.getState().removeLight('non-existent-id')
      expect(useLightingStore.getState().lights).toHaveLength(initialCount)
    })
  })

  describe('updateLight', () => {
    it('should update light name', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { name: 'Custom Name' })
      expect(useLightingStore.getState().lights[0]!.name).toBe('Custom Name')
    })

    it('should update light type', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { type: 'spot' })
      expect(useLightingStore.getState().lights[0]!.type).toBe('spot')
    })

    it('should update light enabled state', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { enabled: false })
      expect(useLightingStore.getState().lights[0]!.enabled).toBe(false)
    })

    it('should update light position', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { position: [1, 2, 3] })
      expect(useLightingStore.getState().lights[0]!.position).toEqual([1, 2, 3])
    })

    it('should update light rotation', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { rotation: [0.5, 1.0, 1.5] })
      expect(useLightingStore.getState().lights[0]!.rotation).toEqual([0.5, 1.0, 1.5])
    })

    it('should update light color', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { color: '#FF0000' })
      expect(useLightingStore.getState().lights[0]!.color).toBe('#FF0000')
    })

    it('should update light intensity with clamping', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { intensity: 2.5 })
      expect(useLightingStore.getState().lights[0]!.intensity).toBe(2.5)

      // Test clamping - minimum is now 0.1
      useLightingStore.getState().updateLight(lightId, { intensity: -1 })
      expect(useLightingStore.getState().lights[0]!.intensity).toBe(0.1)

      useLightingStore.getState().updateLight(lightId, { intensity: 10 })
      expect(useLightingStore.getState().lights[0]!.intensity).toBe(3)
    })

    it('should update cone angle with clamping', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { coneAngle: 45 })
      expect(useLightingStore.getState().lights[0]!.coneAngle).toBe(45)

      // Test clamping
      useLightingStore.getState().updateLight(lightId, { coneAngle: 0 })
      expect(useLightingStore.getState().lights[0]!.coneAngle).toBe(1)

      useLightingStore.getState().updateLight(lightId, { coneAngle: 180 })
      expect(useLightingStore.getState().lights[0]!.coneAngle).toBe(120)
    })

    it('should update penumbra with clamping', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, { penumbra: 0.7 })
      expect(useLightingStore.getState().lights[0]!.penumbra).toBe(0.7)

      // Test clamping
      useLightingStore.getState().updateLight(lightId, { penumbra: -0.5 })
      expect(useLightingStore.getState().lights[0]!.penumbra).toBe(0)

      useLightingStore.getState().updateLight(lightId, { penumbra: 2 })
      expect(useLightingStore.getState().lights[0]!.penumbra).toBe(1)
    })

    it('should update multiple properties at once', () => {
      const { lights } = useLightingStore.getState()
      const lightId = lights[0]!.id

      useLightingStore.getState().updateLight(lightId, {
        name: 'Multi Update',
        type: 'directional',
        color: '#00FF00',
        intensity: 2.0,
      })

      const updated = useLightingStore.getState().lights[0]!
      expect(updated.name).toBe('Multi Update')
      expect(updated.type).toBe('directional')
      expect(updated.color).toBe('#00FF00')
      expect(updated.intensity).toBe(2.0)
    })

    it('should do nothing for non-existent ID', () => {
      const originalLight = { ...useLightingStore.getState().lights[0]! }
      useLightingStore.getState().updateLight('non-existent', { name: 'Should Not Apply' })
      expect(useLightingStore.getState().lights[0]!.name).toBe(originalLight.name)
    })
  })

  describe('duplicateLight', () => {
    it('should duplicate a light', () => {
      const { lights } = useLightingStore.getState()
      const originalId = lights[0]!.id

      const newId = useLightingStore.getState().duplicateLight(originalId)
      expect(newId).not.toBeNull()
      expect(useLightingStore.getState().lights).toHaveLength(2)
    })

    it('should create copy with (Copy) suffix', () => {
      const newId = useLightingStore.getState().duplicateLight('light-default')
      const clone = useLightingStore.getState().lights.find((l) => l.id === newId)

      expect(clone!.name).toBe('Main Light (Copy)')
    })

    it('should offset position by 1 on X axis', () => {
      const originalPos = useLightingStore.getState().lights[0]!.position
      const newId = useLightingStore.getState().duplicateLight('light-default')
      const clone = useLightingStore.getState().lights.find((l) => l.id === newId)

      expect(clone!.position[0]).toBe(originalPos[0] + 1)
      expect(clone!.position[1]).toBe(originalPos[1])
      expect(clone!.position[2]).toBe(originalPos[2])
    })

    it('should copy all properties except id, name, position', () => {
      // First update the original light
      useLightingStore.getState().updateLight('light-default', {
        type: 'spot',
        enabled: false,
        color: '#FF0000',
        intensity: 2.5,
        coneAngle: 60,
        penumbra: 0.8,
        rotation: [0.1, 0.2, 0.3],
      })

      const newId = useLightingStore.getState().duplicateLight('light-default')
      const clone = useLightingStore.getState().lights.find((l) => l.id === newId)

      expect(clone!.type).toBe('spot')
      expect(clone!.enabled).toBe(false)
      expect(clone!.color).toBe('#FF0000')
      expect(clone!.intensity).toBe(2.5)
      expect(clone!.coneAngle).toBe(60)
      expect(clone!.penumbra).toBe(0.8)
      expect(clone!.rotation).toEqual([0.1, 0.2, 0.3])
    })

    it('should auto-select the duplicated light', () => {
      const newId = useLightingStore.getState().duplicateLight('light-default')
      expect(useLightingStore.getState().selectedLightId).toBe(newId)
    })

    it('should return null when at MAX_LIGHTS', () => {
      // Add lights until max
      for (let i = 1; i < MAX_LIGHTS; i++) {
        useLightingStore.getState().addLight('point')
      }

      const newId = useLightingStore.getState().duplicateLight('light-default')
      expect(newId).toBeNull()
    })

    it('should return null for non-existent ID', () => {
      const newId = useLightingStore.getState().duplicateLight('non-existent')
      expect(newId).toBeNull()
    })
  })

  describe('selectLight', () => {
    it('should select a light by ID', () => {
      useLightingStore.getState().selectLight('light-default')
      expect(useLightingStore.getState().selectedLightId).toBe('light-default')
    })

    it('should deselect light when passed null', () => {
      useLightingStore.getState().selectLight('light-default')
      expect(useLightingStore.getState().selectedLightId).toBe('light-default')

      useLightingStore.getState().selectLight(null)
      expect(useLightingStore.getState().selectedLightId).toBeNull()
    })

    it('should allow selecting non-existent ID (validation happens elsewhere)', () => {
      useLightingStore.getState().selectLight('any-id')
      expect(useLightingStore.getState().selectedLightId).toBe('any-id')
    })
  })

  describe('setTransformMode', () => {
    it('should set transform mode to translate', () => {
      useLightingStore.getState().setTransformMode('translate')
      expect(useLightingStore.getState().transformMode).toBe('translate')
    })

    it('should set transform mode to rotate', () => {
      useLightingStore.getState().setTransformMode('rotate')
      expect(useLightingStore.getState().transformMode).toBe('rotate')
    })

    it('should toggle between modes', () => {
      useLightingStore.getState().setTransformMode('rotate')
      expect(useLightingStore.getState().transformMode).toBe('rotate')

      useLightingStore.getState().setTransformMode('translate')
      expect(useLightingStore.getState().transformMode).toBe('translate')
    })
  })

  describe('setShowLightGizmos', () => {
    it('should show light gizmos', () => {
      useLightingStore.getState().setShowLightGizmos(true)
      expect(useLightingStore.getState().showLightGizmos).toBe(true)
    })

    it('should hide light gizmos', () => {
      useLightingStore.getState().setShowLightGizmos(true)
      useLightingStore.getState().setShowLightGizmos(false)
      expect(useLightingStore.getState().showLightGizmos).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset lights to default', () => {
      useLightingStore.getState().addLight('point')
      useLightingStore.getState().addLight('spot')
      useLightingStore.setState(LIGHTING_INITIAL_STATE)
      expect(useLightingStore.getState().lights).toHaveLength(1)
      expect(useLightingStore.getState().lights[0]!.id).toBe('light-default')
    })

    it('should reset selectedLightId to null', () => {
      useLightingStore.getState().selectLight('light-default')
      useLightingStore.setState(LIGHTING_INITIAL_STATE)
      expect(useLightingStore.getState().selectedLightId).toBeNull()
    })

    it('should reset transformMode to translate', () => {
      useLightingStore.setState(LIGHTING_INITIAL_STATE)
      expect(useLightingStore.getState().transformMode).toBe('translate')
    })

    it('should reset showLightGizmos to false', () => {
      useLightingStore.setState(LIGHTING_INITIAL_STATE)
      expect(useLightingStore.getState().showLightGizmos).toBe(false)
    })
  })
})
