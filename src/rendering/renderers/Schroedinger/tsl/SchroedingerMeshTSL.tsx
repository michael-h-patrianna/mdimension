/**
 * SchroedingerMeshTSL - TSL-based N-dimensional Quantum Wavefunction Volume Renderer
 *
 * Renders quantum wavefunctions using volumetric raymarching with TSL.
 * Aims for 100% feature parity with the WebGL SchroedingerMesh.
 *
 * @module rendering/renderers/Schroedinger/tsl/SchroedingerMeshTSL
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MeshBasicNodeMaterial } from 'three/webgpu'

import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { needsVolumetricSeparation, RENDER_LAYERS } from '@/rendering/core/layers'
import { trackShaderCompilation, waitForGPUCompile } from '@/rendering/materials/shaderCompilationTracking'
import { useRotationUpdates, useQualityTracking } from '@/rendering/renderers/base'
import {
  composeSchroedingerTSL,
  type ComposedSchroedingerMaterial,
  type SchroedingerShaderConfig,
  type QuantumMode,
} from '@/rendering/tsl/raymarching/schroedinger'
import { useAnimationStore } from '@/stores/animationStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { createColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache'
import {
  flattenPresetForUniforms,
  generateQuantumPreset,
  getNamedPreset,
  type QuantumPreset,
} from '@/lib/geometry/extended/schroedinger/presets'
import { MAX_DIM, MAX_TERMS } from '@/rendering/tsl/raymarching/schroedinger/quantum/hoNDVariants'
import {
  generateHOEigenfunctionTextures,
  selectResolution,
  disposeHOTextures,
  needsTextureRegeneration,
  type HOTextureResult,
} from '@/rendering/tsl/raymarching/schroedinger/quantum/hoTexture'

interface SchroedingerMeshTSLInnerProps {
  dimension: number
  quantumMode: QuantumMode
  isoEnabled: boolean
  temporalAccumulation: boolean
}

/**
 * Inner component that handles the actual rendering.
 * Receives composition-affecting values as props to force remount on change.
 */
/**
 * Pre-allocated quantum uniform arrays
 */
interface QuantumArrays {
  omega: Float32Array
  quantum: Int32Array
  coeff: Float32Array
  energy: Float32Array
}

function createQuantumArrays(): QuantumArrays {
  return {
    omega: new Float32Array(MAX_DIM),
    quantum: new Int32Array(MAX_TERMS * MAX_DIM),
    coeff: new Float32Array(MAX_TERMS * 2),
    energy: new Float32Array(MAX_TERMS),
  }
}

