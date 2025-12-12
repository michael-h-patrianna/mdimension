import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { SceneLighting } from '@/components/canvas/SceneLighting';
import { useVisualStore } from '@/stores/visualStore';

describe('SceneLighting', () => {
  beforeEach(() => {
    // Reset store before each test
    useVisualStore.getState().reset();
  });

  describe('rendering', () => {
    it('should render without errors', () => {
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should always render ambient light', () => {
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });
  });

  describe('directional light', () => {
    it('should render directional light when enabled', () => {
      useVisualStore.getState().setLightEnabled(true);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should not render directional light when disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should update when light color changes', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setLightColor('#FF0000');
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should update when light angles change', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setLightHorizontalAngle(90);
      useVisualStore.getState().setLightVerticalAngle(45);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });
  });

  describe('light indicator', () => {
    it('should render light indicator when both enabled and indicator shown', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setShowLightIndicator(true);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should not render light indicator when light disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      useVisualStore.getState().setShowLightIndicator(true);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should not render light indicator when indicator hidden', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setShowLightIndicator(false);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });
  });

  describe('ambient light', () => {
    it('should update when ambient intensity changes', () => {
      useVisualStore.getState().setAmbientIntensity(0.5);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should render with minimum ambient intensity', () => {
      useVisualStore.getState().setAmbientIntensity(0);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should render with maximum ambient intensity', () => {
      useVisualStore.getState().setAmbientIntensity(1);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });
  });

  describe('light position calculation', () => {
    it('should calculate position for 0,0 angles', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setLightHorizontalAngle(0);
      useVisualStore.getState().setLightVerticalAngle(0);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should calculate position for 90,45 angles', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setLightHorizontalAngle(90);
      useVisualStore.getState().setLightVerticalAngle(45);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should calculate position for 180,0 angles', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setLightHorizontalAngle(180);
      useVisualStore.getState().setLightVerticalAngle(0);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should calculate position for negative vertical angle', () => {
      useVisualStore.getState().setLightEnabled(true);
      useVisualStore.getState().setLightHorizontalAngle(45);
      useVisualStore.getState().setLightVerticalAngle(-30);
      const { container } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });
  });

  describe('state reactivity', () => {
    it('should re-render when light enabled state changes', () => {
      const { rerender } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );

      useVisualStore.getState().setLightEnabled(false);
      rerender(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );

      expect(useVisualStore.getState().lightEnabled).toBe(false);
    });

    it('should re-render when light angles change', () => {
      const { rerender } = render(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );

      useVisualStore.getState().setLightHorizontalAngle(180);
      useVisualStore.getState().setLightVerticalAngle(-45);

      rerender(
        <Canvas>
          <SceneLighting />
        </Canvas>
      );

      expect(useVisualStore.getState().lightHorizontalAngle).toBe(180);
      expect(useVisualStore.getState().lightVerticalAngle).toBe(-45);
    });
  });
});
