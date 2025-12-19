/**
 * QuaternionJuliaMesh - Renders 3D-11D Quaternion Julia fractals using GPU raymarching
 *
 * Mathematical basis: z = z^n + c where c is a fixed Julia constant
 * Unlike Mandelbulb where c varies per sample point, Julia uses a fixed c.
 *
 * @see docs/prd/quaternion-julia-fractal.md
 */

import { RAYMARCH_QUALITY_TO_MULTIPLIER } from '@/lib/geometry/extended/types'
import { getEffectiveSdfQuality } from '@/rendering/utils/adaptiveQuality'
import { composeRotations } from '@/lib/math/rotation'
import type { MatrixND } from '@/lib/math/types'
import {
    createColorCache,
    createLightColorCache,
    updateLinearColorUniform,
} from '@/rendering/colors/linearCache'
import { RENDER_LAYERS } from '@/rendering/core/layers'
import { TemporalDepthManager } from '@/rendering/core/TemporalDepthManager'
import {
    createLightUniforms,
    updateLightUniforms,
} from '@/rendering/lights/uniforms'
import {
    OPACITY_MODE_TO_INT,
    SAMPLE_QUALITY_TO_INT,
} from '@/rendering/opacity/types'
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette'
import {
    SHADOW_ANIMATION_MODE_TO_INT,
    SHADOW_QUALITY_TO_INT,
} from '@/rendering/shadows/types'
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
import { useRotationStore } from '@/stores/rotationStore'
import { useUIStore } from '@/stores/uiStore'
import { useWebGLContextStore } from '@/stores/webglContextStore'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TrackedShaderMaterial } from '@/rendering/materials/TrackedShaderMaterial'
import { composeJuliaShader } from '@/rendering/shaders/julia/compose'
import vertexShader from './quaternion-julia.vert?raw'

/** Debounce time in ms before restoring high quality after rotation stops */
const QUALITY_RESTORE_DELAY_MS = 150

/** Maximum supported dimension */
const MAX_DIMENSION = 11

/**
 * Apply D-dimensional rotation matrix to a vector
 * @param matrix
 * @param vec
 * @param out
 * @param dimension
 */
function applyRotationInPlace(
  matrix: MatrixND,
  vec: number[] | Float32Array,
  out: Float32Array,
  dimension: number
): void {
  out.fill(0);
  for (let i = 0; i < dimension; i++) {
    let sum = 0;
    const row = matrix[i];
    if (row) {
      for (let j = 0; j < dimension; j++) {
        sum += (row[j] ?? 0) * (vec[j] ?? 0);
      }
    }
    out[i] = sum;
  }
}

interface WorkingArrays {
  unitX: number[]
  unitY: number[]
  unitZ: number[]
  origin: number[]
  rotatedX: Float32Array
  rotatedY: Float32Array
  rotatedZ: Float32Array
  rotatedOrigin: Float32Array
}

function createWorkingArrays(): WorkingArrays {
  return {
    unitX: new Array(MAX_DIMENSION).fill(0),
    unitY: new Array(MAX_DIMENSION).fill(0),
    unitZ: new Array(MAX_DIMENSION).fill(0),
    origin: new Array(MAX_DIMENSION).fill(0),
    rotatedX: new Float32Array(MAX_DIMENSION),
    rotatedY: new Float32Array(MAX_DIMENSION),
    rotatedZ: new Float32Array(MAX_DIMENSION),
    rotatedOrigin: new Float32Array(MAX_DIMENSION),
  }
}

/**
 * QuaternionJuliaMesh - Renders Quaternion Julia fractals
 */
const QuaternionJuliaMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, size } = useThree()

  // Performance optimization refs
  const prevVersionRef = useRef<number>(-1)
  const fastModeRef = useRef(false)
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  // Pre-allocated working arrays
  const workingArraysRef = useRef<WorkingArrays>(createWorkingArrays())

  // Cached rotation matrix
  const cachedRotationMatrixRef = useRef<MatrixND | null>(null)
  const prevDimensionRef = useRef<number | null>(null)
  const prevParamValuesRef = useRef<number[] | null>(null)
  const prevScaleRef = useRef<number | null>(null)
  const basisVectorsDirtyRef = useRef(true)

  // Cached uniform values
  // Note: prevPowerRef, prevIterationsRef, prevEscapeRadiusRef were removed
  // because the optimization caused uniforms to not update after TrackedShaderMaterial
  // transitions from placeholder to shader material.
  const prevLightingVersionRef = useRef<number>(-1)

  // Cached colors
  const colorCacheRef = useRef(createColorCache())
  const lightColorCacheRef = useRef(createLightColorCache())

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restoreQualityTimeoutRef.current) {
        clearTimeout(restoreQualityTimeoutRef.current)
        restoreQualityTimeoutRef.current = null
      }
    }
  }, [])

  // Assign layer
  useEffect(() => {
    if (meshRef.current?.layers) {
      meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT)
    }
  }, [])

  // Get dimension from geometry store (used for useEffect dependency)
  const dimension = useGeometryStore((state) => state.dimension)

  // Context restore counter - forces material recreation when context is restored
  const restoreCount = useWebGLContextStore((state) => state.restoreCount)

  // Get parameterValues for useEffect dependency (triggers basis vector recomputation)
  const parameterValues = useExtendedObjectStore(
    (state) => state.quaternionJulia.parameterValues
  )

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

      // Multi-light system
      ...createLightUniforms(),

      // Global lighting
      uAmbientIntensity: { value: 0.2 },
      uAmbientColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      uSpecularColor: { value: new THREE.Color('#FFFFFF').convertSRGBToLinear() },
      uDiffuseIntensity: { value: 1.0 },
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

      // Performance
      uFastMode: { value: false },
      uQualityMultiplier: { value: 1.0 },

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
      uShadowAnimationMode: { value: 0 },

      // Ambient Occlusion
      uAoEnabled: { value: true },

      // Advanced Color
      uColorAlgorithm: { value: 2 },
      uCosineA: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uCosineB: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uCosineC: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      uCosineD: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
      uDistPower: { value: 1.0 },
      uDistCycles: { value: 1.0 },
      uDistOffset: { value: 0.0 },
      uLchLightness: { value: 0.7 },
      uLchChroma: { value: 0.15 },
      uMultiSourceWeights: { value: new THREE.Vector3(0.5, 0.3, 0.2) },

      // Temporal Reprojection uniforms
      uPrevDepthTexture: { value: null },
      uPrevViewProjectionMatrix: { value: new THREE.Matrix4() },
      uPrevInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
      uTemporalEnabled: { value: false },
      uDepthBufferResolution: { value: new THREE.Vector2(1, 1) },
    }),
    []
  )

  // Invalidate basis vectors when dimension/params change
  useEffect(() => {
    basisVectorsDirtyRef.current = true
  }, [dimension, parameterValues])

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
    const rotStore = useRotationStore.getState()
    const geoStore = useGeometryStore.getState()
    const extStore = useExtendedObjectStore.getState()
    const appStore = useAppearanceStore.getState()
    const lightStore = useLightingStore.getState()
    const uiStore = useUIStore.getState()
    const perfStore = usePerformanceStore.getState()

    const currentDimension = geoStore.dimension
    const config = extStore.quaternionJulia
    const { rotations: currentRotations, version: rotationVersion } = rotStore

    // Update time
    u.uTime.value = state.clock.elapsedTime

    // Quality mode based on rotation changes
    const didRotate = rotationVersion !== prevVersionRef.current

    if (didRotate) {
      fastModeRef.current = true
      prevVersionRef.current = rotationVersion
      if (restoreQualityTimeoutRef.current) {
        clearTimeout(restoreQualityTimeoutRef.current)
      }
    } else if (fastModeRef.current) {
        if (!restoreQualityTimeoutRef.current) {
            restoreQualityTimeoutRef.current = setTimeout(() => {
                fastModeRef.current = false
                restoreQualityTimeoutRef.current = null
            }, QUALITY_RESTORE_DELAY_MS)
        }
    }

    // Only enable fast mode if fractalAnimationLowQuality is enabled in performance settings
    const fractalAnimLowQuality = perfStore.fractalAnimationLowQuality;
    u.uFastMode.value = fractalAnimLowQuality && fastModeRef.current

    // Progressive refinement
    const qualityMultiplier = perfStore.qualityMultiplier ?? 1.0
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

    // Check if basis vectors need recomputation
    const dimChanged = currentDimension !== prevDimensionRef.current
    const paramsChanged =
      !prevParamValuesRef.current ||
      config.parameterValues.length !== prevParamValuesRef.current.length ||
      config.parameterValues.some((v, i) => v !== prevParamValuesRef.current![i])
    const scaleChanged = prevScaleRef.current !== config.scale

    const needsRecompute =
      dimChanged || paramsChanged || scaleChanged || basisVectorsDirtyRef.current || didRotate

    if (needsRecompute) {
      prevDimensionRef.current = currentDimension
      prevParamValuesRef.current = [...config.parameterValues]
      prevScaleRef.current = config.scale

      // Compose rotation matrix
      const rotMatrix = composeRotations(currentDimension, currentRotations)
      cachedRotationMatrixRef.current = rotMatrix

      // Build basis vectors
      const wa = workingArraysRef.current
      for (let i = 0; i < MAX_DIMENSION; i++) {
        wa.unitX[i] = i === 0 ? 1 : 0
        wa.unitY[i] = i === 1 ? 1 : 0
        wa.unitZ[i] = i === 2 ? 1 : 0
      }

      // Apply rotations to basis vectors
      applyRotationInPlace(rotMatrix, wa.unitX, wa.rotatedX, currentDimension)
      applyRotationInPlace(rotMatrix, wa.unitY, wa.rotatedY, currentDimension)
      applyRotationInPlace(rotMatrix, wa.unitZ, wa.rotatedZ, currentDimension)

      // Scale basis vectors
      const boundingSize = config.scale
      for (let i = 0; i < MAX_DIMENSION; i++) {
        wa.rotatedX[i]! *= boundingSize
        wa.rotatedY[i]! *= boundingSize
        wa.rotatedZ[i]! *= boundingSize
      }

      // Copy basis vectors to uniforms
      u.uBasisX.value.set(wa.rotatedX)
      u.uBasisY.value.set(wa.rotatedY)
      u.uBasisZ.value.set(wa.rotatedZ)

      basisVectorsDirtyRef.current = false
    }

    // ============================================
    // Origin Update (separate from basis vectors)
    // ============================================
    if (needsRecompute && cachedRotationMatrixRef.current) {
      const wa = workingArraysRef.current

      // Clear and set up origin
      for (let i = 0; i < MAX_DIMENSION; i++) {
        wa.origin[i] = 0
      }

      // Set extra dimension values from parameters
      for (let i = 0; i < config.parameterValues.length; i++) {
        wa.origin[3 + i] = config.parameterValues[i] ?? 0
      }

      // Apply rotation to origin
      applyRotationInPlace(cachedRotationMatrixRef.current, wa.origin, wa.rotatedOrigin, currentDimension)

      // Scale origin
      const boundingSize = config.scale
      for (let i = 0; i < MAX_DIMENSION; i++) {
        wa.rotatedOrigin[i]! *= boundingSize
      }

      // Copy origin to uniform
      u.uOrigin.value.set(wa.rotatedOrigin)
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

    // Update temporal reprojection uniforms from manager
    const temporalUniforms = TemporalDepthManager.getUniforms()
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

    // Update multi-light system (conditionally)
    const currentLightingVersion = lightStore.version
    if (prevLightingVersionRef.current !== currentLightingVersion) {
      updateLightUniforms(u, lightStore.lights, lightColorCacheRef.current)
      prevLightingVersionRef.current = currentLightingVersion
    }

    // Update global lighting
    u.uAmbientIntensity.value = lightStore.ambientIntensity
    updateLinearColorUniform(
      colorCacheRef.current.ambientColor,
      u.uAmbientColor.value as THREE.Color,
      lightStore.ambientColor
    )
    u.uSpecularIntensity.value = lightStore.specularIntensity
    u.uSpecularPower.value = lightStore.shininess
    updateLinearColorUniform(
      colorCacheRef.current.specularColor,
      u.uSpecularColor.value as THREE.Color,
      lightStore.specularColor
    )
    u.uDiffuseIntensity.value = lightStore.diffuseIntensity
    
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
      fastModeRef.current ? 0 : 1
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
      fastModeRef.current ? 0 : 1
    )
    u.uShadowQuality.value = SHADOW_QUALITY_TO_INT[effectiveShadowQuality]
    u.uShadowSoftness.value = lightStore.shadowSoftness
    u.uShadowAnimationMode.value =
      SHADOW_ANIMATION_MODE_TO_INT[lightStore.shadowAnimationMode] ?? 0

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
  })

  // Generate unique key to force material recreation when shader changes or context is restored
  const materialKey = `julia-material-${shaderString.length}-${features.join(',')}-${restoreCount}`

  return (
    <mesh ref={meshRef}>
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
