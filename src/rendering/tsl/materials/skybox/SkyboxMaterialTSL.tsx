/**
 * SkyboxMaterialTSL - Complete TSL Node Material for procedural skybox
 *
 * WebGPU-compatible material with all 7 procedural modes:
 * - Aurora: Flowing vertical curtains
 * - Nebula: Volumetric clouds
 * - Crystalline: Geometric voronoi patterns
 * - Horizon: Clean studio environment
 * - Ocean: Underwater atmosphere
 * - Twilight: Sunset/sunrise gradient
 * - Classic: Cube texture sampling (fallback gradient for TSL)
 */

import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useAnimationStore } from '@/stores/animationStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  float,
  Fn,
  positionWorld,
  uniform,
  vec2,
  vec4,
} from 'three/tsl'
import { useShallow } from 'zustand/react/shallow'
import {
  createAuroraMode,
  createCrystallineMode,
  createHorizonMode,
  createNebulaMode,
  createOceanMode,
  createTwilightMode,
  type SkyboxUniforms,
} from './SkyboxModesTSL'
import {
  applyDistortion,
  applySun,
  applyVignette,
} from './SkyboxUtilsTSL'

// Selectors for store subscriptions
const skyboxEnvSelector = (state: ReturnType<typeof useEnvironmentStore.getState>) => ({
  skyboxMode: state.skyboxMode,
  skyboxIntensity: state.skyboxIntensity,
  skyboxRotation: state.skyboxRotation,
  proceduralSettings: state.proceduralSettings,
  skyboxVersion: state.skyboxVersion,
})

const appearanceSelector = (state: ReturnType<typeof useAppearanceStore.getState>) => ({
  colorAlgorithm: state.colorAlgorithm,
  cosineCoefficients: state.cosineCoefficients,
  distribution: state.distribution,
  faceColor: state.faceColor,
  appearanceVersion: state.appearanceVersion,
})

/**
 * TSL-based Skybox Material for WebGPU.
 * Supports all 7 procedural modes with full feature parity.
 */
