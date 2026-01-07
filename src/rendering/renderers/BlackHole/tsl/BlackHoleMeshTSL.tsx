/**
 * BlackHoleMeshTSL - TSL-based N-dimensional Black Hole Renderer
 *
 * Renders a black hole with gravitational lensing, event horizon,
 * photon shell, and accretion disk using TSL.
 *
 * Aims for 100% feature parity with the WebGL BlackHoleMesh.
 *
 * @module rendering/renderers/BlackHole/tsl/BlackHoleMeshTSL
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MeshBasicNodeMaterial } from 'three/webgpu'

import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { RENDER_LAYERS } from '@/rendering/core/layers'
import { trackShaderCompilation, waitForGPUCompile } from '@/rendering/materials/shaderCompilationTracking'
import { useRotationUpdates, useQualityTracking } from '@/rendering/renderers/base'
import {
  composeBlackHoleTSL,
  type ComposedBlackHoleMaterial,
  type BlackHoleShaderConfig,
} from '@/rendering/tsl/raymarching/blackhole'
import { computeKerrRadii } from '@/lib/geometry/extended/kerr-physics'
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette'
import { useAnimationStore } from '@/stores/animationStore'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { usePostProcessingStore } from '@/stores/postProcessingStore'
import { useRotationStore } from '@/stores/rotationStore'

interface BlackHoleMeshTSLInnerProps {
  dimension: number
  dopplerEnabled: boolean
  volumetricDisk: boolean
}

/**
 * Inner component that handles the actual rendering.
 */
