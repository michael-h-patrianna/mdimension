/**
 * Scene Pass
 *
 * Renders the Three.js scene to a render target.
 * This is typically the first pass in a render graph.
 *
 * Features:
 * - Optional layer filtering
 * - Clear color configuration
 * - Background rendering control
 *
 * @module rendering/graph/passes/ScenePass
 */

import * as THREE from 'three';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for ScenePass.
 */
export interface ScenePassConfig extends Omit<RenderPassConfig, 'inputs'> {
  /** Layers to render (null = all layers) */
  layers?: number[];

  /** Clear color (null = use renderer's clear color) */
  clearColor?: THREE.ColorRepresentation | null;

  /** Clear alpha */
  clearAlpha?: number;

  /** Whether to clear before rendering */
  autoClear?: boolean;

  /** Whether to render background */
  renderBackground?: boolean;
}

/**
 * Renders the scene to a render target.
 *
 * @example
 * ```typescript
 * const scenePass = new ScenePass({
 *   id: 'scene',
 *   outputs: [{ resourceId: 'sceneColor', access: 'write' }],
 *   clearColor: 0x000000,
 *   autoClear: true,
 * });
 *
 * graph.addPass(scenePass);
 * ```
 */
export class ScenePass extends BasePass {
  private layers: number[] | null;
  private clearColor: THREE.Color | null;
  private clearAlpha: number;
  private autoClear: boolean;
  private renderBackground: boolean;

  // Saved state for restoration
  private savedClearColor = new THREE.Color();
  private savedClearAlpha = 1;
  private savedAutoClear = true;
  private cameraLayers = new THREE.Layers();

  constructor(config: ScenePassConfig) {
    super({
      ...config,
      inputs: [], // ScenePass has no inputs
    });

    this.layers = config.layers ?? null;
    this.clearColor = config.clearColor !== undefined && config.clearColor !== null
      ? new THREE.Color(config.clearColor)
      : null;
    this.clearAlpha = config.clearAlpha ?? 1;
    this.autoClear = config.autoClear ?? true;
    this.renderBackground = config.renderBackground ?? true;
  }

  execute(ctx: RenderContext): void {
    const { renderer, scene, camera } = ctx;

    // Get output target
    const outputConfig = this.config.outputs[0];
    if (!outputConfig) {
      console.warn('ScenePass: No output configured');
      return;
    }

    const target = ctx.getWriteTarget(outputConfig.resourceId);

    // #region agent log - H15-H17: ScenePass debug
    const perspCam = camera as THREE.PerspectiveCamera;
    const targetInfo = target ? { w: target.width, h: target.height } : null;
    const h15Data = {
      location: 'ScenePass.ts:execute',
      message: 'H15-H17: ScenePass execution',
      data: {
        resourceId: outputConfig.resourceId,
        targetSize: targetInfo,
        cameraType: camera.type,
        cameraFov: perspCam.fov,
        cameraNear: perspCam.near,
        cameraFar: perspCam.far,
        cameraAspect: perspCam.aspect,
        cameraPos: [camera.position.x, camera.position.y, camera.position.z],
        layers: this.layers,
        ctxSize: ctx.size,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H15-H17',
    };
    console.log('[DEBUG-H15H17-ScenePass]', JSON.stringify(h15Data));
    fetch('http://127.0.0.1:7242/ingest/af54dc2c-228f-456b-a43d-a100942bc421', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(h15Data) }).catch(() => {});
    // #endregion

    // Save renderer state (only things we actually modify)
    this.savedClearColor.copy(renderer.getClearColor(this.savedClearColor));
    this.savedClearAlpha = renderer.getClearAlpha();
    this.savedAutoClear = renderer.autoClear;

    // Save camera layers
    if (this.layers !== null) {
      this.cameraLayers.mask = camera.layers.mask;
    }

    // Configure renderer
    if (this.clearColor !== null) {
      renderer.setClearColor(this.clearColor, this.clearAlpha);
    }
    renderer.autoClear = this.autoClear;

    // Handle background: only modify if renderBackground is false
    // IMPORTANT: Do NOT save/restore scene.background - let the scene own its state.
    // Saving and restoring can cause race conditions when React updates scene.background
    // during the frame (e.g., when skybox texture changes).
    const originalBackground = !this.renderBackground ? scene.background : null;
    if (!this.renderBackground) {
      scene.background = null;
    }

    // Configure layers
    if (this.layers !== null) {
      camera.layers.disableAll();
      for (const layer of this.layers) {
        camera.layers.enable(layer);
      }
    }

    // Render
    renderer.setRenderTarget(target);
    
    // #region agent log - H26: Count visible objects before render
    let visibleMeshes = 0;
    let visibleOnLayer1 = 0;
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.visible) {
        visibleMeshes++;
        if (obj.layers.test(camera.layers)) {
          visibleOnLayer1++;
        }
      }
    });
    console.log('[DEBUG-H26-ScenePass]', JSON.stringify({
      location: 'ScenePass.ts:render',
      message: 'H26: Scene objects before render',
      data: { visibleMeshes, visibleOnLayer1, cameraLayerMask: camera.layers.mask },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H26',
    }));
    // #endregion
    
    renderer.render(scene, camera);
    
    // #region agent log - H27: Render stats after scene render
    console.log('[DEBUG-H27-RenderStats]', JSON.stringify({
      location: 'ScenePass.ts:postRender',
      message: 'H27: Render stats after scene render',
      data: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        programs: renderer.info.programs?.length ?? 0,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H27',
    }));
    // #endregion

    // Restore renderer state
    renderer.setClearColor(this.savedClearColor, this.savedClearAlpha);
    renderer.autoClear = this.savedAutoClear;

    // Only restore background if we explicitly disabled it
    if (!this.renderBackground && originalBackground !== null) {
      scene.background = originalBackground;
    }

    if (this.layers !== null) {
      camera.layers.mask = this.cameraLayers.mask;
    }

    // Reset render target (caller will handle final target)
    renderer.setRenderTarget(null);
  }
}
