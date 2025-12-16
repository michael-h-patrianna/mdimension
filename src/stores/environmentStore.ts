import { create } from 'zustand';
import { createFogSlice, FogSlice } from './slices/fogSlice';
import { createGroundSlice, GroundSlice } from './slices/groundSlice';
import { createSkyboxSlice, SkyboxSlice } from './slices/skyboxSlice';

export type EnvironmentStore = GroundSlice & SkyboxSlice & FogSlice;

export const useEnvironmentStore = create<EnvironmentStore>((...a) => ({
  ...createGroundSlice(...a),
  ...createSkyboxSlice(...a),
  ...createFogSlice(...a),
}));
