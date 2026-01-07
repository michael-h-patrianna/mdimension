/**
 * GroundPlaneMaterialTSL - TSL Node Material for ground plane surfaces
 *
 * WebGPU-compatible material using Three.js TSL (Three Shading Language).
 * Uses MeshBasicNodeMaterial with custom full lighting pipeline.
 *
 * CRITICAL: Uses MeshBasicNodeMaterial (not MeshPhysicalNodeMaterial) because
 * we compute our own complete lighting in colorNode. MeshPhysicalNodeMaterial
 * would treat colorNode as albedo and apply its own PBR on top, causing
 * double-lighting or black output when scene lights aren't configured.
 *
 * Features (100% parity with WebGL GroundPlaneMaterial):
 * - Multi-light system (point, directional, spot) via custom TSL nodes
 * - Shadow maps (2D for directional/spot, packed cube for point lights)
 * - IBL (Image-Based Lighting) with PMREM textures via computeIBL
 * - PBR properties from pbrStore 'ground' config
 * - Grid overlay with distance fade
 */

import { blurToPCFSamples, collectShadowDataCached, SHADOW_MAP_SIZES } from '@/rendering/shadows/uniforms'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePBRStore } from '@/stores/pbrStore'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  abs,
  cameraPosition,
  color as tslColor,
  fwidth,
  float,
  Fn,
  int,
  max,
  mix,
  min,
  normalWorld,
  positionLocal,
  positionWorld,
  select,
  uniform,
  vec3,
  vec4,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

import { createLightTSLUniforms, updateLightTSLUniforms } from '../lighting/light-uniforms'
import { createMultiLightNode, computeAmbient } from '../lighting/mesh-lighting'
import { createIBLTSLUniforms, computeIBL } from '../lighting/ibl'
import { safeNormalize3, safeNormalizeUp } from '../utils/safe-math'
import {
  createShadowTSLUniforms,
  releasePlaceholder2D,
  releasePlaceholderRGBA,
  updateShadowTSLUniforms,
  type ShadowTSLUniforms,
} from '../shadows'

export interface GroundPlaneMaterialTSLProps {
  color: string
  opacity: number
  side?: THREE.Side
  showGrid?: boolean
  gridColor?: string
  sectionColor?: string
  gridSpacing?: number
  gridThickness?: number
  sectionThickness?: number
  gridFadeDistance?: number
  gridFadeStrength?: number
  ref?: Ref<THREE.Material>
}

/**
 * Grid line intensity - exact port of `getGrid()` from `shaders/groundplane/grid.glsl.ts`.
 *
 * Uses LOCAL XY coordinates (before model transform) for stable grid across wall orientations.
 */
const getGrid = Fn(([localXY, size, thickness]: [Node, Node, Node]) => {
  const r = localXY.div(size)

  // WebGL: vec2 fw = max(fwidth(r), vec2(0.0001));
  const fwRaw = fwidth(r)
  const fw = vec4(max(fwRaw.x, float(0.0001)), max(fwRaw.y, float(0.0001)), float(0), float(0)).xy

  // WebGL: vec2 grid = abs(fract(r - 0.5) - 0.5) / fw;
  const grid = r.sub(0.5).fract().sub(0.5).abs().div(fw)

  // WebGL: float line = min(grid.x, grid.y) + 1.0 - thickness;
  const line = min(grid.x, grid.y).add(1.0).sub(thickness)

  // WebGL: return 1.0 - min(line, 1.0);
  return float(1.0).sub(min(line, float(1.0)))
})

/**
 * Apply grid overlay - exact port of `applyGrid()` from `shaders/groundplane/grid.glsl.ts`.
 *
 * Ordering matches WebGL: apply grid AFTER lighting/IBL.
 */
const applyGrid = Fn(
  ([
    surfaceColor,
    localXY,
    worldPos,
    camPos,
    showGrid,
    gridColorIn,
    sectionColorIn,
    gridSpacing,
    sectionSpacing,
    gridThickness,
    sectionThickness,
    fadeDistance,
    fadeStrength,
  ]: [Node, Node, Node, Node, Node, Node, Node, Node, Node, Node, Node, Node, Node]) => {
    const g1 = getGrid(localXY, gridSpacing, gridThickness)
    const g2 = getGrid(localXY, sectionSpacing, sectionThickness)

    // Distance-based fade using world position (matches WebGL)
    const dist = worldPos.sub(camPos).length()
    const d = float(1.0).sub(min(dist.div(fadeDistance), float(1.0)))
    const dPow = d.pow(fadeStrength)

    // WebGL: vec3 color = mix(uGridColor, uSectionColor, min(1.0, uSectionThickness * g2));
    const sectionMix = min(float(1.0), sectionThickness.mul(g2))
    const lineColor = mix(gridColorIn, sectionColorIn, sectionMix)

    // WebGL: float alpha = (g1 + g2) * d; alpha = mix(0.75 * alpha, alpha, g2);
    const alpha = g1.add(g2).mul(dPow)
    const alphaFinal = mix(alpha.mul(0.75), alpha, g2)

    const gridApplied = mix(surfaceColor, lineColor, alphaFinal)
    return select(showGrid.greaterThan(0.5), gridApplied, surfaceColor)
  }
)

