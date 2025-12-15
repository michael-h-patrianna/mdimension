import { create } from 'zustand';
import { createUISlice, UISlice } from './slices/uiSlice';

export const useUIStore = create<UISlice>((...a) => ({
  ...createUISlice(...a),
}));
