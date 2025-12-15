/**
 * Tests for MengerControls component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MengerControls } from '@/components/sections/Geometry/MengerControls';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { DEFAULT_MENGER_CONFIG } from '@/lib/geometry/extended/types';

describe('MengerControls', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    // Set dimension to 3 (minimum for menger)
    useGeometryStore.getState().setDimension(3);
    useGeometryStore.getState().setObjectType('menger');
  });

  it('should render detail level presets', () => {
    render(<MengerControls />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('should render custom detail slider', () => {
    render(<MengerControls />);
    expect(screen.getByText('Custom Detail')).toBeInTheDocument();
  });

  it('should render scale slider', () => {
    render(<MengerControls />);
    expect(screen.getByText('Scale')).toBeInTheDocument();
  });

  it('should render rendering info', () => {
    render(<MengerControls />);
    expect(screen.getByText('Rendering: GPU Ray Marching (KIFS)')).toBeInTheDocument();
    expect(screen.getByText('3D Menger Sponge')).toBeInTheDocument();
  });

  it('should not show slice parameters for 3D', () => {
    useGeometryStore.getState().setDimension(3);
    render(<MengerControls />);
    expect(screen.queryByText(/Slice Position/)).not.toBeInTheDocument();
  });

  it('should show slice parameters for 4D', () => {
    useGeometryStore.getState().setDimension(4);
    useExtendedObjectStore.getState().initializeMengerForDimension(4);
    render(<MengerControls />);
    expect(screen.getByText(/Slice Position/)).toBeInTheDocument();
    expect(screen.getByText('Dim 4')).toBeInTheDocument();
  });

  it('should show multiple slice parameters for 5D', () => {
    useGeometryStore.getState().setDimension(5);
    useExtendedObjectStore.getState().initializeMengerForDimension(5);
    render(<MengerControls />);
    expect(screen.getByText(/Slice Position/)).toBeInTheDocument();
    expect(screen.getByText('Dim 4')).toBeInTheDocument();
    expect(screen.getByText('Dim 5')).toBeInTheDocument();
  });

  it('should update iterations value in store', () => {
    act(() => {
      useExtendedObjectStore.getState().setMengerIterations(7);
    });
    expect(useExtendedObjectStore.getState().menger.iterations).toBe(7);
  });

  it('should update scale value in store', () => {
    act(() => {
      useExtendedObjectStore.getState().setMengerScale(1.5);
    });
    expect(useExtendedObjectStore.getState().menger.scale).toBe(1.5);
  });

  it('should clamp iterations value to valid range', () => {
    // Test below minimum (3)
    act(() => {
      useExtendedObjectStore.getState().setMengerIterations(1);
    });
    expect(useExtendedObjectStore.getState().menger.iterations).toBe(3);

    // Test above maximum (8)
    act(() => {
      useExtendedObjectStore.getState().setMengerIterations(15);
    });
    expect(useExtendedObjectStore.getState().menger.iterations).toBe(8);
  });

  it('should clamp scale value to valid range', () => {
    // Test below minimum (0.5)
    act(() => {
      useExtendedObjectStore.getState().setMengerScale(0.1);
    });
    expect(useExtendedObjectStore.getState().menger.scale).toBe(0.5);

    // Test above maximum (2.0)
    act(() => {
      useExtendedObjectStore.getState().setMengerScale(5.0);
    });
    expect(useExtendedObjectStore.getState().menger.scale).toBe(2.0);
  });

  it('should reset to default values', () => {
    // Set custom values
    act(() => {
      useExtendedObjectStore.getState().setMengerIterations(7);
      useExtendedObjectStore.getState().setMengerScale(1.8);
    });

    // Reset
    act(() => {
      useExtendedObjectStore.getState().reset();
    });

    // Verify defaults
    expect(useExtendedObjectStore.getState().menger).toEqual(DEFAULT_MENGER_CONFIG);
  });

  it('should apply custom className', () => {
    const { container } = render(<MengerControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should display dimension info correctly for different dimensions', () => {
    // Test 3D
    act(() => {
      useGeometryStore.getState().setDimension(3);
    });
    const { rerender } = render(<MengerControls />);
    expect(screen.getByText('3D Menger Sponge')).toBeInTheDocument();

    // Test 6D
    act(() => {
      useGeometryStore.getState().setDimension(6);
    });
    rerender(<MengerControls />);
    expect(screen.getByText('6D Menger Sponge')).toBeInTheDocument();
  });

  it('should show KIFS info text', () => {
    render(<MengerControls />);
    expect(screen.getByText(/True geometric SDF via Kaleidoscopic IFS folds/)).toBeInTheDocument();
  });

  it('should show detail level description', () => {
    render(<MengerControls />);
    expect(screen.getByText(/Higher = finer holes, more computation/)).toBeInTheDocument();
  });

  describe('fractal animation controls', () => {
    it('should render fractal animation section', () => {
      render(<MengerControls />);
      expect(screen.getByText('Fractal Animation')).toBeInTheDocument();
    });

    it('should render fold twist toggle', () => {
      render(<MengerControls />);
      expect(screen.getByText('Fold Twist')).toBeInTheDocument();
      expect(screen.getByTestId('fold-twist-toggle')).toBeInTheDocument();
    });

    it('should render scale pulse toggle', () => {
      render(<MengerControls />);
      expect(screen.getByText('Scale Pulse')).toBeInTheDocument();
      expect(screen.getByTestId('scale-pulse-toggle')).toBeInTheDocument();
    });

    it('should not show slice sweep for 3D', () => {
      useGeometryStore.getState().setDimension(3);
      render(<MengerControls />);
      expect(screen.queryByTestId('slice-sweep-toggle')).not.toBeInTheDocument();
    });

    it('should show slice sweep for 4D+', () => {
      useGeometryStore.getState().setDimension(4);
      useExtendedObjectStore.getState().initializeMengerForDimension(4);
      render(<MengerControls />);
      expect(screen.getByText('Slice Sweep')).toBeInTheDocument();
      expect(screen.getByTestId('slice-sweep-toggle')).toBeInTheDocument();
    });

    it('should not show fold twist sliders when disabled', () => {
      useExtendedObjectStore.getState().setMengerFoldTwistEnabled(false);
      render(<MengerControls />);
      // Angle and Speed sliders should not be visible when disabled
      expect(screen.queryByText('Angle')).not.toBeInTheDocument();
    });

    it('should not show scale pulse sliders when disabled', () => {
      useExtendedObjectStore.getState().setMengerScalePulseEnabled(false);
      render(<MengerControls />);
      // Amplitude slider for scale pulse should not be visible when disabled
      // (only visible when scalePulseEnabled is true)
      const amplitudeLabels = screen.queryAllByText('Amplitude');
      // Should have no amplitude sliders when both scale pulse and slice sweep are disabled
      expect(amplitudeLabels.length).toBe(0);
    });

      it('should update fold twist enabled in store', () => {
        act(() => {
          useExtendedObjectStore.getState().setMengerFoldTwistEnabled(true);
        });
        expect(useExtendedObjectStore.getState().menger.foldTwistEnabled).toBe(true);
    
        act(() => {
          useExtendedObjectStore.getState().setMengerFoldTwistEnabled(false);
        });
        expect(useExtendedObjectStore.getState().menger.foldTwistEnabled).toBe(false);
      });
      it('should update scale pulse enabled in store', () => {
        act(() => {
          useExtendedObjectStore.getState().setMengerScalePulseEnabled(true);
        });
        expect(useExtendedObjectStore.getState().menger.scalePulseEnabled).toBe(true);
    
        act(() => {
          useExtendedObjectStore.getState().setMengerScalePulseEnabled(false);
        });
        expect(useExtendedObjectStore.getState().menger.scalePulseEnabled).toBe(false);
      });
      it('should update slice sweep enabled in store', () => {
        act(() => {
          useExtendedObjectStore.getState().setMengerSliceSweepEnabled(true);
        });
        expect(useExtendedObjectStore.getState().menger.sliceSweepEnabled).toBe(true);
    
        act(() => {
          useExtendedObjectStore.getState().setMengerSliceSweepEnabled(false);
        });
        expect(useExtendedObjectStore.getState().menger.sliceSweepEnabled).toBe(false);
      });  });
});
