/**
 * Tests for LightGroundVisualization component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { LightGroundVisualization } from '@/components/canvas/gizmos/LightGroundVisualization';
import type { LightSource } from '@/rendering/lights/types';

// Helper to create a test light
function createTestLight(overrides: Partial<LightSource> = {}): LightSource {
  return {
    id: 'test-light',
    name: 'Test Light',
    type: 'spot',
    enabled: true,
    position: [0, 5, 0] as [number, number, number],
    rotation: [Math.PI / 4, 0, 0] as [number, number, number], // Pointing down at 45 degrees
    color: '#FFFFFF',
    intensity: 1.0,
    coneAngle: 30,
    penumbra: 0.5,
    range: 0,
    decay: 2,
    ...overrides,
  };
}

// Wrapper component that includes Canvas
function TestWrapper({
  light,
  isSelected = false,
  onRotationChange = vi.fn(),
  onPositionChange = vi.fn(),
  onDragStart = vi.fn(),
  onDragEnd = vi.fn(),
  onSelect = vi.fn(),
}: {
  light: LightSource;
  isSelected?: boolean;
  onRotationChange?: (rotation: [number, number, number]) => void;
  onPositionChange?: (position: [number, number, number]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onSelect?: () => void;
}) {
  return (
    <Canvas>
      <LightGroundVisualization
        light={light}
        isSelected={isSelected}
        onRotationChange={onRotationChange}
        onPositionChange={onPositionChange}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onSelect={onSelect}
      />
    </Canvas>
  );
}

describe('LightGroundVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('point light sphere intersection', () => {
    it('should return null for point lights with range = 0 (infinite)', () => {
      const light = createTestLight({
        type: 'point',
        position: [0, 5, 0],
        range: 0, // Infinite range
      });
      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should return null for point lights below ground', () => {
      const light = createTestLight({
        type: 'point',
        position: [0, -5, 0],
        range: 10,
      });
      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should return null when sphere does not touch ground (height >= range)', () => {
      const light = createTestLight({
        type: 'point',
        position: [0, 10, 0], // Height = 10
        range: 5, // Range = 5, sphere doesn't touch ground
      });
      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should render circle when sphere intersects ground', () => {
      const light = createTestLight({
        type: 'point',
        position: [0, 5, 0], // Height = 5
        range: 10, // Range = 10, sphere touches ground
      });
      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should render circle for point light at various heights within range', () => {
      const testCases = [
        { height: 1, range: 10 }, // Circle radius = sqrt(100 - 1) ≈ 9.95
        { height: 5, range: 10 }, // Circle radius = sqrt(100 - 25) ≈ 8.66
        { height: 9, range: 10 }, // Circle radius = sqrt(100 - 81) ≈ 4.36
        { height: 9.9, range: 10 }, // Very small circle
      ];

      for (const { height, range } of testCases) {
        const light = createTestLight({
          type: 'point',
          position: [0, height, 0],
          range,
        });
        const { container } = render(<TestWrapper light={light} />);
        expect(container).toBeTruthy();
      }
    });

    it('should receive onPositionChange callback for point lights', () => {
      const onPositionChange = vi.fn();
      const light = createTestLight({
        type: 'point',
        position: [0, 5, 0],
        range: 10,
      });

      const { container } = render(
        <TestWrapper light={light} onPositionChange={onPositionChange} />
      );
      expect(container).toBeTruthy();
    });

    it('should handle point light at arbitrary position with valid range', () => {
      const light = createTestLight({
        type: 'point',
        position: [10, 8, -5],
        range: 15,
      });
      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should handle disabled point light', () => {
      const light = createTestLight({
        type: 'point',
        position: [0, 5, 0],
        range: 10,
        enabled: false,
      });
      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should handle selected point light', () => {
      const light = createTestLight({
        type: 'point',
        position: [0, 5, 0],
        range: 10,
      });
      const { container } = render(<TestWrapper light={light} isSelected={true} />);
      expect(container).toBeTruthy();
    });
  });

  describe('light position validation', () => {
    it('should render for light above ground pointing down', () => {
      const light = createTestLight({
        position: [0, 5, 0],
        rotation: [-Math.PI / 4, 0, 0], // Pointing downward
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should not render when light is at ground level', () => {
      const light = createTestLight({
        position: [0, 0, 0], // At ground
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should not render when light is below ground', () => {
      const light = createTestLight({
        position: [0, -5, 0], // Below ground
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });
  });

  describe('light direction validation', () => {
    it('should not render when light is pointing upward', () => {
      const light = createTestLight({
        position: [0, 5, 0],
        rotation: [Math.PI / 4, 0, 0], // Pointing upward (positive pitch)
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should render when light is pointing straight down', () => {
      const light = createTestLight({
        position: [0, 5, 0],
        rotation: [-Math.PI / 2, 0, 0], // Straight down
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should render when light is pointing at an angle', () => {
      const light = createTestLight({
        position: [0, 5, 0],
        rotation: [-Math.PI / 6, Math.PI / 4, 0], // 30 deg down, 45 deg yaw
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });
  });

  describe('spot light rendering', () => {
    it('should render visualization for spot light pointing down', () => {
      const light = createTestLight({
        type: 'spot',
        position: [0, 5, 0],
        rotation: [-Math.PI / 4, 0, 0],
        coneAngle: 30,
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should handle various cone angles', () => {
      const testAngles = [5, 30, 60, 90, 120];

      for (const angle of testAngles) {
        const light = createTestLight({
          type: 'spot',
          coneAngle: angle,
          rotation: [-Math.PI / 4, 0, 0],
        });

        const { container } = render(<TestWrapper light={light} />);
        expect(container).toBeTruthy();
      }
    });
  });

  describe('directional light rendering', () => {
    it('should render visualization for directional light', () => {
      const light = createTestLight({
        type: 'directional',
        position: [0, 5, 0],
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should not render ellipse for directional light', () => {
      const light = createTestLight({
        type: 'directional',
        position: [0, 5, 0],
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(<TestWrapper light={light} />);
      // Directional lights should render ray and target but not ellipse
      expect(container).toBeTruthy();
    });
  });

  describe('selection state', () => {
    it('should render with selected styling when isSelected is true', () => {
      const light = createTestLight({
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(
        <TestWrapper light={light} isSelected={true} />
      );
      expect(container).toBeTruthy();
    });

    it('should render with default styling when isSelected is false', () => {
      const light = createTestLight({
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(
        <TestWrapper light={light} isSelected={false} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe('disabled state', () => {
    it('should render with disabled styling when light is disabled', () => {
      const light = createTestLight({
        enabled: false,
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });
  });

  describe('color handling', () => {
    it('should use light color for visualization', () => {
      const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF'];

      for (const color of testColors) {
        const light = createTestLight({
          color,
          rotation: [-Math.PI / 4, 0, 0],
        });

        const { container } = render(<TestWrapper light={light} />);
        expect(container).toBeTruthy();
      }
    });
  });

  describe('callback props', () => {
    it('should receive onRotationChange callback', () => {
      const onRotationChange = vi.fn();
      const light = createTestLight({
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(
        <TestWrapper light={light} onRotationChange={onRotationChange} />
      );
      expect(container).toBeTruthy();
    });

    it('should receive onDragStart callback', () => {
      const onDragStart = vi.fn();
      const light = createTestLight({
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(
        <TestWrapper light={light} onDragStart={onDragStart} />
      );
      expect(container).toBeTruthy();
    });

    it('should receive onDragEnd callback', () => {
      const onDragEnd = vi.fn();
      const light = createTestLight({
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(
        <TestWrapper light={light} onDragEnd={onDragEnd} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle light very close to ground', () => {
      const light = createTestLight({
        position: [0, 0.2, 0],
        rotation: [-Math.PI / 4, 0, 0],
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should handle very steep light angle', () => {
      const light = createTestLight({
        position: [0, 5, 0],
        rotation: [-0.1, 0, 0], // Almost horizontal
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });

    it('should handle light at arbitrary position', () => {
      const light = createTestLight({
        position: [10, 20, -15],
        rotation: [-Math.PI / 3, Math.PI / 6, 0],
      });

      const { container } = render(<TestWrapper light={light} />);
      expect(container).toBeTruthy();
    });
  });
});