const BlackHoleMeshTSLInner = ({
  dimension,
  dopplerEnabled,
  volumetricDisk,
}: BlackHoleMeshTSLInnerProps) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, size, scene } = useThree()
  const materialRef = useRef<MeshBasicNodeMaterial | null>(null)

  // Use shared quality tracking hook
  const { rotationsChanged } = useQualityTracking()

  // Get black hole config from store (via getState for performance)
  const blackholeState = useExtendedObjectStore.getState().blackhole
  const parameterValues = blackholeState.parameterValues

  // Rotation updates for N-D slicing
  const rotationUpdates = useRotationUpdates({ dimension, parameterValues })

  // Compose the TSL material with current config
  const composed: ComposedBlackHoleMaterial = useMemo(() => {
    const config: BlackHoleShaderConfig = {
      dimension,
      doppler: dopplerEnabled,
      volumetricDisk,
      envMap: true, // Enable environment map sampling
    }

    const result = composeBlackHoleTSL(config)

    if (import.meta.env.DEV) {
      console.log('[BlackHoleMeshTSL] Composed material with features:', result.features)
    }

    materialRef.current = result.material
    return result
  }, [dimension, dopplerEnabled, volumetricDisk])

  const { material, uniforms, envMapNode } = composed

  // Proper cleanup of material on dimension/feature change or unmount
  useEffect(() => {
    return () => {
      try {
        material.dispose()
        // Dispose envMapNode texture if it exists (prevents memory leak)
        if (envMapNode) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tex = (envMapNode as any).value
          if (tex && typeof tex.dispose === 'function') {
            tex.dispose()
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[BlackHoleMeshTSL] Material dispose warning:', e)
        }
      }
    }
  }, [material, envMapNode])

  // Track shader compilation for overlay display
  useEffect(() => {
    const stopTracking = trackShaderCompilation(`Black Hole ${dimension}D (TSL)`)

    const cancelWait = waitForGPUCompile(() => {
      stopTracking()
    })

    return () => {
      cancelWait()
      stopTracking()
    }
  }, [material, dimension])

  // Assign layer
  useLayoutEffect(() => {
    if (meshRef.current?.layers) {
      meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT)
    }
  }, [])

  // Version tracking for dirty-flag optimization
  const lastBHVersionRef = useRef(-1)
  const lastGravityVersionRef = useRef(-1)
  const lastRotationVersionRef = useRef(-1)
  const lastDimensionRef = useRef(-1)

  // PERF (OPT-BH-3): Camera velocity tracking for ultra-fast mode
  const prevCameraPosRef = useRef(new THREE.Vector3())
  const cameraVelocityRef = useRef(0)
  const ULTRA_FAST_THRESHOLD = 2.0 // units per second

  // Helper for color conversion
  const tempColor = useMemo(() => new THREE.Color(), [])

  // Per-frame uniform updates (mirrors WebGL implementation)
  useFrame((_, delta) => {
    if (!meshRef.current) return

    // Get current state values via getState
    const extendedState = useExtendedObjectStore.getState()
    const blackhole = extendedState.blackhole
    const blackholeVersion = extendedState.blackholeVersion ?? 0
    const accumulatedTime = useAnimationStore.getState().accumulatedTime
    const ppState = usePostProcessingStore.getState()
    const gravityVersion = ppState.gravityVersion ?? 0
    const rotationVersion = useRotationStore.getState().version ?? 0
    const appearanceState = useAppearanceStore.getState()

    // ============================================
    // PER-FRAME UNIFORMS (always update)
    // ============================================

    // Camera position for raymarching
    uniforms.uCameraPosition.value.copy(camera.position)

    // Resolution
    uniforms.uResolution.value.set(size.width, size.height)

    // PERF (OPT-BH-3): Track camera velocity for ultra-fast mode
    const safeDelta = Math.max(delta, 0.001)
    const frameDist = camera.position.distanceTo(prevCameraPosRef.current)
    const frameVelocity = frameDist / safeDelta
    cameraVelocityRef.current = cameraVelocityRef.current * 0.8 + frameVelocity * 0.2
    prevCameraPosRef.current.copy(camera.position)
    uniforms.uUltraFastMode.value = cameraVelocityRef.current > ULTRA_FAST_THRESHOLD

    // Environment map update (per MKB-002: update texture node value at runtime)
    if (envMapNode) {
      const bg = scene.background
      const isCubeCompatible =
        bg &&
        bg instanceof THREE.CubeTexture &&
        (bg.mapping === THREE.CubeReflectionMapping ||
          bg.mapping === THREE.CubeRefractionMapping)

      if (isCubeCompatible) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(envMapNode as any).value = bg
        uniforms.uEnvMapReady.value = 1.0
      } else {
        uniforms.uEnvMapReady.value = 0.0
      }
    }

    // Time animation
    uniforms.uTime.value = accumulatedTime

    // View and projection matrices for MRT output
    uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)

    // Pre-calculate dimension scaling factor for lensing: pow(N, alpha)
    const dimPower = Math.pow(dimension, blackhole.dimensionEmphasis ?? 0.8)
    uniforms.uDimPower.value = dimPower

    // Pre-calculate origin offset length squared
    let originOffsetLengthSq = 0
    for (let i = 0; i < blackhole.parameterValues.length; i++) {
      const val = blackhole.parameterValues[i] ?? 0
      originOffsetLengthSq += val * val
    }
    uniforms.uOriginOffsetLengthSq.value = originOffsetLengthSq

    // Keplerian disk rotation (per-frame - disk angle animates)
    const rotations = useRotationStore.getState().rotations
    const diskAngle = rotations.get('XZ') ?? 0
    uniforms.uDiskRotationAngle.value = diskAngle

    // ============================================
    // DIRTY-FLAG CHECKS
    // ============================================
    const bhChanged = blackholeVersion !== lastBHVersionRef.current
    const gravityChanged = gravityVersion !== lastGravityVersionRef.current
    const rotationChanged = rotationVersion !== lastRotationVersionRef.current
    const dimensionChanged = dimension !== lastDimensionRef.current

    // ============================================
    // MESH TRANSFORM UNIFORMS
    // ============================================
    if (bhChanged || dimensionChanged) {
      meshRef.current.updateMatrixWorld(true)
      uniforms.uModelMatrix.value.copy(meshRef.current.matrixWorld)
      uniforms.uInverseModelMatrix.value.copy(meshRef.current.matrixWorld).invert()
    }

    // Dimension
    uniforms.uDimension.value = dimension

    // ============================================
    // ROTATION & BASIS VECTORS
    // ============================================
    const {
      basisX,
      basisY,
      basisZ,
      changed: basisChanged,
    } = rotationUpdates.getBasisVectors(rotationsChanged || rotationChanged || dimensionChanged)
    const { origin, changed: originChanged } = rotationUpdates.getOrigin(blackhole.parameterValues)

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
    }
    if (originChanged) {
      uniforms.uOrigin0.value.set(
        origin[0] ?? 0,
        origin[1] ?? 0,
        origin[2] ?? 0,
        origin[3] ?? 0
      )
    }

    // Update version refs
    if (rotationChanged) lastRotationVersionRef.current = rotationVersion
    if (dimensionChanged) lastDimensionRef.current = dimension

    // ============================================
    // BLACK HOLE CONFIG UNIFORMS (on bhVersion change)
    // ============================================
    if (bhChanged) {
      const horizonRadius = blackhole.horizonRadius
      uniforms.uHorizonRadius.value = horizonRadius

      // Compute visual event horizon using Kerr physics
      const spin = blackhole.spin ?? 0
      uniforms.uSpin.value = spin
      const M = horizonRadius / 2
      const kerr = computeKerrRadii(M, spin)
      const visualHorizon = kerr.shadowRadius
      uniforms.uVisualEventHorizon.value = visualHorizon

      // Disk temperature
      uniforms.uDiskTemperature.value = blackhole.diskTemperature ?? 6500.0
      uniforms.uDiskTempInner.value = blackhole.diskTemperature ?? 6500.0
      uniforms.uDiskTempOuter.value = (blackhole.diskTemperature ?? 6500.0) * 0.4

      // Manifold/Disk settings
      uniforms.uManifoldIntensity.value = blackhole.manifoldIntensity ?? 1.0
      uniforms.uManifoldThickness.value = blackhole.manifoldThickness ?? 0.15
      uniforms.uDiskHalfThickness.value = blackhole.manifoldThickness ?? 0.15
      uniforms.uDiskInnerRadius.value = horizonRadius * (blackhole.diskInnerRadiusMul ?? 3.0)
      uniforms.uDiskOuterRadius.value = horizonRadius * (blackhole.diskOuterRadiusMul ?? 10.0)
      uniforms.uDiskDensity.value = blackhole.manifoldIntensity ?? 1.0
      uniforms.uNoiseScale.value = blackhole.noiseScale ?? 1.0
      uniforms.uNoiseAmount.value = blackhole.noiseAmount ?? 0.25
      uniforms.uSwirlAmount.value = blackhole.swirlAmount ?? 0.6
      uniforms.uMultiIntersectionGain.value = blackhole.multiIntersectionGain ?? 1.0
      uniforms.uKeplerianDifferential.value = blackhole.keplerianDifferential ?? 0.5

      // Lensing settings (blackhole store's settings)
      uniforms.uDistanceFalloff.value = blackhole.distanceFalloff ?? 1.6
      uniforms.uEpsilonMul.value = blackhole.epsilonMul ?? 0.01
      uniforms.uBendMaxPerStep.value = blackhole.bendMaxPerStep ?? 0.25
      uniforms.uLensingClamp.value = blackhole.lensingClamp ?? 10.0

      // Photon shell
      uniforms.uShellRpPrecomputed.value = visualHorizon * 1.15
      uniforms.uShellDeltaPrecomputed.value = visualHorizon * (blackhole.photonShellWidth ?? 0.05)
      uniforms.uShellContrastBoost.value = blackhole.shellContrastBoost ?? 1.0
      uniforms.uShellIntensity.value = blackhole.shellGlowStrength ?? 3.0
      uniforms.uShellGlowStrength.value = blackhole.shellGlowStrength ?? 3.0
      uniforms.uShellStepMul.value = blackhole.shellStepMul ?? 0.35
      const shellColor = blackhole.shellGlowColor ?? '#ffffff'
      tempColor.set(shellColor).convertSRGBToLinear()
      uniforms.uShellColor.value.copy(tempColor)

      // Quality settings
      uniforms.uMaxSteps.value = blackhole.maxSteps ?? 256
      uniforms.uStepBase.value = blackhole.stepBase ?? 0.08
      uniforms.uStepMin.value = blackhole.stepMin ?? 0.01
      uniforms.uStepMax.value = blackhole.stepMax ?? 0.2
      uniforms.uStepAdaptG.value = blackhole.stepAdaptG ?? 1.0
      uniforms.uStepAdaptR.value = blackhole.stepAdaptR ?? 0.2
      uniforms.uEnableAbsorption.value = blackhole.enableAbsorption ?? false
      uniforms.uAbsorption.value = blackhole.absorption ?? 1.0
      uniforms.uTransmittanceCutoff.value = blackhole.transmittanceCutoff ?? 0.01
      uniforms.uFarRadius.value = blackhole.farRadius ?? 35.0
      uniforms.uFastMode.value = false // Updated by UniformManager quality source

      // Time scale
      uniforms.uTimeScale.value = blackhole.timeScale ?? 1.0
      uniforms.uDiskRotationSpeed.value = blackhole.timeScale ?? 1.0
      uniforms.uBloomBoost.value = blackhole.bloomBoost ?? 1.5

      // Doppler effect
      uniforms.uDopplerEnabled.value = blackhole.dopplerEnabled ? 1 : 0
      uniforms.uDopplerStrength.value = blackhole.dopplerStrength ?? 0.6

      // Colors - use Global Appearance Store
      tempColor.set(appearanceState.faceColor).convertSRGBToLinear()
      uniforms.uDiskColor.value.copy(tempColor)
      uniforms.uBaseColor.value.copy(tempColor)

      // Color algorithm settings (from appearance store)
      // Convert ColorAlgorithm string to integer for shader uniform
      const colorAlgInt = COLOR_ALGORITHM_TO_INT[appearanceState.colorAlgorithm] ?? 0
      uniforms.uColorAlgorithm.value = colorAlgInt

      // Cosine palette parameters
      const cp = appearanceState.cosineCoefficients
      if (cp) {
        uniforms.uCosineA.value.set(cp.a?.[0] ?? 0.5, cp.a?.[1] ?? 0.5, cp.a?.[2] ?? 0.5)
        uniforms.uCosineB.value.set(cp.b?.[0] ?? 0.5, cp.b?.[1] ?? 0.5, cp.b?.[2] ?? 0.5)
        uniforms.uCosineC.value.set(cp.c?.[0] ?? 1.0, cp.c?.[1] ?? 1.0, cp.c?.[2] ?? 1.0)
        uniforms.uCosineD.value.set(cp.d?.[0] ?? 0.0, cp.d?.[1] ?? 0.33, cp.d?.[2] ?? 0.67)
      }

      // LCH parameters
      uniforms.uLchLightness.value = appearanceState.lchLightness ?? 0.5
      uniforms.uLchChroma.value = appearanceState.lchChroma ?? 0.5

      // Sample quality (affects noise octaves in disk)
      // Default to medium quality (1)
      uniforms.uSampleQuality.value = 1

      lastBHVersionRef.current = blackholeVersion
    }

    // ============================================
    // GRAVITY UNIFORMS (on gravityVersion change)
    // ============================================
    if (gravityChanged) {
      // Use GLOBAL gravity settings from postProcessingStore
      uniforms.uGravityStrength.value = ppState.gravityStrength ?? 1.0
      uniforms.uBendScale.value = ppState.gravityDistortionScale ?? 1.0
      lastGravityVersionRef.current = gravityVersion
    }
  }, FRAME_PRIORITY.RENDERER_UNIFORMS)

  // Calculate box size based on far radius
  const farRadius = useExtendedObjectStore((state) => state.blackhole.farRadius)
  const horizonRadius = useExtendedObjectStore((state) => state.blackhole.horizonRadius)
  const boxSize = farRadius * horizonRadius * 2.2

  return (
    <mesh
      ref={meshRef}
      scale={[1, 1, 1]}
      frustumCulled={true}
    >
      <boxGeometry args={[boxSize, boxSize, boxSize]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

/**
 * BlackHoleMeshTSL - Main export component
 */
export const BlackHoleMeshTSL = () => {
  // Values that affect shader composition (material recreation required)
  const dimension = useGeometryStore((state) => state.dimension)
  const dopplerEnabled = useExtendedObjectStore((state) => state.blackhole.dopplerEnabled ?? true)
  const volumetricDisk = true // Always enabled for now

  // Key forces recreation when composition-affecting values change
  const compositionKey = `blackhole-${dimension}-doppler${dopplerEnabled}-vol${volumetricDisk}`

  return (
    <BlackHoleMeshTSLInner
      key={compositionKey}
      dimension={dimension}
      dopplerEnabled={dopplerEnabled}
      volumetricDisk={volumetricDisk}
    />
  )
}
