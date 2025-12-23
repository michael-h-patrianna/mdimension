/**
 * To Screen Pass
 *
 * Copies a texture to the screen (null render target).
 * Typically the final pass in a render graph.
 *
 * Features:
 * - Simple copy shader (no modifications)
 * - Gamma correction option
 * - Tone mapping option
 *
 * @module rendering/graph/passes/ToScreenPass
 */

import * as THREE from 'three';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for ToScreenPass.
 */
export interface ToScreenPassConfig extends Omit<RenderPassConfig, 'outputs'> {
  /** Apply gamma correction (sRGB output) */
  gammaCorrection?: boolean;

  /** Apply simple tone mapping */
  toneMapping?: boolean;

  /** Exposure for tone mapping */
  exposure?: number;
}

/**
 * Fragment shader for screen output.
 */
const FRAGMENT_SHADER = `
precision highp float;

in vec2 vUv;

uniform sampler2D uInput;
uniform bool uGammaCorrection;
uniform bool uToneMapping;
uniform float uExposure;

layout(location = 0) out vec4 fragColor;

// Simple Reinhard tone mapping
vec3 toneMap(vec3 color) {
  color *= uExposure;
  return color / (1.0 + color);
}

// Linear to sRGB
vec3 linearToSRGB(vec3 color) {
  return pow(color, vec3(1.0 / 2.2));
}

void main() {
  vec4 color = texture(uInput, vUv);

  if (uToneMapping) {
    color.rgb = toneMap(color.rgb);
  }

  if (uGammaCorrection) {
    color.rgb = linearToSRGB(color.rgb);
  }

  fragColor = color;
}
`;

/**
 * Vertex shader for fullscreen quad.
 * Note: With glslVersion: GLSL3, Three.js auto-injects attribute declarations
 * for position, uv, etc. We must NOT redeclare them.
 */
const VERTEX_SHADER = `
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Copies a texture to the screen.
 *
 * @example
 * ```typescript
 * const toScreen = new ToScreenPass({
 *   id: 'toScreen',
 *   inputs: [{ resourceId: 'finalColor', access: 'read' }],
 *   gammaCorrection: true,
 * });
 *
 * graph.addPass(toScreen);
 * ```
 */
export class ToScreenPass extends BasePass {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(config: ToScreenPassConfig) {
    super({
      ...config,
      outputs: [], // ToScreenPass writes to screen (null target)
    });

    // Create material
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uInput: { value: null },
        uGammaCorrection: { value: config.gammaCorrection ?? false },
        uToneMapping: { value: config.toneMapping ?? false },
        uExposure: { value: config.exposure ?? 1.0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;

    // Create dedicated scene and camera
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  execute(ctx: RenderContext): void {
    const { renderer } = ctx;

    // Get input texture
    const inputConfig = this.config.inputs[0];
    if (!inputConfig) {
      console.warn('ToScreenPass: No input configured');
      return;
    }

    const texture = ctx.getReadTexture(inputConfig.resourceId);
    // #region agent log
    console.log('[DEBUG:ToScreenPass] id=' + this.config.id + ' input=' + inputConfig.resourceId + ' hasTexture=' + !!texture);
    // #endregion
    this.material.uniforms['uInput']!.value = texture;

    // Render to screen
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }

  /**
   * Set gamma correction.
   */
  setGammaCorrection(enabled: boolean): void {
    this.material.uniforms['uGammaCorrection']!.value = enabled;
  }

  /**
   * Set tone mapping.
   */
  setToneMapping(enabled: boolean): void {
    this.material.uniforms['uToneMapping']!.value = enabled;
  }

  /**
   * Set exposure.
   */
  setExposure(exposure: number): void {
    this.material.uniforms['uExposure']!.value = exposure;
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
    // Remove mesh from scene to ensure proper cleanup
    this.scene.remove(this.mesh);
  }
}
