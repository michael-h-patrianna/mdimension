import { create } from 'zustand';
import { createPostProcessingSlice, PostProcessingSlice } from './slices/postProcessingSlice';

export const usePostProcessingStore = create<PostProcessingSlice>((...a) => ({
  ...createPostProcessingSlice(...a),
}));
