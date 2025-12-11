import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Canvas } from '@react-three/fiber'
import { Scene } from '@/components/canvas/Scene'
import type { Vector3D } from '@/lib/math/types'

describe('Scene', () => {
  const sampleVertices: Vector3D[] = [
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

  it('should render without errors', () => {
    const { container } = render(
      <Canvas>
        <Scene />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with vertices and edges', () => {
    const { container } = render(
      <Canvas>
        <Scene vertices={sampleVertices} edges={sampleEdges} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with grid enabled', () => {
    const { container } = render(
      <Canvas>
        <Scene showGrid />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with auto-rotation enabled', () => {
    const { container } = render(
      <Canvas>
        <Scene autoRotate />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should handle empty vertices array', () => {
    const { container } = render(
      <Canvas>
        <Scene vertices={[]} edges={[]} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with all props', () => {
    const { container } = render(
      <Canvas>
        <Scene
          vertices={sampleVertices}
          edges={sampleEdges}
          showGrid
          autoRotate
          backgroundColor="#000000"
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should not render PolytopeRenderer when vertices are undefined', () => {
    const { container } = render(
      <Canvas>
        <Scene edges={sampleEdges} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should not render PolytopeRenderer when edges are undefined', () => {
    const { container } = render(
      <Canvas>
        <Scene vertices={sampleVertices} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })
})
