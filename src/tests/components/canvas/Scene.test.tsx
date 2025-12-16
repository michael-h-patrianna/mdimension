import { Scene } from '@/rendering/Scene'
import type { NdGeometry } from '@/lib/geometry/types'
import type { Vector3D } from '@/lib/math/types'
import { Canvas } from '@react-three/fiber'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Scene', () => {
  const sampleVertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
  ]

  const sampleEdges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ]

  const sampleGeometry: NdGeometry = {
    dimension: 3,
    type: 'hypercube',
    vertices: sampleVertices,
    edges: sampleEdges,
  }

  const emptyGeometry: NdGeometry = {
    dimension: 3,
    type: 'hypercube',
    vertices: [],
    edges: [],
  }

  const projectedVertices: Vector3D[] = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
  ]

  it('should render without errors', () => {
    const { container } = render(
      <Canvas>
        <Scene
          geometry={sampleGeometry}
          dimension={3}
          objectType="hypercube"
          projectedVertices={projectedVertices}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with geometry', () => {
    const { container } = render(
      <Canvas>
        <Scene
          geometry={sampleGeometry}
          dimension={3}
          objectType="hypercube"
          projectedVertices={projectedVertices}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with auto-rotation disabled (default)', () => {
    const { container } = render(
      <Canvas>
        <Scene
          geometry={sampleGeometry}
          dimension={3}
          objectType="hypercube"
          autoRotate={false}
          projectedVertices={projectedVertices}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with auto-rotation enabled', () => {
    const { container } = render(
      <Canvas>
        <Scene
          geometry={sampleGeometry}
          dimension={3}
          objectType="hypercube"
          autoRotate
          projectedVertices={projectedVertices}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should handle empty geometry', () => {
    const { container } = render(
      <Canvas>
        <Scene
          geometry={emptyGeometry}
          dimension={3}
          objectType="hypercube"
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with all props', () => {
    const { container } = render(
      <Canvas>
        <Scene
          geometry={sampleGeometry}
          dimension={4}
          objectType="hypercube"
          autoRotate
          opacity={0.8}
          projectedVertices={projectedVertices}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })


  it('should render with minBoundingRadius for raymarched objects', () => {
    const { container } = render(
      <Canvas>
        <Scene
          geometry={sampleGeometry}
          dimension={3}
          objectType="mandelbulb"
          minBoundingRadius={1.5}
          projectedVertices={projectedVertices}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })
})
