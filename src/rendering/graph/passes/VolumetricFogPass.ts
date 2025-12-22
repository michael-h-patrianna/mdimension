/**
 * Volumetric Fog Pass (Render Graph)
 *
 * Wraps the existing VolumetricFogPass for integration with the RenderGraph system.
 * Provides atmospheric fog with light scattering, shadows, and 3D noise.
 *
 * @module rendering/graph/passes/VolumetricFogPass
 */

import * as THREE from 'three';

import { MAX_LIGHTS, LIGHT_TYPE_TO_INT, rotationToDirection } from '@/rendering/lights/types';
import { createVolumetricFogFragmentShader } from '@/rendering/shaders/postprocessing/VolumetricFogShader';
import {
  collectShadowDataCached,
  createShadowMapUniforms,
  updateShadowMapUniforms,
} from '@/rendering/shadows/uniforms';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useLightingStore } from '@/stores/lightingStore';
import { usePerformanceStore } from '@/stores/performanceStore';

import { BasePass } from '../BasePass';
import type { RenderContext, RenderPassConfig } from '../types';

/**
 * Configuration for VolumetricFogPass.
 */
export interface VolumetricFogPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string;
  /** Input depth resource */
  depthInput: string;
  /** Depth input attachment (for depth textures on render targets) */
  depthInputAttachment?: number | 'depth';
  /** Output resource */
  outputResource: string;
  /** Noise texture for fog animation */
  noiseTexture: THREE.Texture;
  /** Use 3D noise (true) or 2D noise fallback (false) */
  use3DNoise: boolean;
}

/**
 * Fog vertex shader (GLSL ES 3.00)
 */
const fogVertexShader = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Composite shader for upsampling and blending fog with scene (GLSL ES 3.00)
 */
const compositeFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tScene;
uniform sampler2D tFog;
uniform sampler2D tDepth;
uniform vec2 uFogResolution;
uniform float uCameraNear;
uniform float uCameraFar;

in vec2 vUv;
layout(location = 0) out vec4 fragColor;

float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}

vec4 sampleFogBilateral(vec2 uv) {
  vec2 fogTexel = 1.0 / uFogResolution;
  vec2 fogCoord = uv * uFogResolution - 0.5;
  vec2 base = floor(fogCoord);
  vec2 frac_coord = fogCoord - base;

  vec2 uv00 = clamp((base + vec2(0.5, 0.5)) / uFogResolution, vec2(0.0), vec2(1.0));
  vec2 uv10 = clamp(uv00 + vec2(fogTexel.x, 0.0), vec2(0.0), vec2(1.0));
  vec2 uv01 = clamp(uv00 + vec2(0.0, fogTexel.y), vec2(0.0), vec2(1.0));
  vec2 uv11 = clamp(uv00 + fogTexel, vec2(0.0), vec2(1.0));

  float centerDepth = linearizeDepth(texture(tDepth, uv).r);
  float depth00 = linearizeDepth(texture(tDepth, uv00).r);
  float depth10 = linearizeDepth(texture(tDepth, uv10).r);
  float depth01 = linearizeDepth(texture(tDepth, uv01).r);
  float depth11 = linearizeDepth(texture(tDepth, uv11).r);

  // Relaxed depth sharpness for softer fog edges
  float depthSharpness = 0.1;

  float w00 = (1.0 - frac_coord.x) * (1.0 - frac_coord.y) * exp(-abs(depth00 - centerDepth) * depthSharpness);
  float w10 = frac_coord.x * (1.0 - frac_coord.y) * exp(-abs(depth10 - centerDepth) * depthSharpness);
  float w01 = (1.0 - frac_coord.x) * frac_coord.y * exp(-abs(depth01 - centerDepth) * depthSharpness);
  float w11 = frac_coord.x * frac_coord.y * exp(-abs(depth11 - centerDepth) * depthSharpness);

  vec4 fog =
    texture(tFog, uv00) * w00 +
    texture(tFog, uv10) * w10 +
    texture(tFog, uv01) * w01 +
    texture(tFog, uv11) * w11;

  float totalWeight = w00 + w10 + w01 + w11;
  if (totalWeight > 0.0) {
    fog /= totalWeight;
  }

  return fog;
}

