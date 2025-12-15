import { create } from 'zustand';
import { createGroundSlice, GroundSlice } from './slices/groundSlice';
import { createSkyboxSlice, SkyboxSlice } from './slices/skyboxSlice';

export const useEnvironmentStore = create<GroundSlice & SkyboxSlice>((...a) => ({
  ...createGroundSlice(...a),
  ...createSkyboxSlice(...a),
}));
