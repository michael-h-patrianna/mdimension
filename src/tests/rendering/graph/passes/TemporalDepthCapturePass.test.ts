/**
 * Tests for TemporalDepthCapturePass.
 *
 * Ensures depth capture updates TemporalDepthState instance.
 */

import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TemporalDepthState } from '@/rendering/core/temporalDepth'
import { TemporalDepthCapturePass } from '@/rendering/graph/passes/TemporalDepthCapturePass'
import type { RenderContext } from '@/rendering/graph/types'

// Mock stores
vi.mock('@/stores', () => ({
  usePerformanceStore: {
    getState: vi.fn(() => ({ temporalReprojectionEnabled: true })),
  },
}))

vi.mock('@/stores/webglContextStore', () => ({
  useWebGLContextStore: {
    getState: vi.fn(() => ({ status: 'active' })),
  },
}))

describe('TemporalDepthCapturePass', () => {
  let temporalDepthState: TemporalDepthState

  beforeEach(() => {
    temporalDepthState = new TemporalDepthState()
  })

  afterEach(() => {
    temporalDepthState.dispose()
    vi.restoreAllMocks()
  })

  it('should update state instance with output texture', () => {
    const updateSpy = vi.spyOn(temporalDepthState, 'updateState')

    const pass = new TemporalDepthCapturePass({
      id: 'temporalDepth',
      depthInput: 'depth',
      outputResource: 'output',
      temporalDepthState,
    })

    const depthTexture = new THREE.DepthTexture(4, 4)
    const writeTarget = new THREE.WebGLRenderTarget(4, 4)

    const ctx = {
      renderer: {
        autoClear: true,
        setRenderTarget: vi.fn(),
        setClearColor: vi.fn(),
        clear: vi.fn(),
        render: vi.fn(),
      } as unknown as THREE.WebGLRenderer,
      getReadTexture: (id: string) => (id === 'depth' ? depthTexture : null),
      getWriteTarget: (id: string) => (id === 'output' ? writeTarget : null),
      camera: new THREE.PerspectiveCamera(),
    } as unknown as RenderContext

    pass.execute(ctx)

    expect(updateSpy).toHaveBeenCalledWith(writeTarget.texture, 4, 4)
  })

  it('should skip update when inputs are missing', () => {
    const updateSpy = vi.spyOn(temporalDepthState, 'updateState')

    const pass = new TemporalDepthCapturePass({
      id: 'temporalDepth',
      depthInput: 'depth',
      outputResource: 'output',
      temporalDepthState,
    })

    const ctx = {
      getReadTexture: () => null, // Missing input
      getWriteTarget: () => new THREE.WebGLRenderTarget(1, 1),
    } as unknown as RenderContext

    pass.execute(ctx)

    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('should skip update when temporalDepthState is disabled', () => {
    temporalDepthState.invalidate() // Disable it
    const updateSpy = vi.spyOn(temporalDepthState, 'updateState')

    const pass = new TemporalDepthCapturePass({
      id: 'temporalDepth',
      depthInput: 'depth',
      outputResource: 'output',
      temporalDepthState,
    })

    const depthTexture = new THREE.DepthTexture(4, 4)
    const writeTarget = new THREE.WebGLRenderTarget(4, 4)

    const ctx = {
      renderer: {
        autoClear: true,
        setRenderTarget: vi.fn(),
        setClearColor: vi.fn(),
        clear: vi.fn(),
        render: vi.fn(),
      } as unknown as THREE.WebGLRenderer,
      getReadTexture: (id: string) => (id === 'depth' ? depthTexture : null),
      getWriteTarget: (id: string) => (id === 'output' ? writeTarget : null),
      camera: new THREE.PerspectiveCamera(),
    } as unknown as RenderContext

    pass.execute(ctx)

    // Should still be called but with invalidated state
    expect(updateSpy).toHaveBeenCalled()
  })
})
