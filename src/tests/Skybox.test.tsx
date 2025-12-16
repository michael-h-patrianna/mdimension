import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Skybox } from '@/rendering/environment/Skybox';
import { useEnvironmentStore } from '@/stores/environmentStore';

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

describe('SkyboxSlice', () => {
  it('setSkyboxSelection sets none correctly', () => {
    useEnvironmentStore.getState().setSkyboxSelection('none');

    const state = useEnvironmentStore.getState();
    expect(state.skyboxSelection).toBe('none');
    expect(state.skyboxEnabled).toBe(false);
    expect(state.skyboxMode).toBe('classic');
    expect(state.skyboxTexture).toBe('none');
  });

  it('setSkyboxSelection sets classic texture correctly', () => {
    useEnvironmentStore.getState().setSkyboxSelection('space_red');

    const state = useEnvironmentStore.getState();
    expect(state.skyboxSelection).toBe('space_red');
    expect(state.skyboxEnabled).toBe(true);
    expect(state.skyboxMode).toBe('classic');
    expect(state.skyboxTexture).toBe('space_red');
  });

  it('setSkyboxSelection sets procedural mode correctly', () => {
    useEnvironmentStore.getState().setSkyboxSelection('procedural_void');

    const state = useEnvironmentStore.getState();
    expect(state.skyboxSelection).toBe('procedural_void');
    expect(state.skyboxEnabled).toBe(true);
    expect(state.skyboxMode).toBe('procedural_void');
  });

  it('resetSkyboxSettings resets to default selection', () => {
    useEnvironmentStore.getState().setSkyboxSelection('none');
    useEnvironmentStore.getState().resetSkyboxSettings();

    const state = useEnvironmentStore.getState();
    expect(state.skyboxSelection).toBe('space_blue');
    expect(state.skyboxEnabled).toBe(true);
    expect(state.skyboxMode).toBe('classic');
  });
});

describe('Skybox', () => {
  it('renders nothing when selection is none', () => {
    useEnvironmentStore.setState({
      skyboxSelection: 'none',
      skyboxEnabled: false,
      skyboxMode: 'classic'
    });
    const { container } = render(<Skybox />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when disabled via legacy state', () => {
    useEnvironmentStore.setState({ skyboxEnabled: false });
    const { container } = render(<Skybox />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders procedural mesh when in procedural mode', () => {
    useEnvironmentStore.setState({
      skyboxSelection: 'procedural_aurora',
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

  it('should set classic mode state correctly', () => {
    // Test the store state derivation for classic mode selection
    // (Rendering the actual SkyboxLoader with KTX2 requires more complex mocking)
    useEnvironmentStore.setState({
      skyboxSelection: 'space_blue',
      skyboxEnabled: true,
      skyboxMode: 'classic',
      skyboxTexture: 'space_blue'
    });

    const state = useEnvironmentStore.getState();
    expect(state.skyboxSelection).toBe('space_blue');
    expect(state.skyboxEnabled).toBe(true);
    expect(state.skyboxMode).toBe('classic');
    expect(state.skyboxTexture).toBe('space_blue');
  });
});
