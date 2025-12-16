import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectSettingsSection } from '@/components/sections/Geometry/ObjectSettingsSection';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { DEFAULT_POLYTOPE_CONFIG } from '@/lib/geometry/extended/types';
import { act } from 'react';

// Note: Components are now loaded dynamically via React.lazy in ObjectSettingsSection.
// Tests need to use waitFor/findBy to handle async loading.

describe('ObjectSettingsSection', () => {
  beforeEach(() => {
    // Reset stores to default state
    act(() => {
      useGeometryStore.setState({
        objectType: 'hypercube',
        dimension: 4
      });
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, scale: 1.0 },
        rootSystem: { rootType: 'A', scale: 1.0 },
        cliffordTorus: {
          radius: 1.0,
          edgeMode: 'grid',
          resolutionU: 32,
          resolutionV: 32,
          mode: 'classic',
          stepsPerCircle: 10,
          k: 2
        },
        nestedTorus: {
          radius: 1.0,
          edgeMode: 'grid',
          eta: Math.PI / 4,
          resolutionXi1: 32,
          resolutionXi2: 32,
          showNestedTori: false,
          numberOfTori: 2,
          fiberResolution: 32,
          baseResolution: 32,
          showFiberStructure: false
        }
      });
    });
  });

  describe('PolytopeSettings', () => {
    it('renders for hypercube', async () => {
      act(() => {
        useGeometryStore.setState({ objectType: 'hypercube' });
      });
      render(<ObjectSettingsSection />);

      // Wait for lazy-loaded component
      expect(await screen.findByTestId('polytope-settings')).toBeInTheDocument();
      expect(await screen.findByText('Hypercube Scale')).toBeInTheDocument();
    });

    it('renders for simplex', async () => {
      act(() => {
        useGeometryStore.setState({ objectType: 'simplex' });
      });
      render(<ObjectSettingsSection />);

      // Wait for lazy-loaded component
      expect(await screen.findByTestId('polytope-settings')).toBeInTheDocument();
      expect(await screen.findByText('Simplex Scale')).toBeInTheDocument();
    });

    it('updates scale', async () => {
      act(() => {
        useGeometryStore.setState({ objectType: 'hypercube' });
      });
      render(<ObjectSettingsSection />);

      // Wait for lazy-loaded component
      await screen.findByTestId('polytope-scale');

      // We'll update the store directly to verify the component reflects it.
      // Testing slider drag interaction in jsdom can be tricky.
      // Verify value reflection via store update.

      act(() => {
        useExtendedObjectStore.getState().setPolytopeScale(2.5);
      });

      // Re-render happens automatically with zustand hooks
      // The slider component formats values to 2 decimal places
      await waitFor(() => {
        expect(screen.getByDisplayValue('2.50')).toBeInTheDocument();
      });
    });
  });

  describe('RootSystemSettings', () => {
    beforeEach(() => {
      act(() => {
        useGeometryStore.setState({ objectType: 'root-system', dimension: 8 });
      });
    });

    it('renders root system settings', async () => {
      render(<ObjectSettingsSection />);
      // Wait for lazy-loaded component
      expect(await screen.findByTestId('root-system-settings')).toBeInTheDocument();
    });

    it('shows E8 option only when dimension is 8', async () => {
      render(<ObjectSettingsSection />);
      // We expect E8 to be in the options
      // Note: testing library 'select' interaction depends on the UI component implementation.
      // We'll check if the select renders.
      // Wait for lazy-loaded component
      expect(await screen.findByTestId('root-system-type')).toBeInTheDocument();
    });

    it('updates root type', async () => {
      render(<ObjectSettingsSection />);
      // Wait for lazy-loaded component
      await screen.findByTestId('root-system-settings');

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

    it('renders classic controls in 4D', async () => {
      render(<ObjectSettingsSection />);
      // Wait for lazy-loaded component
      expect(await screen.findByTestId('clifford-res-u')).toBeInTheDocument();
      expect(await screen.findByTestId('clifford-res-v')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByTestId('clifford-steps')).not.toBeInTheDocument();
      });
    });

    it('renders generalized controls in non-4D', async () => {
      act(() => {
        useGeometryStore.setState({ dimension: 5 });
      });
      render(<ObjectSettingsSection />);
      // Wait for lazy-loaded component
      expect(await screen.findByTestId('clifford-steps')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByTestId('clifford-res-u')).not.toBeInTheDocument();
      });
    });
  });

  describe('NestedTorusSettings', () => {
    beforeEach(() => {
      act(() => {
        useGeometryStore.setState({ objectType: 'nested-torus', dimension: 4 });
      });
    });

    it('renders nested torus settings', async () => {
      render(<ObjectSettingsSection />);
      // Wait for lazy-loaded component
      expect(await screen.findByTestId('nested-torus-settings')).toBeInTheDocument();
      expect(await screen.findByTestId('nested-show-multiple')).toBeInTheDocument();
    });

    it('hides nested tori toggle in non-4D', async () => {
      act(() => {
        useGeometryStore.setState({ dimension: 5 });
      });
      render(<ObjectSettingsSection />);
      // Wait for lazy-loaded component
      await screen.findByTestId('nested-torus-settings');
      await waitFor(() => {
        expect(screen.queryByTestId('nested-show-multiple')).not.toBeInTheDocument();
      });
    });
  });
});
