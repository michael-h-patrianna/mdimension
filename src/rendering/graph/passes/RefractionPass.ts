/**
 * Refraction Pass (Screen-Space Refraction)
 *
 * Render graph pass for screen-space refraction effect.
 * Distorts the scene based on surface normals to simulate refraction.
 *
 * @module rendering/graph/passes/RefractionPass
 */

import * as THREE from 'three';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';
import { RefractionShader, type RefractionUniforms } from '@/rendering/shaders/postprocessing/RefractionShader';

/**
 * Configuration for RefractionPass.
 */
export interface RefractionPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
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

  /** Index of refraction (1.0 = no refraction, 1.5 = glass) */
  ior?: number;
  /** Refraction strength multiplier */
  strength?: number;
  /** Chromatic aberration amount */
  chromaticAberration?: number;
}

/**
 * Screen-space refraction pass.
 *
 * @example
 * ```typescript
 * const refractionPass = new RefractionPass({
 *   id: 'refraction',
 *   colorInput: 'sceneColor',
 *   normalInput: 'normalBuffer',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'refractedOutput',
 *   ior: 1.3,
 *   strength: 0.5,
 * });
 * ```
 */
export class RefractionPass extends BasePass {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  private colorInputId: string;
  private normalInputId: string;
  private depthInputId: string;
  private depthInputAttachment?: number | 'depth';
  private alternateDepthInputId?: string;
  private alternateDepthInputAttachment?: number | 'depth';
  private depthInputSelector?: () => string;
  private outputId: string;

  constructor(config: RefractionPassConfig) {
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
      name: config.name ?? 'Refraction Pass',
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

    // Create material from RefractionShader
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: RefractionShader.vertexShader,
      fragmentShader: RefractionShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(RefractionShader.uniforms as unknown as Record<string, THREE.IUniform>),
      depthTest: false,
      depthWrite: false,
    });

    // Set initial parameters
    const uniforms = this.material.uniforms as unknown as RefractionUniforms;
    uniforms.ior.value = config.ior ?? 1.3;
    uniforms.strength.value = config.strength ?? 0.5;
    uniforms.chromaticAberration.value = config.chromaticAberration ?? 0.02;

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;

    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  execute(ctx: RenderContext): void {
    const { renderer, camera, size } = ctx;

    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId);
    const normalTex = ctx.getReadTexture(this.normalInputId);
    const depthResourceId = this.depthInputSelector ? this.depthInputSelector() : this.depthInputId;
    const depthAttachment =
      depthResourceId === this.depthInputId
        ? this.depthInputAttachment
        : depthResourceId === this.alternateDepthInputId
          ? this.alternateDepthInputAttachment
          : undefined;
    const depthTex = ctx.getReadTexture(depthResourceId, depthAttachment);
    const outputTarget = ctx.getWriteTarget(this.outputId);

    if (!colorTex || !normalTex || !depthTex) {
      return;
    }

    // Update uniforms
    const uniforms = this.material.uniforms as unknown as RefractionUniforms;
    uniforms.tDiffuse.value = colorTex;
    uniforms.tNormal.value = normalTex;
    uniforms.tDepth.value = depthTex as unknown as THREE.DepthTexture;
    uniforms.resolution.value.set(size.width, size.height);
    uniforms.invProjMatrix.value.copy(camera.projectionMatrixInverse);
    uniforms.nearClip.value = camera.near;
    uniforms.farClip.value = camera.far;

    // Render
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }

  /** Set index of refraction */
  setIOR(value: number): void {
    (this.material.uniforms as unknown as RefractionUniforms).ior.value = value;
  }

  /** Set refraction strength */
  setStrength(value: number): void {
    (this.material.uniforms as unknown as RefractionUniforms).strength.value = value;
  }

  /** Set chromatic aberration */
  setChromaticAberration(value: number): void {
    (this.material.uniforms as unknown as RefractionUniforms).chromaticAberration.value = value;
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