const SchroedingerMeshTSLInner = ({
  dimension,
  quantumMode,
  isoEnabled,
  temporalAccumulation,
}: SchroedingerMeshTSLInnerProps) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, size } = useThree()
  const materialRef = useRef<MeshBasicNodeMaterial | null>(null)

  // Use shared quality tracking hook (matches WebGL implementation)
  const { rotationsChanged, effectiveFastMode } = useQualityTracking()

  // Get Schroedinger config from store (via getState for performance)
  const schroedingerState = useExtendedObjectStore.getState().schroedinger
  const parameterValues = schroedingerState.parameterValues

  // Rotation updates for N-D slicing
  const rotationUpdates = useRotationUpdates({ dimension, parameterValues })

  // Pre-allocated quantum arrays for HO preset system
  const quantumArraysRef = useRef<QuantumArrays>(createQuantumArrays())

  // Track quantum config changes to regenerate preset
  const prevQuantumConfigRef = useRef<{
    presetName: string
    seed: number
    termCount: number
    maxQuantumNumber: number
    frequencySpread: number
    dimension: number
  } | null>(null)
  const currentPresetRef = useRef<QuantumPreset | null>(null)

  // Eigenfunction textures for 8-term HO support
  const eigenfunctionTexturesRef = useRef<HOTextureResult | null>(null)

  // Cached linear colors for non-lighting uniforms
  const colorCacheRef = useRef(createColorCache())

  // Dirty-flag tracking for appearance and IBL
  const lastAppearanceVersionRef = useRef(-1)
  const lastIblVersionRef = useRef(-1)

  // ============================================
  // Generate initial eigenfunction textures for HO mode
  // These are created synchronously for shader composition.
  // Textures are regenerated when preset changes (in useFrame).
  // ============================================
  const initialEigenfunctionTextures = useMemo(() => {
    if (quantumMode !== 'harmonicOscillator') {
      return null
    }

    // Get initial preset from store
    const schState = useExtendedObjectStore.getState().schroedinger
    const { presetName, seed, termCount, maxQuantumNumber, frequencySpread } = schState

    // Generate preset
    let preset: QuantumPreset
    if (presetName === 'custom') {
      preset = generateQuantumPreset(seed, dimension, termCount, maxQuantumNumber, frequencySpread)
    } else {
      preset = getNamedPreset(presetName, dimension) ??
        generateQuantumPreset(seed, dimension, termCount, maxQuantumNumber, frequencySpread)
    }

    // Store for later reference
    currentPresetRef.current = preset

    // Generate eigenfunction textures
    const resolution = selectResolution(preset)
    const fieldScale = schState.fieldScale ?? 5.0
    const textures = generateHOEigenfunctionTextures(preset, {
      dimension,
      resolution,
      fieldScale,
    })

    // Store for cleanup
    eigenfunctionTexturesRef.current = textures

    if (import.meta.env.DEV) {
      console.log(`[SchroedingerMeshTSL] Generated eigenfunction textures: ${textures.termCount} terms, ${resolution}³ resolution`)
    }

    return textures
  }, [dimension, quantumMode])

  // Cleanup eigenfunction textures on unmount or mode change
  useEffect(() => {
    return () => {
      if (eigenfunctionTexturesRef.current) {
        disposeHOTextures(eigenfunctionTexturesRef.current)
        eigenfunctionTexturesRef.current = null
      }
    }
  }, [quantumMode])

  // Compose the TSL material with current config
  const composed: ComposedSchroedingerMaterial = useMemo(() => {
    const config: SchroedingerShaderConfig = {
      dimension,
      quantumMode,
      isosurface: isoEnabled,
      temporalAccumulation: temporalAccumulation && !isoEnabled, // Only for volumetric mode
      // Pass eigenfunction textures for 8-term HO support
      eigenfunctionTextures: initialEigenfunctionTextures ?? undefined,
    }

    const result = composeSchroedingerTSL(config)

    if (import.meta.env.DEV) {
      console.log('[SchroedingerMeshTSL] Composed material with features:', result.features)
    }

    materialRef.current = result.material
    return result
  }, [dimension, quantumMode, isoEnabled, temporalAccumulation])

  const { material, uniforms } = composed

  // Proper cleanup of material on dimension/feature change or unmount
  useEffect(() => {
    return () => {
      try {
        material.dispose()
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[SchroedingerMeshTSL] Material dispose warning:', e)
        }
      }
    }
  }, [material])

  // Track shader compilation for overlay display
  useEffect(() => {
    const stopTracking = trackShaderCompilation(`Schrödinger ${dimension}D (TSL)`)

    const cancelWait = waitForGPUCompile(() => {
      stopTracking()
    })

    return () => {
      cancelWait()
      stopTracking()
    }
  }, [material, dimension])

  // Assign layer based on temporal accumulation mode
  // When temporal cloud accumulation is active, use VOLUMETRIC layer for separate rendering
  // CRITICAL: Use useLayoutEffect to ensure layer is set BEFORE first render
  const useVolumetricLayer = temporalAccumulation && !isoEnabled
  useLayoutEffect(() => {
    if (meshRef.current?.layers) {
      const shouldUseVolumetric = needsVolumetricSeparation({
        temporalCloudAccumulation: useVolumetricLayer,
        objectType: 'schroedinger',
      })

      if (shouldUseVolumetric) {
        // Use VOLUMETRIC layer for temporal accumulation (rendered separately at 1/4 res)
        meshRef.current.layers.set(RENDER_LAYERS.VOLUMETRIC)
        if (import.meta.env.DEV) {
          console.warn('[SchroedingerMeshTSL] Layer set to VOLUMETRIC:', RENDER_LAYERS.VOLUMETRIC)
        }
      } else {
        // Standard main object layer (rendered as part of main scene)
        meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT)
        if (import.meta.env.DEV) {
          console.warn('[SchroedingerMeshTSL] Layer set to MAIN_OBJECT:', RENDER_LAYERS.MAIN_OBJECT)
        }
      }
    }
  }, [useVolumetricLayer])

  // Version tracking for dirty-flag optimization
  const lastSchroedingerVersionRef = useRef(-1)

  // Track frame count for debugging
  const frameCountRef = useRef(0)

  // Per-frame uniform updates (mirrors WebGL implementation)
  useFrame(() => {
    frameCountRef.current++

    if (!meshRef.current) return

    // Get current state values via getState (avoids re-render subscriptions)
    const extendedState = useExtendedObjectStore.getState()
    const schroedinger = extendedState.schroedinger
    const schroedingerVersion = extendedState.schroedingerVersion ?? 0
    const accumulatedTime = useAnimationStore.getState().accumulatedTime

    // Camera position for raymarching
    uniforms.uCameraPosition.value.copy(camera.position)

    // Resolution
    uniforms.uResolution.value.set(size.width, size.height)

    // Time animation (use accumulatedTime which respects pause state)
    uniforms.uTime.value = accumulatedTime
    uniforms.uTimeScale.value = schroedinger.timeScale ?? 0.5
    // Fast mode follows the global quality tracking hook (animation playing + setting enabled)
    uniforms.uFastMode.value = effectiveFastMode

    // Model matrices for ray transformation
    meshRef.current.updateMatrixWorld(true)
    uniforms.uModelMatrix.value.copy(meshRef.current.matrixWorld)
    uniforms.uInverseModelMatrix.value.copy(meshRef.current.matrixWorld).invert()

    // Camera matrices - CRITICAL for MRT depth/normal output
    uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)
    // Inverse view projection matrix (needed for temporal reprojection)
    uniforms.uInverseViewProjectionMatrix.value
      .copy(camera.projectionMatrixInverse)
      .premultiply(camera.matrixWorld)

    // Apply scale to mesh
    const scale = schroedinger.scale
    meshRef.current.scale.set(scale, scale, scale)

    // Dimension
    uniforms.uDimension.value = dimension

    // Update basis vectors from rotation (using hook's rotationsChanged)
    const {
      basisX,
      basisY,
      basisZ,
      changed: basisChanged,
    } = rotationUpdates.getBasisVectors(rotationsChanged)
    const { origin, changed: originChanged } = rotationUpdates.getOrigin(schroedinger.parameterValues)

    // Pack into vec4 uniforms (dimensions 0-3)
    if (basisChanged) {
      uniforms.uBasisX0.value.set(
        basisX[0] ?? 0,
        basisX[1] ?? 0,
        basisX[2] ?? 0,
        basisX[3] ?? 0
      )
      uniforms.uBasisY0.value.set(
        basisY[0] ?? 0,
        basisY[1] ?? 0,
        basisY[2] ?? 0,
        basisY[3] ?? 0
      )
      uniforms.uBasisZ0.value.set(
        basisZ[0] ?? 0,
        basisZ[1] ?? 0,
        basisZ[2] ?? 0,
        basisZ[3] ?? 0
      )
      // Second vec4 for dimensions 4-7
      uniforms.uBasisX1.value.set(
        basisX[4] ?? 0,
        basisX[5] ?? 0,
        basisX[6] ?? 0,
        basisX[7] ?? 0
      )
      uniforms.uBasisY1.value.set(
        basisY[4] ?? 0,
        basisY[5] ?? 0,
        basisY[6] ?? 0,
        basisY[7] ?? 0
      )
      uniforms.uBasisZ1.value.set(
        basisZ[4] ?? 0,
        basisZ[5] ?? 0,
        basisZ[6] ?? 0,
        basisZ[7] ?? 0
      )
      // Third vec4 for dimensions 8-10 (for 9D, 10D, 11D modes)
      uniforms.uBasisX2.value.set(
        basisX[8] ?? 0,
        basisX[9] ?? 0,
        basisX[10] ?? 0,
        0 // w unused
      )
      uniforms.uBasisY2.value.set(
        basisY[8] ?? 0,
        basisY[9] ?? 0,
        basisY[10] ?? 0,
        0 // w unused
      )
      uniforms.uBasisZ2.value.set(
        basisZ[8] ?? 0,
        basisZ[9] ?? 0,
        basisZ[10] ?? 0,
        0 // w unused
      )
    }
    if (originChanged) {
      uniforms.uOrigin0.value.set(
        origin[0] ?? 0,
        origin[1] ?? 0,
        origin[2] ?? 0,
        origin[3] ?? 0
      )
      uniforms.uOrigin1.value.set(
        origin[4] ?? 0,
        origin[5] ?? 0,
        origin[6] ?? 0,
        origin[7] ?? 0
      )
      uniforms.uOrigin2.value.set(
        origin[8] ?? 0,
        origin[9] ?? 0,
        origin[10] ?? 0,
        0 // w unused
      )
    }

    // Schroedinger-specific uniforms (dirty-flag check)
    if (schroedingerVersion !== lastSchroedingerVersionRef.current) {
      // Volume rendering parameters
      uniforms.uDensityGain.value = schroedinger.densityGain ?? 2.0
      uniforms.uVolumeScale.value = schroedinger.fieldScale ?? 1.0
      uniforms.uFieldScale.value = schroedinger.fieldScale ?? 1.0

      // Hydrogen quantum parameters
      const validN = Math.max(1, schroedinger.principalQuantumNumber ?? 2)
      const validL = Math.max(0, Math.min(schroedinger.azimuthalQuantumNumber ?? 1, validN - 1))
      const validM = Math.max(-validL, Math.min(schroedinger.magneticQuantumNumber ?? 0, validL))

      uniforms.uPrincipalN.value = validN
      uniforms.uAzimuthalL.value = validL
      uniforms.uMagneticM.value = validM
      uniforms.uBohrRadius.value = schroedinger.bohrRadiusScale ?? 1.0
      uniforms.uUseRealOrbitals.value = schroedinger.useRealOrbitals ?? true

      // Extra dimension quantum numbers (Hydrogen ND mode)
      const extraN = schroedinger.extraDimQuantumNumbers ?? [0, 0, 0, 0, 0, 0, 0, 0]
      const extraOmega = schroedinger.extraDimOmega ?? [1, 1, 1, 1, 1, 1, 1, 1]
      const extraSpread = schroedinger.extraDimFrequencySpread ?? 0

      uniforms.uExtraDimN0.value.set(
        extraN[0] ?? 0,
        extraN[1] ?? 0,
        extraN[2] ?? 0,
        extraN[3] ?? 0
      )
      uniforms.uExtraDimN1.value.set(
        extraN[4] ?? 0,
        extraN[5] ?? 0,
        extraN[6] ?? 0,
        extraN[7] ?? 0
      )

      // Apply frequency spread to omega values (like WebGL)
      uniforms.uExtraDimOmega0.value.set(
        (extraOmega[0] ?? 1) * (1.0 + (0 - 3.5) * extraSpread),
        (extraOmega[1] ?? 1) * (1.0 + (1 - 3.5) * extraSpread),
        (extraOmega[2] ?? 1) * (1.0 + (2 - 3.5) * extraSpread),
        (extraOmega[3] ?? 1) * (1.0 + (3 - 3.5) * extraSpread)
      )
      uniforms.uExtraDimOmega1.value.set(
        (extraOmega[4] ?? 1) * (1.0 + (4 - 3.5) * extraSpread),
        (extraOmega[5] ?? 1) * (1.0 + (5 - 3.5) * extraSpread),
        (extraOmega[6] ?? 1) * (1.0 + (6 - 3.5) * extraSpread),
        (extraOmega[7] ?? 1) * (1.0 + (7 - 3.5) * extraSpread)
      )

      // Erosion effects
      uniforms.uErosionStrength.value = schroedinger.erosionStrength ?? 0.0
      uniforms.uErosionScale.value = schroedinger.erosionScale ?? 1.0
      uniforms.uErosionTurbulence.value = schroedinger.erosionTurbulence ?? 0.0
      uniforms.uErosionNoiseType.value = schroedinger.erosionNoiseType ?? 0

      // Curl flow
      uniforms.uCurlEnabled.value = schroedinger.curlEnabled ?? false
      uniforms.uCurlStrength.value = schroedinger.curlStrength ?? 0.0
      uniforms.uCurlScale.value = schroedinger.curlScale ?? 1.0
      uniforms.uCurlSpeed.value = schroedinger.curlSpeed ?? 1.0
      uniforms.uCurlBias.value = schroedinger.curlBias ?? 0

      // Dispersion
      uniforms.uDispersionEnabled.value = schroedinger.dispersionEnabled ?? false
      uniforms.uDispersionStrength.value = schroedinger.dispersionStrength ?? 0.0

      // Shadows
      uniforms.uShadowsEnabled.value = schroedinger.shadowsEnabled ?? false
      uniforms.uShadowStrength.value = schroedinger.shadowStrength ?? 0.5
      uniforms.uShadowSteps.value = schroedinger.shadowSteps ?? 4

      // Ambient Occlusion
      uniforms.uAoEnabled.value = schroedinger.aoEnabled ?? false
      uniforms.uAoStrength.value = schroedinger.aoStrength ?? 0.5
      uniforms.uAoRadius.value = schroedinger.aoRadius ?? 0.5
      uniforms.uAoSteps.value = schroedinger.aoQuality ?? 4

      // Quantum effects
      uniforms.uNodalEnabled.value = schroedinger.nodalEnabled ?? false
      uniforms.uNodalStrength.value = schroedinger.nodalStrength ?? 1.0
      uniforms.uEnergyColorEnabled.value = schroedinger.energyColorEnabled ?? false
      uniforms.uShimmerEnabled.value = schroedinger.shimmerEnabled ?? false
      uniforms.uShimmerStrength.value = schroedinger.shimmerStrength ?? 0.5

      // Isosurface mode
      uniforms.uIsoEnabled.value = isoEnabled
      uniforms.uIsoThreshold.value = schroedinger.isoThreshold ?? -3.0

      // Powder and scattering
      uniforms.uPowderScale.value = schroedinger.powderScale ?? 0.5
      uniforms.uScatteringAnisotropy.value = schroedinger.scatteringAnisotropy ?? 0.0

      // Opacity from appearance or store
      uniforms.uOpacity.value = 1.0

      // ============================================
      // Harmonic Oscillator Preset System (matching WebGL)
      // ============================================
      if (quantumMode === 'harmonicOscillator') {
        const { presetName, seed, termCount, maxQuantumNumber, frequencySpread, spreadAnimationEnabled, spreadAnimationSpeed } = schroedinger

        let effectiveSpread = frequencySpread
        if (spreadAnimationEnabled) {
          // Wavepacket Dispersion Animation
          const t = accumulatedTime * (spreadAnimationSpeed ?? 0.5)
          const phase = (Math.sin(t) + 1.0) * 0.5 // 0 to 1
          effectiveSpread = 0.01 + phase * 0.44
        }

        const currentConfig = {
          presetName,
          seed,
          termCount,
          maxQuantumNumber,
          frequencySpread: effectiveSpread,
          dimension,
        }

        const needsPresetRegen =
          !prevQuantumConfigRef.current ||
          prevQuantumConfigRef.current.presetName !== currentConfig.presetName ||
          prevQuantumConfigRef.current.seed !== currentConfig.seed ||
          prevQuantumConfigRef.current.termCount !== currentConfig.termCount ||
          prevQuantumConfigRef.current.maxQuantumNumber !== currentConfig.maxQuantumNumber ||
          Math.abs(prevQuantumConfigRef.current.frequencySpread - currentConfig.frequencySpread) > 0.001 ||
          prevQuantumConfigRef.current.dimension !== currentConfig.dimension

        if (needsPresetRegen) {
          // Generate or get preset
          let preset: QuantumPreset
          if (presetName === 'custom') {
            preset = generateQuantumPreset(seed, dimension, termCount, maxQuantumNumber, frequencySpread)
          } else {
            preset = getNamedPreset(presetName, dimension) ??
              generateQuantumPreset(seed, dimension, termCount, maxQuantumNumber, frequencySpread)
          }

          currentPresetRef.current = preset
          prevQuantumConfigRef.current = { ...currentConfig }

          // Flatten and update uniform arrays
          // Note: flattenPresetForUniforms uses WebGL MAX_TERMS (8) but TSL uses MAX_TERMS (2)
          // Only copy the elements that fit in our smaller TSL arrays
          const flatData = flattenPresetForUniforms(preset)
          quantumArraysRef.current.omega.set(flatData.omega.subarray(0, MAX_DIM))
          quantumArraysRef.current.quantum.set(flatData.quantum.subarray(0, MAX_TERMS * MAX_DIM))
          quantumArraysRef.current.coeff.set(flatData.coeff.subarray(0, MAX_TERMS * 2))
          quantumArraysRef.current.energy.set(flatData.energy.subarray(0, MAX_TERMS))

          // Update uniforms - TSL uses different structure, need to check if these exist
          // Clamp termCount to MAX_TERMS to avoid shader out-of-bounds access
          uniforms.uTermCount.value = Math.min(preset.termCount, MAX_TERMS)

          // Note: TSL uniformArray uses .array property for underlying array access
          // - uOmega: UniformArrayNode<number> - access via .array, set values directly
          // - uQuantum: UniformArrayNode<number> - access via .array, set values directly
          // - uCoeff: UniformArrayNode<Vector2> - access via .array, Vector2 elements
          // - uEnergy: UniformArrayNode<number> - access via .array, set values directly
          if ('uOmega' in uniforms && uniforms.uOmega) {
            const omegaArray = (uniforms.uOmega as unknown as { array: number[] }).array
            const sourceOmega = quantumArraysRef.current.omega
            for (let i = 0; i < Math.min(omegaArray.length, sourceOmega.length); i++) {
              const srcVal = sourceOmega[i]
              if (srcVal !== undefined) omegaArray[i] = srcVal
            }
          }
          if ('uQuantum' in uniforms && uniforms.uQuantum) {
            const quantumArray = (uniforms.uQuantum as unknown as { array: number[] }).array
            const sourceQuantum = quantumArraysRef.current.quantum
            for (let i = 0; i < Math.min(quantumArray.length, sourceQuantum.length); i++) {
              const srcVal = sourceQuantum[i]
              if (srcVal !== undefined) quantumArray[i] = srcVal
            }
          }
          // uCoeff is UniformArrayNode<Vector2> - convert from interleaved Float32Array
          if ('uCoeff' in uniforms && uniforms.uCoeff) {
            const coeffArray = (uniforms.uCoeff as unknown as { array: THREE.Vector2[] }).array
            const coeffData = quantumArraysRef.current.coeff
            const termCount = preset.termCount
            // Update existing Vector2 elements in place
            for (let i = 0; i < Math.min(termCount, coeffArray.length); i++) {
              const elem = coeffArray[i]
              const re = coeffData[i * 2]
              const im = coeffData[i * 2 + 1]
              if (elem && re !== undefined && im !== undefined) {
                elem.set(re, im)
              }
            }
          }
          // uEnergy is UniformArrayNode<number> - update from Float32Array
          if ('uEnergy' in uniforms && uniforms.uEnergy) {
            const energyArray = (uniforms.uEnergy as unknown as { array: number[] }).array
            const energyData = quantumArraysRef.current.energy
            const termCount = preset.termCount
            // Update values
            for (let i = 0; i < Math.min(termCount, energyArray.length); i++) {
              const srcVal = energyData[i]
              if (srcVal !== undefined) energyArray[i] = srcVal
            }
          }
        }
      }

      lastSchroedingerVersionRef.current = schroedingerVersion
    }

    // ============================================
    // Appearance Store Uniforms (SSS, Emission, Fresnel)
    // ============================================
    const appearanceState = useAppearanceStore.getState()
    const appearanceVersion = appearanceState.appearanceVersion

    if (appearanceVersion !== lastAppearanceVersionRef.current) {
      const { sssEnabled, sssIntensity, sssColor, sssThickness, sssJitter, faceEmission, faceEmissionThreshold, faceEmissionColorShift, faceEmissionPulsing, faceRimFalloff, faceColor, edgesVisible, fresnelIntensity, edgeColor } = appearanceState

      // Cache for linear color conversion
      const cache = colorCacheRef.current

      // SSS uniforms
      if ('uSssEnabled' in uniforms && uniforms.uSssEnabled) uniforms.uSssEnabled.value = sssEnabled
      if ('uSssIntensity' in uniforms && uniforms.uSssIntensity) uniforms.uSssIntensity.value = sssIntensity
      if ('uSssColor' in uniforms && uniforms.uSssColor) {
        updateLinearColorUniform(cache.faceColor, uniforms.uSssColor.value as THREE.Color, sssColor || '#ff8844')
      }
      if ('uSssThickness' in uniforms && uniforms.uSssThickness) uniforms.uSssThickness.value = sssThickness
      if ('uSssJitter' in uniforms && uniforms.uSssJitter) uniforms.uSssJitter.value = sssJitter

      // Emission uniforms
      if ('uEmissionIntensity' in uniforms && uniforms.uEmissionIntensity) uniforms.uEmissionIntensity.value = faceEmission
      if ('uEmissionThreshold' in uniforms && uniforms.uEmissionThreshold) uniforms.uEmissionThreshold.value = faceEmissionThreshold
      if ('uEmissionColorShift' in uniforms && uniforms.uEmissionColorShift) uniforms.uEmissionColorShift.value = faceEmissionColorShift
      if ('uEmissionPulsing' in uniforms && uniforms.uEmissionPulsing) uniforms.uEmissionPulsing.value = faceEmissionPulsing
      if ('uRimExponent' in uniforms && uniforms.uRimExponent) uniforms.uRimExponent.value = faceRimFalloff

      // Face color
      if ('uColor' in uniforms && uniforms.uColor) {
        updateLinearColorUniform(cache.faceColor, uniforms.uColor.value as THREE.Color, faceColor)
      }

      // Fresnel uniforms
      if ('uFresnelEnabled' in uniforms && uniforms.uFresnelEnabled) uniforms.uFresnelEnabled.value = edgesVisible
      if ('uFresnelIntensity' in uniforms && uniforms.uFresnelIntensity) uniforms.uFresnelIntensity.value = fresnelIntensity
      if ('uRimColor' in uniforms && uniforms.uRimColor) {
        updateLinearColorUniform(cache.rimColor, uniforms.uRimColor.value as THREE.Color, edgeColor)
      }

      // Note: Color algorithm uniforms (uColorAlgorithm, uCosineA/B/C/D, uDistPower, etc.)
      // are initialized with defaults in composeSchroedingerTSL.ts.
      // The WebGL version also doesn't update these from stores - they use defaults.
      // When a color configuration store is added, this is where updates would go.

      lastAppearanceVersionRef.current = appearanceVersion
    }

    // ============================================
    // IBL (Image-Based Lighting) Uniforms
    // ============================================
    const environmentState = useEnvironmentStore.getState()
    const iblVersion = environmentState.iblVersion

    if (iblVersion !== lastIblVersionRef.current) {
      // Note: TSL material may not have IBL uniforms - check existence first
      if ('uIBLIntensity' in uniforms && uniforms.uIBLIntensity) {
        (uniforms.uIBLIntensity as unknown as { value: number }).value = environmentState.iblIntensity
      }

      lastIblVersionRef.current = iblVersion
    }

  }, FRAME_PRIORITY.RENDERER_UNIFORMS)

  // Box geometry is fixed size 4 - the mesh.scale transform handles the actual scale
  // This matches WebGL: <boxGeometry args={[4, 4, 4]} />
  const boxSize = 4

  // Log mesh state on mount (development only)
  useEffect(() => {
    if (import.meta.env.DEV && meshRef.current) {
      const mat = meshRef.current.material
      const matType = mat && !Array.isArray(mat) ? mat.type : 'unknown'
      console.log('[SchroedingerMeshTSL] Mesh mounted with material:', matType)
    }
  }, [material])

  return (
    <mesh
      ref={meshRef}
      frustumCulled={false} // DEBUG: Disable frustum culling to ensure mesh is always rendered
    >
      <boxGeometry args={[boxSize, boxSize, boxSize]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

/**
 * SchroedingerMeshTSL - Main export component
 *
 * Subscribes to composition-affecting values and uses key prop to force
 * component remount when shader recompilation is needed.
 */
export const SchroedingerMeshTSL = () => {
  // Values that affect shader composition (material recreation required)
  const dimension = useGeometryStore((state) => state.dimension)
  const quantumMode = useExtendedObjectStore(
    (state) => (state.schroedinger.quantumMode ?? 'hydrogenND') as QuantumMode
  )
  const isoEnabled = useExtendedObjectStore((state) => state.schroedinger.isoEnabled ?? false)

  // Temporal reprojection enabled state (affects layer assignment and shader compilation)
  const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled)

  // For volumetric mode with temporal enabled, use temporal ACCUMULATION (Horizon-style)
  // For isosurface mode with temporal enabled, use temporal REPROJECTION (depth-skip)
  const useTemporalAccumulation = temporalEnabled && !isoEnabled

  // Key forces recreation when composition-affecting values change
  const compositionKey = `schroedinger-${dimension}-${quantumMode}-iso${isoEnabled}-temp${useTemporalAccumulation}`

  return (
    <SchroedingerMeshTSLInner
      key={compositionKey}
      dimension={dimension}
      quantumMode={quantumMode}
      isoEnabled={isoEnabled}
      temporalAccumulation={useTemporalAccumulation}
    />
  )
}
