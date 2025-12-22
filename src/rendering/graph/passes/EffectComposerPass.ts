/**
 * Effect Composer Pass
 *
 * Wraps Three.js EffectComposer for integration with the render graph.
 * Allows using existing Three.js post-processing passes within the graph.
 *
 * @module rendering/graph/passes/EffectComposerPass
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for EffectComposerPass.
 */
export interface EffectComposerPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input scene color resource (optional - if not provided, renders scene) */
  inputResource?: string;

  /** Output resource ID */
  outputResource: string;

  /** Post-processing passes to add to the composer */
  composerPasses?: Pass[];

  /** Whether to include a RenderPass at the start (default: true if no inputResource) */
  includeRenderPass?: boolean;
}

/**
 * Wraps Three.js EffectComposer for render graph integration.
 *
 * This pass allows using existing Three.js post-processing passes
 * (UnrealBloomPass, SMAAPass, etc.) within the declarative render graph.
 *
 * @example
 * ```typescript
 * import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
 *
 * const bloomPass = new UnrealBloomPass(
 *   new THREE.Vector2(window.innerWidth, window.innerHeight),
 *   1.5, 0.4, 0.85
 * );
 *
 * const composerPass = new EffectComposerPass({
 *   id: 'composer',
 *   inputResource: 'sceneColor',
 *   outputResource: 'processed',
 *   composerPasses: [bloomPass],
 * });
 *
 * graph.addPass(composerPass);
 * ```
 */
export class EffectComposerPass extends BasePass {
  private inputResourceId: string | null;
  private outputResourceId: string;
  private composerPasses: Pass[];
  private includeRenderPass: boolean;

  private composer: EffectComposer | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  // Fullscreen copy for input texture
  private copyMaterial: THREE.ShaderMaterial;
  private copyMesh: THREE.Mesh;
  private copyScene: THREE.Scene;
  private copyCamera: THREE.OrthographicCamera;

  constructor(config: EffectComposerPassConfig) {
    // Build inputs based on config
    const inputs = config.inputResource
      ? [{ resourceId: config.inputResource, access: 'read' as const }]
      : [];

    super({
      id: config.id,
      name: config.name,
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    });

    this.inputResourceId = config.inputResource ?? null;
    this.outputResourceId = config.outputResource;
    this.composerPasses = config.composerPasses ?? [];
    this.includeRenderPass = config.includeRenderPass ?? !config.inputResource;

    // Create copy material for input texture
    this.copyMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: /* glsl */ `
        out vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;
        uniform sampler2D tDiffuse;

        void main() {
          fragColor = texture(tDiffuse, vUv);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.copyMesh = new THREE.Mesh(geometry, this.copyMaterial);
    this.copyMesh.frustumCulled = false;

    this.copyScene = new THREE.Scene();
    this.copyScene.add(this.copyMesh);

    this.copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Ensure composer is initialized with correct size.
   */
  private ensureComposer(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number
  ): void {
    if (!this.composer || width !== this.lastWidth || height !== this.lastHeight) {
      // Dispose old composer
      if (this.composer) {
        this.composer.renderTarget1.dispose();
        this.composer.renderTarget2.dispose();
      }

      // Create new composer
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      });

      this.composer = new EffectComposer(renderer, renderTarget);

      // Add render pass if needed
      if (this.includeRenderPass) {
        this.composer.addPass(new RenderPass(scene, camera));
      }

      // Add configured passes
      for (const pass of this.composerPasses) {
        this.composer.addPass(pass);
        // Resize pass if it has setSize
        if ('setSize' in pass && typeof pass.setSize === 'function') {
          (pass as { setSize: (w: number, h: number) => void }).setSize(width, height);
        }
      }

      this.lastWidth = width;
      this.lastHeight = height;
    }
  }

  execute(ctx: RenderContext): void {
    const { renderer, scene, camera, size } = ctx;

    // Ensure composer exists
    this.ensureComposer(renderer, scene, camera, size.width, size.height);

    if (!this.composer) {
      console.warn('EffectComposerPass: Failed to initialize composer');
      return;
    }

    // Get output target
    const outputTarget = ctx.getWriteTarget(this.outputResourceId);

    // If we have an input resource, copy it to the composer's read buffer
    if (this.inputResourceId) {
      const inputTexture = ctx.getReadTexture(this.inputResourceId);
      if (inputTexture) {
        this.copyMaterial.uniforms['tDiffuse']!.value = inputTexture;
        renderer.setRenderTarget(this.composer.readBuffer);
        renderer.render(this.copyScene, this.copyCamera);
      }
    }

    // Render composer passes
    this.composer.render();

    // Copy result to output target
    this.copyMaterial.uniforms['tDiffuse']!.value = this.composer.readBuffer.texture;
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.copyScene, this.copyCamera);
    renderer.setRenderTarget(null);
  }

  /**
   * Add a pass to the composer.
   */
  addComposerPass(pass: Pass): void {
    this.composerPasses.push(pass);
    if (this.composer) {
      this.composer.addPass(pass);
      if ('setSize' in pass && typeof pass.setSize === 'function') {
        (pass as { setSize: (w: number, h: number) => void }).setSize(
          this.lastWidth,
          this.lastHeight
        );
      }
    }
  }

  /**
   * Remove a pass from the composer.
   */
  removeComposerPass(pass: Pass): void {
    const index = this.composerPasses.indexOf(pass);
    if (index !== -1) {
      this.composerPasses.splice(index, 1);
      if (this.composer) {
        this.composer.removePass(pass);
      }
    }
  }

  /**
   * Get the internal EffectComposer for direct manipulation.
   */
  getComposer(): EffectComposer | null {
    return this.composer;
  }

  dispose(): void {
    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
    }
    this.copyMaterial.dispose();
    this.copyMesh.geometry.dispose();

    // Dispose passes if they have dispose method
    for (const pass of this.composerPasses) {
      if ('dispose' in pass && typeof pass.dispose === 'function') {
        (pass as { dispose: () => void }).dispose();
      }
    }
  }
}
