import { create } from 'zustand'

export type ProjectionType = 'perspective' | 'orthographic'

interface ProjectionState {
  type: ProjectionType

  // Actions
  setType: (type: ProjectionType) => void
  resetToDefaults: () => void
}

const DEFAULT_TYPE: ProjectionType = 'perspective'

export const useProjectionStore = create<ProjectionState>((set) => ({
  type: DEFAULT_TYPE,

  setType: (type: ProjectionType) => set({ type }),

  resetToDefaults: () =>
    set({
      type: DEFAULT_TYPE,
    }),
}))
