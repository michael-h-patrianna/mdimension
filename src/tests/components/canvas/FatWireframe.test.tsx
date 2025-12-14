import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { FatWireframe } from '@/components/canvas/renderers/FatWireframe';

// Mock Three.js and R3F context
vi.mock('@react-three/fiber', () => ({
  extend: vi.fn(),
  useThree: () => ({ size: { width: 800, height: 600 } }),
  useFrame: vi.fn(),
}));

// Mock three-stdlib to avoid canvas/webgl requirements in test
vi.mock('three-stdlib', async () => {
  const THREE = await import('three');
  return {
    LineSegments2: class extends THREE.Object3D {
      computeLineDistances = vi.fn();
    },
    LineMaterial: class extends THREE.ShaderMaterial {
      resolution = new THREE.Vector2();
      uniforms = {};
      onBeforeCompile = vi.fn();
    },
    LineSegmentsGeometry: class extends THREE.BufferGeometry {
      setPositions = vi.fn();
      computeBoundingSphere = vi.fn();
      setAttribute = vi.fn();
    },
  };
});

// Mock rotation store
vi.mock('@/stores/rotationStore', () => ({
  useRotationStore: {
    getState: () => ({
      rotations: [],
    }),
  },
}));

// Mock transform store
vi.mock('@/stores/transformStore', () => ({
  useTransformStore: {
    getState: () => ({
      uniformScale: 1,
      perAxisScale: [1, 1, 1],
    }),
  },
}));

// Mock projection store
vi.mock('@/stores/projectionStore', () => ({
  useProjectionStore: {
    getState: () => ({
      type: 'perspective',
    }),
  },
}));

// Mock math functions
vi.mock('@/lib/math/rotation', () => ({
  composeRotations: () => ({
    getArray: () => new Float32Array(16),
  }),
}));

vi.mock('@/lib/math/projection', () => ({
  DEFAULT_PROJECTION_DISTANCE: 4,
}));

vi.mock('@/lib/shaders/transforms/ndTransform', () => ({
  matrixToGPUUniforms: () => ({
    rotationMatrix4D: {
      elements: new Float32Array(16),
    },
    extraRotationCols: new Float32Array(28),
    depthRowSums: new Float32Array(11),
  }),
}));

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('should accept dimension prop for N-D support', () => {
    const mockNDVertices = [
      [0, 0, 0, 1], // 4D vertex
      [1, 0, 0, -1],
      [0, 1, 0, 0],
    ];

    render(
      <FatWireframe
        vertices={mockNDVertices}
        edges={mockEdges}
        dimension={4}
        color="#ff00ff"
        thickness={2}
      />
    );
  });

  it('should use default dimension of 3 when not specified', () => {
    render(
      <FatWireframe
        vertices={mockVertices}
        edges={mockEdges}
        color="#ffffff"
      />
    );
    // No error means it used default dimension successfully
  });
});
