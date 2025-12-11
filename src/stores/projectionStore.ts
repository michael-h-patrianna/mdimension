import { create } from 'zustand';

export type ProjectionType = 'perspective' | 'orthographic';

interface ProjectionState {
  type: ProjectionType;
  distance: number;      // 2.0 to 10.0, default 4.0
  fov: number;          // 30 to 120, default 60 (for Three.js camera)

  // Actions
  setType: (type: ProjectionType) => void;
  setDistance: (distance: number) => void;
  setFov: (fov: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_TYPE: ProjectionType = 'perspective';
const DEFAULT_DISTANCE = 4.0;
const DEFAULT_FOV = 60;

export const useProjectionStore = create<ProjectionState>((set) => ({
  type: DEFAULT_TYPE,
  distance: DEFAULT_DISTANCE,
  fov: DEFAULT_FOV,

  setType: (type: ProjectionType) => set({ type }),

  setDistance: (distance: number) => {
    // Clamp distance between 2.0 and 10.0
    const clampedDistance = Math.max(2.0, Math.min(10.0, distance));
    set({ distance: clampedDistance });
  },

  setFov: (fov: number) => {
    // Clamp FOV between 30 and 120
    const clampedFov = Math.max(30, Math.min(120, fov));
    set({ fov: clampedFov });
  },

  resetToDefaults: () => set({
    type: DEFAULT_TYPE,
    distance: DEFAULT_DISTANCE,
    fov: DEFAULT_FOV,
  }),
}));
