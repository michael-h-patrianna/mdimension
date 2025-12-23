/**
 * Main Object MRT Pass
 *
 * Renders the main object layer into an MRT render target so shaders
 * can output both color and normal buffers in a single pass.
 *
 * This pass forces materials to be opaque for correct normal output
 * and writes depth for depth-aware compositing.
 *
 * Performance: Material cache is built lazily on first render and
 * reused for subsequent frames. Call invalidateCache() when the scene
 * structure changes (e.g., object type change, geometry recreation).
 *
 * @module rendering/graph/passes/MainObjectMRTPass
 */

import * as THREE from 'three';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Cached material entry with original properties for restoration.
 */
interface CachedMaterialEntry {
  material: THREE.Material;
  transparent: boolean;
  depthWrite: boolean;
  blending: THREE.Blending;
}

/**
 * Configuration for MainObjectMRTPass.
 */
export interface MainObjectMRTPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Output MRT resource ID */
  outputResource: string;
  /** Layers to render (null = all layers) */
  layers?: number[];
  /** Clear color (default: black) */
  clearColor?: THREE.ColorRepresentation;
  /** Clear alpha (default: 0) */
  clearAlpha?: number;
  /** Whether to clear before rendering */
  clear?: boolean;
  /** Whether to render scene background */
  renderBackground?: boolean;
  /** Force materials to be opaque for MRT output */
  forceOpaque?: boolean;
}

/**
 * Renders the main object layer into an MRT target.
 */
export class MainObjectMRTPass extends BasePass {
  private outputId: string;
  private layers: number[] | null;
  private clearColor: THREE.Color;
  private clearAlpha: number;
  private clear: boolean;
  private renderBackground: boolean;
  private forceOpaque: boolean;
  private cameraLayers = new THREE.Layers();

  /**
   * Cached materials that need opacity forcing.
   * Built lazily on first render, invalidated via invalidateCache().
   * null means cache needs to be rebuilt.
   */
  private materialCache: CachedMaterialEntry[] | null = null;

  constructor(config: MainObjectMRTPassConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Main Object MRT Pass',
      inputs: [],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    });

    this.outputId = config.outputResource;
    this.layers = config.layers ?? null;
    this.clearColor = new THREE.Color(config.clearColor ?? 0x000000);
    this.clearAlpha = config.clearAlpha ?? 0;
    this.clear = config.clear ?? true;
    this.renderBackground = config.renderBackground ?? false;
    this.forceOpaque = config.forceOpaque ?? true;
  }

  execute(ctx: RenderContext): void {
    const { renderer, scene, camera } = ctx;

    const target = ctx.getWriteTarget(this.outputId);
    if (!target) {
      console.warn('MainObjectMRTPass: Output target not found');
      return;
    }

    const savedAutoClear = renderer.autoClear;
    const savedClearColor = renderer.getClearColor(new THREE.Color());
    const savedClearAlpha = renderer.getClearAlpha();

    // Save camera layers if filtering
    if (this.layers !== null) {
      this.cameraLayers.mask = camera.layers.mask;
    }

    // Optionally hide background to avoid skybox bleed into MRT
    const savedBackground = !this.renderBackground ? scene.background : null;
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

    try {
      // Force materials to be opaque for MRT outputs
      if (this.forceOpaque) {
        // Build cache lazily on first render or after invalidation
        if (this.materialCache === null) {
          this.rebuildMaterialCache(scene, camera);
        }

        // Apply opacity forcing - O(M) where M is materials needing modification
        for (const entry of this.materialCache!) {
          entry.material.transparent = false;
          entry.material.depthWrite = true;
          entry.material.blending = THREE.NoBlending;
        }
      }

      renderer.setRenderTarget(target);

      // Manually force drawBuffers to all 3 MRT attachments
      // This ensures Three.js has the correct draw buffer configuration
      const glCtx = renderer.getContext();
      glCtx.drawBuffers([glCtx.COLOR_ATTACHMENT0, glCtx.COLOR_ATTACHMENT1, glCtx.COLOR_ATTACHMENT2]);

      if (this.clear) {
        renderer.autoClear = false;
        renderer.setClearColor(this.clearColor, this.clearAlpha);
        renderer.clear(true, true, false);
      }

      renderer.render(scene, camera);
    } finally {
      // Restore material props - O(M)
      if (this.forceOpaque && this.materialCache) {
        for (const entry of this.materialCache) {
          entry.material.transparent = entry.transparent;
          entry.material.depthWrite = entry.depthWrite;
          entry.material.blending = entry.blending;
        }
      }

      // Restore background
      if (!this.renderBackground && savedBackground !== null) {
        scene.background = savedBackground;
      }

      // Restore camera layers
      if (this.layers !== null) {
        camera.layers.mask = this.cameraLayers.mask;
      }

      renderer.autoClear = savedAutoClear;
      renderer.setClearColor(savedClearColor, savedClearAlpha);
      renderer.setRenderTarget(null);
    }
  }

  /**
   * Rebuild the material cache by traversing the scene.
   * Only called on first render or after invalidateCache().
   *
   * @param scene - The scene to traverse
   * @param camera - The camera with layer mask to test against
   */
  private rebuildMaterialCache(scene: THREE.Scene, camera: THREE.Camera): void {
    this.materialCache = [];

    scene.traverse((obj) => {
      // Skip objects not on the active camera layers
      if (this.layers !== null && !obj.layers.test(camera.layers)) {
        return;
      }

      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.Material;

        // Only cache materials that actually need modification
        if (mat.transparent || !mat.depthWrite || mat.blending !== THREE.NoBlending) {
          this.materialCache!.push({
            material: mat,
            transparent: mat.transparent,
            depthWrite: mat.depthWrite,
            blending: mat.blending,
          });
        }
      }
    });
  }

  /**
   * Invalidate the material cache.
   * Call this when scene structure changes (object type change, geometry recreation).
   * The cache will be rebuilt on the next execute() call.
   *
   * @returns Nothing
   */
  invalidateCache(): void {
    this.materialCache = null;
  }

  /**
   * Update which layers are rendered.
   * Also invalidates the material cache since layer filtering affects cached materials.
   *
   * @param layers - The layers to render (null for all layers)
   */
  setLayers(layers: number[] | null): void {
    this.layers = layers;
    this.invalidateCache();
  }

  dispose(): void {
    this.materialCache = null;
  }
}
