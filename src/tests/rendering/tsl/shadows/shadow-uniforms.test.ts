import * as THREE from 'three'

import { describe, expect, it } from 'vitest'

import type { ShadowLightData } from '@/rendering/shadows/uniforms'
import { createShadowTSLUniforms, updateShadowTSLUniforms } from '@/rendering/tsl/shadows'

function textureValue(node: unknown): THREE.Texture {
  return (node as { value: THREE.Texture }).value
}

describe('TSL shadow-uniforms', () => {
  it('updateShadowTSLUniforms keeps placeholders and disables flags when given no data (WebGL parity)', () => {
    const uniforms = createShadowTSLUniforms()

    // Provide no shadow data: should reset all slots to placeholders and castsShadow flags to 0
    updateShadowTSLUniforms(uniforms, [], 0.002, 2048, 2)

    expect(textureValue(uniforms.uShadowMap0)).toBeInstanceOf(THREE.Texture)
    expect(textureValue(uniforms.uPointShadowMap0)).toBeInstanceOf(THREE.Texture)

    expect(textureValue(uniforms.uShadowMap0)).toBe(uniforms.placeholder2DTexture)
    expect(textureValue(uniforms.uShadowMap1)).toBe(uniforms.placeholder2DTexture)
    expect(textureValue(uniforms.uShadowMap2)).toBe(uniforms.placeholder2DTexture)
    expect(textureValue(uniforms.uShadowMap3)).toBe(uniforms.placeholder2DTexture)

    expect(textureValue(uniforms.uPointShadowMap0)).toBe(uniforms.placeholderRGBATexture)
    expect(textureValue(uniforms.uPointShadowMap1)).toBe(uniforms.placeholderRGBATexture)
    expect(textureValue(uniforms.uPointShadowMap2)).toBe(uniforms.placeholderRGBATexture)
    expect(textureValue(uniforms.uPointShadowMap3)).toBe(uniforms.placeholderRGBATexture)

    expect(Array.from(uniforms.uLightCastsShadow.array)).toEqual([0, 0, 0, 0])

    // Global settings should update
    expect(uniforms.uShadowMapBias.value).toBe(0.002)
    expect(uniforms.uShadowMapSize.value).toBe(2048)
    expect(uniforms.uShadowPCFSamples.value).toBe(2)
  })

  it('updateShadowTSLUniforms uses real textures when present and still keeps non-used samplers on placeholders', () => {
    const uniforms = createShadowTSLUniforms()

    const directionalShadow = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    directionalShadow.needsUpdate = true

    const pointShadow = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    pointShadow.needsUpdate = true

    const shadowData: ShadowLightData[] = [
      {
        lightType: 1,
        shadowMap: directionalShadow,
        pointShadowMap: null,
        shadowMatrix: new THREE.Matrix4().makeTranslation(1, 2, 3),
        castsShadow: true,
        cameraNear: 0.5,
        cameraFar: 50,
      },
      {
        lightType: 0,
        shadowMap: null,
        pointShadowMap: pointShadow,
        shadowMatrix: new THREE.Matrix4().makeTranslation(4, 5, 6),
        castsShadow: true,
        cameraNear: 0.5,
        cameraFar: 100,
      },
    ]

    updateShadowTSLUniforms(uniforms, shadowData, 0.001, 1024, 1)

    // Slot 0 is directional: uses shadowMap, point map stays placeholder
    expect(textureValue(uniforms.uShadowMap0)).toBe(directionalShadow)
    expect(textureValue(uniforms.uPointShadowMap0)).toBe(uniforms.placeholderRGBATexture)

    // Slot 1 is point: 2D shadow map stays placeholder, point shadow map uses real
    expect(textureValue(uniforms.uShadowMap1)).toBe(uniforms.placeholder2DTexture)
    expect(textureValue(uniforms.uPointShadowMap1)).toBe(pointShadow)

    // Flags set for first two slots only
    expect(Array.from(uniforms.uLightCastsShadow.array)).toEqual([1, 1, 0, 0])

    // Camera far should track point light far (WebGL parity)
    expect(uniforms.uShadowCameraFar.value).toBe(100)
  })
})
