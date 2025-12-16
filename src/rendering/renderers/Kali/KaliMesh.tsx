/**
 * KaliMesh - Renders 3D-11D Kali fractals using GPU raymarching
 *
 * Mathematical basis: z = abs(z) / dot(z,z) + c
 * The reciprocal step creates intense nonlinear folding that produces
 * fluid, cellular, and "alive" structures.
 *
 * @see docs/prd/kali-reciprocal-fractal.md
 */

import {
  createColorCache,
  createLightColorCache,
  updateLinearColorUniform,
} from '@/rendering/colors/linearCache'
import {
  computeDriftedOrigin,
  type OriginDriftConfig,
} from '@/lib/animation/originDrift'
import {
  createLightUniforms,
  updateLightUniforms,
} from '@/rendering/lights/uniforms'
import { composeRotations } from '@/lib/math/rotation'
import type { MatrixND } from '@/lib/math/types'
import {
  OPACITY_MODE_TO_INT,
  SAMPLE_QUALITY_TO_INT,
} from '@/rendering/opacity/types'
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette'
import {
  SHADOW_QUALITY_TO_INT,
  SHADOW_ANIMATION_MODE_TO_INT,
} from '@/rendering/shadows/types'
import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useAnimationStore } from '@/stores/animationStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import {
  getEffectiveSampleQuality,
  getEffectiveShadowQuality,
  usePerformanceStore,
} from '@/stores/performanceStore'
import type { RotationState } from '@/stores/rotationStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useLightingStore } from '@/stores/lightingStore'
import { useUIStore } from '@/stores/uiStore'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import fragmentShader from './kali.frag?raw'
import vertexShader from './kali.vert?raw'

/** Debounce time in ms before restoring high quality after rotation stops */
const QUALITY_RESTORE_DELAY_MS = 150

/** Maximum supported dimension */
const MAX_DIMENSION = 11

/**
 * Apply D-dimensional rotation matrix to a vector
 */
