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

    it('should have correct default distance', () => {
      const { distance } = useProjectionStore.getState();
      expect(distance).toBe(4.0);
    });

    it('should have correct default FOV', () => {
      const { fov } = useProjectionStore.getState();
      expect(fov).toBe(60);
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

  describe('setDistance', () => {
    it('should update distance within valid range', () => {
      const { setDistance } = useProjectionStore.getState();

      setDistance(5.5);
      expect(useProjectionStore.getState().distance).toBe(5.5);

      setDistance(2.0);
      expect(useProjectionStore.getState().distance).toBe(2.0);

      setDistance(10.0);
      expect(useProjectionStore.getState().distance).toBe(10.0);
    });

    it('should clamp distance to minimum value (2.0)', () => {
      const { setDistance } = useProjectionStore.getState();

      setDistance(1.0);
      expect(useProjectionStore.getState().distance).toBe(2.0);

      setDistance(-5.0);
      expect(useProjectionStore.getState().distance).toBe(2.0);
    });

    it('should clamp distance to maximum value (10.0)', () => {
      const { setDistance } = useProjectionStore.getState();

      setDistance(15.0);
      expect(useProjectionStore.getState().distance).toBe(10.0);

      setDistance(100.0);
      expect(useProjectionStore.getState().distance).toBe(10.0);
    });
  });

  describe('setFov', () => {
    it('should update FOV within valid range', () => {
      const { setFov } = useProjectionStore.getState();

      setFov(45);
      expect(useProjectionStore.getState().fov).toBe(45);

      setFov(30);
      expect(useProjectionStore.getState().fov).toBe(30);

      setFov(120);
      expect(useProjectionStore.getState().fov).toBe(120);
    });

    it('should clamp FOV to minimum value (30)', () => {
      const { setFov } = useProjectionStore.getState();

      setFov(20);
      expect(useProjectionStore.getState().fov).toBe(30);

      setFov(-10);
      expect(useProjectionStore.getState().fov).toBe(30);
    });

    it('should clamp FOV to maximum value (120)', () => {
      const { setFov } = useProjectionStore.getState();

      setFov(150);
      expect(useProjectionStore.getState().fov).toBe(120);

      setFov(200);
      expect(useProjectionStore.getState().fov).toBe(120);
    });
  });

  describe('resetToDefaults', () => {
    it('should restore all values to defaults', () => {
      const { setType, setDistance, setFov, resetToDefaults } = useProjectionStore.getState();

      // Change all values
      setType('orthographic');
      setDistance(8.0);
      setFov(90);

      // Verify they changed
      expect(useProjectionStore.getState().type).toBe('orthographic');
      expect(useProjectionStore.getState().distance).toBe(8.0);
      expect(useProjectionStore.getState().fov).toBe(90);

      // Reset
      resetToDefaults();

      // Verify defaults restored
      expect(useProjectionStore.getState().type).toBe('perspective');
      expect(useProjectionStore.getState().distance).toBe(4.0);
      expect(useProjectionStore.getState().fov).toBe(60);
    });
  });
});
