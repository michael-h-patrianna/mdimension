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
import { useRotationStore } from './rotationStore'
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
    rotation: Record<string, unknown> // Stores Map as Object/Array
    animation: Record<string, unknown> // Stores Set as Array
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

/**
 * Deep clones state and removes functions to ensure JSON serializability.
 * Prevents reference mutation issues where saved presets would change when store changes.
 */
const serializeState = <T extends object>(state: T): Record<string, unknown> => {
  // 1. Create a shallow copy first to filter functions
  const clean: Record<string, unknown> = {}
  for (const key in state) {
    if (typeof state[key] !== 'function') {
      clean[key] = state[key]
    }
  }
  
  // 2. Deep clone via JSON to break references
  return JSON.parse(JSON.stringify(clean))
}

/**
 * Serializes Animation store (Set -> Array)
 */
const serializeAnimationState = <T extends object>(state: T) => {
  const clean = serializeState(state)
  if ('animatingPlanes' in state && state.animatingPlanes instanceof Set) {
    clean.animatingPlanes = Array.from(state.animatingPlanes)
  }
  return clean
}

/**
 * Serializes Rotation store (Map -> Object)
 */
const serializeRotationState = <T extends object>(state: T) => {
  const clean = serializeState(state)
  if ('rotations' in state && state.rotations instanceof Map) {
    // Convert Map to Object for JSON serialization
    clean.rotations = Object.fromEntries(state.rotations as Map<string, unknown>)
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
        // Deep clone all states to prevent reference sharing
        const appearance = serializeState(useAppearanceStore.getState())
        const lighting = serializeState(useLightingStore.getState())
        const postProcessing = serializeState(usePostProcessingStore.getState())
        const environment = serializeState(useEnvironmentStore.getState())

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

        // Signal scene transition start
        usePerformanceStore.getState().setSceneTransitioning(true)

        // Restore states
        // NOTE: We assume these are plain objects and arrays which Zustand handles fine
        useAppearanceStore.setState(style.data.appearance)
        useLightingStore.setState(style.data.lighting)
        usePostProcessingStore.setState(style.data.postProcessing)

        // Handle legacy environment data (fallback to no skybox)
        const envData = { ...style.data.environment }
        if (envData.skyboxEnabled === undefined) {
          envData.skyboxEnabled = false
        }
        useEnvironmentStore.setState(envData)

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
          // Basic validation: Check if items look like SavedStyle
          const valid = imported.every(i => i.id && i.name && i.data && i.data.appearance)
          if (!valid) return false

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
        const appearance = serializeState(useAppearanceStore.getState())
        const lighting = serializeState(useLightingStore.getState())
        const postProcessing = serializeState(usePostProcessingStore.getState())
        const environment = serializeState(useEnvironmentStore.getState())

        // Scene components
        const geometry = serializeState(useGeometryStore.getState())
        const extended = serializeState(useExtendedObjectStore.getState())
        const transform = serializeState(useTransformStore.getState())
        const ui = serializeState(useUIStore.getState())

        // Special handling
        const animation = serializeAnimationState(useAnimationStore.getState())
        const rotation = serializeRotationState(useRotationStore.getState())
        
        const cameraState = useCameraStore.getState().captureState()
        const camera = cameraState ? serializeState(cameraState) : {}

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
            rotation,
            animation,
            camera,
          },
        }

        set((state) => ({ savedScenes: [...state.savedScenes, newScene] }))
      },

      loadScene: (id) => {
        const scene = get().savedScenes.find((s) => s.id === id)
        if (!scene) return

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

        // Special handling for Rotation (Object -> Map)
        if (scene.data.rotation) {
          const rotState = { ...scene.data.rotation }
          if (rotState.rotations && typeof rotState.rotations === 'object' && !Array.isArray(rotState.rotations)) {
            // Convert Object back to Map
            rotState.rotations = new Map(Object.entries(rotState.rotations as Record<string, number>))
          }
          useRotationStore.setState(rotState)
        }

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
          // Basic validation
          const valid = imported.every(i => i.id && i.name && i.data && i.data.geometry)
          if (!valid) return false

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
