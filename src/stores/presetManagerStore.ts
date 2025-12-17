import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAnimationStore } from './animationStore'
import { useAppearanceStore } from './appearanceStore'
import { useCameraStore } from './cameraStore'
import { useEnvironmentStore } from './environmentStore'
import { useExtendedObjectStore } from './extendedObjectStore'
import { useGeometryStore } from './geometryStore'
import { useLightingStore } from './lightingStore'
import { usePerformanceStore } from './performanceStore'
import { usePostProcessingStore } from './postProcessingStore'
import { useTransformStore } from './transformStore'
import { useUIStore } from './uiStore'

// -- Types --

export interface SavedStyle {
  id: string
  name: string
  timestamp: number
  data: {
    appearance: Record<string, unknown>
    lighting: Record<string, unknown>
    postProcessing: Record<string, unknown>
    environment: Record<string, unknown>
  }
}

export interface SavedScene {
  id: string
  name: string
  timestamp: number
  data: {
    // Style components
    appearance: Record<string, unknown>
    lighting: Record<string, unknown>
    postProcessing: Record<string, unknown>
    environment: Record<string, unknown>

    // Scene specific components
    geometry: Record<string, unknown>
    extended: Record<string, unknown>
    transform: Record<string, unknown>
    animation: Record<string, unknown> // Requires Set -> Array conversion
    camera: Record<string, unknown>
    ui: Record<string, unknown>
  }
}

interface PresetManagerState {
  savedStyles: SavedStyle[]
  savedScenes: SavedScene[]

  // Style Actions
  saveStyle: (name: string) => void
  loadStyle: (id: string) => void
  deleteStyle: (id: string) => void
  importStyles: (jsonData: string) => boolean
  exportStyles: () => string

  // Scene Actions
  saveScene: (name: string) => void
  loadScene: (id: string) => void
  deleteScene: (id: string) => void
  importScenes: (jsonData: string) => boolean
  exportScenes: () => string
}

// -- Helpers --

const cleanState = <T extends object>(state: T): Record<string, unknown> => {
  const clean: Record<string, unknown> = {}
  for (const key in state) {
    if (typeof state[key] !== 'function') {
      clean[key] = state[key]
    }
  }
  return clean
}

// Specialized helper for Animation store (Set -> Array)
const cleanAnimationState = <T extends object>(state: T) => {
  const clean = cleanState(state)
  if (clean.animatingPlanes instanceof Set) {
    clean.animatingPlanes = Array.from(clean.animatingPlanes)
  }
  return clean
}