void main() {
  vec4 scene = texture(tScene, vUv);
  vec4 fog = sampleFogBilateral(vUv);

  // fog.a is (1.0 - transmittance)
  // fog.rgb is accumulated fog light
  // Final = Scene * Transmittance + Fog
  vec3 finalColor = scene.rgb * (1.0 - fog.a) + fog.rgb;
  fragColor = vec4(finalColor, scene.a);
}
`;

/**
 * Volumetric Fog pass for render graph.
 *
 * Renders half-resolution volumetric fog with light scattering
 * and composites it with the scene using bilateral upsampling.
 *
 * @example
 * ```typescript
 * const fogPass = new VolumetricFogPass({
 *   id: 'volumetricFog',
 *   colorInput: 'sceneColor',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'fogOutput',
 *   noiseTexture: noise3D,
 *   use3DNoise: true,
 * });
 * ```
 */
export class VolumetricFogPass extends BasePass {
  private material: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private halfResTarget: THREE.WebGLRenderTarget;

  private colorInputId: string;
  private depthInputId: string;
  private depthInputAttachment?: number | 'depth';
  private outputId: string;

  // Track size for dynamic scaling
  private fullWidth = 1;
  private fullHeight = 1;
  private currentFastMode = false;

  // Reusable matrix
  private viewProjMatrix = new THREE.Matrix4();

  // Light arrays
  private lightTypes: number[];
  private lightPositions: THREE.Vector3[];

  constructor(config: VolumetricFogPassConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Volumetric Fog Pass',
      inputs: [
        { resourceId: config.colorInput, access: 'read' },
        {
          resourceId: config.depthInput,
          access: 'read',
          attachment: config.depthInputAttachment,
        },
      ],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    });

    this.colorInputId = config.colorInput;
    this.depthInputId = config.depthInput;
    this.depthInputAttachment = config.depthInputAttachment;
    this.outputId = config.outputResource;

    // Initialize light arrays
    this.lightTypes = new Array(MAX_LIGHTS).fill(0);
    this.lightPositions = [];
    for (let i = 0; i < MAX_LIGHTS; i++) {
      this.lightPositions.push(new THREE.Vector3());
    }

    const shadowUniforms = createShadowMapUniforms();

    // Create fog material
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDepth: { value: null },
        tNoise: { value: config.noiseTexture },
        uCameraPosition: { value: new THREE.Vector3() },
        uInverseViewProj: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 1000.0 },

        // Fog params
        uFogHeight: { value: 10.0 },
        uFogFalloff: { value: 0.1 },
        uFogDensity: { value: 0.02 },
        uFogColor: { value: new THREE.Color(0x000000) },
        uFogNoiseScale: { value: 0.1 },
        uFogNoiseSpeed: { value: new THREE.Vector3(0.1, 0.0, 0.1) },
        uFogScattering: { value: 0.0 },
        uVolumetricShadows: { value: true },
        uFogFastMode: { value: false },

        // Light
        uLightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() },
        uLightColor: { value: new THREE.Color(1, 1, 1) },
        uLightIntensity: { value: 1.0 },
        uLightTypes: { value: this.lightTypes },
        uLightPositions: { value: this.lightPositions },
        uShadowLightIndex: { value: -1 },

        ...shadowUniforms,
      },
      vertexShader: fogVertexShader,
      fragmentShader: createVolumetricFogFragmentShader({ use3DNoise: config.use3DNoise }),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NoBlending,
    });

    // Create composite material
    this.compositeMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tScene: { value: null },
        tFog: { value: null },
        tDepth: { value: null },
        uFogResolution: { value: new THREE.Vector2(1, 1) },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 1000.0 },
      },
      vertexShader: fogVertexShader,
      fragmentShader: compositeFragmentShader,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NoBlending,
    });

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;

    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Half-res target for fog rendering
    this.halfResTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
    this.halfResTarget.texture.name = 'VolumetricFogHalfRes';
  }

  private applyResolution(): void {
    // Fast mode: 25% resolution, Normal: 33% resolution
    const scale = this.currentFastMode ? 0.25 : 0.33;
    const w = Math.ceil(this.fullWidth * scale);
    const h = Math.ceil(this.fullHeight * scale);
    this.halfResTarget.setSize(w, h);

    this.material.uniforms['uResolution']!.value.set(w, h);
    this.compositeMaterial.uniforms['uFogResolution']!.value.set(w, h);
  }

  execute(ctx: RenderContext): void {
    const { renderer, time, size, scene: mainScene, camera: mainCamera } = ctx;

    // Skip if size is invalid
    if (size.width < 1 || size.height < 1) {
      return;
    }

    // Update size tracking
    if (size.width !== this.fullWidth || size.height !== this.fullHeight) {
      this.fullWidth = size.width;
      this.fullHeight = size.height;
      this.applyResolution();
    }

    // Get store state
    const fogState = useEnvironmentStore.getState();
    const lightState = useLightingStore.getState();
    const perfState = usePerformanceStore.getState();

    // Fast mode handling
    const fastMode = perfState.isInteracting;
    if (fastMode !== this.currentFastMode) {
      this.currentFastMode = fastMode;
      this.applyResolution();
    }

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId);
    const depthTex = ctx.getReadTexture(this.depthInputId, this.depthInputAttachment);
    const outputTarget = ctx.getWriteTarget(this.outputId);

    if (!colorTex || !depthTex) {
      return;
    }

    // Update fog uniforms
    const u = this.material.uniforms;
    u['uFogFastMode']!.value = fastMode;
    u['tDepth']!.value = depthTex;
    u['uFogHeight']!.value = fogState.fogHeight;
    u['uFogFalloff']!.value = fogState.fogFalloff;
    u['uFogDensity']!.value = fogState.fogDensity;
    u['uFogColor']!.value.set(fogState.fogColor);
    u['uFogNoiseScale']!.value = fogState.fogNoiseScale;
    u['uFogNoiseSpeed']!.value.fromArray(fogState.fogNoiseSpeed);
    u['uFogScattering']!.value = fogState.fogScattering;
    u['uVolumetricShadows']!.value = fogState.volumetricShadows;
    u['uTime']!.value = time;

    // Camera uniforms
    u['uCameraPosition']!.value.copy(mainCamera.position);
    this.viewProjMatrix.multiplyMatrices(mainCamera.projectionMatrix, mainCamera.matrixWorldInverse);
    u['uInverseViewProj']!.value.copy(this.viewProjMatrix.invert());

    const cameraNear = 'near' in mainCamera ? (mainCamera as THREE.PerspectiveCamera).near : 0.1;
    const cameraFar = 'far' in mainCamera ? (mainCamera as THREE.PerspectiveCamera).far : 1000.0;
    u['uCameraNear']!.value = cameraNear;
    u['uCameraFar']!.value = cameraFar;
    this.compositeMaterial.uniforms['uCameraNear']!.value = cameraNear;
    this.compositeMaterial.uniforms['uCameraFar']!.value = cameraFar;

    // Light data
    let directionalIndex = -1;
    for (let i = 0; i < Math.min(lightState.lights.length, MAX_LIGHTS); i++) {
      const light = lightState.lights[i];
      if (light?.enabled && light.type === 'directional') {
        directionalIndex = i;
        break;
      }
    }

    const sun = directionalIndex >= 0 ? lightState.lights[directionalIndex] : undefined;
    if (sun) {
      const lightDir = rotationToDirection(sun.rotation);
      u['uLightDirection']!.value.set(lightDir[0], lightDir[1], lightDir[2]);
      u['uLightColor']!.value.set(sun.color);
      u['uLightIntensity']!.value = sun.intensity;
    }

    // Update light arrays
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = lightState.lights[i];
      if (light) {
        this.lightTypes[i] = LIGHT_TYPE_TO_INT[light.type];
        this.lightPositions[i]!.set(light.position[0], light.position[1], light.position[2]);
      } else {
        this.lightTypes[i] = 0;
        this.lightPositions[i]!.set(0, 0, 0);
      }
    }
    u['uShadowLightIndex']!.value = directionalIndex;

    // Shadow maps
    if (fogState.volumetricShadows) {
      const shadowData = collectShadowDataCached(mainScene, lightState.lights);
      updateShadowMapUniforms(u, shadowData, lightState.shadowMapBias, 1024, 1);
    }

    // 1. Render fog to half-res target
    this.mesh.material = this.material;
    renderer.setRenderTarget(this.halfResTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    // 2. Composite fog with scene
    this.compositeMaterial.uniforms['tScene']!.value = colorTex;
    this.compositeMaterial.uniforms['tFog']!.value = this.halfResTarget.texture;
    this.compositeMaterial.uniforms['tDepth']!.value = depthTex;

    this.mesh.material = this.compositeMaterial;
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.scene, this.camera);

    renderer.setRenderTarget(null);
  }

  /** Update noise texture */
  setNoiseTexture(texture: THREE.Texture): void {
    this.material.uniforms['tNoise']!.value = texture;
  }

  dispose(): void {
    this.material.dispose();
    this.compositeMaterial.dispose();
    this.mesh.geometry.dispose();
    this.halfResTarget.dispose();
  }
}
