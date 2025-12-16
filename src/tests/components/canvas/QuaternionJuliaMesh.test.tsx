import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import QuaternionJuliaMesh from '@/rendering/renderers/QuaternionJulia/QuaternionJuliaMesh';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useLightingStore } from '@/stores/lightingStore';
import { LIGHTING_INITIAL_STATE } from '@/stores/slices/lightingSlice';
import { DEFAULT_QUATERNION_JULIA_CONFIG } from '@/lib/geometry/extended/types';

describe('QuaternionJuliaMesh', () => {
  beforeEach(() => {
    // Reset stores to default state
    useGeometryStore.setState({ dimension: 3 });
    useExtendedObjectStore.getState().reset();
    useLightingStore.setState(LIGHTING_INITIAL_STATE);
  });

  it('should render without errors for 3D', () => {
    useGeometryStore.setState({ dimension: 3 });

    const { container } = render(
      <Canvas>
        <QuaternionJuliaMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('should render without errors for 4D', () => {
    useGeometryStore.setState({ dimension: 4 });
    // Initialize parameter values for 4D (1 slice param)
    useExtendedObjectStore.getState().setQuaternionJuliaParameterValues([0]);

    const { container } = render(
      <Canvas>
        <QuaternionJuliaMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('should render without errors for 7D', () => {
    useGeometryStore.setState({ dimension: 7 });
    // Initialize parameter values for 7D (4 slice params)
    useExtendedObjectStore.getState().setQuaternionJuliaParameterValues([0, 0, 0, 0]);

    const { container } = render(
      <Canvas>
        <QuaternionJuliaMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('should render without errors for 11D', () => {
    useGeometryStore.setState({ dimension: 11 });
    // Initialize parameter values for 11D (8 slice params)
    useExtendedObjectStore.getState().setQuaternionJuliaParameterValues([0, 0, 0, 0, 0, 0, 0, 0]);

    const { container } = render(
      <Canvas>
        <QuaternionJuliaMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('should update with different Julia constant values', () => {
    useGeometryStore.setState({ dimension: 3 });

    // Set Julia constant
    useExtendedObjectStore.getState().setQuaternionJuliaConstant([0.5, -0.3, 0.2, 0.1]);

    const { container } = render(
      <Canvas>
        <QuaternionJuliaMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();

    // Verify the parameter was set
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.juliaConstant).toEqual([0.5, -0.3, 0.2, 0.1]);
  });

  it('should update with different power values', () => {
    useGeometryStore.setState({ dimension: 3 });

    // Set power
    useExtendedObjectStore.getState().setQuaternionJuliaPower(4);

    const { container } = render(
      <Canvas>
        <QuaternionJuliaMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();

    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.power).toBe(4);
  });

  it('should update with different slice values for 5D', () => {
    useGeometryStore.setState({ dimension: 5 });
    // Initialize parameter values for 5D (2 slice params)
    useExtendedObjectStore.getState().setQuaternionJuliaParameterValues([0, 0]);

    // Set slice value for dimension 4
    useExtendedObjectStore.getState().setQuaternionJuliaParameterValue(0, 0.5);

    const { container } = render(
      <Canvas>
        <QuaternionJuliaMesh />
      </Canvas>
    );
    expect(container).toBeTruthy();

    // Verify the parameter was set
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.parameterValues[0]).toBe(0.5);
  });

  it('should have correct default Julia constant', () => {
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.juliaConstant).toEqual(DEFAULT_QUATERNION_JULIA_CONFIG.juliaConstant);
    expect(config.juliaConstant).toEqual([-0.2, 0.8, 0.0, 0.0]);
  });

  it('should have correct default power', () => {
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.power).toBe(DEFAULT_QUATERNION_JULIA_CONFIG.power);
    expect(config.power).toBe(2);
  });

  it('should have correct default scale', () => {
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.scale).toBe(DEFAULT_QUATERNION_JULIA_CONFIG.scale);
    expect(config.scale).toBe(1.0);
  });

  it('should have correct default maxIterations', () => {
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.maxIterations).toBe(DEFAULT_QUATERNION_JULIA_CONFIG.maxIterations);
    expect(config.maxIterations).toBe(64);
  });

  it('should have correct default bailoutRadius', () => {
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.bailoutRadius).toBe(DEFAULT_QUATERNION_JULIA_CONFIG.bailoutRadius);
    expect(config.bailoutRadius).toBe(4.0);
  });

  it('should enable Julia constant animation', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaConstantAnimationEnabled(true);
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.juliaConstantAnimation.enabled).toBe(true);
  });

  it('should enable power animation', () => {
    useExtendedObjectStore.getState().setQuaternionJuliaPowerAnimationEnabled(true);
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.powerAnimation.enabled).toBe(true);
  });

  it('should enable origin drift for 4D+', () => {
    useGeometryStore.setState({ dimension: 4 });
    useExtendedObjectStore.getState().setQuaternionJuliaOriginDriftEnabled(true);
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.originDriftEnabled).toBe(true);
  });

  it('should enable dimension mixing for 4D+', () => {
    useGeometryStore.setState({ dimension: 4 });
    useExtendedObjectStore.getState().setQuaternionJuliaDimensionMixEnabled(true);
    const config = useExtendedObjectStore.getState().quaternionJulia;
    expect(config.dimensionMixEnabled).toBe(true);
  });
});
