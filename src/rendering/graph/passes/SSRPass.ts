/**
 * SSR Pass (Screen-Space Reflections)
 *
 * Render graph pass for screen-space reflections.
 * Uses ray marching in screen space to find reflections.
 *
 * @module rendering/graph/passes/SSRPass
 */

import * as THREE from 'three';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';
import { SSRShader, type SSRUniforms } from '@/rendering/shaders/postprocessing/SSRShader';

/**
 * Configuration for SSRPass.
 */
export interface SSRPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Scene color input resource */
  colorInput: string;
  /** Normal buffer input resource */
  normalInput: string;
  /** Depth buffer input resource */
  depthInput: string;
  /** Depth input attachment (for depth textures on render targets) */
  depthInputAttachment?: number | 'depth';
  /** Alternate depth input resource (optional) */
  alternateDepthInput?: string;
  /** Alternate depth input attachment */
  alternateDepthInputAttachment?: number | 'depth';
  /** Optional selector for choosing depth input at runtime */
  depthInputSelector?: () => string;
  /** Output resource */
  outputResource: string;

  /** Reflection intensity (0-1) */
  intensity?: number;
  /** Max ray distance */
  maxDistance?: number;
  /** Depth thickness for hit detection */
  thickness?: number;
  /** Fade start distance */
  fadeStart?: number;
  /** Fade end distance */
  fadeEnd?: number;
  /** Max ray march steps */
  maxSteps?: number;
}

/**
 * Screen-space reflections pass.
 *
 * @example
 * ```typescript
 * const ssrPass = new SSRPass({
 *   id: 'ssr',
 *   colorInput: 'sceneColor',
 *   normalInput: 'normalBuffer',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'ssrOutput',
 *   intensity: 0.8,
 *   maxSteps: 64,
 * });
 * ```
 */
export class SSRPass extends BasePass {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Copy material for passthrough
  private copyMaterial: THREE.ShaderMaterial;
  private copyMesh: THREE.Mesh;
  private copyScene: THREE.Scene;

  private colorInputId: string;
  private normalInputId: string;
  private depthInputId: string;
  private depthInputAttachment?: number | 'depth';
  private alternateDepthInputId?: string;
  private alternateDepthInputAttachment?: number | 'depth';
  private depthInputSelector?: () => string;
  private outputId: string;

  constructor(config: SSRPassConfig) {
    const inputs = [
      { resourceId: config.colorInput, access: 'read' as const },
      { resourceId: config.normalInput, access: 'read' as const },
      {
        resourceId: config.depthInput,
        access: 'read' as const,
        attachment: config.depthInputAttachment,
      },
    ];

    if (config.alternateDepthInput && config.alternateDepthInput !== config.depthInput) {
      inputs.push({
        resourceId: config.alternateDepthInput,
        access: 'read' as const,
        attachment: config.alternateDepthInputAttachment,
      });
    }

    super({
      id: config.id,
      name: config.name ?? 'SSR Pass',
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    });

    this.colorInputId = config.colorInput;
    this.normalInputId = config.normalInput;
    this.depthInputId = config.depthInput;
    this.depthInputAttachment = config.depthInputAttachment;
    this.alternateDepthInputId = config.alternateDepthInput;
    this.alternateDepthInputAttachment = config.alternateDepthInputAttachment;
    this.depthInputSelector = config.depthInputSelector;
    this.outputId = config.outputResource;

    // Create material from SSRShader
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SSRShader.vertexShader,
      fragmentShader: SSRShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(SSRShader.uniforms as unknown as Record<string, THREE.IUniform>),
      depthTest: false,
      depthWrite: false,
    });

    // Set initial parameters
    const uniforms = this.material.uniforms as unknown as SSRUniforms;
    uniforms.intensity.value = config.intensity ?? 0.8;
    uniforms.maxDistance.value = config.maxDistance ?? 10;
    uniforms.thickness.value = config.thickness ?? 0.5;
    uniforms.fadeStart.value = config.fadeStart ?? 0.3;
    uniforms.fadeEnd.value = config.fadeEnd ?? 0.8;
    uniforms.maxSteps.value = config.maxSteps ?? 64;

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;

    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create copy material for passthrough
    this.copyMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { tDiffuse: { value: null } },
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
        uniform sampler2D tDiffuse;
        layout(location = 0) out vec4 fragColor;
        void main() {
          fragColor = texture(tDiffuse, vUv);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.copyMesh = new THREE.Mesh(geometry.clone(), this.copyMaterial);
    this.copyMesh.frustumCulled = false;
    this.copyScene = new THREE.Scene();
    this.copyScene.add(this.copyMesh);
  }

  execute(ctx: RenderContext): void {
    const { renderer, camera, size } = ctx;

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId);
    const outputTarget = ctx.getWriteTarget(this.outputId);

    // Passthrough if camera is not perspective or required inputs missing
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      this.copyToOutput(renderer, colorTex, outputTarget);
      return;
    }

    const normalTex = ctx.getReadTexture(this.normalInputId);
    const depthResourceId = this.depthInputSelector ? this.depthInputSelector() : this.depthInputId;
    const depthAttachment =
      depthResourceId === this.depthInputId
        ? this.depthInputAttachment
        : depthResourceId === this.alternateDepthInputId
          ? this.alternateDepthInputAttachment
          : undefined;
    const depthTex = ctx.getReadTexture(depthResourceId, depthAttachment);

    // Passthrough if required inputs missing
    if (!colorTex || !normalTex || !depthTex) {
      this.copyToOutput(renderer, colorTex, outputTarget);
      return;
    }

    // Update uniforms
    const uniforms = this.material.uniforms as unknown as SSRUniforms;
    uniforms.tDiffuse.value = colorTex;
    uniforms.tNormal.value = normalTex;
    uniforms.tDepth.value = depthTex as unknown as THREE.DepthTexture;
    uniforms.resolution.value.set(size.width, size.height);
    uniforms.projMatrix.value.copy(camera.projectionMatrix);
    uniforms.invProjMatrix.value.copy(camera.projectionMatrixInverse);
    uniforms.uViewMat.value.copy(camera.matrixWorldInverse);
    uniforms.nearClip.value = camera.near;
    uniforms.farClip.value = camera.far;

    // Render
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }

  /** Set SSR intensity */
  setIntensity(value: number): void {
    (this.material.uniforms as unknown as SSRUniforms).intensity.value = value;
  }

  /** Set max ray distance */
  setMaxDistance(value: number): void {
    (this.material.uniforms as unknown as SSRUniforms).maxDistance.value = value;
  }

  /** Set depth thickness */
  setThickness(value: number): void {
    (this.material.uniforms as unknown as SSRUniforms).thickness.value = value;
  }

  /** Set max ray march steps */
  setMaxSteps(value: number): void {
    (this.material.uniforms as unknown as SSRUniforms).maxSteps.value = value;
  }

  /** Copy input texture directly to output (passthrough) */
  private copyToOutput(
    renderer: THREE.WebGLRenderer,
    inputTex: THREE.Texture | null,
    outputTarget: THREE.WebGLRenderTarget | null
  ): void {
    if (!inputTex) return;

    this.copyMaterial.uniforms['tDiffuse']!.value = inputTex;
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.copyScene, this.camera);
    renderer.setRenderTarget(null);
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.copyMaterial.dispose();
    this.copyMesh.geometry.dispose();
  }
}
