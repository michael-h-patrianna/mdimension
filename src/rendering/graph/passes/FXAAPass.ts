/**
 * FXAA Pass
 *
 * Render graph pass for Fast Approximate Anti-Aliasing.
 * Provides edge smoothing with minimal performance cost.
 *
 * @module rendering/graph/passes/FXAAPass
 */

import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for FXAAPass.
 */
export interface FXAAPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string;
  /** Output resource */
  outputResource: string;
}

/**
 * Fast Approximate Anti-Aliasing pass.
 *
 * @example
 * ```typescript
 * const fxaaPass = new FXAAPass({
 *   id: 'fxaa',
 *   colorInput: 'sceneColor',
 *   outputResource: 'antialiasedOutput',
 * });
 * ```
 */
export class FXAAPass extends BasePass {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  private colorInputId: string;
  private outputId: string;

  constructor(config: FXAAPassConfig) {
    super({
      id: config.id,
      name: config.name ?? 'FXAA Pass',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    });

    this.colorInputId = config.colorInput;
    this.outputId = config.outputResource;

    // Create material from FXAAShader
    this.material = new THREE.ShaderMaterial({
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      depthTest: false,
      depthWrite: false,
    });

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;

    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  execute(ctx: RenderContext): void {
    const { renderer, size } = ctx;

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId);
    const outputTarget = ctx.getWriteTarget(this.outputId);

    if (!colorTex) {
      return;
    }

    // Update uniforms
    this.material.uniforms['tDiffuse']!.value = colorTex;
    this.material.uniforms['resolution']!.value.set(1 / size.width, 1 / size.height);

    // Render
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
