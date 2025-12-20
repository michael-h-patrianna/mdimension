import { create } from 'zustand';
import { createAppearanceSlice, AppearanceSlice } from './slices/appearanceSlice';

export type { AppearanceSlice };

export const useAppearanceStore = create<AppearanceSlice>((...a) => ({
  ...createAppearanceSlice(...a),
}));
