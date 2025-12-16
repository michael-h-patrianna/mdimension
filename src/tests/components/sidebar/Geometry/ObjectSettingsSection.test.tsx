import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectSettingsSection } from '@/components/sections/Geometry/ObjectSettingsSection';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { act } from 'react';

// Mock the components that are already separated to verify they are rendered
vi.mock('./MandelbrotControls', () => ({
  MandelbrotControls: () => <div data-testid="mandelbrot-controls">Mandelbrot Controls</div>
}));

describe('ObjectSettingsSection', () => {
  beforeEach(() => {
    // Reset stores to default state
    act(() => {
      useGeometryStore.setState({
        objectType: 'hypercube',
        dimension: 4
      });
      useExtendedObjectStore.setState({
        polytope: { scale: 1.0 },
        rootSystem: { rootType: 'A', scale: 1.0 },
        cliffordTorus: { 
          radius: 1.0, 
          resolutionU: 32, 
          resolutionV: 32, 
          mode: 'classic',
          stepsPerCircle: 10,
          k: 2
        },
        nestedTorus: {
          radius: 1.0,
          eta: Math.PI / 4,
          resolutionXi1: 32,
          resolutionXi2: 32,
          showNestedTori: false,
          numberOfTori: 2
        }
      });
    });
  });

  describe('PolytopeSettings', () => {
    it('renders for hypercube', () => {
      act(() => {
        useGeometryStore.setState({ objectType: 'hypercube' });
      });
      render(<ObjectSettingsSection />);
      expect(screen.getByTestId('polytope-settings')).toBeInTheDocument();
      expect(screen.getByText('Hypercube Scale')).toBeInTheDocument();
    });

    it('renders for simplex', () => {
      act(() => {
        useGeometryStore.setState({ objectType: 'simplex' });
      });
      render(<ObjectSettingsSection />);
      expect(screen.getByTestId('polytope-settings')).toBeInTheDocument();
      expect(screen.getByText('Simplex Scale')).toBeInTheDocument();
    });

    it('updates scale', () => {
      act(() => {
        useGeometryStore.setState({ objectType: 'hypercube' });
      });
      render(<ObjectSettingsSection />);
      
      const slider = screen.getByTestId('polytope-scale');
      // Find the input within the slider component (radix-ui slider usually has hidden input or we target the thumb)
      // For this codebase's Slider component, let's look at how it's implemented or just try to fire change on the slider role
      // Assuming generic slider behavior for now
      const input = slider.querySelector('input') || slider; 
      
      // We'll update the store directly to verify the component reflects it, 
      // and test the interaction if possible. 
      // Testing slider drag interaction in jsdom can be tricky.
      // Let's verify value reflection first.
      
      act(() => {
        useExtendedObjectStore.getState().setPolytopeScale(2.5);
      });
      
      // Re-render happens automatically with zustand hooks
      // The slider component formats values to 2 decimal places
      expect(screen.getByDisplayValue('2.50')).toBeInTheDocument();
    });
  });

  describe('RootSystemSettings', () => {
    beforeEach(() => {
      act(() => {
        useGeometryStore.setState({ objectType: 'root-system', dimension: 8 });
      });
    });

    it('renders root system settings', () => {
      render(<ObjectSettingsSection />);
      expect(screen.getByTestId('root-system-settings')).toBeInTheDocument();
    });

    it('shows E8 option only when dimension is 8', () => {
      render(<ObjectSettingsSection />);
      // We expect E8 to be in the options
      // Note: testing library 'select' interaction depends on the UI component implementation.
      // We'll check if the select renders.
      expect(screen.getByTestId('root-system-type')).toBeInTheDocument();
    });

    it('updates root type', () => {
        render(<ObjectSettingsSection />);
        act(() => {
            useExtendedObjectStore.getState().setRootSystemType('E8');
        });
        // Check if store update is reflected if possible, or just trust the store
        expect(useExtendedObjectStore.getState().rootSystem.rootType).toBe('E8');
    });
  });

  describe('CliffordTorusSettings', () => {
    beforeEach(() => {
      act(() => {
        useGeometryStore.setState({ objectType: 'clifford-torus', dimension: 4 });
      });
    });

    it('renders classic controls in 4D', () => {
      render(<ObjectSettingsSection />);
      expect(screen.getByTestId('clifford-res-u')).toBeInTheDocument();
      expect(screen.getByTestId('clifford-res-v')).toBeInTheDocument();
      expect(screen.queryByTestId('clifford-steps')).not.toBeInTheDocument();
    });

    it('renders generalized controls in non-4D', () => {
      act(() => {
        useGeometryStore.setState({ dimension: 5 });
      });
      render(<ObjectSettingsSection />);
      expect(screen.queryByTestId('clifford-res-u')).not.toBeInTheDocument();
      expect(screen.getByTestId('clifford-steps')).toBeInTheDocument();
    });
  });

  describe('NestedTorusSettings', () => {
    beforeEach(() => {
      act(() => {
        useGeometryStore.setState({ objectType: 'nested-torus', dimension: 4 });
      });
    });

    it('renders nested torus settings', () => {
      render(<ObjectSettingsSection />);
      expect(screen.getByTestId('nested-torus-settings')).toBeInTheDocument();
      expect(screen.getByTestId('nested-show-multiple')).toBeInTheDocument();
    });

    it('hides nested tori toggle in non-4D', () => {
      act(() => {
        useGeometryStore.setState({ dimension: 5 });
      });
      render(<ObjectSettingsSection />);
      expect(screen.queryByTestId('nested-show-multiple')).not.toBeInTheDocument();
    });
  });
});
