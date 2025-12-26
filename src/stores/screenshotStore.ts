import { create } from 'zustand';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenshotStore {
  isOpen: boolean;
  imageSrc: string | null;
  crop: CropArea | null; // Null means full image

  // Actions
  openModal: (imageSrc: string) => void;
  closeModal: () => void;
  setCrop: (crop: CropArea | null) => void;
  reset: () => void;
}

export const useScreenshotStore = create<ScreenshotStore>((set) => ({
  isOpen: false,
  imageSrc: null,
  crop: null,

  openModal: (imageSrc) => set({ isOpen: true, imageSrc, crop: null }),
  closeModal: () => set({ isOpen: false }),
  setCrop: (crop) => set({ crop }),
  reset: () => set({ isOpen: false, imageSrc: null, crop: null }),
}));
