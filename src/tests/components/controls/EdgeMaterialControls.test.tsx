/**
 * Tests for EdgeMaterialControls component
 */

import { EdgeMaterialControls } from '@/components/sections/Edges/EdgeMaterialControls'
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('EdgeMaterialControls', () => {
  beforeEach(() => {
    useAppearanceStore.getState().setEdgeThickness(1);
    useAppearanceStore.getState().setEdgeMetallic(0.0);
    useAppearanceStore.getState().setEdgeRoughness(0.5);
    useLightingStore.getState().setLightEnabled(true);
  });

  describe('Visibility', () => {
    it('should not render when edgeThickness is 1', () => {
      useAppearanceStore.getState().setEdgeThickness(1);
      const { container } = render(<EdgeMaterialControls />);
      expect(container).toBeEmptyDOMElement();
    });

    it('should not render when light is disabled', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      useLightingStore.getState().setLightEnabled(false);
      const { container } = render(<EdgeMaterialControls />);
      expect(container).toBeEmptyDOMElement();
    });

    it('should render when edgeThickness > 1 and light is enabled', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      useLightingStore.getState().setLightEnabled(true);
      render(<EdgeMaterialControls />);

      expect(screen.getByText('Edge Material')).toBeInTheDocument();
      expect(screen.getByText('Metallic')).toBeInTheDocument();
      expect(screen.getByText('Roughness')).toBeInTheDocument();
    });
  })

  describe('Metallic Slider', () => {
    beforeEach(() => {
      useAppearanceStore.getState().setEdgeThickness(2)
      useLightingStore.getState().setLightEnabled(true)
    })

    it('should display metallic slider', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      render(<EdgeMaterialControls />);

      expect(screen.getByText('Metallic')).toBeInTheDocument();
    });

    it('should show default metallic value', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      render(<EdgeMaterialControls />);

      // Default metallic is 0.0
      expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    });

    it('should update metallic value via store', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      useAppearanceStore.getState().setEdgeMetallic(0.8);
      render(<EdgeMaterialControls />);

      expect(screen.getByDisplayValue('0.8')).toBeInTheDocument();
    });
  })

  describe('Roughness Slider', () => {
    beforeEach(() => {
      useAppearanceStore.getState().setEdgeThickness(2)
      useLightingStore.getState().setLightEnabled(true)
    })

    it('should display roughness slider', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      render(<EdgeMaterialControls />);

      expect(screen.getByText('Roughness')).toBeInTheDocument();
    });

    it('should show default roughness value', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      render(<EdgeMaterialControls />);

      // Default roughness is 0.5
      expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
    });

    it('should update roughness value via store', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      useAppearanceStore.getState().setEdgeRoughness(0.2);
      render(<EdgeMaterialControls />);

      expect(screen.getByDisplayValue('0.2')).toBeInTheDocument();
    });
  })

  describe('Edge Thickness Threshold', () => {
    it('should render for thickness 2', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      const { container } = render(<EdgeMaterialControls />);
      expect(container).not.toBeEmptyDOMElement();
    });

    it('should render for thickness 3', () => {
      useAppearanceStore.getState().setEdgeThickness(3);
      const { container } = render(<EdgeMaterialControls />);
      expect(container).not.toBeEmptyDOMElement();
    });

    it('should render for thickness 5 (max)', () => {
      useAppearanceStore.getState().setEdgeThickness(5);
      const { container } = render(<EdgeMaterialControls />);
      expect(container).not.toBeEmptyDOMElement();
    });
  });

  describe('className prop', () => {
    beforeEach(() => {
      useAppearanceStore.getState().setEdgeThickness(2)
      useLightingStore.getState().setLightEnabled(true)
    })

    it('should apply custom className', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      const { container } = render(<EdgeMaterialControls className="custom-class" />);

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-class')
    })
  })

  describe('State Persistence', () => {
    beforeEach(() => {
      useAppearanceStore.getState().setEdgeThickness(2)
      useLightingStore.getState().setLightEnabled(true)
    })

    it('should persist metallic value across rerenders', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      const { rerender } = render(<EdgeMaterialControls />);

      act(() => {
        useAppearanceStore.getState().setEdgeMetallic(0.9);
      });
      rerender(<EdgeMaterialControls />);

      expect(screen.getByDisplayValue('0.9')).toBeInTheDocument();
    });

    it('should persist roughness value across rerenders', () => {
      useAppearanceStore.getState().setEdgeThickness(2);
      const { rerender } = render(<EdgeMaterialControls />);

      act(() => {
        useAppearanceStore.getState().setEdgeRoughness(0.3);
      });
      rerender(<EdgeMaterialControls />);

      expect(screen.getByDisplayValue('0.3')).toBeInTheDocument();
    });
  });
});