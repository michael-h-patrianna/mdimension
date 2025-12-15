import { create } from 'zustand';
import { createAppearanceSlice, AppearanceSlice } from './slices/appearanceSlice';

export const useAppearanceStore = create<AppearanceSlice>((...a) => ({
  ...createAppearanceSlice(...a),
}));
