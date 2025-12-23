/**
 * Tests for TemporalCloudPass.
 *
 * Ensures temporal cloud pass orchestrates rendering and reconstruction.
 */

import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TemporalCloudPass } from '@/rendering/graph/passes/TemporalCloudPass'
import type { RenderContext } from '@/rendering/graph/types'

describe('TemporalCloudPass', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render scene and reconstruction when enabled', () => {
    const pass = new TemporalCloudPass({
      id: 'temporalCloud',
      volumetricLayer: 3,
      cloudBuffer: 'cloud',
      accumulationBuffer: 'accum',
      reprojectionBuffer: 'reproj',
      shouldRender: () => true,
    })

    const cloudTarget = new THREE.WebGLRenderTarget(100, 100)
    const accumWrite = new THREE.WebGLRenderTarget(200, 200)
    const accumRead = new THREE.WebGLRenderTarget(200, 200)
    const reprojTarget = new THREE.WebGLRenderTarget(200, 200)

    // Mock WebGL2 context for MRTUtil.configureDrawBuffers
    const mockGlContext = {
      COLOR_ATTACHMENT0: 0x8ce0,
      COLOR_ATTACHMENT1: 0x8ce1,
      COLOR_ATTACHMENT2: 0x8ce2,
      drawBuffers: vi.fn(),
    } as unknown as WebGL2RenderingContext

    const renderer = {
      setRenderTarget: vi.fn(),
      setClearColor: vi.fn(),
      clear: vi.fn(),
      render: vi.fn(),
      getRenderTarget: vi.fn(() => null),
      getContext: vi.fn(() => mockGlContext),
    } as unknown as THREE.WebGLRenderer

    // Create a mock volumetric mesh that is on layer 3
    const volumetricMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.ShaderMaterial({ uniforms: {} })
    )
    volumetricMesh.layers.set(3) // Put on volumetric layer

    const scene = {
      traverse: vi.fn((callback: (obj: THREE.Object3D) => void) => {
        callback(volumetricMesh)
      }),
    } as unknown as THREE.Scene

    const camera = new THREE.PerspectiveCamera()
    camera.layers.disableAll = vi.fn()
    camera.layers.enable = vi.fn()

    const ctx = {
      renderer,
      scene,
      camera,
      size: { width: 200, height: 200 },
      getWriteTarget: (id: string) => {
        if (id === 'cloud') return cloudTarget
        if (id === 'accum') return accumWrite
        if (id === 'reproj') return reprojTarget
        return null
      },
      getReadTexture: () => null,
      getReadTarget: (id: string) => (id === 'accum' ? accumRead : null),
    } as unknown as RenderContext

    pass.execute(ctx)

    // Verify scene render (Quarter Res)
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(cloudTarget)
    expect(camera.layers.enable).toHaveBeenCalledWith(3)

    // Verify reprojection and reconstruction calls
    // Since we can't easily spy on private methods, we infer from render calls
    // Scene render + Reprojection + Reconstruction = 3 render calls?
    // Reprojection is skipped on first frame (no valid history).
    // So 2 calls: Scene + Reconstruction.
    expect(renderer.render).toHaveBeenCalledTimes(2)
  })

  it('should skip rendering when shouldRender returns false', () => {
    const pass = new TemporalCloudPass({
      id: 'temporalCloud',
      volumetricLayer: 3,
      cloudBuffer: 'cloud',
      accumulationBuffer: 'accum',
      reprojectionBuffer: 'reproj',
      shouldRender: () => false,
    })

    const ctx = {
      renderer: { render: vi.fn() } as unknown as THREE.WebGLRenderer,
    } as unknown as RenderContext

    pass.execute(ctx)

    expect(ctx.renderer.render).not.toHaveBeenCalled()
  })
})
