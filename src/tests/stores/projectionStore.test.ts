import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectionStore } from '@/stores/projectionStore';

describe('projectionStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useProjectionStore.getState().resetToDefaults();
  });

  describe('default values', () => {
    it('should have correct default projection type', () => {
      const { type } = useProjectionStore.getState();
      expect(type).toBe('perspective');
    });
  });

  describe('setType', () => {
    it('should change projection type to perspective', () => {
      const { setType } = useProjectionStore.getState();
      setType('orthographic');
      expect(useProjectionStore.getState().type).toBe('orthographic');

      setType('perspective');
      expect(useProjectionStore.getState().type).toBe('perspective');
    });

    it('should change projection type to orthographic', () => {
      const { setType } = useProjectionStore.getState();
      setType('orthographic');
      expect(useProjectionStore.getState().type).toBe('orthographic');
    });
  });

  describe('resetToDefaults', () => {
    it('should restore all values to defaults', () => {
      const { setType, resetToDefaults } = useProjectionStore.getState();

      // Change values
      setType('orthographic');

      // Verify they changed
      expect(useProjectionStore.getState().type).toBe('orthographic');

      // Reset
      resetToDefaults();

      // Verify defaults restored
      expect(useProjectionStore.getState().type).toBe('perspective');
    });
  });
});
