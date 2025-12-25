import { create } from 'zustand';
import { createGroundSlice, GroundSlice } from './slices/groundSlice';
import { createSkyboxSlice, SkyboxSlice } from './slices/skyboxSlice';

export type EnvironmentStore = GroundSlice & SkyboxSlice;

export const useEnvironmentStore = create<EnvironmentStore>((...a) => ({
  ...createGroundSlice(...a),
  ...createSkyboxSlice(...a),
}));
