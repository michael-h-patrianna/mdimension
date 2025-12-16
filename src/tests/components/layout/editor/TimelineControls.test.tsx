import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimelineControls } from '@/components/layout/TimelineControls';

vi.mock('@/stores/geometryStore', () => ({
  useGeometryStore: vi.fn((selector) => {
    const state = {
      dimension: 4,
      objectType: 'hypercube',
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/stores/animationStore', () => ({
  useAnimationStore: vi.fn((selector) => {
    const state = {
      isPlaying: false,
      speed: 1,
      direction: 1,
      animatingPlanes: new Set(['XY']),
      toggle: vi.fn(),
      setSpeed: vi.fn(),
      toggleDirection: vi.fn(),
      togglePlane: vi.fn(),
      stopAll: vi.fn(),
      animateAll: vi.fn(),
      resetToFirstPlane: vi.fn(),
      clearAllPlanes: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
  MIN_SPEED: 0.1,
  MAX_SPEED: 5,
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn((selector) => {
    const state = {
      animationBias: 0,
      setAnimationBias: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/stores/defaults/visualDefaults', () => ({
  MIN_ANIMATION_BIAS: 0,
  MAX_ANIMATION_BIAS: 1,
}));

vi.mock('@/stores/extendedObjectStore', () => ({
  useExtendedObjectStore: vi.fn((selector) => {
    const state = {
        mandelbrot: {
            powerAnimationEnabled: false,
            sliceAnimationEnabled: false,
            juliaModeEnabled: false,
            phaseShiftEnabled: false,
        },
        quaternionJulia: {
            juliaConstantAnimation: { enabled: false },
            powerAnimation: { enabled: false },
            originDriftEnabled: false,
            dimensionMixEnabled: false,
        },
        setMandelbrotPowerAnimationEnabled: vi.fn(),
        setMandelbrotPowerMin: vi.fn(),
        setMandelbrotPowerMax: vi.fn(),
        setMandelbrotPowerSpeed: vi.fn(),
        setMandelbrotSliceAnimationEnabled: vi.fn(),
        setMandelbrotSliceSpeed: vi.fn(),
        setMandelbrotSliceAmplitude: vi.fn(),
        setMandelbrotJuliaModeEnabled: vi.fn(),
        setMandelbrotJuliaOrbitSpeed: vi.fn(),
        setMandelbrotJuliaOrbitRadius: vi.fn(),
        setMandelbrotPhaseShiftEnabled: vi.fn(),
        setMandelbrotPhaseSpeed: vi.fn(),
        setMandelbrotPhaseAmplitude: vi.fn(),
        // Quaternion Julia setters
        setQuaternionJuliaConstantAnimationEnabled: vi.fn(),
        setQuaternionJuliaPowerAnimationEnabled: vi.fn(),
        setQuaternionJuliaOriginDriftEnabled: vi.fn(),
        setQuaternionJuliaDimensionMixEnabled: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

describe('TimelineControls', () => {
  it('toggles Rotation drawer when button is clicked', async () => {
    render(<TimelineControls />);
    
    // Check initial state
    const rotButton = screen.getByText(/Rotation/i);
    expect(rotButton).toBeInTheDocument();
    
    // Plane buttons should NOT be visible yet
    expect(screen.queryByText('XY', { selector: 'button' })).not.toBeInTheDocument();

    // Click Rotation
    fireEvent.click(rotButton);

    // Now drawer should be open, and "XY" button visible
    expect(screen.getByText('XY')).toBeInTheDocument();
    
    // Click Rotation again to close
    fireEvent.click(rotButton);
    await waitFor(() => {
      expect(screen.queryByText('XY', { selector: 'button' })).not.toBeInTheDocument();
    });
  });

  it('does not show Stop All button in main bar, but shows Deselect All in drawer', () => {
    render(<TimelineControls />);

    // Stop All button should be removed from main bar
    expect(screen.queryByTitle("Stop All")).not.toBeInTheDocument();

    // Open drawer
    const rotButton = screen.getByText(/Rotation/i);
    fireEvent.click(rotButton);

    // Deselect All button (functionally the stop button) should be in drawer
    expect(screen.getByText("Deselect All")).toBeInTheDocument();
  });
});
