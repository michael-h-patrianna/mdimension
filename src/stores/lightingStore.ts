import { create } from 'zustand';
import { createLightingSlice, LightingSlice } from './slices/lightingSlice';

export const useLightingStore = create<LightingSlice>((...a) => ({
  ...createLightingSlice(...a),
}));
