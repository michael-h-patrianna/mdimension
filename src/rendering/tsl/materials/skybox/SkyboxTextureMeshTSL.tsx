/**
 * SkyboxTextureMeshTSL - TSL material for KTX2 texture-based skyboxes
 *
 * WebGPU-compatible material that displays a pre-loaded cube texture.
 * This is the TSL equivalent of the classic mode in WebGL SkyboxMesh.
 *
 * Features:
 * - Cube texture sampling with rotation
 * - Intensity/opacity control
 * - Fade-in animation
 * - Proper layer assignment (RENDER_LAYERS.SKYBOX)
 *
 * @module rendering/tsl/materials/skybox/SkyboxTextureMeshTSL
 */

import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  cubeTexture,
  Fn,
  positionWorld,
  uniform,
  vec3,
  vec4,
} from 'three/tsl'

import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useAnimationStore } from '@/stores/animationStore'
import { useShallow } from 'zustand/react/shallow'

interface SkyboxTextureMeshTSLProps {
  texture: THREE.CubeTexture
}

/**
 * TSL-based skybox mesh for KTX2 textures.
 * Renders a cube texture on a sphere with rotation support.
 */
export function SkyboxTextureMeshTSL({ texture }: SkyboxTextureMeshTSLProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const timeRef = useRef(0)
  const opacityRef = useRef(0)
  const fadeStartTimeRef = useRef<number | null>(null)
  const FADE_DURATION = 0.5 // seconds

  // Reusable objects for rotation calculation
  const eulerRef = useRef(new THREE.Euler())
  const matrix3Ref = useRef(new THREE.Matrix3())
  const matrix4Ref = useRef(new THREE.Matrix4())

  // CRITICAL: Use callback ref to set layer IMMEDIATELY when mesh is created
  const setMeshRef = React.useCallback((mesh: THREE.Mesh | null) => {
    if (mesh) {
      mesh.layers.set(RENDER_LAYERS.SKYBOX)
      mesh.renderOrder = -1
    }
    ;(meshRef as React.MutableRefObject<THREE.Mesh | null>).current = mesh
  }, [])

  // Get skybox settings from store
  const envSelector = useShallow((state: ReturnType<typeof useEnvironmentStore.getState>) => ({
    skyboxIntensity: state.skyboxIntensity,
    skyboxRotation: state.skyboxRotation,
    skyboxAnimationMode: state.skyboxAnimationMode,
    skyboxAnimationSpeed: state.skyboxAnimationSpeed,
  }))
  const { skyboxIntensity, skyboxRotation, skyboxAnimationMode, skyboxAnimationSpeed } =
    useEnvironmentStore(envSelector)
  const isPlaying = useAnimationStore((state) => state.isPlaying)

  const baseRotY = skyboxRotation * (Math.PI / 180)

  // Create stable uniform nodes and TextureNode - NEVER recreate during runtime
  // This is critical for WebGPU: texture nodes must be created once and updated via .value
  const { uniforms, textureNode, material } = useMemo(() => {
    // Create uniforms
    const u = {
      uRotation: uniform(new THREE.Matrix3()),
      uIntensity: uniform(1.0),
      uOpacity: uniform(0.0),
    }

    // Create a placeholder cube texture if the real one isn't ready
    // The actual texture will be assigned via textureNode.value = texture
    const cubeTexNode = cubeTexture(texture)

    // Build the color node
    const skyboxColor = Fn(() => {
      const rawDir = positionWorld.normalize()

      // Apply rotation matrix (column-major: result = col0*x + col1*y + col2*z)
      const col0 = u.uRotation.element(0)
      const col1 = u.uRotation.element(1)
      const col2 = u.uRotation.element(2)

      const rotatedDir = vec3(
        col0.element(0).mul(rawDir.x).add(col1.element(0).mul(rawDir.y)).add(col2.element(0).mul(rawDir.z)),
        col0.element(1).mul(rawDir.x).add(col1.element(1).mul(rawDir.y)).add(col2.element(1).mul(rawDir.z)),
        col0.element(2).mul(rawDir.x).add(col1.element(2).mul(rawDir.y)).add(col2.element(2).mul(rawDir.z))
      ).normalize()

      // Sample the cube texture
      // Note: CubeTextureNode uses sample() method with direction vector
      const texColor = (cubeTexNode as unknown as { sample: (dir: unknown) => typeof vec4.prototype }).sample(rotatedDir).xyz

      // Apply intensity
      const finalColor = texColor.mul(u.uIntensity)

      // Apply opacity for fade-in
      return vec4(finalColor, u.uOpacity)
    })

    // Create material
    const mat = new MeshBasicNodeMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
    mat.colorNode = skyboxColor()

    return { uniforms: u, textureNode: cubeTexNode, material: mat }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only create once - texture updates via textureNode.value

  // Update the texture node when the prop changes
  // CRITICAL: Use stable TextureNode and update its .value property
  useEffect(() => {
    if (textureNode && texture) {
      // Access the underlying value - TSL nodes have a .value property
      ;(textureNode as unknown as { value: THREE.CubeTexture | null }).value = texture
    }
  }, [texture, textureNode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  // Update uniforms every frame
  useFrame((state, delta) => {
    if (!material) return

    // Fade-in animation
    if (fadeStartTimeRef.current === null) {
      fadeStartTimeRef.current = state.clock.elapsedTime
    }
    const fadeElapsed = state.clock.elapsedTime - fadeStartTimeRef.current
    opacityRef.current = Math.min(1, fadeElapsed / FADE_DURATION)

    // Time accumulation
    if (isPlaying) {
      const TIME_SCALE = 0.01
      timeRef.current += delta * TIME_SCALE
    }

    // Calculate rotation matrix (matches WebGL Skybox.tsx exactly)
    let finalRotY = baseRotY

    // Handle animation modes (rotation)
    if (isPlaying && skyboxAnimationMode !== 'none' && skyboxAnimationSpeed > 0) {
      const rotSpeed = skyboxAnimationSpeed * 0.1
      finalRotY += timeRef.current * rotSpeed * 100 // Match WebGL scaling
    }

    eulerRef.current.set(0, finalRotY, 0)
    const rotationMatrix = matrix3Ref.current.setFromMatrix4(
      matrix4Ref.current.makeRotationFromEuler(eulerRef.current)
    )

    // Update uniforms via .value property
    ;(uniforms.uRotation as unknown as { value: THREE.Matrix3 }).value.copy(rotationMatrix)
    ;(uniforms.uIntensity as unknown as { value: number }).value = skyboxIntensity
    ;(uniforms.uOpacity as unknown as { value: number }).value = opacityRef.current
  })

  // Don't render until we have some opacity
  if (opacityRef.current === 0 && fadeStartTimeRef.current === null) {
    return null
  }

  return (
    <mesh ref={setMeshRef}>
      <sphereGeometry args={[200, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

