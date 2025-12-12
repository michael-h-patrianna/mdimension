import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FatWireframe } from '@/components/canvas/FatWireframe';

// Mock Three.js and R3F context
vi.mock('@react-three/fiber', () => ({
  extend: vi.fn(),
  useThree: () => ({ size: { width: 800, height: 600 } }),
}));

// Mock three-stdlib to avoid canvas/webgl requirements in test
// We can't import THREE here for use in the mock factory due to hoisting
vi.mock('three-stdlib', async () => {
  const THREE = await import('three');
  return {
    LineSegments2: class extends THREE.Object3D {
      computeLineDistances = vi.fn();
    },
    LineMaterial: class extends THREE.ShaderMaterial {
      resolution = new THREE.Vector2();
    },
    LineSegmentsGeometry: class extends THREE.BufferGeometry {
      setPositions = vi.fn();
      computeBoundingSphere = vi.fn();
    },
  };
});

describe('FatWireframe', () => {
  const mockVertices = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ];
  const mockEdges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];

  it('should render without errors', () => {
    const { container } = render(
      <FatWireframe
        vertices={mockVertices}
        edges={mockEdges}
        color="#ff0000"
        thickness={3}
      />
    );
    expect(container).toBeDefined();
  });

  it('should accept custom color and thickness', () => {
    render(
      <FatWireframe
        vertices={mockVertices}
        edges={mockEdges}
        color="#00ff00"
        thickness={5}
      />
    );
  });

  it('should handle empty inputs gracefully', () => {
    render(
      <FatWireframe
        vertices={[]}
        edges={[]}
        color="#0000ff"
      />
    );
  });
});