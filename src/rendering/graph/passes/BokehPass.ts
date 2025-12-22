/**
 * Bokeh Pass (Depth of Field)
 *
 * Render graph pass for depth-of-field blur effect.
 * Uses depth buffer to blur out-of-focus areas.
 *
 * @module rendering/graph/passes/BokehPass
 */

import * as THREE from 'three';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';
import { BokehShader, type BokehUniforms } from '@/rendering/shaders/postprocessing/BokehShader';

/**
 * Configuration for BokehPass.
 */
export interface BokehPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Scene color input resource */
  colorInput: string;
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

  /** Focus distance in world units */
  focus?: number;
  /** Focus range (depth of focus area) */
  focusRange?: number;
  /** Aperture size (affects blur intensity) */
  aperture?: number;
  /** Maximum blur amount */
  maxBlur?: number;
  /** Blur method: 0=disc, 1=jittered, 2=separable, 3=hexagonal */
  blurMethod?: number;
}

/**
 * Depth of field pass using bokeh blur.
 *
 * @example
 * ```typescript
 * const bokehPass = new BokehPass({
 *   id: 'bokeh',
 *   colorInput: 'sceneColor',
 *   depthInput: 'objectDepth',
 *   outputResource: 'bokehOutput',
 *   focus: 5,
 *   focusRange: 3,
 *   aperture: 0.025,
 * });
 * ```
 */
export class BokehPass extends BasePass {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  private colorInputId: string;
  private depthInputId: string;
  private depthInputAttachment?: number | 'depth';
  private alternateDepthInputId?: string;
  private alternateDepthInputAttachment?: number | 'depth';
  private depthInputSelector?: () => string;
  private outputId: string;

  // Current parameters
  private focus: number;
  private focusRange: number;
  private aperture: number;
  private maxBlur: number;
  private blurMethod: number;

  constructor(config: BokehPassConfig) {
    const inputs = [
      { resourceId: config.colorInput, access: 'read' as const },
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
      name: config.name ?? 'Bokeh Pass',
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    });

    this.colorInputId = config.colorInput;
    this.depthInputId = config.depthInput;
    this.depthInputAttachment = config.depthInputAttachment;
    this.alternateDepthInputId = config.alternateDepthInput;
    this.alternateDepthInputAttachment = config.alternateDepthInputAttachment;
    this.depthInputSelector = config.depthInputSelector;
    this.outputId = config.outputResource;

    this.focus = config.focus ?? 5;
    this.focusRange = config.focusRange ?? 3;
    this.aperture = config.aperture ?? 0.025;
    this.maxBlur = config.maxBlur ?? 0.02;
    this.blurMethod = config.blurMethod ?? 3;

    // Create material from BokehShader
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BokehShader.vertexShader,
      fragmentShader: BokehShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(BokehShader.uniforms),
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
    const { renderer, camera, size } = ctx;

    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId);
    const depthResourceId = this.depthInputSelector ? this.depthInputSelector() : this.depthInputId;
    const depthAttachment =
      depthResourceId === this.depthInputId
        ? this.depthInputAttachment
        : depthResourceId === this.alternateDepthInputId
          ? this.alternateDepthInputAttachment
          : undefined;
    const depthTex = ctx.getReadTexture(depthResourceId, depthAttachment);
    const outputTarget = ctx.getWriteTarget(this.outputId);

    if (!colorTex || !depthTex) {
      return;
    }

    // Update uniforms
    const uniforms = this.material.uniforms as unknown as BokehUniforms;
    uniforms.tDiffuse.value = colorTex;
    uniforms.tDepth.value = depthTex as unknown as THREE.DepthTexture;
    uniforms.focus.value = this.focus;
    uniforms.focusRange.value = this.focusRange;
    uniforms.aperture.value = this.aperture;
    uniforms.maxblur.value = this.maxBlur;
    uniforms.nearClip.value = camera.near;
    uniforms.farClip.value = camera.far;
    uniforms.aspect.value = size.height / size.width;
    uniforms.blurMethod.value = this.blurMethod;
    uniforms.time.value = ctx.time;

    // Render
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }

  /** Set focus distance */
  setFocus(value: number): void {
    this.focus = value;
  }

  /** Set focus range */
  setFocusRange(value: number): void {
    this.focusRange = value;
  }

  /** Set aperture */
  setAperture(value: number): void {
    this.aperture = value;
  }

  /** Set max blur */
  setMaxBlur(value: number): void {
    this.maxBlur = value;
  }

  /** Set blur method */
  setBlurMethod(value: number): void {
    this.blurMethod = value;
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
