/**
 * useBlackHoleUniformUpdates Hook
 *
 * Updates black hole shader uniforms each frame. This hook reads from
 * various stores and updates the material uniforms accordingly.
 *
 * Extracted from BlackHoleMesh.tsx to reduce component complexity.
 */

import { composeRotations } from '@/lib/math/rotation'
import {
  createCachedLinearColor,
  createLightColorCache,
  updateLinearColorUniform,
} from '@/rendering/colors/linearCache'
// Note: Black hole is SDF-based like Mandelbulb, so it should use TemporalDepthManager
// (not TemporalCloudManager which is for volumetric clouds like Schrödinger).
// For now, temporal accumulation uniforms are not wired up - the black hole renders
// on MAIN_OBJECT layer without temporal reprojection.
import { type LightUniforms, updateLightUniforms } from '@/rendering/lights/uniforms'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useAnimationStore } from '@/stores/animationStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useUIStore } from '@/stores/uiStore'
import { useFrame, useThree } from '@react-three/fiber'
import React, { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

// DEBUG helper
const debugLog = (event: string, data?: Record<string, unknown>) => {
  if (typeof window !== 'undefined' && window.__DEBUG_LOG) {
    window.__DEBUG_LOG('BlackHoleUniforms', event, data)
  }
}
import {
  applyRotationInPlace,
  COLOR_ALGORITHM_MAP,
  createWorkingArrays,
  LIGHTING_MODE_MAP,
  MANIFOLD_TYPE_MAP,
  OPACITY_MODE_MAP,
  PALETTE_MODE_MAP,
  RAY_BENDING_MODE_MAP,
  type WorkingArrays,
} from './types'

/**
 * Create color cache for black hole specific colors
 * @returns Object containing cached linear colors
 */
function createBlackHoleColorCache() {
  return {
    baseColor: createCachedLinearColor(),
    shellGlowColor: createCachedLinearColor(),
    edgeGlowColor: createCachedLinearColor(),
    jetsColor: createCachedLinearColor(),
  }
}

/**
 * Configuration options for the black hole uniform updates hook
 */
interface UseBlackHoleUniformUpdatesOptions {
  /** Reference to the black hole mesh */
  meshRef: React.RefObject<THREE.Mesh | null>
}

/**
 * Helper to safely set a uniform value
 * @param uniforms - The uniforms record to update
 * @param name - The name of the uniform
 * @param value - The new value for the uniform
 */
function setUniform<T>(
  uniforms: Record<string, { value: unknown } | undefined>,
  name: string,
  value: T
): void {
  const u = uniforms[name]
  if (u) u.value = value
}

/**
 * Update black hole uniforms each frame
 *
 * This hook handles all per-frame uniform updates, including:
 * - Time and camera updates
 * - Rotation matrix calculations
 * - Black hole parameter synchronization
 * - Lighting updates
 * - Temporal accumulation setup
 *
 * @param options - Configuration options
 * @param options.meshRef - Reference to the black hole mesh
 */
export function useBlackHoleUniformUpdates({
  meshRef,
}: UseBlackHoleUniformUpdatesOptions) {
  const { camera, size, scene } = useThree()

  // Pre-allocated working arrays for rotation calculations
  const workingArraysRef = useRef<WorkingArrays>(createWorkingArrays())

  // Cached state for change detection
  const prevDimensionRef = useRef<number | null>(null)
  const prevParamValuesRef = useRef<number[] | null>(null)
  const prevLightingVersionRef = useRef<number | null>(null)

  // Fast mode tracking for adaptive quality during rotation/animation
  const prevRotationVersionRef = useRef<number>(-1)
  const fastModeRef = useRef(false)
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const QUALITY_RESTORE_DELAY_MS = 150

  // Cached linear colors (avoid sRGB->linear conversion every frame)
  const colorCacheRef = useRef(createBlackHoleColorCache())
  const lightColorCacheRef = useRef(createLightColorCache())

  // CRITICAL: Cache last valid env map to survive transient scene.background clears.
  // PostProcessing and ProceduralSkyboxCapture temporarily set scene.background = null
  // during their render passes, which would otherwise cause 1-frame lensing flicker.
  const lastValidEnvMapRef = useRef<THREE.Texture | null>(null)

  // Track if envMap was ever null, to detect transition from null → valid
  const envMapWasNullRef = useRef(true)

  // Track material to detect when TrackedShaderMaterial switches from placeholder to real shader.
  // When this happens, we need to force-sync all uniforms before the first render.
  const prevMaterialRef = useRef<THREE.ShaderMaterial | null>(null)

  // CRITICAL: Sync uniforms immediately on mount to prevent first-frame rendering issues.
  // Without this, the shader uses stale initial values until useFrame runs,
  // causing ray bending/lensing to not work on initial page load.
  useLayoutEffect(() => {
    if (!meshRef.current) return
    const material = meshRef.current.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) return

    const u = material.uniforms
    const bhState = useExtendedObjectStore.getState().blackhole

    // Sync critical ray bending uniforms from store
    setUniform(u, 'uHorizonRadius', bhState.horizonRadius)
    setUniform(u, 'uSpin', bhState.spin)
    setUniform(u, 'uDiskTemperature', bhState.diskTemperature)
    setUniform(u, 'uGravityStrength', bhState.gravityStrength)
    setUniform(u, 'uBendScale', bhState.bendScale)
    setUniform(u, 'uBendMaxPerStep', bhState.bendMaxPerStep)
    setUniform(u, 'uManifoldIntensity', bhState.manifoldIntensity)
    setUniform(u, 'uDiskInnerRadiusMul', bhState.diskInnerRadiusMul)
    setUniform(u, 'uDiskOuterRadiusMul', bhState.diskOuterRadiusMul)

    // CRITICAL: Sync farRadius - store default (35.0) differs from uniform default (20.0)
    // Without this, the bounding sphere is too small and edge rays miss it,
    // causing them to use unbent rayDir in the early-out path
    setUniform(u, 'uFarRadius', bhState.farRadius)

    // Sync camera uniforms
    if (u.uCameraPosition?.value) {
      ;(u.uCameraPosition.value as THREE.Vector3).copy(camera.position)
    }
    if (u.uViewMatrix?.value) {
      ;(u.uViewMatrix.value as THREE.Matrix4).copy(camera.matrixWorldInverse)
    }
    if (u.uProjectionMatrix?.value) {
      ;(u.uProjectionMatrix.value as THREE.Matrix4).copy(camera.projectionMatrix)
    }

    // Force material update
    material.needsUpdate = true
  }, [meshRef, camera])

  // CRITICAL: Use negative priority (-10) to ensure uniforms are updated BEFORE
  // PostProcessing's useFrame runs the volumetric render pass.
  useFrame(() => {
    if (!meshRef.current) {
      debugLog('useFrame: EARLY RETURN - meshRef is null')
      return
    }
    const material = meshRef.current.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) {
      debugLog('useFrame: EARLY RETURN - material or uniforms is null', {
        hasMaterial: !!material,
        hasUniforms: !!material?.uniforms,
        materialType: material?.type
      })
      return
    }

    // Uniforms with null-safe access pattern
    const u = material.uniforms

    // CRITICAL: Detect material change (placeholder → real shader) and force-sync critical uniforms.
    // TrackedShaderMaterial renders a placeholder for ~4 frames before switching to real shader.
    // The useLayoutEffect runs on mount but syncs to the placeholder, not the real shader.
    // Without this detection, the first render with real shader uses DEFAULT uniform values,
    // causing the bounding sphere to be wrong and rays to use unbent directions.
    const materialChanged = material !== prevMaterialRef.current
    if (materialChanged) {
      prevMaterialRef.current = material
      debugLog('useFrame: MATERIAL CHANGED - force-syncing uniforms', {
        materialType: material.type,
        hasFragmentShader: !!material.fragmentShader,
        fragmentShaderLength: material.fragmentShader?.length
      })

      // Force-sync all critical ray bending uniforms that affect bounding sphere and lensing
      const bhState = useExtendedObjectStore.getState().blackhole
      setUniform(u, 'uHorizonRadius', bhState.horizonRadius)
      setUniform(u, 'uFarRadius', bhState.farRadius)
      setUniform(u, 'uGravityStrength', bhState.gravityStrength)
      setUniform(u, 'uBendScale', bhState.bendScale)
      setUniform(u, 'uBendMaxPerStep', bhState.bendMaxPerStep)
      setUniform(u, 'uManifoldIntensity', bhState.manifoldIntensity)
      setUniform(u, 'uDiskInnerRadiusMul', bhState.diskInnerRadiusMul)
      setUniform(u, 'uDiskOuterRadiusMul', bhState.diskOuterRadiusMul)

      debugLog('useFrame: SYNCED critical uniforms', {
        uHorizonRadius: bhState.horizonRadius,
        uFarRadius: bhState.farRadius,
        boundingSphere: bhState.farRadius * bhState.horizonRadius
      })

      // Also check if scene.background is ready and sync envMap state
      const bg = scene.background as THREE.Texture | null
      const isCubeCompatible =
        bg &&
        ((bg as THREE.CubeTexture).isCubeTexture ||
          bg.mapping === THREE.CubeReflectionMapping ||
          bg.mapping === THREE.CubeRefractionMapping)
      if (isCubeCompatible) {
        lastValidEnvMapRef.current = bg
        setUniform(u, 'envMap', bg)
        setUniform(u, 'uEnvMapReady', 1.0)
        debugLog('useFrame: SYNCED envMap on material change', { envMapReady: 1.0 })
      } else {
        debugLog('useFrame: envMap NOT ready on material change', {
          'scene.background': bg ? 'SET' : 'NULL',
          mapping: (bg as THREE.Texture)?.mapping
        })
      }
    }

    // Configure material transparency and depth write based on opacity mode.
    // In solid mode, we write depth to allow proper occlusion.
    // In transparent modes, we disable depth write for correct blending.
    const opacitySettings = useUIStore.getState().opacitySettings
    const isTransparent = opacitySettings.mode !== 'solid'
    if (material.transparent !== isTransparent) {
      material.transparent = isTransparent
      material.depthWrite = !isTransparent
      material.needsUpdate = true
      debugLog('useFrame: opacity mode changed', {
        mode: opacitySettings.mode,
        transparent: isTransparent,
        depthWrite: !isTransparent,
      })
    }

    // CRITICAL: Update camera and resolution uniforms - required for ray reconstruction
    // Without these, raymarching fails with NaN values (division by zero)
    if (u.uCameraPosition?.value) {
      ;(u.uCameraPosition.value as THREE.Vector3).copy(camera.position)
    }
    if (u.uResolution?.value) {
      // Use logical viewport size - consistent with other raymarching shaders
      // Ray direction now calculated from vPosition, not screen coordinates
      const res = u.uResolution.value as THREE.Vector2
      res.set(size.width, size.height)
    }
    if (u.uViewMatrix?.value) {
      ;(u.uViewMatrix.value as THREE.Matrix4).copy(camera.matrixWorldInverse)
    }
    if (u.uProjectionMatrix?.value) {
      ;(u.uProjectionMatrix.value as THREE.Matrix4).copy(camera.projectionMatrix)
    }

    // Get current state from stores
    const geomState = useGeometryStore.getState()
    const { rotations, version: rotationVersion } = useRotationStore.getState()
    const animState = useAnimationStore.getState()

    // Adaptive quality: detect rotation changes and enable fast mode
    const rotationsChanged = rotationVersion !== prevRotationVersionRef.current
    if (rotationsChanged) {
      // Rotation is happening - switch to fast mode for better interactivity
      fastModeRef.current = true
      prevRotationVersionRef.current = rotationVersion

      // Clear any pending quality restore timeout
      if (restoreQualityTimeoutRef.current) {
        clearTimeout(restoreQualityTimeoutRef.current)
        restoreQualityTimeoutRef.current = null
      }
    } else if (fastModeRef.current) {
      // Rotation stopped - schedule quality restore after delay
      if (!restoreQualityTimeoutRef.current) {
        restoreQualityTimeoutRef.current = setTimeout(() => {
          fastModeRef.current = false
          restoreQualityTimeoutRef.current = null
        }, QUALITY_RESTORE_DELAY_MS)
      }
    }

    // Update fast mode uniform (only enable if performance setting allows it)
    const perfState = usePerformanceStore.getState()
    const fractalAnimLowQuality = perfState.fractalAnimationLowQuality
    setUniform(u, 'uFastMode', fractalAnimLowQuality && fastModeRef.current)
    setUniform(u, 'uQualityMultiplier', perfState.qualityMultiplier)
    const bhState = useExtendedObjectStore.getState().blackhole
    const appearanceState = useAppearanceStore.getState() // Global appearance
    const lightingState = useLightingStore.getState() // Global lighting
    const uiState = useUIStore.getState() // Global UI state
    const { lights, version: lightingVersion } = lightingState
    const cache = colorCacheRef.current

    // Visual scale: DON'T scale the mesh (causes clipping)
    // Instead, pass scale to shader where positions are scaled during SDF evaluation
    // This is the same approach used by Mandelbulb zoom
    const scale = bhState.scale
    setUniform(u, 'uScale', scale)

    // Update dimension
    const currentDimension = geomState.dimension
    setUniform(u, 'uDimension', currentDimension)

    // Update time using global synced time
    setUniform(u, 'uTime', animState.accumulatedTime)

    // Pre-calculate dimension scaling factor for lensing
    // Formula: pow(N, alpha) where N is dimension
    const dimPower = Math.pow(currentDimension, bhState.dimensionEmphasis)
    setUniform(u, 'uDimPower', dimPower)

    // Pre-calculate origin offset length squared (sum of param values squared)
    // This represents the constant distance from the 3D slice to the N-D origin.
    let originOffsetLengthSq = 0
    for (let i = 0; i < bhState.parameterValues.length; i++) {
      const val = bhState.parameterValues[i] ?? 0
      originOffsetLengthSq += val * val
    }
    setUniform(u, 'uOriginOffsetLengthSq', originOffsetLengthSq)

    // Update resolution

    // Update basis vectors if needed
    const currentParamValues = bhState.parameterValues

    if (
      prevDimensionRef.current !== currentDimension ||
      prevParamValuesRef.current !== currentParamValues
    ) {
      prevDimensionRef.current = currentDimension
      prevParamValuesRef.current = currentParamValues
    }

    // Update rotation matrix
    const rotation = composeRotations(currentDimension, rotations)

    // Update basis vectors
    const arrays = workingArraysRef.current

    // Initialize unit vectors
    arrays.unitX.fill(0)
    arrays.unitY.fill(0)
    arrays.unitZ.fill(0)
    arrays.origin.fill(0)

    arrays.unitX[0] = 1
    arrays.unitY[1] = 1
    arrays.unitZ[2] = 1

    // Set origin from parameter values
    for (let i = 0; i < currentParamValues.length && i < currentDimension - 3; i++) {
      arrays.origin[3 + i] = currentParamValues[i] ?? 0
    }

    // Apply rotation to basis vectors
    if (rotation) {
      applyRotationInPlace(rotation, arrays.unitX, arrays.rotatedX, currentDimension)
      applyRotationInPlace(rotation, arrays.unitY, arrays.rotatedY, currentDimension)
      applyRotationInPlace(rotation, arrays.unitZ, arrays.rotatedZ, currentDimension)
      applyRotationInPlace(rotation, arrays.origin, arrays.rotatedOrigin, currentDimension)
    }

    // Copy to uniforms (with null guards)
    if (u.uBasisX?.value) (u.uBasisX.value as Float32Array).set(arrays.rotatedX)
    if (u.uBasisY?.value) (u.uBasisY.value as Float32Array).set(arrays.rotatedY)
    if (u.uBasisZ?.value) (u.uBasisZ.value as Float32Array).set(arrays.rotatedZ)
    if (u.uOrigin?.value) (u.uOrigin.value as Float32Array).set(arrays.rotatedOrigin)

    // Update parameter values uniform
    if (u.uParamValues?.value) {
      const paramArray = u.uParamValues.value as Float32Array
      for (let i = 0; i < 8; i++) {
        paramArray[i] = currentParamValues[i] ?? 0
      }
    }

    // Update black hole uniforms (Kerr physics)
    setUniform(u, 'uHorizonRadius', bhState.horizonRadius)
    setUniform(u, 'uSpin', bhState.spin)
    setUniform(u, 'uDiskTemperature', bhState.diskTemperature)
    setUniform(u, 'uGravityStrength', bhState.gravityStrength)
    setUniform(u, 'uManifoldIntensity', bhState.manifoldIntensity)
    setUniform(u, 'uManifoldThickness', bhState.manifoldThickness)
    setUniform(u, 'uPhotonShellWidth', bhState.photonShellWidth)
    setUniform(u, 'uTimeScale', bhState.timeScale)
    setUniform(u, 'uBloomBoost', bhState.bloomBoost)

    // Update colors (with null guards) using Global Appearance Store
    if (u.uBaseColor?.value) {
      updateLinearColorUniform(
        cache.baseColor,
        u.uBaseColor.value as THREE.Color,
        appearanceState.faceColor
      )
    }
    if (u.uShellGlowColor?.value) {
      updateLinearColorUniform(
        cache.shellGlowColor,
        u.uShellGlowColor.value as THREE.Color,
        bhState.shellGlowColor
      )
    }
    if (u.uEdgeGlowColor?.value) {
      updateLinearColorUniform(
        cache.edgeGlowColor,
        u.uEdgeGlowColor.value as THREE.Color,
        bhState.edgeGlowColor
      )
    }
    if (u.uJetsColor?.value) {
      updateLinearColorUniform(
        cache.jetsColor,
        u.uJetsColor.value as THREE.Color,
        bhState.jetsColor
      )
    }

    // Sync Color Algorithm uniforms
    setUniform(u, 'uColorAlgorithm', COLOR_ALGORITHM_MAP[appearanceState.colorAlgorithm] ?? 0)
    if (u.uCosineA?.value) (u.uCosineA.value as THREE.Vector3).fromArray(appearanceState.cosineCoefficients.a)
    if (u.uCosineB?.value) (u.uCosineB.value as THREE.Vector3).fromArray(appearanceState.cosineCoefficients.b)
    if (u.uCosineC?.value) (u.uCosineC.value as THREE.Vector3).fromArray(appearanceState.cosineCoefficients.c)
    if (u.uCosineD?.value) (u.uCosineD.value as THREE.Vector3).fromArray(appearanceState.cosineCoefficients.d)
    setUniform(u, 'uLchLightness', appearanceState.lchLightness)
    setUniform(u, 'uLchChroma', appearanceState.lchChroma)

    // Palette mode (still supported for black hole specific modes)
    setUniform(u, 'uPaletteMode', PALETTE_MODE_MAP[bhState.paletteMode] ?? 0)

    // Sync Opacity uniforms
    const opacity = uiState.opacitySettings
    setUniform(u, 'uOpacityMode', OPACITY_MODE_MAP[opacity.mode] ?? 0)
    setUniform(u, 'uSimpleAlpha', opacity.simpleAlphaOpacity)
    setUniform(u, 'uLayerCount', opacity.layerCount)
    setUniform(u, 'uLayerOpacity', opacity.layerOpacity)
    setUniform(u, 'uVolumetricDensity', opacity.volumetricDensity)
    setUniform(u, 'uSampleQuality', opacity.sampleQuality === 'high' ? 2 : opacity.sampleQuality === 'low' ? 0 : 1)

    // Lensing
    setUniform(u, 'uDimensionEmphasis', bhState.dimensionEmphasis)
    setUniform(u, 'uDistanceFalloff', bhState.distanceFalloff)
    setUniform(u, 'uEpsilonMul', bhState.epsilonMul)
    setUniform(u, 'uBendScale', bhState.bendScale)
    setUniform(u, 'uBendMaxPerStep', bhState.bendMaxPerStep)
    setUniform(u, 'uLensingClamp', bhState.lensingClamp)
    setUniform(u, 'uRayBendingMode', RAY_BENDING_MODE_MAP[bhState.rayBendingMode] ?? 0)

    // Photon shell
    setUniform(u, 'uPhotonShellRadiusMul', bhState.photonShellRadiusMul)
    setUniform(u, 'uPhotonShellRadiusDimBias', bhState.photonShellRadiusDimBias)
    setUniform(u, 'uShellGlowStrength', bhState.shellGlowStrength)
    setUniform(u, 'uShellStepMul', bhState.shellStepMul)
    setUniform(u, 'uShellContrastBoost', bhState.shellContrastBoost)

    // Manifold
    setUniform(u, 'uManifoldType', MANIFOLD_TYPE_MAP[bhState.manifoldType] ?? 0)
    setUniform(u, 'uDensityFalloff', bhState.densityFalloff)
    setUniform(u, 'uDiskInnerRadiusMul', bhState.diskInnerRadiusMul)
    setUniform(u, 'uDiskOuterRadiusMul', bhState.diskOuterRadiusMul)
    setUniform(u, 'uRadialSoftnessMul', bhState.radialSoftnessMul)
    setUniform(u, 'uThicknessPerDimMax', bhState.thicknessPerDimMax)
    setUniform(u, 'uHighDimWScale', bhState.highDimWScale)
    setUniform(u, 'uSwirlAmount', bhState.swirlAmount)
    setUniform(u, 'uNoiseScale', bhState.noiseScale)
    setUniform(u, 'uNoiseAmount', bhState.noiseAmount)
    setUniform(u, 'uMultiIntersectionGain', bhState.multiIntersectionGain)

    // Rotation damping
    setUniform(u, 'uDampInnerMul', bhState.dampInnerMul)
    setUniform(u, 'uDampOuterMul', bhState.dampOuterMul)

    // Quality
    setUniform(u, 'uMaxSteps', bhState.maxSteps)
    setUniform(u, 'uStepBase', bhState.stepBase)
    setUniform(u, 'uStepMin', bhState.stepMin)
    setUniform(u, 'uStepMax', bhState.stepMax)
    setUniform(u, 'uStepAdaptG', bhState.stepAdaptG)
    setUniform(u, 'uStepAdaptR', bhState.stepAdaptR)
    setUniform(u, 'uEnableAbsorption', bhState.enableAbsorption)
    setUniform(u, 'uAbsorption', bhState.absorption)
    setUniform(u, 'uTransmittanceCutoff', bhState.transmittanceCutoff)
    setUniform(u, 'uFarRadius', bhState.farRadius)

    // Lighting (from Global Lighting Store)
    setUniform(u, 'uLightingMode', LIGHTING_MODE_MAP[bhState.lightingMode] ?? 0)
    setUniform(u, 'uRoughness', appearanceState.roughness)
    setUniform(u, 'uSpecular', lightingState.specularIntensity)
    setUniform(u, 'uAmbientTint', bhState.ambientTint)

    // Edge glow
    setUniform(u, 'uEdgeGlowEnabled', bhState.edgeGlowEnabled)
    setUniform(u, 'uEdgeGlowWidth', bhState.edgeGlowWidth)
    setUniform(u, 'uEdgeGlowIntensity', bhState.edgeGlowIntensity)

    // Update environment map from scene.background (set by general skybox system)
    // Note: PMREM textures are 2D textures with special mapping, NOT CubeTextures
    // Our shader uses samplerCube, so we need textures compatible with cube sampling
    // scene.background = may be:
    //   - CubeTexture (from KTX2 loader): has isCubeTexture === true
    //   - WebGLCubeRenderTarget.texture (from procedural capture): is Texture but with cube mapping
    //
    // CRITICAL: Use sticky fallback to survive transient scene.background clears.
    // PostProcessing clears scene.background during normal pass, then restores it.
    // Without this cache, black hole would see null and disable lensing for that frame.
    const bg = scene.background as THREE.Texture | null
    const isCubeCompatible =
      bg &&
      ((bg as THREE.CubeTexture).isCubeTexture ||
        bg.mapping === THREE.CubeReflectionMapping ||
        bg.mapping === THREE.CubeRefractionMapping)

    // Cache valid env maps so transient clears don't break lensing
    if (isCubeCompatible) {
      lastValidEnvMapRef.current = bg
    }

    // Use cached env map if current background is invalid but we have a cached one
    const envMapToUse = isCubeCompatible ? bg : lastValidEnvMapRef.current

    // DEBUG: Log envMap state every frame (limit to first 30 frames)
    const globalFrame = typeof window !== 'undefined' ? window.__DEBUG_FRAME || 0 : 0
    if (globalFrame <= 30) {
      debugLog('useFrame: envMap state', {
        'scene.background': bg ? 'SET' : 'NULL',
        'bg.mapping': bg?.mapping,
        isCubeCompatible,
        hasCachedEnvMap: !!lastValidEnvMapRef.current,
        envMapToUse: envMapToUse ? 'AVAILABLE' : 'NULL',
        uEnvMapReady: envMapToUse ? 1.0 : 0.0
      })
    }

    if (envMapToUse) {
      setUniform(u, 'envMap', envMapToUse)
      setUniform(u, 'uEnvMapReady', 1.0)

      // CRITICAL: When envMap transitions from null to valid, THREE.js needs
      // material.needsUpdate = true to properly rebind the texture to the shader.
      // Without this, the shader may continue using a null/default texture.
      if (envMapWasNullRef.current) {
        envMapWasNullRef.current = false
        material.needsUpdate = true
        debugLog('useFrame: envMap transitioned null→valid, forced material.needsUpdate')
      }
    } else {
      // EnvMap not ready or skybox disabled - shader renders black background
      setUniform(u, 'uEnvMapReady', 0.0)
      envMapWasNullRef.current = true
    }

    // Doppler
    setUniform(u, 'uDopplerEnabled', bhState.dopplerEnabled)
    setUniform(u, 'uDopplerStrength', bhState.dopplerStrength)
    setUniform(u, 'uDopplerHueShift', bhState.dopplerHueShift)

    // Jets
    setUniform(u, 'uJetsEnabled', bhState.jetsEnabled)
    setUniform(u, 'uJetsHeight', bhState.jetsHeight)
    setUniform(u, 'uJetsWidth', bhState.jetsWidth)
    setUniform(u, 'uJetsIntensity', bhState.jetsIntensity)
    setUniform(u, 'uJetsFalloff', bhState.jetsFalloff)
    setUniform(u, 'uJetsNoiseAmount', bhState.jetsNoiseAmount)
    setUniform(u, 'uJetsPulsation', bhState.jetsPulsation)

    // Animation
    setUniform(u, 'uSwirlAnimationEnabled', bhState.swirlAnimationEnabled)
    setUniform(u, 'uSwirlAnimationSpeed', bhState.swirlAnimationSpeed)
    setUniform(u, 'uPulseEnabled', bhState.pulseEnabled)
    setUniform(u, 'uPulseSpeed', bhState.pulseSpeed)
    setUniform(u, 'uPulseAmount', bhState.pulseAmount)

    // Slice animation (for trueND mode)
    setUniform(u, 'uSliceSpeed', bhState.sliceSpeed)
    setUniform(u, 'uSliceAmplitude', bhState.sliceAmplitude)

    // Update lights
    if (prevLightingVersionRef.current !== lightingVersion) {
      updateLightUniforms(
        material.uniforms as unknown as LightUniforms,
        lights,
        lightColorCacheRef.current
      )
      prevLightingVersionRef.current = lightingVersion
    }

    // Temporal accumulation uniforms
    // Compute inverse view-projection matrix for ray reconstruction
    if (u.uInverseViewProjectionMatrix?.value) {
      const invVP = u.uInverseViewProjectionMatrix.value as THREE.Matrix4
      invVP.copy(camera.projectionMatrixInverse).premultiply(camera.matrixWorld)
    }

    // Note: Temporal accumulation uniforms (uBayerOffset, uFullResolution) are not wired up.
    // Black hole is SDF-based and should use TemporalDepthManager like Mandelbulb,
    // not TemporalCloudManager which is for volumetric clouds.
  }, -10) // Priority -10: before PostProcessing volumetric pass
}