import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'cyan' | 'gold' | 'magenta';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'cyan',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'mdimension-theme-storage',
    }
  )
);
