/**
 * Debug Overlay Pass (TSL)
 *
 * Renders debug/gizmo elements (light helpers, transform controls, arrows,
 * lines, axis helpers) AFTER all post-processing effects, directly to screen.
 *
 * WHY THIS EXISTS:
 * ----------------
 * The main render graph uses MRT (Multiple Render Targets) which requires ALL
 * shaders to output to 3 color attachments (gColor, gNormal, gPosition).
 * Standard Three.js materials (MeshBasicMaterial, LineBasicMaterial) and
 * helpers (ArrowHelper, TransformControls, Line from drei) only output to
 * a single attachment, causing them to not render correctly in MRT passes.
 *
 * SOLUTION:
 * ---------
 * Objects on RENDER_LAYERS.DEBUG are excluded from MRT passes and rendered
 * here AFTER post-processing. This allows standard Three.js materials to
 * work without modification - NO NEED for custom MRT-compatible shaders.
 *
 * TSL port of the WebGL DebugOverlayPass with identical behavior.
 *
 * @module rendering/graph-tsl/passes/DebugOverlayPassTSL
 */

import * as THREE from 'three'

import { RENDER_LAYERS } from '@/rendering/core/layers'
import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for DebugOverlayPassTSL.
 * No additional config needed - always renders DEBUG layer to screen.
 */
export type DebugOverlayPassTSLConfig = Omit<RenderPassConfig, 'inputs' | 'outputs'>

/**
 * Renders debug/gizmo layer after post-processing, directly to screen.
 *
 * Objects on this layer can use standard Three.js materials without
 * needing MRT-compatible output declarations (no gColor/gNormal/gPosition).
 *
 * TSL port of the WebGL DebugOverlayPass with identical behavior.
 *
 * @example
 * ```typescript
 * const debugPass = new DebugOverlayPassTSL({
 *   id: 'debugOverlay',
 * });
 *
 * // Add AFTER ToScreenPass in render graph
 * graph.addPass(debugPass);
 * ```
 */
export class DebugOverlayPassTSL extends BasePassTSL {
  private savedCameraLayers = new THREE.Layers()

  constructor(config: DebugOverlayPassTSLConfig) {
    super({
      ...config,
      inputs: [],
      outputs: [], // Renders directly to screen (no render target)
      // CRITICAL: Very high priority ensures this pass runs LAST in the render graph.
      // The topological sort uses priority to order passes with the same dependency level.
      // Without this, DebugOverlayPassTSL (with 0 dependencies) would run at the START
      // of the graph, before any scene is rendered to screen.
      priority: 10000,
    })
  }

  execute(ctx: RenderContextTSL): void {
    // Cast to renderer-agnostic interface that works with both WebGL and WebGPU
    const renderer = ctx.renderer as unknown as {
      setRenderTarget(target: THREE.WebGLRenderTarget | null): void
      render(scene: THREE.Scene, camera: THREE.Camera): void
      autoClear: boolean
    }
    const { scene, camera } = ctx

    // Save camera layers
    this.savedCameraLayers.mask = camera.layers.mask

    // IMPORTANT: Clear scene.background to prevent WebGLBackground from rendering.
    // When scene.background is a WebGLCubeRenderTarget.texture, THREE.js's WebGLBackground
    // attempts to render it, which can cause WebGL state issues. Since we only render
    // the DEBUG layer here (gizmos, helpers), we don't need the background.
    const savedBackground = scene.background
    scene.background = null
    const savedAutoClear = renderer.autoClear

    try {
      // Configure camera to ONLY render DEBUG layer
      camera.layers.disableAll()
      camera.layers.enable(RENDER_LAYERS.DEBUG)

      // Render directly to screen (null = default framebuffer)
      // MRTStateManager automatically configures drawBuffers via patched setRenderTarget
      renderer.setRenderTarget(null)

      // Don't clear - overlay on top of existing render
      renderer.autoClear = false

      // Render debug elements
      renderer.render(scene, camera)
    } finally {
      // Restore camera layers
      camera.layers.mask = this.savedCameraLayers.mask
      renderer.autoClear = savedAutoClear
      // Restore scene.background
      scene.background = savedBackground
    }
  }
}
