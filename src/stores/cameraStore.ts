import { create } from 'zustand'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Vector3 } from 'three'

interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
}

interface CameraStore {
  controls: OrbitControlsImpl | null
  savedState: CameraState | null
  
  registerControls: (controls: OrbitControlsImpl) => void
  captureState: () => CameraState | null
  applyState: (state: CameraState) => void
}

export const useCameraStore = create<CameraStore>((set, get) => ({
  controls: null,
  savedState: null,

  registerControls: (controls) => set({ controls }),

  captureState: () => {
    const { controls } = get()
    if (!controls) return null

    const position: [number, number, number] = [
      controls.object.position.x,
      controls.object.position.y,
      controls.object.position.z
    ]
    
    const target: [number, number, number] = [
      controls.target.x,
      controls.target.y,
      controls.target.z
    ]

    return { position, target }
  },

  applyState: (state) => {
    const { controls } = get()
    if (!controls) return

    controls.object.position.set(...state.position)
    controls.target.set(...state.target)
    controls.update()
  }
}))
