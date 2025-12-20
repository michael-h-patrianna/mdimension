/**
 * BlackHoleMesh - Renders N-dimensional black hole with gravitational lensing
 *
 * Visualizes a black hole with:
 * - Event horizon (pure black sphere)
 * - Photon shell (bright ring at R_p = 1.5 R_h)
 * - Accretion manifold (luminous disk/sheet/field based on dimension)
 * - Gravitational lensing (bent rays)
 * - Optional polar jets
 *
 * TODO: Deferred Lensing Integration
 * The deferred lensing shader (src/rendering/shaders/blackhole/effects/deferred-lensing.glsl.ts)
 * is currently not integrated into the render pipeline. To enable deferred lensing:
 * 1. Create a post-processing pass using deferredLensingBlock
 * 2. Render the scene (without black hole) to a texture
 * 3. Apply lensing distortion based on black hole position
 * 4. Composite with the black hole's direct contribution
 * This allows background objects to be visibly lensed around the black hole.
 */

import { RENDER_LAYERS, needsVolumetricSeparation } from '@/rendering/core/layers'
import { TrackedShaderMaterial } from '@/rendering/materials/TrackedShaderMaterial'
import { composeBlackHoleShader, generateBlackHoleVertexShader } from '@/rendering/shaders/blackhole/compose'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useUIStore } from '@/stores/uiStore'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MAX_DIMENSION } from './types'
import { useBlackHoleUniforms } from './useBlackHoleUniforms'
import { useBlackHoleUniformUpdates } from './useBlackHoleUniformUpdates'

/**
 * BlackHoleMesh - Renders N-dimensional black hole visualization
 * @returns The black hole mesh component
 */
const BlackHoleMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null)

  // Values that affect shader compilation
  const rawDimension = useGeometryStore((state) => state.dimension)
  const opacityMode = useUIStore((state) => state.opacitySettings.mode)

  // Validate dimension at compile time (not every frame)
  // This ensures dimension is within valid bounds for N-D array operations
  const dimension = useMemo(() => {
    const clamped = Math.min(Math.max(rawDimension, 3), MAX_DIMENSION)
    if (import.meta.env.DEV && clamped !== rawDimension) {
      console.warn(
        `BlackHole: dimension ${rawDimension} clamped to ${clamped} (valid range: 3-${MAX_DIMENSION})`
      )
    }
    return clamped
  }, [rawDimension])

  // Black hole specific settings that affect shader compilation
  const jetsEnabled = useExtendedObjectStore((state) => state.blackhole.jetsEnabled)
  const dopplerEnabled = useExtendedObjectStore((state) => state.blackhole.dopplerEnabled)
  const temporalEnabled = useExtendedObjectStore(
    (state) => state.blackhole.temporalAccumulationEnabled
  )
  const raymarchMode = useExtendedObjectStore((state) => state.blackhole.raymarchMode)
  const sliceAnimationEnabled = useExtendedObjectStore(
    (state) => state.blackhole.sliceAnimationEnabled
  )

  // Create uniforms using extracted hook
  const uniforms = useBlackHoleUniforms()

  // Compile shader
  const { fragmentShader } = useMemo(() => {
    return composeBlackHoleShader({
      dimension,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      temporalAccumulation: temporalEnabled,
      jets: jetsEnabled,
      doppler: dopplerEnabled,
      envMap: true,
      opacityMode,
      fog: false,
      raymarchMode,
      sliceAnimation: sliceAnimationEnabled,
    })
  }, [dimension, temporalEnabled, jetsEnabled, dopplerEnabled, opacityMode, raymarchMode, sliceAnimationEnabled])

  // Generate vertex shader
  const vertexShader = useMemo(() => generateBlackHoleVertexShader(), [])

  // Generate material key for caching
  const materialKey = useMemo(() => {
    return `blackhole-${dimension}-${temporalEnabled}-${jetsEnabled}-${dopplerEnabled}-${opacityMode}-${raymarchMode}-${sliceAnimationEnabled}`
  }, [dimension, temporalEnabled, jetsEnabled, dopplerEnabled, opacityMode, raymarchMode, sliceAnimationEnabled])

  // Cleanup material when shader recompiles or component unmounts
  // This prevents WebGL memory leaks when switching modes/dimensions
  useEffect(() => {
    const mesh = meshRef.current;
    return () => {
      if (mesh) {
        const material = mesh.material as THREE.ShaderMaterial
        if (material && typeof material.dispose === 'function') {
          material.dispose()
        }
      }
    }
  }, [materialKey])

  // Assign layer based on temporal accumulation mode
  // When temporal cloud accumulation is active, use VOLUMETRIC layer for separate rendering
  // CRITICAL: Use useLayoutEffect to ensure layer is set BEFORE first render
  useLayoutEffect(() => {
    if (meshRef.current?.layers) {
      const useVolumetricLayer = needsVolumetricSeparation({
        temporalCloudAccumulation: temporalEnabled,
        objectType: 'blackhole',
      })

      if (useVolumetricLayer) {
        // Use VOLUMETRIC layer for temporal accumulation (rendered separately at 1/4 res)
        meshRef.current.layers.set(RENDER_LAYERS.VOLUMETRIC)
      } else {
        // Standard main object layer (rendered as part of main scene)
        meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT)
      }
    }
  }, [temporalEnabled])

  // Update uniforms each frame using extracted hook
  useBlackHoleUniformUpdates({
    meshRef,
    temporalEnabled,
  })

  return (
    <mesh ref={meshRef} layers={RENDER_LAYERS.MAIN_OBJECT} frustumCulled={false}>
      <boxGeometry args={[100, 100, 100]} />
      <TrackedShaderMaterial
        shaderName="Black Hole N-Dimensional"
        materialKey={materialKey}
        glslVersion={THREE.GLSL3}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

export default BlackHoleMesh
