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

import { RENDER_LAYERS } from '@/rendering/core/layers'
import { TrackedShaderMaterial } from '@/rendering/materials/TrackedShaderMaterial'
import { composeBlackHoleShader, generateBlackHoleVertexShader } from '@/rendering/shaders/blackhole/compose'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useUIStore } from '@/stores/uiStore'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MAX_DIMENSION } from './types'
import { useBlackHoleUniforms } from './useBlackHoleUniforms'
import { useBlackHoleUniformUpdates } from './useBlackHoleUniformUpdates'

// DEBUG helper
const debugLog = (event: string, data?: Record<string, unknown>) => {
  if (typeof window !== 'undefined' && window.__DEBUG_LOG) {
    window.__DEBUG_LOG('BlackHoleMesh', event, data)
  }
}

/**
 * BlackHoleMesh - Renders N-dimensional black hole visualization
 * @returns The black hole mesh component
 */
const BlackHoleMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null)

  // DEBUG: Log mount
  useEffect(() => {
    debugLog('MOUNT')
    return () => {
      debugLog('UNMOUNT')
    }
  }, [])

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
  // Note: globalTemporalEnabled is checked dynamically in useBlackHoleUniformUpdates
  // along with screen coverage to determine when to use temporal rendering
  const sliceAnimationEnabled = useExtendedObjectStore(
    (state) => state.blackhole.sliceAnimationEnabled
  )
  // Scale and Bounds
  const scale = useExtendedObjectStore((state) => state.blackhole.scale)
  const farRadius = useExtendedObjectStore((state) => state.blackhole.farRadius)
  const horizonRadius = useExtendedObjectStore((state) => state.blackhole.horizonRadius)
  const jetsHeight = useExtendedObjectStore((state) => state.blackhole.jetsHeight)

  // Create uniforms using extracted hook
  const uniforms = useBlackHoleUniforms()

  // Compile shader
  const { fragmentShader } = useMemo(() => {
    debugLog('composeBlackHoleShader START', { dimension, temporalEnabled, jetsEnabled, dopplerEnabled })
    const result = composeBlackHoleShader({
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
      sliceAnimation: sliceAnimationEnabled,
      volumetricDisk: true,
    })
    debugLog('composeBlackHoleShader END', { fragmentShaderLength: result.fragmentShader.length })
    return result
  }, [dimension, temporalEnabled, jetsEnabled, dopplerEnabled, opacityMode, sliceAnimationEnabled])

  // Generate vertex shader
  const vertexShader = useMemo(() => generateBlackHoleVertexShader(), [])

  // Generate material key for caching
  const materialKey = useMemo(() => {
    const key = `blackhole-${dimension}-${temporalEnabled}-${jetsEnabled}-${dopplerEnabled}-${opacityMode}-${sliceAnimationEnabled}`
    debugLog('materialKey generated', { key })
    return key
  }, [dimension, temporalEnabled, jetsEnabled, dopplerEnabled, opacityMode, sliceAnimationEnabled])

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

  // Layer assignment is handled dynamically in useBlackHoleUniformUpdates
  // based on screen coverage (only uses temporal when coverage > 50%)

  // Update uniforms each frame using extracted hook
  useBlackHoleUniformUpdates({
    meshRef,
  })

  // Calculate box size to ensure it covers the entire visual effect
  // Shader uses farRadius * horizonRadius as the bounding sphere radius for raymarching.
  // Jets extend vertically by jetsHeight * horizonRadius.
  // We use the maximum of these to size the box, preventing clipping.
  const shaderRadius = farRadius * horizonRadius
  const jetsRadius = jetsEnabled ? jetsHeight * horizonRadius : 0
  const maxRadius = Math.max(shaderRadius, jetsRadius)
  
  // Use 2.2x max radius (diameter + 10% padding)
  const boxSize = maxRadius * 2.2

  return (
    <mesh ref={meshRef} layers={RENDER_LAYERS.MAIN_OBJECT} frustumCulled={true} scale={[scale, scale, scale]}>
      <boxGeometry args={[boxSize, boxSize, boxSize]} />
      <TrackedShaderMaterial
        shaderName="Black Hole N-Dimensional"
        materialKey={materialKey}
        glslVersion={THREE.GLSL3}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        /* transparent and depthWrite are set dynamically in useBlackHoleUniformUpdates
         * based on opacity mode (solid = depthWrite:true, others = depthWrite:false) */
      />
    </mesh>
  )
}

export default BlackHoleMesh