export function SkyboxMaterialTSL() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<InstanceType<typeof MeshBasicNodeMaterial> | null>(null)
  const timeRef = useRef(0)
  const opacityRef = useRef(0)
  const fadeStartTimeRef = useRef<number | null>(null)
  const FADE_DURATION = 0.5 // seconds

  // CRITICAL: Use callback ref to set layer IMMEDIATELY when mesh is created
  // This ensures the layer is set before any render pass happens
  // useEffect runs AFTER the mesh is added to scene, causing layer issues
  const setMeshRef = React.useCallback((mesh: THREE.Mesh | null) => {
    if (mesh) {
      mesh.layers.set(RENDER_LAYERS.SKYBOX)
      mesh.renderOrder = -1
    }
    ;(meshRef as React.MutableRefObject<THREE.Mesh | null>).current = mesh
  }, [])

  // Store subscriptions
  const envState = useEnvironmentStore(useShallow(skyboxEnvSelector))
  const appState = useAppearanceStore(useShallow(appearanceSelector))
  const isPlaying = useAnimationStore((state) => state.isPlaying)

  const {
    skyboxMode,
    skyboxIntensity,
    skyboxRotation,
    proceduralSettings,
  } = envState

  // Reusable objects for rotation calculation (avoid per-frame allocations)
  const eulerRef = useRef(new THREE.Euler())
  const matrix3Ref = useRef(new THREE.Matrix3())
  const matrix4Ref = useRef(new THREE.Matrix4())
  const baseRotY = skyboxRotation * (Math.PI / 180)

  const {
    cosineCoefficients,
  } = appState

  // Determine if using object sync
  const syncWithObject = skyboxMode !== 'classic' && proceduralSettings.syncWithObject

  // Get active coefficients
  const activeCoeffs = syncWithObject ? cosineCoefficients : proceduralSettings.cosineCoefficients

  // Track versions for dirty-flag optimization
  const lastVersionRef = useRef({ skybox: -1, appearance: -1 })

  // Create uniforms - CRITICAL: use raw THREE.js values, NOT TSL nodes
  // uniform() expects primitive JS values (numbers) or THREE objects (Vector3)
  // NOT TSL nodes like float() or vec3()
  const uniforms = useMemo(() => {
    return {
      uTime: uniform(0),
      uTimeScale: uniform(proceduralSettings.timeScale),
      uIntensity: uniform(skyboxIntensity),
      uScale: uniform(proceduralSettings.scale),
      uComplexity: uniform(proceduralSettings.complexity),
      uEvolution: uniform(proceduralSettings.evolution),
      uTurbulence: uniform(proceduralSettings.turbulence),
      uDistortion: uniform(proceduralSettings.turbulence),
      uVignette: uniform(0.15),
      uSunIntensity: uniform(proceduralSettings.sunIntensity),
      uSunPosition: uniform(new THREE.Vector3(...proceduralSettings.sunPosition)),
      uHue: uniform(proceduralSettings.hue ?? 0),
      uSaturation: uniform(proceduralSettings.saturation ?? 1),
      uColor1: uniform(new THREE.Vector3(0.5, 0.5, 0.5)),
      uColor2: uniform(new THREE.Vector3(0.8, 0.8, 0.8)),
      uPalA: uniform(new THREE.Vector3(...activeCoeffs.a)),
      uPalB: uniform(new THREE.Vector3(...activeCoeffs.b)),
      uPalC: uniform(new THREE.Vector3(...activeCoeffs.c)),
      uPalD: uniform(new THREE.Vector3(...activeCoeffs.d)),
      uUsePalette: uniform(1),
      // Aurora
      uAuroraCurtainHeight: uniform(proceduralSettings.aurora?.curtainHeight ?? 0.5),
      uAuroraWaveFrequency: uniform(proceduralSettings.aurora?.waveFrequency ?? 1.0),
      // Horizon
      uHorizonGradientContrast: uniform(proceduralSettings.horizonGradient?.gradientContrast ?? 0.5),
      uHorizonSpotlightFocus: uniform(proceduralSettings.horizonGradient?.spotlightFocus ?? 0.5),
      // Ocean
      uOceanCausticIntensity: uniform(proceduralSettings.ocean?.causticIntensity ?? 0.5),
      uOceanDepthGradient: uniform(proceduralSettings.ocean?.depthGradient ?? 0.5),
      uOceanBubbleDensity: uniform(proceduralSettings.ocean?.bubbleDensity ?? 0.3),
      uOceanSurfaceShimmer: uniform(proceduralSettings.ocean?.surfaceShimmer ?? 0.4),
      // Mode index
      uMode: uniform(0),
      // Rotation matrix (mat3 uniform)
      uRotation: uniform(new THREE.Matrix3()),
      // Opacity for fade-in (matches WebGL behavior)
      uOpacity: uniform(0),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Create mode functions with uniforms
  const modeFunctions = useMemo(() => ({
    aurora: createAuroraMode(uniforms as unknown as SkyboxUniforms),
    nebula: createNebulaMode(uniforms as unknown as SkyboxUniforms),
    crystalline: createCrystallineMode(uniforms as unknown as SkyboxUniforms),
    horizon: createHorizonMode(uniforms as unknown as SkyboxUniforms),
    ocean: createOceanMode(uniforms as unknown as SkyboxUniforms),
    twilight: createTwilightMode(uniforms as unknown as SkyboxUniforms),
  }), [uniforms])

  // Create the material with all procedural modes wired up
  const material = useMemo(() => {
    const mat = new MeshBasicNodeMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })

    // Full procedural skybox color node with mode selection
    const skyboxColor = Fn(() => {
      // Calculate world direction from position (like WebGL vertex shader)
      // For sphere geometry with BackSide, we want the inward-facing direction
      // positionWorld gives us the world-space position of the current vertex
      const rawDir = positionWorld.normalize()

      // Apply rotation matrix (uRotation is mat3)
      // CRITICAL: In WGSL/TSL, element(n) returns COLUMN n, not row n
      // For M * v with column-major storage: result = col0*v.x + col1*v.y + col2*v.z
      // The previous code used element(n).dot(rawDir) which computes M^T * v (wrong!)
      const rotatedDir = uniforms.uRotation.element(0).mul(rawDir.x)
        .add(uniforms.uRotation.element(1).mul(rawDir.y))
        .add(uniforms.uRotation.element(2).mul(rawDir.z))
        .normalize()

      // Get time with timeScale applied (like WebGL: float time = uTime * uTimeScale)
      const time = uniforms.uTime.mul(uniforms.uTimeScale)

      // Apply distortion effect (heatwave/turbulence) - matches WebGL main()
      const dir = applyDistortion(rotatedDir, time, uniforms.uDistortion)

      // Calculate screen UV for vignette effect
      // In WebGL: vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5
      // For sphere, approximate from direction
      const screenUV = vec2(
        dir.x.div(dir.z.abs().add(0.001)).mul(0.25).add(0.5),
        dir.y.mul(0.5).add(0.5)
      )

      // Mode selection based on uMode uniform
      // 0 = classic (gradient), 1 = aurora, 2 = nebula, 3 = crystalline,
      // 4 = horizon, 5 = ocean, 6 = twilight

      // Classic mode: simple cosine palette gradient
      const y = dir.y
      const t = y.mul(0.5).add(0.5).clamp(0, 1)
      const angle = uniforms.uPalC.mul(t).add(uniforms.uPalD).mul(6.28318)
      const classicColor = uniforms.uPalA.add(uniforms.uPalB.mul(angle.cos()))

      // Procedural modes
      const auroraColor = modeFunctions.aurora(dir, time)
      const nebulaColor = modeFunctions.nebula(dir, time)
      const crystallineColor = modeFunctions.crystalline(dir, time)
      const horizonColor = modeFunctions.horizon(dir, time)
      const oceanColor = modeFunctions.ocean(dir, time)
      const twilightColor = modeFunctions.twilight(dir, time)

      // Select color based on mode using nested select
      // Mode 6: twilight
      const mode6 = twilightColor
      // Mode 5: ocean
      const mode5 = uniforms.uMode.equal(5).select(oceanColor, mode6)
      // Mode 4: horizon
      const mode4 = uniforms.uMode.equal(4).select(horizonColor, mode5)
      // Mode 3: crystalline
      const mode3 = uniforms.uMode.equal(3).select(crystallineColor, mode4)
      // Mode 2: nebula
      const mode2 = uniforms.uMode.equal(2).select(nebulaColor, mode3)
      // Mode 1: aurora
      const mode1 = uniforms.uMode.equal(1).select(auroraColor, mode2)
      // Mode 0: classic
      let color = uniforms.uMode.equal(0).select(classicColor, mode1)

      // Apply intensity (matches WebGL: color * uIntensity in mode functions)
      color = color.mul(uniforms.uIntensity)

      // Apply post-processing effects (matches WebGL main() ordering)
      // 1. Sun glow effect
      color = applySun(color, dir, uniforms.uSunIntensity, uniforms.uSunPosition)
      // 2. Vignette effect
      color = applyVignette(color, screenUV, uniforms.uVignette)

      return vec4(color, float(1))
    })

    mat.colorNode = skyboxColor()

    return mat
  }, [uniforms, modeFunctions])

  // Layer setting is handled by setMeshRef callback (see above)
  // Using callback ref ensures layer is set BEFORE any render pass

  // Store material ref and cleanup on unmount
  useEffect(() => {
    materialRef.current = material
    return () => {
      try {
        material.dispose()
      } catch (e) {
        // TSL materials may have internal resources that are already disposed
        if (import.meta.env.DEV) {
          console.warn('[SkyboxMaterialTSL] Material dispose warning:', e)
        }
      }
    }
  }, [material])

  // Update uniforms every frame
  useFrame((state, delta) => {
    if (!material) return

    // Handle fade-in animation (matches WebGL SkyboxMesh behavior)
    if (fadeStartTimeRef.current === null) {
      fadeStartTimeRef.current = state.clock.elapsedTime
    }
    const elapsed = state.clock.elapsedTime - fadeStartTimeRef.current
    opacityRef.current = Math.min(1, elapsed / FADE_DURATION)

    // Animation time
    if (isPlaying) {
      const TIME_SCALE = 0.01
      timeRef.current += delta * TIME_SCALE
    }
    const t = timeRef.current

    // Update time uniform
    ;(uniforms.uTime as unknown as { value: number }).value = t

    // Get current intensity from store and apply opacity for fade-in
    const currentIntensity = useEnvironmentStore.getState().skyboxIntensity
    ;(uniforms.uIntensity as unknown as { value: number }).value = currentIntensity * opacityRef.current

    // Calculate rotation matrix (matches WebGL Skybox.tsx exactly)
    // Start with base rotation from settings
    const finalRotY = baseRotY

    // Note: Animation modes (cinematic, heatwave, etc.) would add rotation here
    // For parity, we use the same static rotation as WebGL
    eulerRef.current.set(0, finalRotY, 0)
    const rotationMatrix = matrix3Ref.current.setFromMatrix4(
      matrix4Ref.current.makeRotationFromEuler(eulerRef.current)
    )

    // Update rotation uniform
    ;(uniforms.uRotation as unknown as { value: THREE.Matrix3 }).value.copy(rotationMatrix)

    // Get version counters
    const skyboxVersion = useEnvironmentStore.getState().skyboxVersion
    const appearanceVersion = useAppearanceStore.getState().appearanceVersion

    const versionsChanged =
      skyboxVersion !== lastVersionRef.current.skybox ||
      appearanceVersion !== lastVersionRef.current.appearance

    if (versionsChanged) {
      // Get fresh state
      const envState = useEnvironmentStore.getState()
      const appState = useAppearanceStore.getState()
      const ps = envState.proceduralSettings

      // Update mode index
      let modeIndex = 0
      switch (envState.skyboxMode) {
        case 'procedural_aurora': modeIndex = 1; break
        case 'procedural_nebula': modeIndex = 2; break
        case 'procedural_crystalline': modeIndex = 3; break
        case 'procedural_horizon': modeIndex = 4; break
        case 'procedural_ocean': modeIndex = 5; break
        case 'procedural_twilight': modeIndex = 6; break
        default: modeIndex = 0
      }
      ;(uniforms.uMode as unknown as { value: number }).value = modeIndex

      // Update procedural settings
      ;(uniforms.uTimeScale as unknown as { value: number }).value = ps.timeScale
      ;(uniforms.uScale as unknown as { value: number }).value = ps.scale
      ;(uniforms.uComplexity as unknown as { value: number }).value = ps.complexity
      ;(uniforms.uEvolution as unknown as { value: number }).value = ps.evolution
      ;(uniforms.uTurbulence as unknown as { value: number }).value = ps.turbulence
      ;(uniforms.uDistortion as unknown as { value: number }).value = ps.turbulence
      ;(uniforms.uSunIntensity as unknown as { value: number }).value = ps.sunIntensity
      ;(uniforms.uHue as unknown as { value: number }).value = ps.hue ?? 0
      ;(uniforms.uSaturation as unknown as { value: number }).value = ps.saturation ?? 1

      // Update sun position
      const sunPos = (uniforms.uSunPosition as unknown as { value: THREE.Vector3 }).value
      sunPos.set(...ps.sunPosition)

      // Update colors
      const sync = envState.skyboxMode !== 'classic' && ps.syncWithObject
      const coeffs = sync ? appState.cosineCoefficients : ps.cosineCoefficients

      ;(uniforms.uPalA as unknown as { value: THREE.Vector3 }).value.set(...coeffs.a)
      ;(uniforms.uPalB as unknown as { value: THREE.Vector3 }).value.set(...coeffs.b)
      ;(uniforms.uPalC as unknown as { value: THREE.Vector3 }).value.set(...coeffs.c)
      ;(uniforms.uPalD as unknown as { value: THREE.Vector3 }).value.set(...coeffs.d)

      // Determine palette usage
      const useSimpleInterpolation = sync &&
        (appState.colorAlgorithm === 'monochromatic' || appState.colorAlgorithm === 'analogous')
      ;(uniforms.uUsePalette as unknown as { value: number }).value = useSimpleInterpolation ? 0 : 1

      // Aurora settings
      ;(uniforms.uAuroraCurtainHeight as unknown as { value: number }).value = ps.aurora?.curtainHeight ?? 0.5
      ;(uniforms.uAuroraWaveFrequency as unknown as { value: number }).value = ps.aurora?.waveFrequency ?? 1.0

      // Horizon settings
      ;(uniforms.uHorizonGradientContrast as unknown as { value: number }).value = ps.horizonGradient?.gradientContrast ?? 0.5
      ;(uniforms.uHorizonSpotlightFocus as unknown as { value: number }).value = ps.horizonGradient?.spotlightFocus ?? 0.5

      // Ocean settings
      ;(uniforms.uOceanCausticIntensity as unknown as { value: number }).value = ps.ocean?.causticIntensity ?? 0.5
      ;(uniforms.uOceanDepthGradient as unknown as { value: number }).value = ps.ocean?.depthGradient ?? 0.5
      ;(uniforms.uOceanBubbleDensity as unknown as { value: number }).value = ps.ocean?.bubbleDensity ?? 0.3
      ;(uniforms.uOceanSurfaceShimmer as unknown as { value: number }).value = ps.ocean?.surfaceShimmer ?? 0.4

      lastVersionRef.current = { skybox: skyboxVersion, appearance: appearanceVersion }
    }
  })

  return (
    <mesh ref={setMeshRef}>
      <sphereGeometry args={[200, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
