/**
 * QuaternionJuliaMesh - Renders 3D-11D Quaternion Julia fractals using GPU raymarching
 *
 * Mathematical basis: z = z^n + c where c is a fixed Julia constant
 * Unlike Mandelbulb where c varies per sample point, Julia uses a fixed c.
 *
 * @see docs/prd/quaternion-julia-fractal.md
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
import fragmentShader from './quaternion-julia.frag?raw'
import vertexShader from './quaternion-julia.vert?raw'

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
 * QuaternionJuliaMesh - Renders Quaternion Julia fractals
 */
const QuaternionJuliaMesh = () => {
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

  // Animation time
  const animationTimeRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const lastPowerRef = useRef(2.0)

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

  // Get parameterValues for useEffect dependency (triggers basis vector recomputation)
  const parameterValues = useExtendedObjectStore(
    (state) => state.quaternionJulia.parameterValues
  )

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

      // Power Animation
      uPowerAnimationEnabled: { value: false },
      uAnimatedPower: { value: 2.0 },

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
   * Check if rotations have changed by comparing current vs previous state.
   * Returns true if any rotation angle has changed, or if this is the first comparison.
   * NOTE: rotations is a Map<string, number>, not a plain object!
   */
  const hasRotationsChanged = useCallback(
    (current: RotationState['rotations'], previous: RotationState['rotations'] | null): boolean => {
      // First frame or no previous state - consider it a change to ensure initial computation
      if (!previous) return true

      // Check if sizes differ
      if (current.size !== previous.size) return true

      // Compare all rotation planes using Map methods
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

    const u = material.uniforms as any;
    if (!u) return;

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
    const config = extStore.quaternionJulia
    const currentRotations = rotStore.rotations

    // Update time
    u.uTime.value = state.clock.elapsedTime

    // Update animation time
    const currentTime = state.clock.elapsedTime
    const delta = currentTime - lastFrameTimeRef.current
    lastFrameTimeRef.current = currentTime

    if (animStore.isPlaying) {
      animationTimeRef.current += delta * animStore.speed
    }
    const animTime = animationTimeRef.current

    // Quality mode based on rotation changes
    const didRotate = hasRotationsChanged(currentRotations, prevRotationsRef.current)

    // Store current rotations for next frame comparison only when changed
    // (avoids creating garbage every frame)
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
    u.uPower.value = config.power
    u.uIterations.value = config.maxIterations
    u.uEscapeRadius.value = config.bailoutRadius

    // Julia constant (with animation if enabled)
    // Uses controlled animation time so it respects play/pause
    if (config.juliaConstantAnimation.enabled) {
      const { amplitude, frequency, phase } = config.juliaConstantAnimation
      const base = config.juliaConstant
      const t = animTime  // Use controlled animation time
      u.uJuliaConstant.value.set(
        base[0] + amplitude[0] * Math.sin(frequency[0] * t * 2 * Math.PI + phase[0]),
        base[1] + amplitude[1] * Math.cos(frequency[1] * t * 2 * Math.PI + phase[1]),
        base[2] + amplitude[2] * Math.sin(frequency[2] * t * 2 * Math.PI + phase[2]),
        base[3] + amplitude[3] * Math.cos(frequency[3] * t * 2 * Math.PI + phase[3])
      )
    } else {
      u.uJuliaConstant.value.set(...config.juliaConstant)
    }

    // Power animation - directly modify uPower like Mandelbulb does
    // This gives smoother animation and matches the Mandelbulb pattern
    if (config.powerAnimation.enabled) {
      const { minPower, maxPower, speed } = config.powerAnimation
      // Use controlled animation time (respects play/pause and speed)
      const t = animTime * speed * 2 * Math.PI
      const normalized = (Math.sin(t) + 1) / 2 // Maps [-1, 1] to [0, 1]
      const animatedPower = minPower + normalized * (maxPower - minPower)
      u.uPower.value = animatedPower  // Directly set uPower like Mandelbulb
      lastPowerRef.current = animatedPower
    }
    // Disable the separate animation uniform system (Mandelbulb pattern)
    u.uPowerAnimationEnabled.value = false
    u.uAnimatedPower.value = config.power

    // Dimension mixing - uses controlled animation time (matches Mandelbulb)
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
      u.uBasisX.value.set(wa.rotatedX)
      u.uBasisY.value.set(wa.rotatedY)
      u.uBasisZ.value.set(wa.rotatedZ)

      basisVectorsDirtyRef.current = false
    }

    // ============================================
    // Origin Update (separate from basis vectors)
    // Must update every frame when origin drift is enabled
    // ============================================
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

      // Apply origin drift if enabled (Technique C - animate slice origin in extra dims)
      if (config.originDriftEnabled && currentDimension >= 4) {
        const driftConfig: OriginDriftConfig = {
          enabled: true,
          amplitude: config.originDriftAmplitude,
          baseFrequency: config.originDriftBaseFrequency,
          frequencySpread: config.originDriftFrequencySpread,
        }
        // Get animation speed from store for consistent drift timing
        const animationSpeed = animStore.speed
        const driftedOrigin = computeDriftedOrigin(
          config.parameterValues,  // baseValues - extra dimension values only
          animTime,                // time - controlled animation time (respects play/pause)
          driftConfig,             // config
          animationSpeed,          // animationSpeed
          uiStore.animationBias    // animationBias
        )
        // Set drifted values for extra dimensions (indices 3+)
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

export default QuaternionJuliaMesh
