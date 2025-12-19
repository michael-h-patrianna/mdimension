import { LIGHT_TYPE_TO_INT, MAX_LIGHTS, rotationToDirection } from '@/rendering/lights/types'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useLightingStore } from '@/stores/lightingStore'
import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { createVolumetricFogFragmentShader } from '../shaders/postprocessing/VolumetricFogShader'
import {
  collectShadowDataCached,
  createShadowMapUniforms,
  updateShadowMapUniforms,
} from '../shadows/uniforms'

/**
 * Composite Fragment Shader (GLSL ES 3.00)
 *
 * Upsamples half-resolution fog and blends with scene using bilateral filtering.
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

    vec2 uv00 = (base + vec2(0.5, 0.5)) / uFogResolution;
    vec2 uv10 = uv00 + vec2(fogTexel.x, 0.0);
    vec2 uv01 = uv00 + vec2(0.0, fogTexel.y);
    vec2 uv11 = uv00 + fogTexel;

    uv00 = clamp(uv00, vec2(0.0), vec2(1.0));
    uv10 = clamp(uv10, vec2(0.0), vec2(1.0));
    uv01 = clamp(uv01, vec2(0.0), vec2(1.0));
    uv11 = clamp(uv11, vec2(0.0), vec2(1.0));

    float centerDepth = linearizeDepth(texture(tDepth, uv).r);
    float depth00 = linearizeDepth(texture(tDepth, uv00).r);
    float depth10 = linearizeDepth(texture(tDepth, uv10).r);
    float depth01 = linearizeDepth(texture(tDepth, uv01).r);
    float depth11 = linearizeDepth(texture(tDepth, uv11).r);

    // Relaxed depth sharpness for softer fog edges (was 1.0)
    // Fog is naturally soft; high sharpness causes aliasing at depth discontinuities
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
    // Transmittance = 1.0 - fog.a

    vec3 finalColor = scene.rgb * (1.0 - fog.a) + fog.rgb;
    fragColor = vec4(finalColor, scene.a);
}
`

/**
 * Volumetric Fog Vertex Shader (GLSL ES 3.00)
 */
