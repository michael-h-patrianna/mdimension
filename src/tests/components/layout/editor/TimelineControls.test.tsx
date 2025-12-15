import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineControls } from '@/components/layout/editor/TimelineControls';

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
    };
    return selector ? selector(state) : state;
  }),
  MIN_SPEED: 0.1,
  MAX_SPEED: 5,
}));

vi.mock('@/stores/visualStore', () => ({
  useVisualStore: vi.fn((selector) => {
    const state = {
      animationBias: 0,
      setAnimationBias: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
  MIN_ANIMATION_BIAS: 0,
  MAX_ANIMATION_BIAS: 1,
}));

vi.mock('@/stores/extendedObjectStore', () => ({
  useExtendedObjectStore: vi.fn((selector) => {
    const state = {
        mandelbox: {
            scaleAnimationEnabled: false,
            juliaMode: false,
            scaleCenter: 0,
            scaleAmplitude: 0,
            scaleSpeed: 0,
            juliaSpeed: 0,
            juliaRadius: 0
        },
        setMandelboxScaleAnimationEnabled: vi.fn(),
        setMandelboxScaleCenter: vi.fn(),
        setMandelboxScaleAmplitude: vi.fn(),
        setMandelboxScaleSpeed: vi.fn(),
        setMandelboxJuliaMode: vi.fn(),
        setMandelboxJuliaSpeed: vi.fn(),
        setMandelboxJuliaRadius: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

describe('TimelineControls', () => {
  it('toggles Rotation drawer when button is clicked', () => {
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
    expect(screen.queryByText('XY', { selector: 'button' })).not.toBeInTheDocument();
  });
});
