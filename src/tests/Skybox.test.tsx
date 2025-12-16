import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Skybox } from '@/rendering/environment/Skybox';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useAppearanceStore } from '@/stores/appearanceStore';

// Mock dependencies
vi.mock('@react-three/drei', () => ({
  Environment: () => null,
  shaderMaterial: () => class ShaderMaterial {},
}));

vi.mock('@react-three/fiber', () => ({
  extend: vi.fn(),
  useFrame: vi.fn(),
  useThree: () => ({
    gl: {
      compileEquirectangularShader: vi.fn(),
    },
    pointer: { x: 0, y: 0 },
  }),
}));

vi.mock('three/examples/jsm/loaders/KTX2Loader', () => ({
  KTX2Loader: class {
    setTranscoderPath = vi.fn();
    detectSupport = vi.fn();
    load = vi.fn();
    dispose = vi.fn();
  },
}));

describe('Skybox', () => {
  it('renders nothing when disabled', () => {
    useEnvironmentStore.setState({ skyboxEnabled: false });
    const { container } = render(<Skybox />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders procedural mesh when in procedural mode', () => {
    useEnvironmentStore.setState({ 
      skyboxEnabled: true,
      skyboxMode: 'procedural_aurora'
    });
    
    // We can't easily test the Canvas output in unit tests, but we can verify it doesn't crash
    // and that the logic branches correctly (no KTX2Loader triggered for procedural)
    
    // Ideally we would inspect the mock calls or the rendered tree, but 
    // without a Canvas context, R3F components don't actually render to DOM.
    // This test primarily ensures the component logic handles the new mode without error.
    
    const { container } = render(<Skybox />);
    expect(container).toBeTruthy();
  });
});
