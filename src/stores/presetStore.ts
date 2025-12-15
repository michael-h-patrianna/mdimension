import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useVisualStore } from './visualStore';
import { useGeometryStore } from './geometryStore';
import { useExtendedObjectStore } from './extendedObjectStore';
import { useTransformStore } from './transformStore';

export interface SavedPreset {
  id: string;
  name: string;
  timestamp: number;
  data: {
    visual: any;
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
        const visual = cleanState(useVisualStore.getState());
        const geometry = cleanState(useGeometryStore.getState());
        const extended = cleanState(useExtendedObjectStore.getState());
        const transform = cleanState(useTransformStore.getState());

        const newPreset: SavedPreset = {
          id: crypto.randomUUID(),
          name,
          timestamp: Date.now(),
          data: {
            visual,
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
        // Note: setState is available on the store hook itself, but here we use the store instance if we exported it.
        // Since we imported hooks, we can use their setState methods if they were exposed, but typically we use store.setState
        
        // We need to access the store instances directly. 
        // Since we imported hooks, we rely on Zustand's singleton nature if the hooks are just wrappers.
        // However, usually hooks don't expose setState directly unless we import the store definition.
        
        // Assuming we can just use the hooks' `setState` (not standard API for hooks) 
        // or we need to import the vanilla store. 
        // For now, let's assume we can define actions in those stores to "loadState" or we accept we might need to manually set properties.
        // Or we use the hooks to get setters. This is tricky inside a function.
        
        // Better approach: use `useVisualStore.setState(preset.data.visual)` which IS valid in Zustand v4+ 
        useVisualStore.setState(preset.data.visual);
        useGeometryStore.setState(preset.data.geometry);
        useExtendedObjectStore.setState(preset.data.extended);
        useTransformStore.setState(preset.data.transform);
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
