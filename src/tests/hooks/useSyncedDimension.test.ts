import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSyncedDimension } from '@/hooks/useSyncedDimension'
import { useGeometryStore } from '@/stores/geometryStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useTransformStore } from '@/stores/transformStore'
import { useAnimationStore } from '@/stores/animationStore'

describe('useSyncedDimension', () => {
  beforeEach(() => {
    // Reset all stores
    useGeometryStore.getState().reset()
    useRotationStore.getState().resetAllRotations()
    useTransformStore.getState().resetAll()
    useAnimationStore.getState().reset()
  })

  it('keeps rotation + transform dimensions in sync with geometry dimension', () => {
    const { rerender } = renderHook(() => useSyncedDimension())

    act(() => {
      useGeometryStore.getState().setDimension(7)
    })
    rerender()

    expect(useRotationStore.getState().dimension).toBe(7)
    expect(useTransformStore.getState().dimension).toBe(7)
  })

  it('filters animation planes when geometry dimension changes', () => {
    renderHook(() => useSyncedDimension())

    act(() => {
      useGeometryStore.getState().setDimension(8)
      useAnimationStore.getState().animateAll(8)
    })
    expect(useAnimationStore.getState().animatingPlanes.has('XV')).toBe(true)

    act(() => {
      useGeometryStore.getState().setDimension(4)
    })
    expect(useAnimationStore.getState().animatingPlanes.has('XV')).toBe(false)
  })

  it('resets rotations when object type changes', () => {
    act(() => {
      useGeometryStore.getState().setDimension(4)
      useGeometryStore.getState().setObjectType('hypercube')
    })

    const { rerender } = renderHook(() => useSyncedDimension())

    act(() => {
      useRotationStore.getState().setRotation('XY', Math.PI / 4)
      useRotationStore.getState().setRotation('XW', Math.PI / 3)
    })
    expect(useRotationStore.getState().rotations.get('XY')).not.toBe(0)

    act(() => {
      useGeometryStore.getState().setObjectType('simplex')
    })
    rerender()

    for (const [, angle] of useRotationStore.getState().rotations) {
      expect(angle).toBe(0)
    }
  })
})
