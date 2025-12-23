/**
 * GroundPlaneMaterial - Custom PBR shader material for ground plane surfaces
 *
 * Uses the same GGX BRDF as other custom shaders for visual consistency.
 * Supports multi-light system, shadow maps, and IBL.
 */

import { createColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache'
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import {
  blurToPCFSamples,
  collectShadowDataFromScene,
  createShadowMapUniforms,
  SHADOW_MAP_SIZES,
  updateShadowMapUniforms,
} from '@/rendering/shadows'
import { UniformManager } from '@/rendering/uniforms/UniformManager'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useLightingStore } from '@/stores/lightingStore'
import { useFrame, useThree } from '@react-three/fiber'
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  composeGroundPlaneFragmentShader,
  composeGroundPlaneVertexShader,
} from '../shaders/groundplane/compose'

export interface GroundPlaneMaterialProps {
  color: string
  opacity: number
  side?: THREE.Side
  // Note: PBR properties (metallic, roughness, specularIntensity, specularColor)
  // are managed via UniformManager using 'pbr-ground' source
}

/**
 * Custom shader material for ground plane that matches GGX BRDF of other objects.
 */
export const GroundPlaneMaterial = forwardRef<THREE.ShaderMaterial, GroundPlaneMaterialProps>(
  function GroundPlaneMaterial({ color, opacity, side = THREE.DoubleSide }, ref) {
    const { scene } = useThree()
    const materialRef = useRef<THREE.ShaderMaterial>(null)
    const colorCacheRef = useRef(createColorCache())

    // Get shadow settings for shader compilation
    const shadowEnabled = useLightingStore((state) => state.shadowEnabled)

    // Compile shaders
    const { glsl: fragmentShader } = useMemo(
      () => composeGroundPlaneFragmentShader({ shadows: shadowEnabled, fog: false }),
      [shadowEnabled]
    )
    const vertexShader = useMemo(() => composeGroundPlaneVertexShader(), [])

    // Create uniforms
    const uniforms = useMemo(
      () => ({
        // Material properties
        uColor: { value: new THREE.Color(color).convertSRGBToLinear() },
        uOpacity: { value: opacity },

        // Lighting and PBR uniforms (via UniformManager)
        // PBR properties (uMetallic, uRoughness, uSpecularIntensity, uSpecularColor)
        // are provided by 'pbr-ground' source
        ...UniformManager.getCombinedUniforms(['lighting', 'pbr-ground']),

        // Shadow map uniforms
        ...createShadowMapUniforms(),

        // IBL uniforms
        uEnvMap: { value: null },
        uIBLIntensity: { value: 1.0 },
        uIBLQuality: { value: 0 },
      }),
      // Only recreate when shader config changes, not when prop values change
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [shadowEnabled]
    )

    // Forward ref
    useEffect(() => {
      if (ref && materialRef.current) {
        if (typeof ref === 'function') {
          ref(materialRef.current)
        } else {
          ref.current = materialRef.current
        }
      }
    }, [ref])

    // Update uniforms every frame
    useFrame((state) => {
      const material = materialRef.current
      if (!material?.uniforms) return

      const u = material.uniforms
      const cache = colorCacheRef.current
      const lightingState = useLightingStore.getState()

      // Update material properties
      // Note: PBR properties (uMetallic, uRoughness, uSpecularIntensity, uSpecularColor)
      // are applied via UniformManager using 'pbr-ground' source
      updateLinearColorUniform(cache.faceColor, u.uColor!.value as THREE.Color, color)
      u.uOpacity!.value = opacity

      // Update transparency
      const isTransparent = opacity < 1
      if (material.transparent !== isTransparent) {
        material.transparent = isTransparent
        material.depthWrite = !isTransparent
        material.needsUpdate = true
      }

      // Update multi-light system and PBR
      UniformManager.applyToMaterial(material, ['lighting', 'pbr-ground'])

      // Update shadow maps
      if (shadowEnabled && lightingState.shadowEnabled) {
        const shadowData = collectShadowDataFromScene(scene, lightingState.lights)
        const shadowQuality = lightingState.shadowQuality
        const shadowMapSize = SHADOW_MAP_SIZES[shadowQuality]
        const pcfSamples = blurToPCFSamples(lightingState.shadowMapBlur)
        updateShadowMapUniforms(
          u as Record<string, { value: unknown }>,
          shadowData,
          lightingState.shadowMapBias,
          shadowMapSize,
          pcfSamples
        )
      }

      // Update IBL
      const iblState = useEnvironmentStore.getState()
      const qualityMap = { off: 0, low: 1, high: 2 } as const
      u.uIBLQuality!.value = qualityMap[iblState.iblQuality]
      u.uIBLIntensity!.value = iblState.iblIntensity
      const bg = state.scene.background
      if (bg && (bg as THREE.CubeTexture).isCubeTexture) {
        u.uEnvMap!.value = bg
      }
    }, FRAME_PRIORITY.RENDERER_UNIFORMS)

    return (
      <shaderMaterial
        ref={materialRef}
        glslVersion={THREE.GLSL3}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={side}
        transparent={opacity < 1}
        depthWrite={opacity >= 1}
      />
    )
  }
)
