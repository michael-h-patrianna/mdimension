/**
 * JuliaMeshTSL - WebGPU-compatible Julia renderer using TSL
 *
 * Renders Quaternion Julia fractals using GPU raymarching with TSL node materials.
 * Uses shader composition pattern matching the WebGL version:
 * - Material is recreated when dimension/features change
 * - Features (SSS, AO, Shadows, Fresnel) are conditionally compiled
 *
 * @module rendering/renderers/QuaternionJulia/tsl/JuliaMeshTSL
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MeshBasicNodeMaterial } from 'three/webgpu'

import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { trackShaderCompilation, waitForGPUCompile } from '@/rendering/materials/shaderCompilationTracking'
import { useLayerAssignment, useRotationUpdates, useQualityTracking } from '@/rendering/renderers/base'
import {
  composeJuliaTSL,
  type ComposedJuliaMaterial,
  type JuliaShaderConfig,
} from '@/rendering/tsl/raymarching/julia'
import { updateColorTSLUniforms } from '@/rendering/tsl/color/color-uniforms'
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette'
import { useTemporalDepthUniforms } from '@/rendering/core/useTemporalDepthUniforms'

// Store imports
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePBRStore } from '@/stores/pbrStore'
import { usePerformanceStore } from '@/stores/performanceStore'

/**
 * Inner component that handles rendering with a specific config.
 */
interface JuliaMeshTSLInnerProps {
  dimension: number
  shadowsEnabled: boolean
  aoEnabled: boolean
  sssEnabled: boolean
  fresnelEnabled: boolean
  temporalEnabled: boolean
}