/**
 * TSL-based ground plane material for WebGPU.
 * Uses MeshBasicNodeMaterial with custom full lighting pipeline.
 */
export function GroundPlaneMaterialTSL({
  color,
  opacity,
  side = THREE.DoubleSide,
  showGrid = false,
  gridColor = '#3a3a3a',
  sectionColor = '#4a4a4a',
  gridSpacing = 1,
  gridThickness = 0.5,
  sectionThickness = 1.0,
  gridFadeDistance = 20,
  gridFadeStrength = 2,
  ref,
}: GroundPlaneMaterialTSLProps) {
  const materialRef = useRef<InstanceType<typeof MeshBasicNodeMaterial> | null>(null)

  // Track store versions for dirty-flag optimization
  const lastGroundVersionRef = useRef(-1)
  const lastPBRVersionRef = useRef(-1)
  const lastLightingVersionRef = useRef(-1)
  const lastIblVersionRef = useRef(-1)

  // Get scene for environment map access
  const { scene } = useThree()

  // Create lighting uniforms (multi-light system)
  const lightUniforms = useMemo(() => createLightTSLUniforms(), [])

  // Create IBL uniforms
  const iblUniforms = useMemo(() => createIBLTSLUniforms(), [])

  // Create shadow uniforms
  const shadowUniforms = useMemo<ShadowTSLUniforms>(() => createShadowTSLUniforms(), [])

  // Create uniforms - these are used both in the shader graph AND for runtime updates
  // TSL uniform() returns a node that has a .value property for runtime modification
  const groundPBR = usePBRStore.getState().ground
  const uniformRefs = useMemo(() => {
    const baseColor = new THREE.Color(color).convertSRGBToLinear()
    const gridCol = new THREE.Color(gridColor).convertSRGBToLinear()
    const sectionCol = new THREE.Color(sectionColor).convertSRGBToLinear()

    // Create uniform nodes - these have a .value property
    // CRITICAL (docs/tsl.md): uniform() must receive raw JS values or THREE objects,
    // NOT TSL nodes like float()/vec3()/color().
    const uBaseColor = uniform(baseColor)
    const uShowGrid = uniform(showGrid ? 1 : 0)
    const uGridColor = uniform(new THREE.Vector3(gridCol.r, gridCol.g, gridCol.b))
    const uSectionColor = uniform(new THREE.Vector3(sectionCol.r, sectionCol.g, sectionCol.b))
    const uGridSpacing = uniform(gridSpacing)
    const uSectionSpacing = uniform(gridSpacing * 5)
    const uGridThickness = uniform(gridThickness)
    const uSectionThickness = uniform(sectionThickness)
    const uGridFadeDistance = uniform(gridFadeDistance)
    const uGridFadeStrength = uniform(gridFadeStrength)
    // PBR uniforms from 'ground' config in pbrStore
    const uRoughness = uniform(groundPBR.roughness)
    const uMetalness = uniform(groundPBR.metallic)
    const uSpecularIntensity = uniform(groundPBR.specularIntensity)
    // Use Vector3 for specular color (TSL specularColorNode expects vec3, not Color)
    const specularCol = new THREE.Color(groundPBR.specularColor).convertSRGBToLinear()
    const uSpecularColor = uniform(new THREE.Vector3(specularCol.r, specularCol.g, specularCol.b))

    return {
      uBaseColor,
      uShowGrid,
      uGridColor,
      uSectionColor,
      uGridSpacing,
      uSectionSpacing,
      uGridThickness,
      uSectionThickness,
      uGridFadeDistance,
      uGridFadeStrength,
      uRoughness,
      uMetalness,
      uSpecularIntensity,
      uSpecularColor,
    }
    // Only create once - updates happen via .value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Create the material with the uniform nodes
  // CRITICAL: Use MeshBasicNodeMaterial (not MeshPhysicalNodeMaterial) because:
  // - We compute our own full lighting (ambient + multi-light + IBL + shadows)
  // - MeshPhysicalNodeMaterial would treat colorNode as albedo and apply its own PBR on top
  // - This matches MandelbulbMeshTSL and other raymarched TSL materials
  // Ground plane is always opaque (opacity=1 always passed from GroundPlane.tsx)
  const material = useMemo(() => {
    const mat = new MeshBasicNodeMaterial({
      side,
      transparent: false,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })

    // Create IBL sampling node
    const iblNode = computeIBL(iblUniforms)

    // Simple multi-light without shadows for debugging wall positions
    const colorWithLighting = Fn(() => {
      const worldPos = positionWorld
      const camPos = cameraPosition
      const N = normalWorld
      const V = safeNormalizeUp(camPos.sub(worldPos))
      const base = tslColor(uniformRefs.uBaseColor)
      const roughness = max(uniformRefs.uRoughness, float(0.04))
      const metallic = uniformRefs.uMetalness

      // PBR constants
      const PI = float(Math.PI)
      const F0 = vec3(0.04, 0.04, 0.04).mix(base, metallic)
      const NdotV = max(abs(N.dot(V)), float(0.001))

      const ambient = computeAmbient(
        base,
        vec3(lightUniforms.uAmbientColor),
        lightUniforms.uAmbientIntensity,
        metallic
      )

      // Inline multi-light loop (no shadows for now)
      const totalLight = vec3(0, 0, 0).toVar('totalLight')

      for (let i = 0; i < 4; i++) {
        const isInRange = int(i).lessThan(lightUniforms.uNumLights)
        const isEnabled = lightUniforms.uLightsEnabled.element(i).greaterThan(0.5)
        const isActive = isInRange.and(isEnabled)

        const lightPos = lightUniforms.uLightPositions.element(i)
        const lightDir = lightUniforms.uLightDirections.element(i)
        const lightColor = lightUniforms.uLightColors.element(i)
        const lightType = lightUniforms.uLightTypes.element(i)
        const lightIntensity = float(lightUniforms.uLightIntensities.element(i))

        const isDirectional = lightType.equal(1)

        // === DIRECTIONAL LIGHT WITH PBR ===
        const L_dir = safeNormalizeUp(vec3(lightDir).negate())
        const H_dir = safeNormalize3(L_dir.add(V), N)
        const NdotL_dir = max(abs(N.dot(L_dir)), float(0.001))
        const NdotH_dir = max(N.dot(H_dir), float(0.001))
        const HdotV_dir = max(H_dir.dot(V), float(0.001))

        // Fresnel (Schlick)
        const fresnel_dir = F0.add(vec3(1, 1, 1).sub(F0).mul(float(1).sub(HdotV_dir).pow(5)))

        // GGX Distribution
        const a_dir = roughness.mul(roughness)
        const a2_dir = a_dir.mul(a_dir)
        const NdotH2_dir = NdotH_dir.mul(NdotH_dir)
        const denom_dir = NdotH2_dir.mul(a2_dir.sub(1)).add(1)
        const D_dir = a2_dir.div(PI.mul(denom_dir).mul(denom_dir))

        // Geometry (Smith GGX)
        const k_dir = roughness.add(1).mul(roughness.add(1)).div(8)
        const G1_L_dir = NdotL_dir.div(NdotL_dir.mul(float(1).sub(k_dir)).add(k_dir))
        const G1_V_dir = NdotV.div(NdotV.mul(float(1).sub(k_dir)).add(k_dir))
        const G_dir = G1_L_dir.mul(G1_V_dir)

        // Specular BRDF
        const specular_dir = D_dir.mul(G_dir).mul(fresnel_dir).div(float(4).mul(NdotL_dir).mul(NdotV))

        // Diffuse (energy conserving)
        const kD_dir = vec3(1, 1, 1).sub(fresnel_dir).mul(float(1).sub(metallic))
        const diffuse_dir = kD_dir.mul(base).div(PI)

        const dirLight = diffuse_dir.add(specular_dir).mul(vec3(lightColor)).mul(lightIntensity).mul(NdotL_dir)

        // === POINT LIGHT WITH PBR ===
        const toLight = vec3(lightPos).sub(worldPos)
        const dist = toLight.length()
        const L_point = toLight.div(max(dist, float(0.001)))
        const H_point = safeNormalize3(L_point.add(V), N)
        const NdotL_point = max(abs(N.dot(L_point)), float(0.001))
        const NdotH_point = max(N.dot(H_point), float(0.001))
        const HdotV_point = max(H_point.dot(V), float(0.001))

        const fresnel_point = F0.add(vec3(1, 1, 1).sub(F0).mul(float(1).sub(HdotV_point).pow(5)))
        const NdotH2_point = NdotH_point.mul(NdotH_point)
        const denom_point = NdotH2_point.mul(a2_dir.sub(1)).add(1)
        const D_point = a2_dir.div(PI.mul(denom_point).mul(denom_point))
        const G1_L_point = NdotL_point.div(NdotL_point.mul(float(1).sub(k_dir)).add(k_dir))
        const G_point = G1_L_point.mul(G1_V_dir)
        const specular_point = D_point.mul(G_point).mul(fresnel_point).div(float(4).mul(NdotL_point).mul(NdotV))
        const kD_point = vec3(1, 1, 1).sub(fresnel_point).mul(float(1).sub(metallic))
        const diffuse_point = kD_point.mul(base).div(PI)
        const attenuation = float(1).div(dist.mul(dist).add(1))

        const pointLight = diffuse_point.add(specular_point).mul(vec3(lightColor)).mul(lightIntensity).mul(NdotL_point).mul(attenuation)

        const contrib = select(isDirectional, dirLight, pointLight)
        totalLight.addAssign(select(isActive, contrib, vec3(0, 0, 0)))
      }

      // WebGL parity: IBL is added after direct lighting.
      const ibl = iblNode(N, V, F0, roughness, metallic, base)
      const lit = ambient.add(totalLight).add(ibl)

      // WebGL parity: apply grid overlay AFTER lighting using LOCAL coords.
      const withGrid = applyGrid(
        lit,
        positionLocal.xy,
        worldPos,
        camPos,
        uniformRefs.uShowGrid,
        vec3(uniformRefs.uGridColor),
        vec3(uniformRefs.uSectionColor),
        uniformRefs.uGridSpacing,
        uniformRefs.uSectionSpacing,
        uniformRefs.uGridThickness,
        uniformRefs.uSectionThickness,
        uniformRefs.uGridFadeDistance,
        uniformRefs.uGridFadeStrength
      )

      return withGrid
    })

    mat.colorNode = colorWithLighting()

    return mat
  }, [uniformRefs, lightUniforms, shadowUniforms, iblUniforms, side, opacity])

  // Forward ref to parent
  useEffect(() => {
    if (ref && material) {
      if (typeof ref === 'function') {
        ref(material as unknown as THREE.Material)
      } else if (ref && typeof ref === 'object') {
        ;(ref as React.MutableRefObject<THREE.Material | null>).current = material as unknown as THREE.Material
      }
    }
  }, [ref, material])

  // Store material ref and cleanup on unmount
  useEffect(() => {
    materialRef.current = material
    return () => {
      try {
        material.dispose()
      } catch (e) {
        // TSL materials may have internal resources that are already disposed
        if (import.meta.env.DEV) {
          console.warn('[GroundPlaneMaterialTSL] Material dispose warning:', e)
        }
      }
      // Release shadow placeholder texture references
      releasePlaceholder2D()
      releasePlaceholderRGBA()
    }
  }, [material])

  // Update uniform values every frame
  // Note: TSL uniform values are accessed via .value at runtime
  // The types don't match perfectly, so we use 'as unknown as' casts
  useFrame(() => {
    if (!material) return

    // Get version counter from store
    const groundVersion = useEnvironmentStore.getState().groundVersion

    // Update base color via the uniform node's value
    const colorObj = new THREE.Color(color).convertSRGBToLinear()
    // Access the underlying value - TSL uniforms have a value property
    const baseColorValue = (uniformRefs.uBaseColor as unknown as { value: THREE.Color }).value
    if (baseColorValue && typeof baseColorValue.copy === 'function') {
      baseColorValue.copy(colorObj)
    }

    // Ground plane is always opaque (opacity=1 always) - no transparency handling needed

    // Update grid uniforms with dirty-flag optimization
    if (groundVersion !== lastGroundVersionRef.current) {
      // Cast and update each uniform's value
      ;(uniformRefs.uShowGrid as unknown as { value: number }).value = showGrid ? 1 : 0

      const gridCol = new THREE.Color(gridColor).convertSRGBToLinear()
      const gridVec = (uniformRefs.uGridColor as unknown as { value: THREE.Vector3 }).value
      if (gridVec && typeof gridVec.set === 'function') {
        gridVec.set(gridCol.r, gridCol.g, gridCol.b)
      }

      const sectionCol = new THREE.Color(sectionColor).convertSRGBToLinear()
      const sectionVec = (uniformRefs.uSectionColor as unknown as { value: THREE.Vector3 }).value
      if (sectionVec && typeof sectionVec.set === 'function') {
        sectionVec.set(sectionCol.r, sectionCol.g, sectionCol.b)
      }

      ;(uniformRefs.uGridSpacing as unknown as { value: number }).value = gridSpacing
      ;(uniformRefs.uSectionSpacing as unknown as { value: number }).value = gridSpacing * 5
      ;(uniformRefs.uGridThickness as unknown as { value: number }).value = gridThickness
      ;(uniformRefs.uSectionThickness as unknown as { value: number }).value = sectionThickness
      ;(uniformRefs.uGridFadeDistance as unknown as { value: number }).value = gridFadeDistance
      ;(uniformRefs.uGridFadeStrength as unknown as { value: number }).value = gridFadeStrength

      lastGroundVersionRef.current = groundVersion
    }

    // Update PBR uniforms from pbrStore ('ground' config)
    const pbrState = usePBRStore.getState()
    if (pbrState.pbrVersion !== lastPBRVersionRef.current) {
      const groundPBR = pbrState.ground

      // Update uniform node values - this is ALL that's needed for TSL
      // DO NOT set direct material properties or needsUpdate - that triggers shader recompilation!
      ;(uniformRefs.uRoughness as unknown as { value: number }).value = groundPBR.roughness
      ;(uniformRefs.uMetalness as unknown as { value: number }).value = groundPBR.metallic
      ;(uniformRefs.uSpecularIntensity as unknown as { value: number }).value = groundPBR.specularIntensity

      // Update specular color uniform value directly
      const specColor = new THREE.Color(groundPBR.specularColor).convertSRGBToLinear()
      const specularColorValue = (uniformRefs.uSpecularColor as unknown as { value: THREE.Vector3 }).value
      if (specularColorValue && typeof specularColorValue.set === 'function') {
        specularColorValue.set(specColor.r, specColor.g, specColor.b)
      }

      lastPBRVersionRef.current = pbrState.pbrVersion
    }

    // Update lighting uniforms from lightingStore
    const lightingState = useLightingStore.getState()
    if (lightingState.version !== lastLightingVersionRef.current) {
      // Update multi-light system uniforms
      updateLightTSLUniforms(lightUniforms, lightingState.lights)

      // Update ambient lighting
      const ambientColor = new THREE.Color(lightingState.ambientColor).convertSRGBToLinear()
      ;(lightUniforms.uAmbientColor as unknown as { value: THREE.Color }).value.copy(ambientColor)
      ;(lightUniforms.uAmbientIntensity as unknown as { value: number }).value = lightingState.ambientIntensity

      lastLightingVersionRef.current = lightingState.version
    }

    // Update shadow uniforms EVERY FRAME (shadow matrices change with camera/light movement)
    // This matches WebGL pattern: collectShadowDataCached + updateShadowMapUniforms
    if (lightingState.shadowEnabled) {
      const pcfSamples = blurToPCFSamples(lightingState.shadowMapBlur)
      const mapSize = SHADOW_MAP_SIZES[lightingState.shadowQuality]
      const shadowData = collectShadowDataCached(scene, lightingState.lights)
      updateShadowTSLUniforms(shadowUniforms, shadowData, lightingState.shadowMapBias, mapSize, pcfSamples)
    } else {
      // Shadows disabled: keep placeholder textures bound but disable via flags
      updateShadowTSLUniforms(shadowUniforms, [], 0.001, 1024, 1)
    }

    // Update IBL from environment (scene.environment contains PMREM texture)
    // IBL is now computed in our custom colorNode via iblNode, not by the material
    const iblVersion = useEnvironmentStore.getState().iblVersion
    if (iblVersion !== lastIblVersionRef.current) {
      const iblState = useEnvironmentStore.getState()
      const env = scene.environment

      // Check if environment is a valid PMREM texture
      const isPMREM = env && env.mapping === THREE.CubeUVReflectionMapping

      if (isPMREM) {
        // Update IBL uniforms for custom sampling
        ;(iblUniforms.uEnvMap as unknown as { value: THREE.Texture | null }).value = env
        ;(iblUniforms.uIBLIntensity as unknown as { value: number }).value = iblState.iblIntensity
        const qualityMap = { off: 0, low: 1, high: 2 } as const
        ;(iblUniforms.uIBLQuality as unknown as { value: number }).value = qualityMap[iblState.iblQuality]
      } else {
        // No valid PMREM, disable IBL
        ;(iblUniforms.uIBLQuality as unknown as { value: number }).value = 0
      }

      lastIblVersionRef.current = iblVersion
    }
  })

  return <primitive object={material} attach="material" />
}