const fogVertexShader = /* glsl */ `
out vec2 vUv;
void main() {
    vUv = uv;
    // FullScreenQuad uses PlaneGeometry(2, 2), so vertices are already in [-1, 1] range
    // We strictly output NDC coordinates to cover the screen regardless of camera/DPR
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export class VolumetricFogPass extends Pass {
  private material: THREE.ShaderMaterial
  private compositeMaterial: THREE.ShaderMaterial
  private fsQuad: FullScreenQuad
  private halfResTarget: THREE.WebGLRenderTarget

  // Depth texture reference (set externally from PostProcessing)
  private depthTexture: THREE.DepthTexture | null = null

  // Reusable matrix to avoid per-frame allocation
  private viewProjMatrix = new THREE.Matrix4()

  constructor(noiseTexture: THREE.Texture, use3DNoise: boolean) {
    super()

    const shadowUniforms = createShadowMapUniforms()
    const lightTypes: number[] = new Array(MAX_LIGHTS).fill(0)
    const lightPositions: THREE.Vector3[] = []
    for (let i = 0; i < MAX_LIGHTS; i++) {
      lightPositions.push(new THREE.Vector3())
    }

    // Material for Raymarching (Volumetric Fog) - WebGL2/GLSL ES 3.00
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDepth: { value: null },
        tNoise: { value: noiseTexture },
        uCameraPosition: { value: new THREE.Vector3() },
        uInverseViewProj: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 1000.0 },

        // Fog Params
        uFogHeight: { value: 10.0 },
        uFogFalloff: { value: 0.1 },
        uFogDensity: { value: 0.02 },
        uFogColor: { value: new THREE.Color(0x000000) },
        uFogNoiseScale: { value: 0.1 },
        uFogNoiseSpeed: { value: new THREE.Vector3(0.1, 0.0, 0.1) },
        uFogScattering: { value: 0.0 },
        uVolumetricShadows: { value: true },

        // Light
        uLightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() },
        uLightColor: { value: new THREE.Color(1, 1, 1) },
        uLightIntensity: { value: 1.0 },
        uLightTypes: { value: lightTypes },
        uLightPositions: { value: lightPositions },
        uShadowLightIndex: { value: -1 },

        ...shadowUniforms,
      },
      vertexShader: fogVertexShader,
      fragmentShader: createVolumetricFogFragmentShader({ use3DNoise }),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NoBlending, // We render to offscreen target, manual blend later
    })

    // Material for Compositing (Upsample + Blend) - WebGL2/GLSL ES 3.00
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
    })

    this.fsQuad = new FullScreenQuad(this.material)

    // Internal Half-Res Target
    this.halfResTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType, // HDR support
      format: THREE.RGBAFormat,
    })
    this.halfResTarget.texture.name = 'VolumetricFogHalfRes'
  }

  /**
   * Set the depth texture from the scene render target.
   * Must be called before render() each frame.
   */
  public setDepthTexture(texture: THREE.DepthTexture | null): void {
    this.depthTexture = texture
  }

  public setSize(width: number, height: number) {
    // Render fog at 33% resolution (optimized from 50%)
    const w = Math.ceil(width * 0.33)
    const h = Math.ceil(height * 0.33)
    this.halfResTarget.setSize(w, h)

    // Update resolution uniform
    if (this.material.uniforms.uResolution) {
      this.material.uniforms.uResolution.value.set(w, h)
    }
    if (this.compositeMaterial.uniforms.uFogResolution) {
      this.compositeMaterial.uniforms.uFogResolution.value.set(w, h)
    }
  }

  public update(scene: THREE.Scene, camera: THREE.Camera, deltaTime: number) {
    const fogState = useEnvironmentStore.getState()
    const lightState = useLightingStore.getState()

    // Update Fog Uniforms
    if (this.material.uniforms.uFogHeight)
      this.material.uniforms.uFogHeight.value = fogState.fogHeight
    if (this.material.uniforms.uFogFalloff)
      this.material.uniforms.uFogFalloff.value = fogState.fogFalloff
    if (this.material.uniforms.uFogDensity)
      this.material.uniforms.uFogDensity.value = fogState.fogDensity
    if (this.material.uniforms.uFogColor)
      this.material.uniforms.uFogColor.value.set(fogState.fogColor)
    if (this.material.uniforms.uFogNoiseScale)
      this.material.uniforms.uFogNoiseScale.value = fogState.fogNoiseScale
    if (this.material.uniforms.uFogNoiseSpeed)
      this.material.uniforms.uFogNoiseSpeed.value.fromArray(fogState.fogNoiseSpeed)
    if (this.material.uniforms.uFogScattering)
      this.material.uniforms.uFogScattering.value = fogState.fogScattering
    if (this.material.uniforms.uVolumetricShadows)
      this.material.uniforms.uVolumetricShadows.value = fogState.volumetricShadows
    if (this.material.uniforms.uTime) this.material.uniforms.uTime.value += deltaTime

    // Camera Uniforms
    if (this.material.uniforms.uCameraPosition)
      this.material.uniforms.uCameraPosition.value.copy(camera.position)

    // Reuse matrix to avoid per-frame allocation
    this.viewProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    if (this.material.uniforms.uInverseViewProj)
      this.material.uniforms.uInverseViewProj.value.copy(this.viewProjMatrix.invert())

    // Camera clip planes
    const cameraNear = 'near' in camera ? (camera as THREE.PerspectiveCamera).near : 0.1
    const cameraFar = 'far' in camera ? (camera as THREE.PerspectiveCamera).far : 1000.0
    if (this.material.uniforms.uCameraNear) this.material.uniforms.uCameraNear.value = cameraNear
    if (this.material.uniforms.uCameraFar) this.material.uniforms.uCameraFar.value = cameraFar
    if (this.compositeMaterial.uniforms.uCameraNear)
      this.compositeMaterial.uniforms.uCameraNear.value = cameraNear
    if (this.compositeMaterial.uniforms.uCameraFar)
      this.compositeMaterial.uniforms.uCameraFar.value = cameraFar

    // Light Data (single directional for scattering, arrays for shadows)
    let directionalIndex = -1
    for (let i = 0; i < Math.min(lightState.lights.length, MAX_LIGHTS); i++) {
      const light = lightState.lights[i]
      if (!light) continue
      if (light.enabled && light.type === 'directional') {
        directionalIndex = i
        break
      }
    }

    const sun = directionalIndex >= 0 ? lightState.lights[directionalIndex] : undefined
    if (sun) {
      const lightDir = rotationToDirection(sun.rotation)
      if (this.material.uniforms.uLightDirection) {
        this.material.uniforms.uLightDirection.value.set(lightDir[0], lightDir[1], lightDir[2])
      }
      if (this.material.uniforms.uLightColor)
        this.material.uniforms.uLightColor.value.set(sun.color)
      if (this.material.uniforms.uLightIntensity)
        this.material.uniforms.uLightIntensity.value = sun.intensity
    }

    // Update light arrays used by shadow functions (types + positions)
    const lightTypes = this.material.uniforms.uLightTypes?.value as number[] | undefined
    const lightPositions = this.material.uniforms.uLightPositions?.value as
      | THREE.Vector3[]
      | undefined
    if (lightTypes && lightPositions) {
      for (let i = 0; i < MAX_LIGHTS; i++) {
        const light = lightState.lights[i]
        const lightPos = lightPositions[i]
        if (light && lightPos) {
          lightTypes[i] = LIGHT_TYPE_TO_INT[light.type]
          lightPos.set(light.position[0], light.position[1], light.position[2])
        } else if (lightPos) {
          lightTypes[i] = 0
          lightPos.set(0, 0, 0)
        }
      }
    }

    if (this.material.uniforms.uShadowLightIndex) {
      this.material.uniforms.uShadowLightIndex.value = directionalIndex
    }

    // Shadow Maps
    if (fogState.volumetricShadows) {
      const shadowData = collectShadowDataCached(scene, lightState.lights)
      updateShadowMapUniforms(this.material.uniforms, shadowData, lightState.shadowMapBias, 1024, 1)
    }
  }

  public render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime?: number,
    _stencilTest?: boolean
  ) {
    // 1. Render Volumetric Fog to Half-Res Target
    // -------------------------------------------

    // Bind Depth - use stored depth texture (set via setDepthTexture)
    if (this.material.uniforms.tDepth && this.depthTexture) {
      this.material.uniforms.tDepth.value = this.depthTexture
    }

    // Setup FSQuad for Fog
    this.fsQuad.material = this.material

    const currentRenderTarget = renderer.getRenderTarget()
    const currentAutoClear = renderer.autoClear

    renderer.setRenderTarget(this.halfResTarget)
    renderer.autoClear = true // Clear internal target
    renderer.clear()

    this.fsQuad.render(renderer)

    // 2. Composite (Upsample + Blend) to Output
    // -----------------------------------------

    if (this.compositeMaterial.uniforms.tScene)
      this.compositeMaterial.uniforms.tScene.value = readBuffer.texture
    if (this.compositeMaterial.uniforms.tFog)
      this.compositeMaterial.uniforms.tFog.value = this.halfResTarget.texture
    if (this.compositeMaterial.uniforms.tDepth && this.depthTexture) {
      this.compositeMaterial.uniforms.tDepth.value = this.depthTexture
    }

    this.fsQuad.material = this.compositeMaterial

    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    renderer.autoClear = false

    this.fsQuad.render(renderer)

    // Restore state
    renderer.setRenderTarget(currentRenderTarget)
    renderer.autoClear = currentAutoClear
  }

  public dispose() {
    this.material.dispose()
    this.compositeMaterial.dispose()
    this.halfResTarget.dispose()
    this.fsQuad.dispose()
  }
}