const JuliaMeshTSLInner = ({
  dimension,
  shadowsEnabled,
  aoEnabled,
  sssEnabled,
  fresnelEnabled,
  temporalEnabled,
}: JuliaMeshTSLInnerProps) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, size, viewport, scene } = useThree()
  const materialRef = useRef<MeshBasicNodeMaterial | null>(null)

  // Assign main object layer
  useLayerAssignment(meshRef)

  // Use shared quality tracking hook (matches WebGL implementation)
  const { rotationsChanged } = useQualityTracking()

  // Get Julia config from store
  const scale = useExtendedObjectStore((state) => state.quaternionJulia.scale)
  const parameterValues = useExtendedObjectStore((state) => state.quaternionJulia.parameterValues)

  // Rotation updates
  const rotationUpdates = useRotationUpdates({ dimension, parameterValues })

  // Get temporal depth uniforms getter from render graph store
  const getTemporalUniforms = useTemporalDepthUniforms()

  // Compose the TSL material with current config
  // Material is recreated when any of these change (shader composition)
  const composed: ComposedJuliaMaterial = useMemo(() => {
    const config: JuliaShaderConfig = {
      dimension,
      shadows: shadowsEnabled,
      ambientOcclusion: aoEnabled,
      sss: sssEnabled,
      fresnel: fresnelEnabled,
      temporal: temporalEnabled,
    }

    const result = composeJuliaTSL(config)

    if (import.meta.env.DEV) {
      console.log('[JuliaMeshTSL] Composed material with features:', result.features)
    }

    materialRef.current = result.material
    return result
  }, [dimension, shadowsEnabled, aoEnabled, sssEnabled, fresnelEnabled, temporalEnabled])

  const { material, uniforms } = composed

  // Track shader compilation for overlay display
  useEffect(() => {
    const stopTracking = trackShaderCompilation('Quaternion Julia (TSL)')
    
    // Wait for GPU to compile the shader, then hide overlay
    const cancelWait = waitForGPUCompile(() => {
      stopTracking()
    })

    return () => {
      cancelWait()
      stopTracking()
    }
  }, [material]) // Re-run when material changes (recompilation)

  // Cleanup material on unmount or config change
  useEffect(() => {
    return () => {
      try {
        material.dispose()
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[JuliaMeshTSL] Material dispose warning:', e)
        }
      }
    }
  }, [material])

  // Version tracking for dirty-flag optimization
  const lastJuliaVersionRef = useRef(-1)
  const lastPBRVersionRef = useRef(-1)
  const lastLightingVersionRef = useRef(-1)
  const lastIblVersionRef = useRef(-1)

  // Per-frame uniform updates
  useFrame(() => {
    if (!meshRef.current) return

    // Update camera position
    uniforms.uCameraPosition.value.copy(camera.position)

    // Update resolution
    const dpr = viewport.dpr
    uniforms.uResolution.value.set(
      Math.floor(size.width * dpr),
      Math.floor(size.height * dpr)
    )

    // Update model matrices
    uniforms.uModelMatrix.value.copy(meshRef.current.matrixWorld)
    uniforms.uInverseModelMatrix.value.copy(meshRef.current.matrixWorld).invert()

    // Update view/projection matrices (for MRT depth calculation matching WebGL gl_FragDepth)
    uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)

    // Get store versions
    const extendedState = useExtendedObjectStore.getState()
    const juliaVersion = extendedState.quaternionJuliaVersion
    const pbrState = usePBRStore.getState()
    const pbrVersion = pbrState.pbrVersion
    const lightingState = useLightingStore.getState()
    const lightingVersion = lightingState.version

    // Julia parameters (dirty-flag check)
    if (juliaVersion !== lastJuliaVersionRef.current) {
      const jConfig = extendedState.quaternionJulia
      
      uniforms.uPower.value = jConfig.power
      uniforms.uIterations.value = jConfig.maxIterations
      uniforms.uEscapeRadius.value = jConfig.bailoutRadius
      uniforms.uSdfSurfaceDistance.value = jConfig.sdfSurfaceDistance ?? 0.002

      // Julia constant
      const jc = jConfig.juliaConstant
      uniforms.uJuliaConstant.value.set(jc[0], jc[1], jc[2], jc[3])

      uniforms.uDimension.value = dimension

      lastJuliaVersionRef.current = juliaVersion
    }

    // PBR parameters (dirty-flag check)
    if (pbrVersion !== lastPBRVersionRef.current) {
      uniforms.uRoughness.value = pbrState.face.roughness
      uniforms.uMetallic.value = pbrState.face.metallic

      lastPBRVersionRef.current = pbrVersion
    }

    // Lighting parameters (dirty-flag check)
    if (lightingVersion !== lastLightingVersionRef.current) {
      uniforms.uAmbientEnabled.value = lightingState.ambientEnabled ? 1 : 0
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

    // IBL (dirty-flag check)
    const environmentState = useEnvironmentStore.getState()
    const iblVersion = environmentState.iblVersion
    const iblChanged = iblVersion !== lastIblVersionRef.current

    if (iblChanged) {
      // Check if scene has a valid PMREM environment map
      const env = scene.environment
      const isPMREM = env && env.mapping === THREE.CubeUVReflectionMapping

      // Map quality string to integer (matches WebGL)
      const qualityMap = { off: 0, low: 1, high: 2 } as const
      uniforms.ibl.uIBLQuality.value = isPMREM ? qualityMap[environmentState.iblQuality] : 0
      uniforms.ibl.uIBLIntensity.value = environmentState.iblIntensity

      // Only assign env map if it's a valid PMREM texture
      if (isPMREM && env) {
        uniforms.ibl.uEnvMap.value = env
      }

      lastIblVersionRef.current = iblVersion
    }

    // Update temporal reprojection uniforms from TemporalDepthCapturePass
    // Matches WebGL pattern - get uniforms from pass, apply all values
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

    // Fresnel (if enabled)
    if (uniforms.uFresnelIntensity) {
      uniforms.uFresnelIntensity.value = appearanceState.fresnelIntensity
    }

    // Quality settings
    const perfState = usePerformanceStore.getState()
    const isFastMode = perfState.isInteracting || perfState.qualityMultiplier < 1.0
    uniforms.uFastMode.value = isFastMode
    uniforms.uQualityMultiplier.value = perfState.qualityMultiplier

    // Update basis vectors from rotation (using hook's rotationsChanged)
    const {
      basisX,
      basisY,
      basisZ,
      changed: basisChanged,
    } = rotationUpdates.getBasisVectors(rotationsChanged)

    if (basisChanged) {
      // Pack into vec4 uniforms
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
    }

    // Compute origin with extra dimension values
    const originValues = new Array(11).fill(0)
    for (let i = 3; i < dimension; i++) {
      originValues[i] = parameterValues[i - 3] ?? 0
    }
    const { origin } = rotationUpdates.getOrigin(originValues)

    uniforms.uOrigin0.value.set(
      origin[0] ?? 0,
      origin[1] ?? 0,
      origin[2] ?? 0,
      origin[3] ?? 0
    )

  }, FRAME_PRIORITY.RENDERER_UNIFORMS)

  return (
    <mesh ref={meshRef} scale={[scale ?? 1.0, scale ?? 1.0, scale ?? 1.0]} frustumCulled={true}>
      <boxGeometry args={[4, 4, 4]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

/**
 * JuliaMeshTSL - WebGPU Julia renderer with shader composition.
 *
 * The outer component subscribes to stores that affect shader composition.
 * When these change, the inner component is recreated with new material.
 */
export function JuliaMeshTSL() {
  // Values that affect shader composition (material recreation required)
  const dimension = useGeometryStore((state) => state.dimension)
  const shadowsEnabled = useExtendedObjectStore((state) => state.quaternionJulia.shadowEnabled)
  const sssEnabled = useExtendedObjectStore((state) => state.quaternionJulia.sssEnabled)
  const fresnelEnabled = useAppearanceStore((state) => state.edgesVisible) // Fresnel tied to edges
  const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled)

  // AO from post-processing
  const aoEnabled = false // TODO: Get from postProcessingStore.ssaoEnabled

  // Key forces recreation when composition-affecting values change
  const compositionKey = `julia-${dimension}-s${shadowsEnabled}-a${aoEnabled}-sss${sssEnabled}-f${fresnelEnabled}-t${temporalEnabled}`

  return (
    <JuliaMeshTSLInner
      key={compositionKey}
      dimension={dimension}
      shadowsEnabled={shadowsEnabled ?? false}
      aoEnabled={aoEnabled}
      sssEnabled={sssEnabled ?? false}
      fresnelEnabled={fresnelEnabled}
      temporalEnabled={temporalEnabled ?? false}
    />
  )
}

export default JuliaMeshTSL

