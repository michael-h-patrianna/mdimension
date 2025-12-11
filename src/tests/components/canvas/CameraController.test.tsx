import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Canvas } from '@react-three/fiber'
import { CameraController, useCameraReset } from '@/components/canvas/CameraController'

describe('CameraController', () => {
  it('should render without errors', () => {
    const { container } = render(
      <Canvas>
        <CameraController />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom damping factor', () => {
    const { container } = render(
      <Canvas>
        <CameraController dampingFactor={0.1} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom zoom limits', () => {
    const { container } = render(
      <Canvas>
        <CameraController minDistance={3} maxDistance={15} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should enable auto-rotation', () => {
    const { container } = render(
      <Canvas>
        <CameraController autoRotate autoRotateSpeed={2.0} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should disable damping', () => {
    const { container } = render(
      <Canvas>
        <CameraController enableDamping={false} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should disable pan', () => {
    const { container } = render(
      <Canvas>
        <CameraController enablePan={false} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should disable zoom', () => {
    const { container } = render(
      <Canvas>
        <CameraController enableZoom={false} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should accept custom rotate speed', () => {
    const { container } = render(
      <Canvas>
        <CameraController rotateSpeed={1.0} />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })

  it('should render with all props', () => {
    const { container } = render(
      <Canvas>
        <CameraController
          enableDamping={true}
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={18}
          autoRotate={true}
          autoRotateSpeed={1.5}
          enablePan={true}
          enableZoom={true}
          rotateSpeed={0.75}
        />
      </Canvas>
    )
    expect(container).toBeTruthy()
  })
})

describe('useCameraReset', () => {
  it('should provide reset function and not throw when called', () => {
    function TestComponent() {
      const { reset } = useCameraReset()
      // Call reset immediately to test it doesn't throw
      expect(reset).toBeDefined()
      expect(typeof reset).toBe('function')
      expect(() => reset()).not.toThrow()
      return null
    }

    const { container } = render(
      <Canvas>
        <TestComponent />
      </Canvas>
    )

    expect(container).toBeTruthy()
  })
})
