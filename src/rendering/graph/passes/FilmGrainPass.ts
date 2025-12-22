/**
 * Film Grain Pass (Render Graph)
 *
 * Adds cinematic film grain effect to the scene.
 * Uses GLSL ES 3.00 for WebGL2 compatibility.
 *
 * @module rendering/graph/passes/FilmGrainPass
 */

import * as THREE from 'three';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for FilmGrainPass.
 */
export interface FilmGrainPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string;
  /** Output resource */
  outputResource: string;
  /** Grain intensity (0.0 - 1.0, default: 0.35) */
  intensity?: number;
  /** Grain size (higher = coarser grain, default: 1.0) */
  grainSize?: number;
  /** Whether grain is colored (default: false) */
  colored?: boolean;
}

/**
 * Film grain shader (GLSL ES 3.00)
 */
const filmGrainShader = {
  vertexShader: /* glsl */ `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uGrainSize;
    uniform bool uColored;
    uniform vec2 uResolution;

    in vec2 vUv;
    layout(location = 0) out vec4 fragColor;

    // High-quality noise function
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    // Film grain noise
    float filmNoise(vec2 uv, float time) {
      // Temporal noise that changes each frame
      float t = fract(time * 10.0);
      vec2 p = floor(uv * uResolution / uGrainSize);
      return hash(p + t * 100.0);
    }

    void main() {
      vec4 color = texture(tDiffuse, vUv);

      // Generate grain noise
      float noise = filmNoise(vUv, uTime);

      // Map to centered range (-0.5 to 0.5)
      noise = noise - 0.5;

      if (uColored) {
        // Colored grain - different noise per channel
        float noiseR = filmNoise(vUv + vec2(0.0, 0.1), uTime);
        float noiseG = filmNoise(vUv + vec2(0.1, 0.0), uTime);
        float noiseB = filmNoise(vUv + vec2(0.1, 0.1), uTime);

        vec3 coloredNoise = vec3(noiseR, noiseG, noiseB) - 0.5;
        color.rgb += coloredNoise * uIntensity;
      } else {
        // Monochrome grain
        color.rgb += noise * uIntensity;
      }

      // Clamp to valid range
      color.rgb = clamp(color.rgb, 0.0, 1.0);

      fragColor = color;
    }
  `,
};

/**
 * Film grain pass for render graph.
 *
 * Applies cinematic film grain effect using temporal noise.
 * The grain updates every frame to simulate analog film look.
 *
 * @example
 * ```typescript
 * const filmGrain = new FilmGrainPass({
 *   id: 'filmGrain',
 *   colorInput: 'sceneColor',
 *   outputResource: 'grainedColor',
 *   intensity: 0.35,
 *   grainSize: 1.0,
 *   colored: false,
 * });
 * ```
 */
export class FilmGrainPass extends BasePass {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  private colorInputId: string;
  private outputId: string;

  constructor(config: FilmGrainPassConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Film Grain Pass',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    });

    this.colorInputId = config.colorInput;
    this.outputId = config.outputResource;

    // Create material
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: config.intensity ?? 0.35 },
        uGrainSize: { value: config.grainSize ?? 1.0 },
        uColored: { value: config.colored ?? false },
        uResolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: filmGrainShader.vertexShader,
      fragmentShader: filmGrainShader.fragmentShader,
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
    const { renderer, time, size } = ctx;

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId);
    const outputTarget = ctx.getWriteTarget(this.outputId);

    if (!colorTex) {
      return;
    }

    // Update uniforms
    this.material.uniforms['tDiffuse']!.value = colorTex;
    this.material.uniforms['uTime']!.value = time;
    this.material.uniforms['uResolution']!.value.set(size.width, size.height);

    // Render
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }

  /** Set grain intensity (0.0 - 1.0) */
  setIntensity(intensity: number): void {
    this.material.uniforms['uIntensity']!.value = intensity;
  }

  /** Set grain size (higher = coarser) */
  setGrainSize(size: number): void {
    this.material.uniforms['uGrainSize']!.value = size;
  }

  /** Set whether grain is colored */
  setColored(colored: boolean): void {
    this.material.uniforms['uColored']!.value = colored;
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
