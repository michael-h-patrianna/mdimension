import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'cyan' | 'green' | 'magenta' | 'orange' | 'blue' | 'rainbow';

/** Valid theme values for runtime validation */
const VALID_THEMES: readonly Theme[] = ['cyan', 'green', 'magenta', 'orange', 'blue', 'rainbow'] as const;

/** Type guard to validate theme values at runtime */
function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && VALID_THEMES.includes(value as Theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'blue', // Default to our new polished blue
      setTheme: (theme) => {
        // Runtime validation for safety (handles localStorage deserialization edge cases)
        if (!isValidTheme(theme)) {
          if (import.meta.env.DEV) {
            console.warn(`Invalid theme value: "${theme}". Using default "blue".`);
          }
          set({ theme: 'blue' });
          return;
        }
        set({ theme });
      },
    }),
    {
      name: 'mdimension-theme-storage',
    }
  )
);