export const usePresetManagerStore = create<PresetManagerState>()(
  persist(
    (set, get) => ({
      savedStyles: [],
      savedScenes: [],

      // --- Style Actions ---

      saveStyle: (name) => {
        const appearance = cleanState(useAppearanceStore.getState())
        const lighting = cleanState(useLightingStore.getState())
        const postProcessing = cleanState(usePostProcessingStore.getState())
        const environment = cleanState(useEnvironmentStore.getState())

        const newStyle: SavedStyle = {
          id: crypto.randomUUID(),
          name,
          timestamp: Date.now(),
          data: {
            appearance,
            lighting,
            postProcessing,
            environment,
          },
        }

        set((state) => ({ savedStyles: [...state.savedStyles, newStyle] }))
      },

      loadStyle: (id) => {
        const style = get().savedStyles.find((s) => s.id === id)
        if (!style) return

        // Signal scene transition start - pauses animation, triggers low quality
        usePerformanceStore.getState().setSceneTransitioning(true)

        useAppearanceStore.setState(style.data.appearance)
        useLightingStore.setState(style.data.lighting)
        usePostProcessingStore.setState(style.data.postProcessing)

        // Handle legacy environment data (fallback to no skybox)
        const envData = { ...style.data.environment }
        if (envData.skyboxEnabled === undefined) {
          envData.skyboxEnabled = false
        }
        useEnvironmentStore.setState(envData)

        // Signal scene transition complete after a brief delay for React to settle
        requestAnimationFrame(() => {
          usePerformanceStore.getState().setSceneTransitioning(false)
        })
      },

      deleteStyle: (id) => {
        set((state) => ({ savedStyles: state.savedStyles.filter((s) => s.id !== id) }))
      },

      importStyles: (jsonData) => {
        try {
          const imported = JSON.parse(jsonData)
          if (!Array.isArray(imported)) return false
          // Basic validation could be improved
          set((state) => ({ savedStyles: [...state.savedStyles, ...imported] }))
          return true
        } catch (e) {
          console.error('Failed to import styles', e)
          return false
        }
      },

      exportStyles: () => {
        return JSON.stringify(get().savedStyles, null, 2)
      },

      // --- Scene Actions ---

      saveScene: (name) => {
        // Style components
        const appearance = cleanState(useAppearanceStore.getState())
        const lighting = cleanState(useLightingStore.getState())
        const postProcessing = cleanState(usePostProcessingStore.getState())
        const environment = cleanState(useEnvironmentStore.getState())

        // Scene components
        const geometry = cleanState(useGeometryStore.getState())
        const extended = cleanState(useExtendedObjectStore.getState())
        const transform = cleanState(useTransformStore.getState())
        const ui = cleanState(useUIStore.getState())

        // Special handling
        const animation = cleanAnimationState(useAnimationStore.getState())
        const cameraState = useCameraStore.getState().captureState()
        const camera = cameraState ? cleanState(cameraState) : {}

        const newScene: SavedScene = {
          id: crypto.randomUUID(),
          name,
          timestamp: Date.now(),
          data: {
            appearance,
            lighting,
            postProcessing,
            environment,
            geometry,
            extended,
            transform,
            ui,
            animation,
            camera,
          },
        }

        set((state) => ({ savedScenes: [...state.savedScenes, newScene] }))
      },

      loadScene: (id) => {
        const scene = get().savedScenes.find((s) => s.id === id)
        if (!scene) return

        // Signal scene transition start - pauses animation, triggers low quality
        usePerformanceStore.getState().setSceneTransitioning(true)

        // Restore Style components
        useAppearanceStore.setState(scene.data.appearance)
        useLightingStore.setState(scene.data.lighting)
        usePostProcessingStore.setState(scene.data.postProcessing)

        // Handle legacy environment data
        const envData = { ...scene.data.environment }
        if (envData.skyboxEnabled === undefined) {
          envData.skyboxEnabled = false
        }
        useEnvironmentStore.setState(envData)

        // Restore Scene components
        useGeometryStore.setState(scene.data.geometry)
        useExtendedObjectStore.setState(scene.data.extended)
        useTransformStore.setState(scene.data.transform)
        useUIStore.setState(scene.data.ui)

        // Special handling for Animation (Array -> Set)
        if (scene.data.animation) {
          const animState = { ...scene.data.animation }
          if (Array.isArray(animState.animatingPlanes)) {
            animState.animatingPlanes = new Set(animState.animatingPlanes)
          }
          useAnimationStore.setState(animState)
        }

        // Special handling for Camera
        if (scene.data.camera && Object.keys(scene.data.camera).length > 0) {
          const cameraData = scene.data.camera as { position?: [number, number, number]; target?: [number, number, number] }
          if (cameraData.position && cameraData.target) {
            useCameraStore.getState().applyState({
              position: cameraData.position,
              target: cameraData.target,
            })
          }
        }

        // Signal scene transition complete after a brief delay for React to settle
        requestAnimationFrame(() => {
          usePerformanceStore.getState().setSceneTransitioning(false)
        })
      },

      deleteScene: (id) => {
        set((state) => ({ savedScenes: state.savedScenes.filter((s) => s.id !== id) }))
      },

      importScenes: (jsonData) => {
        try {
          const imported = JSON.parse(jsonData)
          if (!Array.isArray(imported)) return false
          set((state) => ({ savedScenes: [...state.savedScenes, ...imported] }))
          return true
        } catch (e) {
          console.error('Failed to import scenes', e)
          return false
        }
      },

      exportScenes: () => {
        return JSON.stringify(get().savedScenes, null, 2)
      },
    }),
    {
      name: 'mdimension-preset-manager',
    }
  )
)
