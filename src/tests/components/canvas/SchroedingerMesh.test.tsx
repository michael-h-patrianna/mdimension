import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import SchroedingerMesh from '@/rendering/renderers/Schroedinger/SchroedingerMesh';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useLightingStore } from '@/stores/lightingStore';
import { LIGHTING_INITIAL_STATE } from '@/stores/slices/lightingSlice';

describe('SchroedingerMesh', () => {
  beforeEach(() => {
    // Reset stores to default state
    useGeometryStore.setState({ dimension: 4 });
    useExtendedObjectStore.getState().reset();
    useLightingStore.setState(LIGHTING_INITIAL_STATE);

    // Initialize Schroedinger config for 4D
    useExtendedObjectStore.getState().initializeSchroedingerForDimension(4);
  });

  it('should render without errors for 4D', () => {
    useGeometryStore.setState({ dimension: 4 });
    useExtendedObjectStore.getState().initializeSchroedingerForDimension(4);

    const { container } = render(
      <Canvas>
        <SchroedingerMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('should render without errors for 7D', () => {
    useGeometryStore.setState({ dimension: 7 });
    useExtendedObjectStore.getState().initializeSchroedingerForDimension(7);

    const { container } = render(
      <Canvas>
        <SchroedingerMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('should render without errors for 11D', () => {
    useGeometryStore.setState({ dimension: 11 });
    useExtendedObjectStore.getState().initializeSchroedingerForDimension(11);

    const { container } = render(
      <Canvas>
        <SchroedingerMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('should update with different slice values', () => {
    useGeometryStore.setState({ dimension: 5 });
    useExtendedObjectStore.getState().initializeSchroedingerForDimension(5);

    // Set slice value for dimension 3
    useExtendedObjectStore.getState().setSchroedingerParameterValue(0, 0.5);

    const { container } = render(
      <Canvas>
        <SchroedingerMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();

    // Verify the parameter was set
    const config = useExtendedObjectStore.getState().schroedinger;
    expect(config.parameterValues[0]).toBe(0.5);
  });

  it('should have correct dimension-aware defaults for 4D', () => {
    useGeometryStore.setState({ dimension: 4 });
    useExtendedObjectStore.getState().initializeSchroedingerForDimension(4);

    const config = useExtendedObjectStore.getState().schroedinger;
    expect(config.escapeRadius).toBe(8.0);
    expect(config.maxIterations).toBe(50);
    expect(config.schroedingerPower).toBe(8);
    expect(config.parameterValues.length).toBe(1); // 4D - 3 = 1 slice param
  });

  it('should have correct dimension-aware defaults for 9D', () => {
    useGeometryStore.setState({ dimension: 9 });
    useExtendedObjectStore.getState().initializeSchroedingerForDimension(9);

    const config = useExtendedObjectStore.getState().schroedinger;
    expect(config.escapeRadius).toBe(12.0);
    expect(config.maxIterations).toBe(35);
    expect(config.parameterValues.length).toBe(6); // 9D - 3 = 6 slice params
  });
});
