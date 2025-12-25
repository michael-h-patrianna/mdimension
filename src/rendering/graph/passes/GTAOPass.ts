/**
 * GTAO Pass (Render Graph)
 *
 * Wraps Three.js GTAOPass for integration with the RenderGraph system.
 * Provides Ground Truth Ambient Occlusion for mesh-based objects (polytopes).
 *
 * @module rendering/graph/passes/GTAOPass
 */

import * as THREE from 'three';
import { GTAOPass as ThreeGTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for GTAOPass.
 */
export interface GTAOPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string;
  /** Input normal resource (world-space normals) */
  normalInput: string;
  /** Input depth resource */
  depthInput: string;
  /** Depth input attachment (for depth textures on render targets) */
  depthInputAttachment?: number | 'depth';
  /** Output resource */
  outputResource: string;
}

/**
 * Fullscreen copy shader for transferring textures between targets.
 */
const copyVertexShader = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const copyFragmentShader = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tDiffuse;
layout(location = 0) out vec4 fragColor;
void main() {
  fragColor = texture(tDiffuse, vUv);
}
`;

/**
 * GTAO (Ground Truth Ambient Occlusion) pass for render graph.
 *
 * Uses Three.js GTAOPass internally to compute AO from scene geometry.
 * Optimized to reuse G-buffer from earlier passes rather than re-rendering.
 *
 * @example
 * ```typescript
 * const gtaoPass = new GTAOPass({
 *   id: 'gtao',
 *   colorInput: 'sceneColor',
 *   normalInput: 'sceneNormals',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'aoOutput',
 * });
 * ```
 */
export class GTAOPass extends BasePass {
  private gtaoPass: ThreeGTAOPass | null = null;

  private colorInputId: string;
  private normalInputId: string;
  private depthInputId: string;
  private depthInputAttachment?: number | 'depth';
  private outputId: string;

  // Cached size for resize detection
  private lastWidth = 0;
  private lastHeight = 0;

  // Render targets for GTAO processing
  private readTarget: THREE.WebGLRenderTarget | null = null;
  private writeTarget: THREE.WebGLRenderTarget | null = null;

  // Copy material for transferring results
  private copyMaterial: THREE.ShaderMaterial;
  private copyMesh: THREE.Mesh;
  private copyScene: THREE.Scene;
  private copyCamera: THREE.OrthographicCamera;

  // Scene/camera references (needed for GTAOPass initialization)
  private sceneRef: THREE.Scene | null = null;
  private cameraRef: THREE.Camera | null = null;

  constructor(config: GTAOPassConfig) {
    super({
      id: config.id,
      name: config.name ?? 'GTAO Pass',
      inputs: [
        { resourceId: config.colorInput, access: 'read' },
        { resourceId: config.normalInput, access: 'read' },
        {
          resourceId: config.depthInput,
          access: 'read',
          attachment: config.depthInputAttachment,
        },
      ],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    });

    this.colorInputId = config.colorInput;
    this.normalInputId = config.normalInput;
    this.depthInputId = config.depthInput;
    this.depthInputAttachment = config.depthInputAttachment;
    this.outputId = config.outputResource;

    // Create copy material
    this.copyMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: copyVertexShader,
      fragmentShader: copyFragmentShader,
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
   * Ensure GTAO pass and targets are initialized with correct size.
   */
  private ensureInitialized(
    width: number,
    height: number,
    scene: THREE.Scene,
    camera: THREE.Camera
  ): void {
    const needsRecreate =
      !this.gtaoPass ||
      width !== this.lastWidth ||
      height !== this.lastHeight ||
      scene !== this.sceneRef ||
      camera !== this.cameraRef;

    if (needsRecreate) {
      // Dispose old resources
      this.gtaoPass?.dispose?.();
      this.readTarget?.dispose();
      this.writeTarget?.dispose();

      // Store references
      this.sceneRef = scene;
      this.cameraRef = camera;

      // Create GTAOPass
      this.gtaoPass = new ThreeGTAOPass(scene, camera, width, height);
      this.gtaoPass.output = ThreeGTAOPass.OUTPUT.Default; // Blend AO with scene

      // Create render targets
      this.readTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      });
      this.writeTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      });

      this.lastWidth = width;
      this.lastHeight = height;
    }
  }

  execute(ctx: RenderContext): void {
    const { renderer, size, scene, camera } = ctx;

    // Skip if size is invalid
    if (size.width < 1 || size.height < 1) {
      return;
    }

    // Ensure GTAO is initialized
    this.ensureInitialized(size.width, size.height, scene, camera);

    if (!this.gtaoPass || !this.readTarget || !this.writeTarget) {
      console.warn('GTAOPass: Failed to initialize');
      return;
    }

    // Get input textures
    const colorTex = ctx.getReadTexture(this.colorInputId);
    const normalTex = ctx.getReadTexture(this.normalInputId);
    const depthTex = ctx.getReadTexture(this.depthInputId, this.depthInputAttachment);
    const outputTarget = ctx.getWriteTarget(this.outputId);

    if (!colorTex || !normalTex || !depthTex) {
      console.warn('GTAOPass: Missing input textures');
      return;
    }

    // CRITICAL: Provide existing G-buffer textures to GTAOPass
    // Without this, GTAOPass renders its own G-buffer using scene.overrideMaterial
    // which breaks raymarched objects that don't use standard materials.
    //
    // By injecting our normal+depth textures directly, we skip GTAOPass's
    // internal G-buffer render entirely.
    if (this.gtaoPass.normalTexture !== normalTex) {
      this.gtaoPass.normalTexture = normalTex;
    }
    if (this.gtaoPass.depthTexture !== depthTex) {
      // Cast to DepthTexture - the render graph provides the correct texture type
      // from the depth resource which is created with DepthTexture format
      this.gtaoPass.depthTexture = depthTex as unknown as THREE.DepthTexture;
    }

    // Copy input color to read buffer
    this.copyMaterial.uniforms['tDiffuse']!.value = colorTex;
    renderer.setRenderTarget(this.readTarget);
    renderer.render(this.copyScene, this.copyCamera);

    // Run GTAO pass
    this.gtaoPass.render(
      renderer,
      this.writeTarget,
      this.readTarget,
      0, // delta
      false // maskActive
    );

    // Copy result to output
    this.copyMaterial.uniforms['tDiffuse']!.value = this.writeTarget.texture;
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.copyScene, this.copyCamera);

    renderer.setRenderTarget(null);
  }

  /**
   * Set the AO radius.
   */
  setRadius(radius: number): void {
    if (this.gtaoPass) {
      // @ts-expect-error - GTAOPass params may vary by Three.js version
      this.gtaoPass.radius = radius;
    }
  }

  /**
   * Set the AO intensity using blendIntensity.
   * blendIntensity controls how strongly the AO effect blends with the scene.
   */
  setIntensity(intensity: number): void {
    if (this.gtaoPass) {
      this.gtaoPass.blendIntensity = intensity;
    }
  }

  dispose(): void {
    this.gtaoPass?.dispose?.();
    this.gtaoPass = null;
    this.readTarget?.dispose();
    this.readTarget = null;
    this.writeTarget?.dispose();
    this.writeTarget = null;
    this.copyMaterial.dispose();
    this.copyMesh.geometry.dispose();
    // Remove mesh from scene to ensure proper cleanup
    this.copyScene.remove(this.copyMesh);
    // Clear scene/camera references to allow garbage collection
    this.sceneRef = null;
    this.cameraRef = null;
  }
}
