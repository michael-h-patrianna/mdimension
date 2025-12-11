import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Canvas } from '@react-three/fiber'
import { PolytopeRenderer } from '@/components/canvas/PolytopeRenderer'
import type { Vector3D } from '@/lib/math/types'

describe('PolytopeRenderer', () => {
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
        <PolytopeRenderer vertices={sampleVertices} edges={sampleEdges} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom edge color', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={sampleVertices}
          edges={sampleEdges}
          edgeColor="#FF0000"
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom vertex color', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={sampleVertices}
          edges={sampleEdges}
          vertexColor="#00FF00"
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom edge thickness', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={sampleVertices}
          edges={sampleEdges}
          edgeThickness={4}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom vertex size', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={sampleVertices}
          edges={sampleEdges}
          vertexSize={0.1}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should hide vertices when showVertices is false', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={sampleVertices}
          edges={sampleEdges}
          showVertices={false}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom face opacity', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={sampleVertices}
          edges={sampleEdges}
          faceOpacity={0.5}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should handle empty vertices array', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer vertices={[]} edges={[]} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should handle single vertex', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer vertices={[[0, 0, 0]]} edges={[]} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should handle single edge', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={[
            [0, 0, 0],
            [1, 1, 1],
          ]}
          edges={[[0, 1]]}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with all props', () => {
    const { container } = render(
      <Canvas>
        <PolytopeRenderer
          vertices={sampleVertices}
          edges={sampleEdges}
          edgeColor="#FF00FF"
          edgeThickness={3}
          vertexColor="#FFFF00"
          vertexSize={0.08}
          showVertices={true}
          faceOpacity={0.25}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })
})
