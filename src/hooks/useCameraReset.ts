import { useThree } from '@react-three/fiber'

/**
 * Hook to access camera reset functionality.
 *
 * @returns Object with reset function
 *
 * @example
 * ```tsx
 * function ResetButton() {
 *   const { reset } = useCameraReset()
 *   return <button onClick={reset}>Reset Camera</button>
 * }
 * ```
 */
export function useCameraReset() {
  const { camera } = useThree()

  const reset = () => {
    // Reset camera to initial position
    camera.position.set(0, 0, 5)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }

  return { reset }
}
