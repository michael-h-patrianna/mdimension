/**
 * QuaternionJuliaMesh - Renders 3D-11D Quaternion Julia fractals using GPU raymarching
 *
 * Mathematical basis: z = z^n + c where c is a fixed Julia constant
 * Unlike Mandelbulb where c varies per sample point, Julia uses a fixed c.
 *
 * @see docs/prd/quaternion-julia-fractal.md
 */

import { RAYMARCH_QUALITY_TO_MULTIPLIER } from '@/lib/geometry/extended/types'
import {
    createColorCache,
    updateLinearColorUniform,
} from '@/rendering/colors/linearCache'
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { useTemporalDepth } from '@/rendering/core/temporalDepth'
import { TrackedShaderMaterial } from '@/rendering/materials/TrackedShaderMaterial'
import {
    OPACITY_MODE_TO_INT,
    SAMPLE_QUALITY_TO_INT,
} from '@/rendering/opacity/types'
import {
    MAX_DIMENSION,
    useLayerAssignment,
    useQualityTracking,
    useRotationUpdates,
} from '@/rendering/renderers/base'
import { composeJuliaShader } from '@/rendering/shaders/julia/compose'
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette'
import {
    SHADOW_QUALITY_TO_INT,
} from '@/rendering/shadows/types'
import { UniformManager } from '@/rendering/uniforms/UniformManager'
import { getEffectiveSdfQuality } from '@/rendering/utils/adaptiveQuality'
import { useAnimationStore } from '@/stores/animationStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLightingStore } from '@/stores/lightingStore'
import {
    getEffectiveSampleQuality,
    getEffectiveShadowQuality,
    usePerformanceStore,
} from '@/stores/performanceStore'
import { usePostProcessingStore } from '@/stores/postProcessingStore'
import { useUIStore } from '@/stores/uiStore'
import { useWebGLContextStore } from '@/stores/webglContextStore'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import vertexShader from './quaternion-julia.vert?raw'

/**
 * QuaternionJuliaMesh - Renders Quaternion Julia fractals
 * @returns The quaternion Julia fractal mesh component
 */
const QuaternionJuliaMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, size } = useThree()

  // Get temporal depth state from context for temporal reprojection
  const temporalDepth = useTemporalDepth()

  // Get scale for mesh scaling
  const scale = useExtendedObjectStore((state) => state.quaternionJulia.scale)

  // Use shared quality tracking hook
  const { effectiveFastMode, qualityMultiplier, rotationsChanged } = useQualityTracking()

  // Use shared layer assignment hook
  useLayerAssignment(meshRef)

  // Animation time tracking (respects pause state)
  const animationTimeRef = useRef(0)
  const lastFrameTimeRef = useRef(0)

  // Cached uniform values
  // Note: prevPowerRef, prevIterationsRef, prevEscapeRadiusRef were removed
  // because the optimization caused uniforms to not update after TrackedShaderMaterial
  // transitions from placeholder to shader material.
  // Note: Lighting version tracking and color caching now handled by LightingSource via UniformManager

  // Cached colors for non-lighting uniforms
  const colorCacheRef = useRef(createColorCache())


  // Get dimension from geometry store (used for useEffect dependency)
  const dimension = useGeometryStore((state) => state.dimension)

  // Context restore counter - forces material recreation when context is restored
  const restoreCount = useWebGLContextStore((state) => state.restoreCount)

  // Get parameterValues for useEffect dependency (triggers basis vector recomputation)
  const parameterValues = useExtendedObjectStore(
    (state) => state.quaternionJulia.parameterValues
  )

  // Use shared rotation hook for basis vector computation with caching
  const rotationUpdates = useRotationUpdates({ dimension, parameterValues })

  // Get config for shader compilation (re-compiles when these change)
  const shadowEnabled = useLightingStore((state) => state.shadowEnabled)
  const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled)
  const opacityMode = useUIStore((state) => state.opacitySettings.mode)
  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo)
  const shaderOverrides = usePerformanceStore((state) => state.shaderOverrides)
  const resetShaderOverrides = usePerformanceStore((state) => state.resetShaderOverrides)

  // Conditionally compiled feature toggles (affect shader compilation)
  const sssEnabled = useAppearanceStore((state) => state.sssEnabled)
  const edgesVisible = useAppearanceStore((state) => state.edgesVisible)

  // Reset overrides when base configuration changes
  useEffect(() => {
    resetShaderOverrides()
  }, [dimension, shadowEnabled, temporalEnabled, opacityMode, sssEnabled, edgesVisible, resetShaderOverrides])

  const { glsl: shaderString, modules, features } = useMemo(() => {
    return composeJuliaShader({
      dimension,
      shadows: shadowEnabled,
      temporal: temporalEnabled,
      ambientOcclusion: true,
      opacityMode,
      overrides: shaderOverrides,
      sss: sssEnabled,
      fresnel: edgesVisible,
      fog: false, // Physical fog handled by post-process
    })
  }, [dimension, shadowEnabled, temporalEnabled, opacityMode, shaderOverrides, sssEnabled, edgesVisible])

  useEffect(() => {
    setShaderDebugInfo('object', {
      name: 'Quaternion Julia Raymarcher',
      vertexShaderLength: vertexShader.length,
      fragmentShaderLength: shaderString.length,
      activeModules: modules,
      features: features,
    })
    return () => setShaderDebugInfo('object', null)
  }, [shaderString, modules, features, setShaderDebugInfo])

  // NOTE: All other store values are read via getState() inside useFrame
  // to avoid React re-renders during animation. This is the high-performance
  // pattern used by Mandelbulb and other raymarched renderers.

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      uDimension: { value: 4 },
      uPower: { value: 2.0 },
      uIterations: { value: 64.0 },
      uEscapeRadius: { value: 4.0 },

      // Julia constant (unique to this fractal type)
      uJuliaConstant: { value: new THREE.Vector4(0.3, 0.5, 0.4, 0.2) },

      // D-dimensional basis
      uBasisX: { value: new Float32Array(11) },
      uBasisY: { value: new Float32Array(11) },
      uBasisZ: { value: new Float32Array(11) },
      uOrigin: { value: new Float32Array(11) },

      // Color
      uColor: { value: new THREE.Color().convertSRGBToLinear() },

      // Matrices
      uModelMatrix: { value: new THREE.Matrix4() },
      uInverseModelMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },

      // Centralized Uniform Sources:
      // - Lighting: Ambient, Diffuse, Specular, Multi-lights
      // - Temporal: Matrices, Enabled state (matrices updated via source)
      // - Quality: FastMode, QualityMultiplier
      // - Color: Algorithm, Cosine coeffs, Distribution, LCH
      ...UniformManager.getCombinedUniforms(['lighting', 'temporal', 'quality', 'color']),

      // Material property for G-buffer (reflectivity for SSR)
      uMetallic: { value: 0.0 },

      // Advanced Rendering
      uRoughness: { value: 0.3 },
      uSssEnabled: { value: false },
      uSssIntensity: { value: 1.0 },
      uSssColor: { value: new THREE.Color('#ff8844') },
      uSssThickness: { value: 1.0 },
      uSssJitter: { value: 0.2 },

      // Fresnel
      uFresnelEnabled: { value: true },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },

      // Opacity
      uOpacityMode: { value: 0 },
      uSimpleAlpha: { value: 0.7 },
      uLayerCount: { value: 2 },
      uLayerOpacity: { value: 0.5 },
      uVolumetricDensity: { value: 1.0 },
      uSampleQuality: { value: 1 },
      uVolumetricReduceOnAnim: { value: true },

      // Shadow
      uShadowEnabled: { value: false },
      uShadowQuality: { value: 1 },
      uShadowSoftness: { value: 1.0 },

      // Ambient Occlusion
      uAoEnabled: { value: true },

      // Temporal Reprojection - Texture must be manually handled as it comes from context
      uPrevDepthTexture: { value: null },
    }),
    []
  )

  // Per-frame updates
  useFrame((state) => {
    if (!meshRef.current) return

    const mesh = meshRef.current
    const material = mesh.material as THREE.ShaderMaterial
    if (!material?.uniforms) return

    // Cast to any for now to allow property access, but we know the structure from useMemo above
    // A full type definition would be very large and duplicate the useMemo structure
    // We suppress the lint error as this is a deliberate trade-off for performance/complexity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = material.uniforms as any;
    if (!u) return;

    // Get current state directly from stores
    const geoStore = useGeometryStore.getState()
    const extStore = useExtendedObjectStore.getState()
    const appStore = useAppearanceStore.getState()
    const lightStore = useLightingStore.getState()
    const uiStore = useUIStore.getState()
    const perfStore = usePerformanceStore.getState()

    const currentDimension = geoStore.dimension
    const config = extStore.quaternionJulia

    // Update animation time (respects pause state)
    const currentTime = state.clock.elapsedTime
    const deltaTime = currentTime - lastFrameTimeRef.current
    lastFrameTimeRef.current = currentTime
    const isPlaying = useAnimationStore.getState().isPlaying
    if (isPlaying) {
      animationTimeRef.current += deltaTime
    }

    // Update time uniform using paused animation time
    u.uTime.value = animationTimeRef.current

    // Use shared quality tracking values
    u.uFastMode.value = effectiveFastMode
    u.uQualityMultiplier.value = qualityMultiplier

    // Update dimension
    u.uDimension.value = currentDimension

    // Update fractal parameters
    // Always set these uniforms unconditionally to ensure they're updated after
    // TrackedShaderMaterial transitions from placeholder to actual shader material.
    u.uPower.value = config.power
    u.uIterations.value = config.maxIterations
    u.uEscapeRadius.value = config.bailoutRadius

    // Julia constant (static)
    u.uJuliaConstant.value.set(...config.juliaConstant)

    // ============================================
    // D-dimensional Rotation & Basis Vectors (via shared hook)
    // Only recomputes when rotations, dimension, or params change
    // ============================================
    const { basisX, basisY, basisZ, changed: basisChanged } = rotationUpdates.getBasisVectors(rotationsChanged)

    if (basisChanged) {
      // Copy basis vectors to uniforms
      u.uBasisX.value.set(basisX)
      u.uBasisY.value.set(basisY)
      u.uBasisZ.value.set(basisZ)
    }

    // ============================================
    // Origin Update (separate from basis vectors)
    // ============================================
    if (basisChanged) {
      // Build origin values array for rotation
      const originValues = new Array(MAX_DIMENSION).fill(0)

      // Set extra dimension values from parameters
      for (let i = 0; i < config.parameterValues.length; i++) {
        originValues[3 + i] = config.parameterValues[i] ?? 0
      }

      // Get rotated origin from hook
      const { origin } = rotationUpdates.getOrigin(originValues)

      // Copy origin to uniform
      u.uOrigin.value.set(origin)
    }

    // Update color
    updateLinearColorUniform(
      colorCacheRef.current.faceColor,
      u.uColor.value as THREE.Color,
      appStore.faceColor
    )

    // Update matrices
    u.uModelMatrix.value.copy(mesh.matrixWorld)
    u.uInverseModelMatrix.value.copy(mesh.matrixWorld).invert()
    u.uProjectionMatrix.value.copy(camera.projectionMatrix)
    u.uViewMatrix.value.copy(camera.matrixWorldInverse)
    u.uCameraPosition.value.copy(camera.position)

    // Update resolution
    if (u.uResolution) {
      u.uResolution.value.set(size.width, size.height)
    }

    // Update temporal reprojection uniforms from context
    const temporalUniforms = temporalDepth.getUniforms()
    if (u.uPrevDepthTexture) {
      u.uPrevDepthTexture.value = temporalUniforms.uPrevDepthTexture
    }
    if (u.uPrevViewProjectionMatrix) {
      u.uPrevViewProjectionMatrix.value.copy(temporalUniforms.uPrevViewProjectionMatrix)
    }
    if (u.uPrevInverseViewProjectionMatrix) {
      u.uPrevInverseViewProjectionMatrix.value.copy(temporalUniforms.uPrevInverseViewProjectionMatrix)
    }
    if (u.uTemporalEnabled) {
      u.uTemporalEnabled.value = temporalUniforms.uTemporalEnabled
    }
    if (u.uDepthBufferResolution) {
      u.uDepthBufferResolution.value.copy(temporalUniforms.uDepthBufferResolution)
    }
    // Note: uCameraNear and uCameraFar are no longer needed - temporal buffer now stores
    // unnormalized ray distances directly (world-space units)

    // Update lighting uniforms via centralized UniformManager (Phase 2 integration)
    // The LightingSource automatically tracks store version and only updates when changed
    UniformManager.applyToMaterial(material, ['lighting'])

    // Advanced Rendering (Global Visuals)
    const visuals = appStore; // appStore is already available
    if (u.uRoughness) u.uRoughness.value = visuals.roughness
    if (u.uSssEnabled) u.uSssEnabled.value = visuals.sssEnabled
    if (u.uSssIntensity) u.uSssIntensity.value = visuals.sssIntensity
    if (u.uSssColor) {
        updateLinearColorUniform(colorCacheRef.current.faceColor /* reuse helper */, u.uSssColor.value as THREE.Color, visuals.sssColor || '#ff8844')
    }
    if (u.uSssThickness) u.uSssThickness.value = visuals.sssThickness
    if (u.uSssJitter) u.uSssJitter.value = visuals.sssJitter

    // Raymarching Quality (per-object setting)
    // Maps RaymarchQuality preset to quality multiplier with screen coverage adaptation
    const baseQuality = RAYMARCH_QUALITY_TO_MULTIPLIER[config.raymarchQuality] ?? 0.5
    const effectiveQuality = getEffectiveSdfQuality(baseQuality, camera as THREE.PerspectiveCamera, perfStore.qualityMultiplier ?? 1.0)

    if (u.uQualityMultiplier) {
        u.uQualityMultiplier.value = effectiveQuality
    }

    // Update fresnel
    u.uFresnelEnabled.value = appStore.edgesVisible
    u.uFresnelIntensity.value = appStore.fresnelIntensity
    updateLinearColorUniform(
      colorCacheRef.current.rimColor,
      u.uRimColor.value as THREE.Color,
      appStore.edgeColor
    )

    // Update opacity settings
    const opacity = uiStore.opacitySettings
    u.uOpacityMode.value = OPACITY_MODE_TO_INT[opacity.mode] ?? 0
    u.uSimpleAlpha.value = opacity.simpleAlphaOpacity
    u.uLayerCount.value = opacity.layerCount
    u.uLayerOpacity.value = opacity.layerOpacity
    u.uVolumetricDensity.value = opacity.volumetricDensity
    const effectiveSampleQuality = getEffectiveSampleQuality(
      opacity.sampleQuality,
      effectiveFastMode ? 0 : 1
    )
    u.uSampleQuality.value = SAMPLE_QUALITY_TO_INT[effectiveSampleQuality]
    u.uVolumetricReduceOnAnim.value = opacity.volumetricAnimationQuality === 'reduce' ? 1 : 0

    // Configure material transparency based on opacity mode
    const isTransparent = opacity.mode !== 'solid'
    if (material.transparent !== isTransparent) {
      material.transparent = isTransparent
      material.depthWrite = !isTransparent
      material.needsUpdate = true
    }

    // Update shadow settings
    u.uShadowEnabled.value = lightStore.shadowEnabled
    const effectiveShadowQuality = getEffectiveShadowQuality(
      lightStore.shadowQuality,
      effectiveFastMode ? 0 : 1
    )
    u.uShadowQuality.value = SHADOW_QUALITY_TO_INT[effectiveShadowQuality]
    u.uShadowSoftness.value = lightStore.shadowSoftness

    // Update ambient occlusion (controlled by global SSAO toggle)
    u.uAoEnabled.value = usePostProcessingStore.getState().ssaoEnabled

    // Update advanced color system
    u.uColorAlgorithm.value = COLOR_ALGORITHM_TO_INT[appStore.colorAlgorithm] ?? 2
    u.uCosineA.value.set(...appStore.cosineCoefficients.a)
    u.uCosineB.value.set(...appStore.cosineCoefficients.b)
    u.uCosineC.value.set(...appStore.cosineCoefficients.c)
    u.uCosineD.value.set(...appStore.cosineCoefficients.d)
    u.uDistPower.value = appStore.distribution.power
    u.uDistCycles.value = appStore.distribution.cycles
    u.uDistOffset.value = appStore.distribution.offset
    u.uLchLightness.value = appStore.lchLightness
    u.uLchChroma.value = appStore.lchChroma
    u.uMultiSourceWeights.value.set(
      appStore.multiSourceWeights.depth,
      appStore.multiSourceWeights.orbitTrap,
      appStore.multiSourceWeights.normal
    )
  }, FRAME_PRIORITY.RENDERER_UNIFORMS)

  // Generate unique key to force material recreation when shader changes or context is restored
  const materialKey = `julia-material-${shaderString.length}-${features.join(',')}-${restoreCount}`

  return (
    <mesh ref={meshRef} scale={[scale ?? 1.0, scale ?? 1.0, scale ?? 1.0]} frustumCulled={true}>
      <boxGeometry args={[4, 4, 4]} />
      <TrackedShaderMaterial
        shaderName="Quaternion Julia Raymarcher"
        materialKey={materialKey}
        glslVersion={THREE.GLSL3}
        vertexShader={vertexShader}
        fragmentShader={shaderString}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

export default QuaternionJuliaMesh
