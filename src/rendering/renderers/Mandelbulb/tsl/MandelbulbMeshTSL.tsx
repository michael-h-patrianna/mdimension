/**
 * MandelbulbMeshTSL - WebGPU-compatible Mandelbulb renderer using TSL shader composition
 *
 * Renders 3D-11D Mandelbulb fractals using GPU raymarching with TSL node materials.
 * Uses proper shader composition to:
 * - Select dimension-specific SDF at compose time (not runtime!)
 * - Exclude unused features from shader graph (not toggle with uniforms!)
 * - Recreate material when dimension/features change
 *
 * This mirrors the WebGL composeMandelbulbShader pattern.
 *
 * @module rendering/renderers/Mandelbulb/tsl/MandelbulbMeshTSL
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, memo } from 'react'
import * as THREE from 'three'

import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { trackShaderCompilation, waitForGPUCompile } from '@/rendering/materials/shaderCompilationTracking'
import { useLayerAssignment, useRotationUpdates, useQualityTracking } from '@/rendering/renderers/base'
import { SHADOW_QUALITY_TO_INT } from '@/rendering/shadows/types'
import {
  composeMandelbulbTSL,
  type MandelbulbShaderConfig,
  type ComposedMandelbulbMaterial,
} from '@/rendering/tsl/raymarching/mandelbulb/composeMandelbulbTSL'
import { updateColorTSLUniforms } from '@/rendering/tsl/color/color-uniforms'
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette'
import { useTemporalDepthUniforms } from '@/rendering/core/useTemporalDepthUniforms'

// Store imports
import { useAnimationStore } from '@/stores/animationStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePBRStore } from '@/stores/pbrStore'
import { getEffectiveShadowQuality, usePerformanceStore } from '@/stores/performanceStore'
import { usePostProcessingStore } from '@/stores/postProcessingStore'

interface MandelbulbMeshTSLInnerProps {
  dimension: number
}

/**
 * Inner component that does the actual rendering.
 * Receives dimension as a prop and recreates material when it changes.
 */
