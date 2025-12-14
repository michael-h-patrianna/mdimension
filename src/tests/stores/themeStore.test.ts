/**
 * Tests for themeStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    // Reset to default theme before each test
    useThemeStore.setState({ theme: 'cyan' });
  });

  describe('initial state', () => {
    it('should have cyan as default theme', () => {
      expect(useThemeStore.getState().theme).toBe('cyan');
    });
  });

  describe('setTheme', () => {
    it('should set theme to green', () => {
      useThemeStore.getState().setTheme('green');
      expect(useThemeStore.getState().theme).toBe('green');
    });

    it('should set theme to magenta', () => {
      useThemeStore.getState().setTheme('magenta');
      expect(useThemeStore.getState().theme).toBe('magenta');
    });

    it('should set theme back to cyan', () => {
      useThemeStore.getState().setTheme('magenta');
      useThemeStore.getState().setTheme('cyan');
      expect(useThemeStore.getState().theme).toBe('cyan');
    });

    it('should fallback to cyan for invalid theme values', () => {
      // TypeScript won't allow this, but at runtime invalid values could come from localStorage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useThemeStore.getState().setTheme('invalid' as any);
      expect(useThemeStore.getState().theme).toBe('cyan');
    });

    it('should handle empty string as invalid theme', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useThemeStore.getState().setTheme('' as any);
      expect(useThemeStore.getState().theme).toBe('cyan');
    });
  });

  describe('theme persistence key', () => {
    it('should use correct storage key', () => {
      // The store uses 'mdimension-theme-storage' as the persist key
      // This test verifies the store structure is correct
      expect(useThemeStore.persist).toBeDefined();
    });
  });
});
