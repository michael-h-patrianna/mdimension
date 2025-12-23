/**
 * useBlackHoleUniformUpdates Hook
 *
 * Updates black hole shader uniforms each frame. This hook reads from
 * various stores and updates the material uniforms accordingly.
 *
 * Extracted from BlackHoleMesh.tsx to reduce component complexity.
 */

import { createCachedLinearColor, updateLinearColorUniform } from '@/rendering/colors/linearCache'
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { getLastFrameExternal } from '@/rendering/graph/lastFrameContext'
import { MAX_DIMENSION, useRotationUpdates } from '@/rendering/renderers/base'
import { UniformManager } from '@/rendering/uniforms/UniformManager'
import { applyScreenCoverageReduction, getScreenCoverage } from '@/rendering/utils/adaptiveQuality'
import { useAnimationStore } from '@/stores/animationStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
// Note: useLightingStore no longer imported - PBR handled via UniformManager 'pbr-face' source
import { useRotationStore } from '@/stores/rotationStore'
import { useUIStore } from '@/stores/uiStore'
import { useFrame, useThree } from '@react-three/fiber'
import React, { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  LIGHTING_MODE_MAP,
  MANIFOLD_TYPE_MAP,
  OPACITY_MODE_MAP,
  PALETTE_MODE_MAP,
  RAY_BENDING_MODE_MAP,
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
export function useBlackHoleUniformUpdates({ meshRef }: UseBlackHoleUniformUpdatesOptions) {
  const { camera, size } = useThree()

  // Subscribe to dimension and parameterValues for useRotationUpdates hook
  const dimension = useGeometryStore((state) => state.dimension)
  const parameterValues = useExtendedObjectStore((state) => state.blackhole.parameterValues)

  // Use shared rotation updates hook for basis vector computation
  const rotationUpdates = useRotationUpdates({ dimension, parameterValues })

  // Track rotation version changes for adaptive quality
  const prevRotationVersionRef = useRef<number>(-1)

  // Cached linear colors (avoid sRGB->linear conversion every frame)
  const colorCacheRef = useRef(createBlackHoleColorCache())

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
    setUniform(u, 'uVisualEventHorizon', bhState._visualEventHorizon)
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
      return
    }
    const material = meshRef.current.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) {
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

      // Force-sync all critical ray bending uniforms that affect bounding sphere and lensing
      const bhState = useExtendedObjectStore.getState().blackhole
      setUniform(u, 'uHorizonRadius', bhState.horizonRadius)
      setUniform(u, 'uVisualEventHorizon', bhState._visualEventHorizon)
      setUniform(u, 'uFarRadius', bhState.farRadius)
      setUniform(u, 'uGravityStrength', bhState.gravityStrength)
      setUniform(u, 'uBendScale', bhState.bendScale)
      setUniform(u, 'uBendMaxPerStep', bhState.bendMaxPerStep)
      setUniform(u, 'uManifoldIntensity', bhState.manifoldIntensity)
      setUniform(u, 'uDiskInnerRadiusMul', bhState.diskInnerRadiusMul)
      setUniform(u, 'uDiskOuterRadiusMul', bhState.diskOuterRadiusMul)

      // Also check if scene.background is ready and sync envMap state
      // Read from frozen frame context for frame-consistent state
      const bg = getLastFrameExternal('sceneBackground') as THREE.Texture | null
      const isCubeCompatible =
        bg &&
        ((bg as THREE.CubeTexture).isCubeTexture ||
          bg.mapping === THREE.CubeReflectionMapping ||
          bg.mapping === THREE.CubeRefractionMapping)
      if (isCubeCompatible) {
        setUniform(u, 'envMap', bg)
        setUniform(u, 'uEnvMapReady', 1.0)
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

    // Update matrices from mesh transform (handles position/rotation/scale)
    // CRITICAL: Ensure matrixWorld is up-to-date before copying to avoid 1-frame lag
    meshRef.current.updateMatrixWorld()
    if (u.uModelMatrix?.value) {
      ;(u.uModelMatrix.value as THREE.Matrix4).copy(meshRef.current.matrixWorld)
    }
    if (u.uInverseModelMatrix?.value) {
      ;(u.uInverseModelMatrix.value as THREE.Matrix4).copy(meshRef.current.matrixWorld).invert()
    }

    // Get current state from stores
    const animState = useAnimationStore.getState()

    // Get black hole state for coverage and temporal calculations
    const bhState = useExtendedObjectStore.getState().blackhole

    // Calculate actual black hole visual radius for accurate coverage estimation
    // The visual extent is farRadius * horizonRadius, scaled by mesh scale
    const blackHoleVisualRadius = bhState.farRadius * bhState.horizonRadius * bhState.scale

    // Calculate screen coverage for temporal and quality decisions
    const coverage =
      camera instanceof THREE.PerspectiveCamera
        ? getScreenCoverage(camera, blackHoleVisualRadius)
        : 0.5

    // Quality reduction for black hole raymarching
    // Combine UniformManager's quality (performance-based) with coverage-based reduction
    // Also enforce higher floor (0.5) than other objects since black hole needs more steps
    const coverageQuality = applyScreenCoverageReduction(1.0, coverage)
    
    // Apply centralized uniform sources
    // Note: 'quality' source updates uFastMode and uQualityMultiplier based on performance/rotation
    // We override uQualityMultiplier below to include coverage scaling
    // Note: 'pbr-face' provides uRoughness, uMetallic, uSpecularIntensity, uSpecularColor
    UniformManager.applyToMaterial(material, ['lighting', 'quality', 'color', 'pbr-face'])

    // Override quality multiplier to include coverage-based reduction
    // This composes with the base quality from UniformManager
    if (u.uQualityMultiplier) {
      const baseQuality = u.uQualityMultiplier.value as number
      const effectiveQuality = Math.max(baseQuality * coverageQuality, 0.5)
      u.uQualityMultiplier.value = effectiveQuality
    }

    // NOTE: Temporal accumulation is intentionally disabled for black hole.
    // The full-screen reconstruction pass (3×3 neighborhood) is too expensive
    // and negates the quarter-res rendering savings. Black hole stays on
    // MAIN_OBJECT layer and benefits from adaptive quality (step reduction) instead.
    // Note: lightingState no longer needed here - specular now via 'pbr-face' source
    const uiState = useUIStore.getState() // Global UI state
    const cache = colorCacheRef.current

    // Visual scale: Handled by mesh.scale now
    // setUniform(u, 'uScale', scale)

    // Update dimension (from subscribed value at top of hook)
    setUniform(u, 'uDimension', dimension)

    // Update time using global synced time
    setUniform(u, 'uTime', animState.accumulatedTime)

    // Pre-calculate dimension scaling factor for lensing
    // Formula: pow(N, alpha) where N is dimension
    const dimPower = Math.pow(dimension, bhState.dimensionEmphasis)
    setUniform(u, 'uDimPower', dimPower)

    // Pre-calculate origin offset length squared (sum of param values squared)
    // This represents the constant distance from the 3D slice to the N-D origin.
    let originOffsetLengthSq = 0
    for (let i = 0; i < bhState.parameterValues.length; i++) {
      const val = bhState.parameterValues[i] ?? 0
      originOffsetLengthSq += val * val
    }
    setUniform(u, 'uOriginOffsetLengthSq', originOffsetLengthSq)

    // ============================================
    // D-dimensional Rotation & Basis Vectors (via shared hook)
    // Only recomputes when rotations, dimension, or params change
    // ============================================
    // Note: rotationUpdates.getBasisVectors now accepts a boolean directly
    // We can use the UniformManager's QualitySource to check for rotation changes if we wanted,
    // but the hook uses internal state. The hook needs to know if rotations changed.
    // We can re-derive it or pass true if we want always update?
    // Actually useRotationUpdates manages 'changed' internally based on prev version.
    // We just need to pass the current boolean trigger if we have one, or just call it?
    // The hook signature is `getBasisVectors(rotationsChanged: boolean)`.
    // We need to know if rotations changed.
    // Use RotationStore directly for this specific check, similar to how QualitySource does it.
    const rotationVersion = useRotationStore.getState().version
    // We can use a ref to track local change detection for this hook call
    // or just let useRotationUpdates handle it if it could... but it takes the boolean.
    // Let's keep the rotation version tracking here for the hook input.
    const rotationsChanged = rotationVersion !== prevRotationVersionRef.current
    if (rotationsChanged) {
        prevRotationVersionRef.current = rotationVersion
    }

    const {
      basisX,
      basisY,
      basisZ,
      changed: basisChanged,
    } = rotationUpdates.getBasisVectors(rotationsChanged)

    // Copy basis vectors to uniforms (with null guards)
    if (basisChanged) {
      if (u.uBasisX?.value) (u.uBasisX.value as Float32Array).set(basisX)
      if (u.uBasisY?.value) (u.uBasisY.value as Float32Array).set(basisY)
      if (u.uBasisZ?.value) (u.uBasisZ.value as Float32Array).set(basisZ)
    }

    // ============================================
    // Origin Update (separate from basis vectors)
    // ============================================
    // Build origin values array for rotation
    const originValues = new Array(MAX_DIMENSION).fill(0)
    const currentParamValues = bhState.parameterValues
    for (let i = 3; i < dimension; i++) {
      originValues[i] = currentParamValues[i - 3] ?? 0
    }
    const { origin } = rotationUpdates.getOrigin(originValues)
    if (u.uOrigin?.value) (u.uOrigin.value as Float32Array).set(origin)

    // Update parameter values uniform
    if (u.uParamValues?.value) {
      const paramArray = u.uParamValues.value as Float32Array
      for (let i = 0; i < 8; i++) {
        paramArray[i] = currentParamValues[i] ?? 0
      }
    }

    // Update black hole uniforms (Kerr physics)
    setUniform(u, 'uHorizonRadius', bhState.horizonRadius)
    setUniform(u, 'uVisualEventHorizon', bhState._visualEventHorizon)
    setUniform(u, 'uSpin', bhState.spin)
    setUniform(u, 'uDiskTemperature', bhState.diskTemperature)
    setUniform(u, 'uGravityStrength', bhState.gravityStrength)
    setUniform(u, 'uManifoldIntensity', bhState.manifoldIntensity)
    setUniform(u, 'uManifoldThickness', bhState.manifoldThickness)
    setUniform(u, 'uPhotonShellWidth', bhState.photonShellWidth)
    setUniform(u, 'uTimeScale', bhState.timeScale)
    setUniform(u, 'uBloomBoost', bhState.bloomBoost)

    // Update colors (with null guards) using Global Appearance Store
    // Note: ColorSource handles algorithm uniforms, but these are material-specific colors
    const appearanceState = useAppearanceStore.getState()
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

    // Palette mode (still supported for black hole specific modes)
    setUniform(u, 'uPaletteMode', PALETTE_MODE_MAP[bhState.paletteMode] ?? 0)

    // Sync Opacity uniforms
    const opacity = uiState.opacitySettings
    setUniform(u, 'uOpacityMode', OPACITY_MODE_MAP[opacity.mode] ?? 0)
    setUniform(u, 'uSimpleAlpha', opacity.simpleAlphaOpacity)
    setUniform(u, 'uLayerCount', opacity.layerCount)
    setUniform(u, 'uLayerOpacity', opacity.layerOpacity)
    setUniform(u, 'uVolumetricDensity', opacity.volumetricDensity)
    setUniform(
      u,
      'uSampleQuality',
      opacity.sampleQuality === 'high' ? 2 : opacity.sampleQuality === 'low' ? 0 : 1
    )

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
    // Note: uRoughness and uSpecular (specularIntensity) are now provided by 'pbr-face' source
    // via UniformManager.applyToMaterial above
    setUniform(u, 'uLightingMode', LIGHTING_MODE_MAP[bhState.lightingMode] ?? 0)
    setUniform(u, 'uAmbientTint', bhState.ambientTint)

    // Edge glow
    setUniform(u, 'uEdgeGlowEnabled', bhState.edgeGlowEnabled)
    setUniform(u, 'uEdgeGlowWidth', bhState.edgeGlowWidth)
    setUniform(u, 'uEdgeGlowIntensity', bhState.edgeGlowIntensity)

    // ========================================================================
    // Environment Map Update (Frame-Consistent via ExternalBridge)
    // ========================================================================
    // scene.background is set by CubemapCapturePass via ExternalBridge at FRAME END.
    // This hook runs at FRAME START (priority -10), so it reads the PREVIOUS frame's
    // cubemap. This one-frame delay is intentional and provides frame consistency:
    //
    // Frame N: CubemapCapturePass captures cubemap, queues export
    // Frame N: executeExports() sets scene.background at frame END
    // Frame N+1: This hook reads scene.background at frame START (reads frame N's value)
    //
    // This architecture replaces the old lastValidEnvMapRef workaround. The combination of:
    // 1. TemporalResource (ensures cubemap is only exported when valid history exists)
    // 2. ExternalBridge (batches exports to frame end)
    // 3. StateBarrier (saves/restores scene state around each pass)
    // ...guarantees the black hole shader never reads from an uninitialized cubemap.
    //
    // Note: PMREM textures are 2D textures with special mapping, NOT CubeTextures.
    // Our shader uses samplerCube, so we need textures compatible with cube sampling.
    // scene.background may be:
    //   - CubeTexture (from KTX2 loader): has isCubeTexture === true
    //   - WebGLCubeRenderTarget.texture (from procedural capture): Texture with cube mapping
    // Read from frozen frame context for frame-consistent state (instead of live scene.background)
    const bg = getLastFrameExternal('sceneBackground') as THREE.Texture | null
    const isCubeCompatible =
      bg &&
      ((bg as THREE.CubeTexture).isCubeTexture ||
        bg.mapping === THREE.CubeReflectionMapping ||
        bg.mapping === THREE.CubeRefractionMapping)

    if (isCubeCompatible) {
      setUniform(u, 'envMap', bg)
      setUniform(u, 'uEnvMapReady', 1.0)
    } else {
      // EnvMap not ready or skybox disabled - shader renders black background
      setUniform(u, 'uEnvMapReady', 0.0)
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

    // Motion blur
    setUniform(u, 'uMotionBlurEnabled', bhState.motionBlurEnabled)
    setUniform(u, 'uMotionBlurStrength', bhState.motionBlurStrength)
    setUniform(u, 'uMotionBlurSamples', bhState.motionBlurSamples)
    setUniform(u, 'uMotionBlurRadialFalloff', bhState.motionBlurRadialFalloff)

    // Slice animation (for trueND mode)
    setUniform(u, 'uSliceSpeed', bhState.sliceSpeed)
    setUniform(u, 'uSliceAmplitude', bhState.sliceAmplitude)

    // Note: Lighting and PBR uniforms already applied at line ~301 via UniformManager
    // ['lighting', 'quality', 'color', 'pbr-face']

    // Temporal accumulation uniforms
    // Compute inverse view-projection matrix for ray reconstruction
    if (u.uInverseViewProjectionMatrix?.value) {
      const invVP = u.uInverseViewProjectionMatrix.value as THREE.Matrix4
      invVP.copy(camera.projectionMatrixInverse).premultiply(camera.matrixWorld)
    }

    // NOTE: Temporal accumulation uniforms (uBayerOffset, uFullResolution) are not used
    // since black hole doesn't benefit from temporal rendering due to reconstruction overhead
  }, FRAME_PRIORITY.BLACK_HOLE_UNIFORMS)
}
