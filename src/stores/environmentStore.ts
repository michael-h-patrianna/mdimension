import { create } from 'zustand';
import { createGroundSlice, GroundSlice } from './slices/groundSlice';

export const useEnvironmentStore = create<GroundSlice>((...a) => ({
  ...createGroundSlice(...a),
}));