const MandelbulbMeshTSLInner = ({ dimension }: MandelbulbMeshTSLInnerProps) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, size, viewport, scene } = useThree()

  // Assign main object layer for depth-based effects
  useLayerAssignment(meshRef)

  // Use shared quality tracking hook (matches WebGL implementation)
  const { rotationsChanged } = useQualityTracking()

  // Get Mandelbulb config from store
  const scale = useExtendedObjectStore((state) => state.mandelbulb.scale)
  const parameterValues = useExtendedObjectStore((state) => state.mandelbulb.parameterValues)

  // Get rotation updates
  const rotationUpdates = useRotationUpdates({ dimension, parameterValues })

  // Power animation parameters
  const powerAnimationEnabled = useExtendedObjectStore(
    (state) => state.mandelbulb.powerAnimationEnabled
  )
  const powerMin = useExtendedObjectStore((state) => state.mandelbulb.powerMin)
  const powerMax = useExtendedObjectStore((state) => state.mandelbulb.powerMax)
  const powerSpeed = useExtendedObjectStore((state) => state.mandelbulb.powerSpeed)

  // Phase shift parameters
  const phaseShiftEnabled = useExtendedObjectStore((state) => state.mandelbulb.phaseShiftEnabled)
  const phaseSpeed = useExtendedObjectStore((state) => state.mandelbulb.phaseSpeed)
  const phaseAmplitude = useExtendedObjectStore((state) => state.mandelbulb.phaseAmplitude)

  // Get feature flags from stores for composition
  // Shadow/AO come from lighting store (not mandelbulb config) - matches WebGL
  const shadowEnabled = useLightingStore((state) => state.shadowEnabled)
  const sssEnabled = useExtendedObjectStore((state) => state.mandelbulb.sssEnabled)
  // AO is controlled by SSAO toggle in post-processing store
  const ssaoEnabled = usePostProcessingStore((state) => state.ssaoEnabled)
  const edgesVisible = useAppearanceStore((state) => state.edgesVisible)
  // NOTE: Temporal reprojection is disabled for WebGPU because the render graph integration
  // for reading the previous frame's position buffer isn't fully wired up yet.
  // The TSL material DOES output MRT (gColor, gNormal, gPosition), but the TemporalDepthCapturePass
  // doesn't capture from the WebGPU render pipeline. Once render graph captures position data,
  // temporal can be re-enabled.
  // TODO: Re-add when WebGPU render graph captures position buffer:
  // const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled)

  // Get temporal depth uniforms getter from render graph store
  // NOTE: Kept for future use when TSL MRT output is implemented
  const getTemporalUniforms = useTemporalDepthUniforms()

  // Build shader config for composition
  // This determines which features are INCLUDED in the shader graph
  //
  // NOTE: Temporal reprojection is DISABLED for WebGPU/TSL because the render graph
  // integration for capturing the previous frame's position buffer isn't fully wired up.
  // The TSL material DOES output MRT correctly (via mrtNode), but the TemporalDepthCapturePass
  // doesn't read from the WebGPU pipeline's position attachment yet.
  // TODO: Enable temporal once render graph captures position buffer from WebGPU.
  const shaderConfig: MandelbulbShaderConfig = useMemo(
    () => ({
      dimension,
      shadows: shadowEnabled ?? false,
      sss: sssEnabled ?? false,
      ao: ssaoEnabled ?? false, // Controlled by SSAO post-processing toggle
      fresnel: edgesVisible ?? false,
      temporal: false, // DISABLED for WebGPU - TSL doesn't support MRT output yet
    }),
    [dimension, shadowEnabled, sssEnabled, ssaoEnabled, edgesVisible]
  )

  // Compose material with dimension-specific SDF and conditional features
  // Material is RECREATED when dimension or features change
  const composedResult = useMemo((): ComposedMandelbulbMaterial => {
    if (import.meta.env.DEV) {
      console.log(
        `[MandelbulbMeshTSL] Composing material for ${dimension}D with features:`,
        shaderConfig
      )
    }
    return composeMandelbulbTSL(shaderConfig)
  }, [shaderConfig, dimension])

  const { material, uniforms, features, sdfName } = composedResult

  // Log composition result in dev mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(`[MandelbulbMeshTSL] Using ${sdfName} with features: [${features.join(', ')}]`)
    }
  }, [sdfName, features])

  // Proper cleanup of material on dimension/feature change or unmount
  useEffect(() => {
    return () => {
      try {
        material.dispose()
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[MandelbulbMeshTSL] Material dispose warning:', e)
        }
      }
    }
  }, [material])

  // Track shader compilation for overlay display
  useEffect(() => {
    const stopTracking = trackShaderCompilation(`Mandelbulb ${dimension}D (TSL)`)
    
    // Wait for GPU to compile the shader, then hide overlay
    const cancelWait = waitForGPUCompile(() => {
      stopTracking()
    })

    return () => {
      cancelWait()
      stopTracking()
    }
  }, [material, dimension]) // Re-run when material changes (recompilation)

  // Version tracking for dirty-flag optimization
  const lastMandelbulbVersionRef = useRef(-1)
  const lastPBRVersionRef = useRef(-1)
  const lastLightingVersionRef = useRef(-1)
  const lastIblVersionRef = useRef(-1)

  // Pre-allocated array for origin values
  const originValuesRef = useRef(new Float32Array(11))

  // Update uniforms each frame
  useFrame(() => {
    if (!meshRef.current) return

    const accumulatedTime = useAnimationStore.getState().accumulatedTime

    // Update camera position
    uniforms.uCameraPosition.value.copy(camera.position)

    // Update resolution with DPR
    const dpr = viewport.dpr
    uniforms.uResolution.value.set(Math.floor(size.width * dpr), Math.floor(size.height * dpr))

    // Update model matrices
    uniforms.uModelMatrix.value.copy(meshRef.current.matrixWorld)
    uniforms.uInverseModelMatrix.value.copy(meshRef.current.matrixWorld).invert()

    // Update view/projection matrices (for MRT depth calculation matching WebGL gl_FragDepth)
    uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)

    // Get store versions
    const extendedState = useExtendedObjectStore.getState()
    const mandelbulbVersion = extendedState.mandelbulbVersion
    const pbrState = usePBRStore.getState()
    const pbrVersion = pbrState.pbrVersion
    const lightingState = useLightingStore.getState()
    const lightingVersion = lightingState.version

    // Mandelbulb parameters (dirty-flag check)
    if (mandelbulbVersion !== lastMandelbulbVersionRef.current) {
      const mbConfig = extendedState.mandelbulb
      uniforms.uIterations.value = mbConfig.maxIterations
      uniforms.uEscapeRadius.value = mbConfig.escapeRadius
      uniforms.uSdfSurfaceDistance.value = mbConfig.sdfSurfaceDistance

      if (!mbConfig.powerAnimationEnabled) {
        uniforms.uPower.value = mbConfig.mandelbulbPower
      }

      uniforms.uAlternatePowerEnabled.value = mbConfig.alternatePowerEnabled
      uniforms.uAlternatePowerValue.value = mbConfig.alternatePowerValue
      uniforms.uAlternatePowerBlend.value = mbConfig.alternatePowerBlend

      lastMandelbulbVersionRef.current = mandelbulbVersion
    }

    // Power animation
    if (powerAnimationEnabled) {
      const t = accumulatedTime * powerSpeed * 2 * Math.PI
      const normalized = (Math.sin(t) + 1) / 2
      uniforms.uPower.value = powerMin + normalized * (powerMax - powerMin)
    }

    // Phase shift animation
    uniforms.uPhaseEnabled.value = phaseShiftEnabled
    if (phaseShiftEnabled) {
      const t = accumulatedTime * phaseSpeed * 2 * Math.PI
      uniforms.uPhaseTheta.value = phaseAmplitude * Math.sin(t)
      uniforms.uPhasePhi.value = phaseAmplitude * Math.sin(t * 1.618)
    } else {
      uniforms.uPhaseTheta.value = 0
      uniforms.uPhasePhi.value = 0
    }

    // PBR parameters (dirty-flag check)
    if (pbrVersion !== lastPBRVersionRef.current) {
      const facePBRConfig = pbrState.face
      uniforms.uRoughness.value = facePBRConfig.roughness
      uniforms.uMetallic.value = facePBRConfig.metallic
      lastPBRVersionRef.current = pbrVersion
    }

    // Lighting parameters (dirty-flag check)
    if (lightingVersion !== lastLightingVersionRef.current) {
      uniforms.uAmbientEnabled.value = lightingState.ambientEnabled ? 1.0 : 0.0
      uniforms.uAmbientColor.value.set(lightingState.ambientColor).convertSRGBToLinear()
      uniforms.uAmbientIntensity.value = lightingState.ambientIntensity

      // Update multi-light system
      uniforms.uNumLights.value = Math.min(lightingState.lights.length, 4)
      for (let i = 0; i < 4; i++) {
        const light = lightingState.lights[i]
        if (light) {
          uniforms.uLightsEnabled[i]!.value = light.enabled
          uniforms.uLightTypes[i]!.value = light.type === 'point' ? 0 : light.type === 'directional' ? 1 : 2
          if ('position' in light) {
            uniforms.uLightPositions[i]!.value.set(...(light.position as [number, number, number]))
          }
          if ('direction' in light) {
            uniforms.uLightDirections[i]!.value.copy(light.direction as THREE.Vector3)
          }
          uniforms.uLightColors[i]!.value.set(light.color).convertSRGBToLinear()
          uniforms.uLightIntensities[i]!.value = light.intensity
          uniforms.uLightRanges[i]!.value = light.range ?? 0
          uniforms.uLightDecays[i]!.value = light.decay ?? 2
          if ('coneAngle' in light) {
            const outerAngle = ((light.coneAngle as number) * Math.PI) / 180
            const innerAngle = outerAngle * (1 - (light.penumbra as number ?? 0.5))
            uniforms.uSpotCosOuter[i]!.value = Math.cos(outerAngle)
            uniforms.uSpotCosInner[i]!.value = Math.cos(innerAngle)
          }
        } else {
          uniforms.uLightsEnabled[i]!.value = false
        }
      }

      lastLightingVersionRef.current = lightingVersion
    }

    // Fresnel parameters (only if feature included)
    if (uniforms.uFresnelEnabled && uniforms.uFresnelIntensity && uniforms.uRimColor) {
      const appearanceState = useAppearanceStore.getState()
      uniforms.uFresnelEnabled.value = appearanceState.edgesVisible
      uniforms.uFresnelIntensity.value = appearanceState.fresnelIntensity
      uniforms.uRimColor.value.set(appearanceState.edgeColor).convertSRGBToLinear()
    }

    // SSS parameters (only if feature included)
    if (uniforms.uSssEnabled && uniforms.uSssIntensity && uniforms.uSssColor) {
      const mbConfig = extendedState.mandelbulb
      uniforms.uSssIntensity.value = mbConfig.sssIntensity ?? 0.3
      uniforms.uSssThickness!.value = mbConfig.sssThickness ?? 0.5
      // SSS color uses face color tinted towards red
      const baseColor = useAppearanceStore.getState().faceColor
      uniforms.uSssColor.value.set(baseColor).lerp(new THREE.Color('#ff8866'), 0.3)
    }

    // Shadow parameters (only if feature included) - read from lighting store like WebGL
    if (uniforms.uShadowEnabled && uniforms.uShadowQuality && uniforms.uShadowSoftness) {
      const lightingState = useLightingStore.getState()
      const performanceState = usePerformanceStore.getState()
      uniforms.uShadowEnabled.value = lightingState.shadowEnabled
      // Progressive refinement: scale shadow quality from low → user's target
      const effectiveShadowQuality = getEffectiveShadowQuality(
        lightingState.shadowQuality,
        performanceState.qualityMultiplier
      )
      uniforms.uShadowQuality.value = SHADOW_QUALITY_TO_INT[effectiveShadowQuality]
      uniforms.uShadowSoftness.value = lightingState.shadowSoftness
    }

    // AO enabled flag (controlled by SSAO toggle in post-processing)
    if (uniforms.uAoEnabled) {
      const postProcState = usePostProcessingStore.getState()
      uniforms.uAoEnabled.value = postProcState.ssaoEnabled ?? false
    }

    // ============================================
    // DIRTY-FLAG: Only update IBL uniforms when settings change
    // ============================================
    const environmentState = useEnvironmentStore.getState()
    const iblVersion = environmentState.iblVersion
    const iblChanged = iblVersion !== lastIblVersionRef.current

    if (iblChanged) {
      // IBL (Image-Based Lighting) uniforms
      // Compute isPMREM first to gate quality (prevents null texture sampling)
      const env = scene.environment
      const isPMREM = env && env.mapping === THREE.CubeUVReflectionMapping

      // Force IBL off when no valid PMREM texture
      const qualityMap = { off: 0, low: 1, high: 2 } as const
      uniforms.ibl.uIBLQuality.value = isPMREM ? qualityMap[environmentState.iblQuality] : 0
      uniforms.ibl.uIBLIntensity.value = environmentState.iblIntensity

      if (isPMREM && env) {
        uniforms.ibl.uEnvMap.value = env
      }

      lastIblVersionRef.current = iblVersion
    }

    // Update temporal reprojection uniforms from TemporalDepthCapturePass
    // Matches WebGL MandelbulbMesh.tsx pattern - get uniforms from pass, apply all values
    if (uniforms.temporal) {
      const temporalData = getTemporalUniforms()
      if (temporalData) {
        // Update texture - TSL TextureNode.value can be set at runtime
        if (temporalData.uPrevPositionTexture) {
          ;(uniforms.temporal.uPrevPositionTexture as unknown as { value: THREE.Texture | null }).value =
            temporalData.uPrevPositionTexture
        }
        // Update enabled state
        uniforms.temporal.uTemporalEnabled.value = temporalData.uTemporalEnabled
        // Update resolution
        uniforms.temporal.uDepthBufferResolution.value.copy(temporalData.uDepthBufferResolution)
        // Matrices (if needed for future validation)
        if (uniforms.temporal.uPrevViewProjectionMatrix) {
          uniforms.temporal.uPrevViewProjectionMatrix.value.copy(temporalData.uPrevViewProjectionMatrix)
        }
        if (uniforms.temporal.uPrevInverseViewProjectionMatrix) {
          uniforms.temporal.uPrevInverseViewProjectionMatrix.value.copy(temporalData.uPrevInverseViewProjectionMatrix)
        }
      } else {
        // No temporal data available - disable temporal reprojection
        uniforms.temporal.uTemporalEnabled.value = false
      }
    }

    // Quality mode
    const performanceState = usePerformanceStore.getState()
    const isFastMode = performanceState.isInteracting || performanceState.qualityMultiplier < 1.0
    uniforms.uFastMode.value = isFastMode
    uniforms.uQualityMultiplier.value = performanceState.qualityMultiplier

    // Color
    const appearanceState = useAppearanceStore.getState()
    uniforms.uColor.value.set(appearanceState.faceColor).convertSRGBToLinear()

    // Color algorithm uniforms (matches WebGL getColorByAlgorithm)
    updateColorTSLUniforms(uniforms.color, {
      colorAlgorithm: COLOR_ALGORITHM_TO_INT[appearanceState.colorAlgorithm],
      cosineA: appearanceState.cosineCoefficients.a,
      cosineB: appearanceState.cosineCoefficients.b,
      cosineC: appearanceState.cosineCoefficients.c,
      cosineD: appearanceState.cosineCoefficients.d,
      distPower: appearanceState.distribution.power,
      distCycles: appearanceState.distribution.cycles,
      distOffset: appearanceState.distribution.offset,
      lchLightness: appearanceState.lchLightness,
      lchChroma: appearanceState.lchChroma,
      multiSourceWeights: [
        appearanceState.multiSourceWeights.depth,
        appearanceState.multiSourceWeights.orbitTrap,
        appearanceState.multiSourceWeights.normal,
      ],
    })

    // Update basis vectors via rotation hook (using hook's rotationsChanged)
    const {
      basisX,
      basisY,
      basisZ,
      changed: basisChanged,
    } = rotationUpdates.getBasisVectors(rotationsChanged)

    if (basisChanged) {
      // Pack basis vectors into uniform sets (4 components each)
      // Set 0: components 0-3
      uniforms.uBasisX0.value.set(basisX[0] ?? 0, basisX[1] ?? 0, basisX[2] ?? 0, basisX[3] ?? 0)
      uniforms.uBasisY0.value.set(basisY[0] ?? 0, basisY[1] ?? 0, basisY[2] ?? 0, basisY[3] ?? 0)
      uniforms.uBasisZ0.value.set(basisZ[0] ?? 0, basisZ[1] ?? 0, basisZ[2] ?? 0, basisZ[3] ?? 0)

      // Set 1: components 4-7 (for 5D+)
      if (dimension >= 5) {
        uniforms.uBasisX1.value.set(basisX[4] ?? 0, basisX[5] ?? 0, basisX[6] ?? 0, basisX[7] ?? 0)
        uniforms.uBasisY1.value.set(basisY[4] ?? 0, basisY[5] ?? 0, basisY[6] ?? 0, basisY[7] ?? 0)
        uniforms.uBasisZ1.value.set(basisZ[4] ?? 0, basisZ[5] ?? 0, basisZ[6] ?? 0, basisZ[7] ?? 0)
      }

      // Set 2: components 8-10 (for 9D+)
      if (dimension >= 9) {
        uniforms.uBasisX2.value.set(
          basisX[8] ?? 0,
          basisX[9] ?? 0,
          basisX[10] ?? 0,
          0 // Component 11 not used
        )
        uniforms.uBasisY2.value.set(basisY[8] ?? 0, basisY[9] ?? 0, basisY[10] ?? 0, 0)
        uniforms.uBasisZ2.value.set(basisZ[8] ?? 0, basisZ[9] ?? 0, basisZ[10] ?? 0, 0)
      }
    }

    // Update origin
    const originValues = originValuesRef.current
    originValues.fill(0)

    const sliceAnimationEnabled = extendedState.mandelbulb.sliceAnimationEnabled
    const sliceSpeed = extendedState.mandelbulb.sliceSpeed
    const sliceAmplitude = extendedState.mandelbulb.sliceAmplitude

    if (sliceAnimationEnabled && dimension > 3) {
      const PHI = 1.618033988749895
      for (let i = 3; i < dimension; i++) {
        const extraDimIndex = i - 3
        const phase = extraDimIndex * PHI
        const t1 = accumulatedTime * sliceSpeed * 2 * Math.PI + phase
        const t2 = accumulatedTime * sliceSpeed * 1.3 * 2 * Math.PI + phase * 1.5
        const offset = sliceAmplitude * (0.7 * Math.sin(t1) + 0.3 * Math.sin(t2))
        originValues[i] = (parameterValues[extraDimIndex] ?? 0) + offset
      }
    } else {
      for (let i = 3; i < dimension; i++) {
        originValues[i] = parameterValues[i - 3] ?? 0
      }
    }

    const { origin } = rotationUpdates.getOrigin(Array.from(originValues))

    // Pack origin into uniform sets
    uniforms.uOrigin0.value.set(origin[0] ?? 0, origin[1] ?? 0, origin[2] ?? 0, origin[3] ?? 0)

    if (dimension >= 5) {
      uniforms.uOrigin1.value.set(origin[4] ?? 0, origin[5] ?? 0, origin[6] ?? 0, origin[7] ?? 0)
    }

    if (dimension >= 9) {
      uniforms.uOrigin2.value.set(origin[8] ?? 0, origin[9] ?? 0, origin[10] ?? 0, 0)
    }
  }, FRAME_PRIORITY.RENDERER_UNIFORMS)

  return (
    <mesh
      ref={meshRef}
      scale={[scale ?? 1.0, scale ?? 1.0, scale ?? 1.0]}
      frustumCulled={true}
      material={material as unknown as THREE.Material}
      // Prevent R3F from auto-disposing material - we handle disposal in useEffect
      dispose={null}
    >
      <boxGeometry args={[4, 4, 4]} dispose={null} />
    </mesh>
  )
}

/**
 * MandelbulbMeshTSL - Wrapper component for TSL Mandelbulb rendering.
 *
 * IMPORTANT: Unlike the old approach, this component uses proper shader composition:
 * - Material is RECREATED when dimension changes (using composeMandelbulbTSL)
 * - Features are EXCLUDED from shader graph when disabled (not toggled with uniforms)
 * - Dimension-specific SDFs are selected at compose time
 *
 * This mirrors the WebGL composeMandelbulbShader pattern for full feature parity.
 */
const MandelbulbMeshTSL = memo(() => {
  // Get dimension from geometry store
  const dimension = useGeometryStore((state) => state.dimension)

  // Using key prop to force complete remount on dimension change
  // This ensures shader composition is completely rebuilt with correct SDF
  return <MandelbulbMeshTSLInner key={`mandelbulb-${dimension}D`} dimension={dimension} />
})

MandelbulbMeshTSL.displayName = 'MandelbulbMeshTSL'

export default MandelbulbMeshTSL
