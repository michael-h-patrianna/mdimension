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

export interface SavedPreset {
  id: string;
  name: string;
  timestamp: number;
  data: {
    visual?: any; // Legacy support
    appearance: any;
    lighting: any;
    postProcessing: any;
    ui: any;
    environment: any;
    geometry: any;
    extended: any;
    transform: any;
  }
}

interface PresetState {
  savedPresets: SavedPreset[];
  saveCurrentAsPreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
}

// Helper to strip functions from state
const cleanState = (state: any) => {
  const clean: any = {};
  for (const key in state) {
    if (typeof state[key] !== 'function') {
      clean[key] = state[key];
    }
  }
  return clean;
};

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      savedPresets: [],
      saveCurrentAsPreset: (name) => {
        const appearance = cleanState(useAppearanceStore.getState());
        const lighting = cleanState(useLightingStore.getState());
        const postProcessing = cleanState(usePostProcessingStore.getState());
        const ui = cleanState(useUIStore.getState());
        const environment = cleanState(useEnvironmentStore.getState());
        const geometry = cleanState(useGeometryStore.getState());
        const extended = cleanState(useExtendedObjectStore.getState());
        const transform = cleanState(useTransformStore.getState());

        const newPreset: SavedPreset = {
          id: crypto.randomUUID(),
          name,
          timestamp: Date.now(),
          data: {
            appearance,
            lighting,
            postProcessing,
            ui,
            environment,
            geometry,
            extended,
            transform,
          },
        };

        set((state) => ({ savedPresets: [...state.savedPresets, newPreset] }));
      },
      loadPreset: (id) => {
        const preset = get().savedPresets.find((p) => p.id === id);
        if (!preset) return;

        // Restore stores
        useGeometryStore.setState(preset.data.geometry);
        useExtendedObjectStore.setState(preset.data.extended);
        useTransformStore.setState(preset.data.transform);

        // Handle migration from legacy single visual store to split stores
        if (preset.data.visual) {
          // If legacy preset, try to map properties (best effort)
          // Since this is internal state, we might just accept that old presets might break or we can implement a mapper
          // For now, let's assume we can set state on new stores if properties match
          useAppearanceStore.setState(preset.data.visual);
          useLightingStore.setState(preset.data.visual);
          usePostProcessingStore.setState(preset.data.visual);
          useUIStore.setState(preset.data.visual);
          useEnvironmentStore.setState(preset.data.visual);
        } else {
          // New format
          useAppearanceStore.setState(preset.data.appearance);
          useLightingStore.setState(preset.data.lighting);
          usePostProcessingStore.setState(preset.data.postProcessing);
          useUIStore.setState(preset.data.ui);
          useEnvironmentStore.setState(preset.data.environment);
        }
      },
      deletePreset: (id) => {
        set((state) => ({ savedPresets: state.savedPresets.filter((p) => p.id !== id) }));
      },
    }),
    {
      name: 'mdimension-presets-storage',
    }
  )
);
