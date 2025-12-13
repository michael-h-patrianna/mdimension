import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'cyan' | 'green' | 'magenta';

/** Valid theme values for runtime validation */
const VALID_THEMES: readonly Theme[] = ['cyan', 'green', 'magenta'] as const;

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
      theme: 'cyan',
      setTheme: (theme) => {
        // Runtime validation for safety (handles localStorage deserialization edge cases)
        if (!isValidTheme(theme)) {
          if (import.meta.env.DEV) {
            console.warn(`Invalid theme value: "${theme}". Using default "cyan".`);
          }
          set({ theme: 'cyan' });
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
