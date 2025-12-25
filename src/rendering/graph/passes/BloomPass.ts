/**
 * Bloom Pass
 *
 * Wraps Three.js UnrealBloomPass for the RenderGraph system.
 * Applies HDR bloom/glow effect to bright areas of the scene.
 *
 * @module rendering/graph/passes/BloomPass
 */

import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for BloomPass.
 */
export interface BloomPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input resource to apply bloom to */
  inputResource: string;

  /** Output resource (can be same as input for in-place) */
  outputResource: string;

  /** Bloom strength (default: 1.0) */
  strength?: number;

  /** Bloom radius (default: 0.4) */
  radius?: number;

  /** Luminance threshold for bloom (default: 0.8) */
  threshold?: number;
}

/**
 * Applies bloom effect to input texture.
 *
 * Uses Three.js UnrealBloomPass internally with selective bloom
 * based on luminance threshold.
 *
 * @example
 * ```typescript
 * const bloom = new BloomPass({
 *   id: 'bloom',
 *   inputResource: 'sceneColor',
 *   outputResource: 'bloomedColor',
 *   strength: 1.5,
 *   radius: 0.4,
 *   threshold: 0.8,
 * });
 *
 * graph.addPass(bloom);
 * ```
 */
export class BloomPass extends BasePass {
  private bloomPass: UnrealBloomPass | null = null;
  private inputResourceId: string;
  private outputResourceId: string;

  // Bloom parameters
  private strength: number;
  private radius: number;
  private threshold: number;

  // Cached size for resize detection
  private lastWidth = 0;
  private lastHeight = 0;

  // Reusable render targets for bloom processing (avoids per-frame allocation)
  private bloomReadTarget: THREE.WebGLRenderTarget | null = null;
  private bloomWriteTarget: THREE.WebGLRenderTarget | null = null;

  // Fullscreen quad for copying result
  private copyMaterial: THREE.ShaderMaterial;
  private copyMesh: THREE.Mesh;
  private copyScene: THREE.Scene;
  private copyCamera: THREE.OrthographicCamera;

  constructor(config: BloomPassConfig) {
    super({
      id: config.id,
      name: config.name,
      inputs: [{ resourceId: config.inputResource, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    });

    this.inputResourceId = config.inputResource;
    this.outputResourceId = config.outputResource;
    this.strength = config.strength ?? 1.0;
    this.radius = config.radius ?? 0.4;
    this.threshold = config.threshold ?? 0.8;

    // Create copy material for transferring bloom result
    this.copyMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        in vec2 vUv;
        uniform sampler2D tDiffuse;
        layout(location = 0) out vec4 fragColor;
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
   * Ensure bloom pass and render targets are initialized with correct size.
   */
  private ensureInitialized(width: number, height: number): void {
    if (!this.bloomPass || width !== this.lastWidth || height !== this.lastHeight) {
      // Dispose old resources
      this.bloomPass?.dispose();
      this.bloomReadTarget?.dispose();
      this.bloomWriteTarget?.dispose();

      // Create new bloom pass with current size
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        this.strength,
        this.radius,
        this.threshold
      );

      // Create reusable render targets for bloom processing
      // CRITICAL: Must use LinearSRGBColorSpace to match pipeline targets
      this.bloomReadTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      });
      this.bloomReadTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;

      this.bloomWriteTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      });
      this.bloomWriteTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;

      this.lastWidth = width;
      this.lastHeight = height;
    }
  }

  execute(ctx: RenderContext): void {
    const { renderer, size } = ctx;

    // Skip if size is invalid (can happen on first frames before canvas is sized)
    if (size.width < 1 || size.height < 1) {
      return;
    }

    // Ensure bloom pass exists
    this.ensureInitialized(size.width, size.height);

    if (!this.bloomPass) {
      console.warn('BloomPass: Failed to initialize bloom pass');
      return;
    }

    // Get input texture
    const inputTexture = ctx.getReadTexture(this.inputResourceId);
    if (!inputTexture) {
      console.warn(`BloomPass: Input texture '${this.inputResourceId}' not found`);
      return;
    }

    // Get output target
    const outputTarget = ctx.getWriteTarget(this.outputResourceId);

    // Update bloom pass parameters
    this.bloomPass.strength = this.strength;
    this.bloomPass.radius = this.radius;
    this.bloomPass.threshold = this.threshold;

    // The UnrealBloomPass needs to work with its own read/write buffers
    // We need to:
    // 1. Set the input texture as the read buffer
    // 2. Render bloom to its write buffer
    // 3. Copy result to our output target

    // Use reusable render targets (created in ensureInitialized)
    if (!this.bloomReadTarget || !this.bloomWriteTarget) {
      console.warn('BloomPass: Render targets not initialized');
      return;
    }

    // Copy input to bloom read target
    this.copyMaterial.uniforms['tDiffuse']!.value = inputTexture;
    renderer.setRenderTarget(this.bloomReadTarget);
    renderer.render(this.copyScene, this.copyCamera);

    // Run bloom pass
    // NOTE: UnrealBloomPass has needsSwap=false and writes back to readBuffer!
    this.bloomPass.render(
      renderer,
      this.bloomWriteTarget,
      this.bloomReadTarget,
      0, // delta not used
      false // maskActive
    );

    // Copy bloom result to output
    // BUG FIX: UnrealBloomPass writes to readBuffer (not writeBuffer) due to needsSwap=false
    // We should read from bloomReadTarget, not bloomWriteTarget
    this.copyMaterial.uniforms['tDiffuse']!.value = this.bloomReadTarget.texture;
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.copyScene, this.copyCamera);

    renderer.setRenderTarget(null);
  }

  /**
   * Set bloom strength.
   */
  setStrength(strength: number): void {
    this.strength = strength;
  }

  /**
   * Set bloom radius.
   */
  setRadius(radius: number): void {
    this.radius = radius;
  }

  /**
   * Set luminance threshold.
   */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /**
   * Get current bloom parameters.
   */
  getParameters(): { strength: number; radius: number; threshold: number } {
    return {
      strength: this.strength,
      radius: this.radius,
      threshold: this.threshold,
    };
  }

  dispose(): void {
    this.bloomPass?.dispose();
    this.bloomPass = null;
    this.bloomReadTarget?.dispose();
    this.bloomReadTarget = null;
    this.bloomWriteTarget?.dispose();
    this.bloomWriteTarget = null;
    this.copyMaterial.dispose();
    this.copyMesh.geometry.dispose();
    // Remove mesh from scene to ensure proper cleanup
    this.copyScene.remove(this.copyMesh);
  }
}