function applyRotationInPlace(
  matrix: MatrixND,
  vec: number[],
  out: Float32Array
): void {
  const D = matrix.length
  for (let i = 0; i < MAX_DIMENSION; i++) out[i] = 0
  for (let i = 0; i < D; i++) {
    let sum = 0
    for (let j = 0; j < D; j++) {
      sum += (matrix[i]?.[j] ?? 0) * (vec[j] ?? 0)
    }
    out[i] = sum
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
 * KaliMesh - Renders Kali fractals
 */
const KaliMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  // Performance optimization refs
  const prevRotationsRef = useRef<RotationState['rotations'] | null>(null)
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

  // Cached colors
  const colorCacheRef = useRef(createColorCache())
  const lightColorCacheRef = useRef(createLightColorCache())

  // Animation time - CRITICAL: respects play/pause
  const animationTimeRef = useRef(0)
  const lastFrameTimeRef = useRef(0)

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

  // Get dimension from geometry store
  const dimension = useGeometryStore((state) => state.dimension)

  // Get parameterValues for useEffect dependency
  const parameterValues = useExtendedObjectStore(
    (state) => state.kali.parameterValues
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uCameraPosition: { value: new THREE.Vector3() },

      uDimension: { value: 4 },
      uIterations: { value: 20.0 },
      uEscapeRadius: { value: 4.0 },

      // Kali-specific uniforms
      uKaliConstant: { value: new Float32Array(11) },
      uReciprocalGain: { value: 1.0 },
      uAxisWeights: { value: new Float32Array(11).fill(1.0) },
      uEpsilon: { value: 0.001 },

      // Dimension Mixing
      uDimensionMixEnabled: { value: false },
      uMixIntensity: { value: 0.1 },
      uMixTime: { value: 0 },

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
    }),
    []
  )

  // Invalidate basis vectors when dimension/params change
  useEffect(() => {
    basisVectorsDirtyRef.current = true
  }, [dimension, parameterValues])

  /**
   * Check if rotations have changed
   */
  const hasRotationsChanged = useCallback(
    (current: RotationState['rotations'], previous: RotationState['rotations'] | null): boolean => {
      if (!previous) return true
      if (current.size !== previous.size) return true
      for (const [key, value] of current.entries()) {
        if (previous.get(key) !== value) {
          return true
        }
      }
      return false
    },
    []
  )

  // Per-frame updates
  useFrame((state) => {
    if (!meshRef.current) return

    const mesh = meshRef.current
    const material = mesh.material as THREE.ShaderMaterial
    if (!material?.uniforms) return

    // Use 'any' for uniforms to avoid verbose type assertions (same as QuaternionJuliaMesh)
    const u = material.uniforms as any
    if (!u) return

    // Get current state directly from stores
    const animStore = useAnimationStore.getState()
    const rotStore = useRotationStore.getState()
    const geoStore = useGeometryStore.getState()
    const extStore = useExtendedObjectStore.getState()
    const appStore = useAppearanceStore.getState()
    const lightStore = useLightingStore.getState()
    const uiStore = useUIStore.getState()
    const perfStore = usePerformanceStore.getState()

    const currentDimension = geoStore.dimension
    const config = extStore.kali
    const currentRotations = rotStore.rotations

    // Update time
    u.uTime.value = state.clock.elapsedTime

    // Update animation time - CRITICAL: respects play/pause
    const currentTime = state.clock.elapsedTime
    const delta = currentTime - lastFrameTimeRef.current
    lastFrameTimeRef.current = currentTime

    if (animStore.isPlaying) {
      animationTimeRef.current += delta * animStore.speed
    }
    const animTime = animationTimeRef.current

    // Quality mode based on rotation changes
    const didRotate = hasRotationsChanged(currentRotations, prevRotationsRef.current)

    if (didRotate || !prevRotationsRef.current) {
      prevRotationsRef.current = new Map(currentRotations)
    }

    if (didRotate) {
      fastModeRef.current = true
      if (restoreQualityTimeoutRef.current) {
        clearTimeout(restoreQualityTimeoutRef.current)
      }
      restoreQualityTimeoutRef.current = setTimeout(() => {
        fastModeRef.current = false
        restoreQualityTimeoutRef.current = null
      }, QUALITY_RESTORE_DELAY_MS)
    }

    u.uFastMode.value = fastModeRef.current

    // Progressive refinement
    const qualityMultiplier = perfStore.qualityMultiplier ?? 1.0
    u.uQualityMultiplier.value = qualityMultiplier

    // Update dimension
    u.uDimension.value = currentDimension

    // Update fractal parameters
    u.uIterations.value = config.maxIterations
    u.uEscapeRadius.value = config.bailoutRadius
    u.uEpsilon.value = config.epsilon

    // Kali constant (with animation if enabled)
    const kaliConstantArray = u.uKaliConstant.value as Float32Array
    if (config.constantAnimation.enabled) {
      const { amplitude, frequency, phaseOffset } = config.constantAnimation
      const t = animTime * frequency * 2 * Math.PI
      for (let i = 0; i < config.kaliConstant.length && i < 11; i++) {
        // Multi-frequency organic motion using golden ratio phases
        const PHI = 1.618033988749895
        const phase = phaseOffset + i * PHI
        kaliConstantArray[i] = (config.kaliConstant[i] ?? 0) + amplitude * Math.sin(t + phase)
      }
    } else {
      for (let i = 0; i < config.kaliConstant.length && i < 11; i++) {
        kaliConstantArray[i] = config.kaliConstant[i] ?? 0
      }
    }

    // Reciprocal gain (with animation if enabled)
    if (config.gainAnimation.enabled) {
      const { minGain, maxGain, speed } = config.gainAnimation
      const t = animTime * speed * 2 * Math.PI
      const normalized = (Math.sin(t) + 1) / 2
      u.uReciprocalGain.value = minGain + normalized * (maxGain - minGain)
    } else {
      u.uReciprocalGain.value = config.reciprocalGain
    }

    // Axis weights (with animation if enabled)
    const axisWeightsArray = u.uAxisWeights.value as Float32Array
    if (config.weightsAnimation.enabled) {
      const { amplitude } = config.weightsAnimation
      const PHI = 1.618033988749895
      for (let i = 0; i < config.axisWeights.length && i < 11; i++) {
        const phase = i * PHI
        const t = animTime * 0.5 * 2 * Math.PI
        axisWeightsArray[i] = (config.axisWeights[i] ?? 1.0) + amplitude * Math.sin(t + phase)
      }
    } else {
      for (let i = 0; i < config.axisWeights.length && i < 11; i++) {
        axisWeightsArray[i] = config.axisWeights[i] ?? 1.0
      }
    }

    // Dimension mixing
    u.uDimensionMixEnabled.value = config.dimensionMixEnabled
    u.uMixIntensity.value = config.mixIntensity
    u.uMixTime.value = animTime * config.mixFrequency * 2 * Math.PI

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
      applyRotationInPlace(rotMatrix, wa.unitX, wa.rotatedX)
      applyRotationInPlace(rotMatrix, wa.unitY, wa.rotatedY)
      applyRotationInPlace(rotMatrix, wa.unitZ, wa.rotatedZ)

      // Scale basis vectors
      const boundingSize = config.scale
      for (let i = 0; i < MAX_DIMENSION; i++) {
        wa.rotatedX[i]! *= boundingSize
        wa.rotatedY[i]! *= boundingSize
        wa.rotatedZ[i]! *= boundingSize
      }

      // Copy basis vectors to uniforms
      ;(u.uBasisX.value as Float32Array).set(wa.rotatedX)
      ;(u.uBasisY.value as Float32Array).set(wa.rotatedY)
      ;(u.uBasisZ.value as Float32Array).set(wa.rotatedZ)

      basisVectorsDirtyRef.current = false
    }

    // Origin Update (separate from basis vectors)
    const needsOriginUpdate = needsRecompute || config.originDriftEnabled

    if (needsOriginUpdate && cachedRotationMatrixRef.current) {
      const wa = workingArraysRef.current

      // Clear and set up origin
      for (let i = 0; i < MAX_DIMENSION; i++) {
        wa.origin[i] = 0
      }

      // Set extra dimension values from parameters
      for (let i = 0; i < config.parameterValues.length; i++) {
        wa.origin[3 + i] = config.parameterValues[i] ?? 0
      }

      // Apply origin drift if enabled
      if (config.originDriftEnabled && currentDimension >= 4) {
        const driftConfig: OriginDriftConfig = {
          enabled: true,
          amplitude: config.originDriftAmplitude,
          baseFrequency: config.originDriftBaseFrequency,
          frequencySpread: config.originDriftFrequencySpread,
        }
        const animationSpeed = animStore.speed
        const driftedOrigin = computeDriftedOrigin(
          config.parameterValues,
          animTime,
          driftConfig,
          animationSpeed,
          uiStore.animationBias
        )
        for (let i = 0; i < driftedOrigin.length && i + 3 < MAX_DIMENSION; i++) {
          wa.origin[3 + i] = driftedOrigin[i] ?? 0
        }
      }

      // Apply rotation to origin
      applyRotationInPlace(cachedRotationMatrixRef.current, wa.origin, wa.rotatedOrigin)

      // Scale origin
      const boundingSize = config.scale
      for (let i = 0; i < MAX_DIMENSION; i++) {
        wa.rotatedOrigin[i]! *= boundingSize
      }

      // Copy origin to uniform
      ;(u.uOrigin.value as Float32Array).set(wa.rotatedOrigin)
    }

    // Update color
    updateLinearColorUniform(
      colorCacheRef.current.faceColor,
      u.uColor.value as THREE.Color,
      appStore.faceColor
    )

    // Update matrices
    ;(u.uModelMatrix.value as THREE.Matrix4).copy(mesh.matrixWorld)
    ;(u.uInverseModelMatrix.value as THREE.Matrix4).copy(mesh.matrixWorld).invert()
    ;(u.uProjectionMatrix.value as THREE.Matrix4).copy(camera.projectionMatrix)
    ;(u.uViewMatrix.value as THREE.Matrix4).copy(camera.matrixWorldInverse)
    ;(u.uCameraPosition.value as THREE.Vector3).copy(camera.position)

    // Update multi-light system
    updateLightUniforms(u, lightStore.lights, lightColorCacheRef.current)

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

    // Update advanced color system
    u.uColorAlgorithm.value = COLOR_ALGORITHM_TO_INT[appStore.colorAlgorithm] ?? 2
    ;(u.uCosineA.value as THREE.Vector3).set(...appStore.cosineCoefficients.a)
    ;(u.uCosineB.value as THREE.Vector3).set(...appStore.cosineCoefficients.b)
    ;(u.uCosineC.value as THREE.Vector3).set(...appStore.cosineCoefficients.c)
    ;(u.uCosineD.value as THREE.Vector3).set(...appStore.cosineCoefficients.d)
    u.uDistPower.value = appStore.distribution.power
    u.uDistCycles.value = appStore.distribution.cycles
    u.uDistOffset.value = appStore.distribution.offset
    u.uLchLightness.value = appStore.lchLightness
    u.uLchChroma.value = appStore.lchChroma
    ;(u.uMultiSourceWeights.value as THREE.Vector3).set(
      appStore.multiSourceWeights.depth,
      appStore.multiSourceWeights.orbitTrap,
      appStore.multiSourceWeights.normal
    )
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[4, 4, 4]} />
      <shaderMaterial
        glslVersion={THREE.GLSL3}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={true}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

export default KaliMesh
