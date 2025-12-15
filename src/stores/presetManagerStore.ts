import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAppearanceStore } from './appearanceStore';
import { useLightingStore } from './lightingStore';
import { usePostProcessingStore } from './postProcessingStore';
import { useUIStore } from './uiStore';
import { useEnvironmentStore } from './environmentStore';
import { useGeometryStore } from './geometryStore';
import { useExtendedObjectStore } from './extendedObjectStore';
import { useTransformStore } from './transformStore';
import { useAnimationStore } from './animationStore';
import { useCameraStore } from './cameraStore';

// -- Types --

export interface SavedStyle {
  id: string;
  name: string;
  timestamp: number;
  data: {
    appearance: any;
    lighting: any;
    postProcessing: any;
    environment: any;
  }
}

export interface SavedScene {
  id: string;
  name: string;
  timestamp: number;
  data: {
    // Style components
    appearance: any;
    lighting: any;
    postProcessing: any;
    environment: any;
    
    // Scene specific components
    geometry: any;
    extended: any;
    transform: any;
    animation: any; // Requires Set -> Array conversion
    camera: any;
    ui: any; 
  }
}

interface PresetManagerState {
  savedStyles: SavedStyle[];
  savedScenes: SavedScene[];

  // Style Actions
  saveStyle: (name: string) => void;
  loadStyle: (id: string) => void;
  deleteStyle: (id: string) => void;
  importStyles: (jsonData: string) => boolean;
  exportStyles: () => string;

  // Scene Actions
  saveScene: (name: string) => void;
  loadScene: (id: string) => void;
  deleteScene: (id: string) => void;
  importScenes: (jsonData: string) => boolean;
  exportScenes: () => string;
}

// -- Helpers --

const cleanState = (state: any) => {
  const clean: any = {};
  for (const key in state) {
    if (typeof state[key] !== 'function') {
      clean[key] = state[key];
    }
  }
  return clean;
};

// Specialized helper for Animation store (Set -> Array)
const cleanAnimationState = (state: any) => {
  const clean = cleanState(state);
  if (clean.animatingPlanes instanceof Set) {
    clean.animatingPlanes = Array.from(clean.animatingPlanes);
  }
  return clean;
};

export const usePresetManagerStore = create<PresetManagerState>()(
  persist(
    (set, get) => ({
      savedStyles: [],
      savedScenes: [],

      // --- Style Actions ---

      saveStyle: (name) => {
        const appearance = cleanState(useAppearanceStore.getState());
        const lighting = cleanState(useLightingStore.getState());
        const postProcessing = cleanState(usePostProcessingStore.getState());
        const environment = cleanState(useEnvironmentStore.getState());

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
        };

        set((state) => ({ savedStyles: [...state.savedStyles, newStyle] }));
      },

      loadStyle: (id) => {
        const style = get().savedStyles.find((s) => s.id === id);
        if (!style) return;

        useAppearanceStore.setState(style.data.appearance);
        useLightingStore.setState(style.data.lighting);
        usePostProcessingStore.setState(style.data.postProcessing);
        useEnvironmentStore.setState(style.data.environment);
      },

      deleteStyle: (id) => {
        set((state) => ({ savedStyles: state.savedStyles.filter((s) => s.id !== id) }));
      },

      importStyles: (jsonData) => {
        try {
          const imported = JSON.parse(jsonData);
          if (!Array.isArray(imported)) return false;
          // Basic validation could be improved
          set((state) => ({ savedStyles: [...state.savedStyles, ...imported] }));
          return true;
        } catch (e) {
          console.error("Failed to import styles", e);
          return false;
        }
      },

      exportStyles: () => {
        return JSON.stringify(get().savedStyles, null, 2);
      },

      // --- Scene Actions ---

      saveScene: (name) => {
        // Style components
        const appearance = cleanState(useAppearanceStore.getState());
        const lighting = cleanState(useLightingStore.getState());
        const postProcessing = cleanState(usePostProcessingStore.getState());
        const environment = cleanState(useEnvironmentStore.getState());

        // Scene components
        const geometry = cleanState(useGeometryStore.getState());
        const extended = cleanState(useExtendedObjectStore.getState());
        const transform = cleanState(useTransformStore.getState());
        const ui = cleanState(useUIStore.getState());
        
        // Special handling
        const animation = cleanAnimationState(useAnimationStore.getState());
        const camera = useCameraStore.getState().captureState();

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
            camera
          },
        };

        set((state) => ({ savedScenes: [...state.savedScenes, newScene] }));
      },

      loadScene: (id) => {
        const scene = get().savedScenes.find((s) => s.id === id);
        if (!scene) return;

        // Restore Style components
        useAppearanceStore.setState(scene.data.appearance);
        useLightingStore.setState(scene.data.lighting);
        usePostProcessingStore.setState(scene.data.postProcessing);
        useEnvironmentStore.setState(scene.data.environment);

        // Restore Scene components
        useGeometryStore.setState(scene.data.geometry);
        useExtendedObjectStore.setState(scene.data.extended);
        useTransformStore.setState(scene.data.transform);
        useUIStore.setState(scene.data.ui);

        // Special handling for Animation (Array -> Set)
        if (scene.data.animation) {
          const animState = { ...scene.data.animation };
          if (Array.isArray(animState.animatingPlanes)) {
            animState.animatingPlanes = new Set(animState.animatingPlanes);
          }
          useAnimationStore.setState(animState);
        }

        // Special handling for Camera
        if (scene.data.camera) {
          useCameraStore.getState().applyState(scene.data.camera);
        }
      },

      deleteScene: (id) => {
        set((state) => ({ savedScenes: state.savedScenes.filter((s) => s.id !== id) }));
      },

      importScenes: (jsonData) => {
        try {
          const imported = JSON.parse(jsonData);
          if (!Array.isArray(imported)) return false;
          set((state) => ({ savedScenes: [...state.savedScenes, ...imported] }));
          return true;
        } catch (e) {
          console.error("Failed to import scenes", e);
          return false;
        }
      },

      exportScenes: () => {
        return JSON.stringify(get().savedScenes, null, 2);
      },

    }),
    {
      name: 'mdimension-preset-manager',
    }
  )
);
