/**
 * Tests for EdgeMaterialControls component
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgeMaterialControls } from '@/components/sidebar/Visual/EdgeMaterialControls'
import { useVisualStore, DEFAULT_EDGE_METALLIC, DEFAULT_EDGE_ROUGHNESS } from '@/stores/visualStore'

describe('EdgeMaterialControls', () => {
  beforeEach(() => {
    // Reset stores before each test
    useVisualStore.getState().reset()
  })

  describe('Visibility', () => {
    it('should not render when edgeThickness is 1', () => {
      useVisualStore.getState().setEdgeThickness(1)
      useVisualStore.getState().setLightEnabled(true)

      const { container } = render(<EdgeMaterialControls />)

      // Should return null (empty container)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when light is disabled', () => {
      useVisualStore.getState().setEdgeThickness(2)
      useVisualStore.getState().setLightEnabled(false)

      const { container } = render(<EdgeMaterialControls />)

      expect(container.firstChild).toBeNull()
    })

    it('should render when edgeThickness > 1 and light is enabled', () => {
      useVisualStore.getState().setEdgeThickness(2)
      useVisualStore.getState().setLightEnabled(true)

      render(<EdgeMaterialControls />)

      expect(screen.getByText('Edge Material')).toBeInTheDocument()
      expect(screen.getByText('Metallic')).toBeInTheDocument()
      expect(screen.getByText('Roughness')).toBeInTheDocument()
    })
  })

  describe('Metallic Slider', () => {
    beforeEach(() => {
      useVisualStore.getState().setEdgeThickness(2)
      useVisualStore.getState().setLightEnabled(true)
    })

    it('should display metallic slider', () => {
      render(<EdgeMaterialControls />)

      expect(screen.getByText('Metallic')).toBeInTheDocument()
    })

    it('should show default metallic value', () => {
      render(<EdgeMaterialControls />)

      // Default metallic is 0
      expect(useVisualStore.getState().edgeMetallic).toBe(DEFAULT_EDGE_METALLIC)
    })

    it('should update metallic value via store', () => {
      render(<EdgeMaterialControls />)

      // Update via store
      useVisualStore.getState().setEdgeMetallic(0.8)

      expect(useVisualStore.getState().edgeMetallic).toBe(0.8)
    })
  })

  describe('Roughness Slider', () => {
    beforeEach(() => {
      useVisualStore.getState().setEdgeThickness(2)
      useVisualStore.getState().setLightEnabled(true)
    })

    it('should display roughness slider', () => {
      render(<EdgeMaterialControls />)

      expect(screen.getByText('Roughness')).toBeInTheDocument()
    })

    it('should show default roughness value', () => {
      render(<EdgeMaterialControls />)

      // Default roughness is 0.5
      expect(useVisualStore.getState().edgeRoughness).toBe(DEFAULT_EDGE_ROUGHNESS)
    })

    it('should update roughness value via store', () => {
      render(<EdgeMaterialControls />)

      // Update via store
      useVisualStore.getState().setEdgeRoughness(0.3)

      expect(useVisualStore.getState().edgeRoughness).toBe(0.3)
    })
  })

  describe('Edge Thickness Threshold', () => {
    beforeEach(() => {
      useVisualStore.getState().setLightEnabled(true)
    })

    it('should render for thickness 2', () => {
      useVisualStore.getState().setEdgeThickness(2)
      render(<EdgeMaterialControls />)

      expect(screen.getByText('Edge Material')).toBeInTheDocument()
    })

    it('should render for thickness 3', () => {
      useVisualStore.getState().setEdgeThickness(3)
      render(<EdgeMaterialControls />)

      expect(screen.getByText('Edge Material')).toBeInTheDocument()
    })

    it('should render for thickness 5 (max)', () => {
      useVisualStore.getState().setEdgeThickness(5)
      render(<EdgeMaterialControls />)

      expect(screen.getByText('Edge Material')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    beforeEach(() => {
      useVisualStore.getState().setEdgeThickness(2)
      useVisualStore.getState().setLightEnabled(true)
    })

    it('should apply custom className', () => {
      const { container } = render(<EdgeMaterialControls className="custom-class" />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-class')
    })
  })

  describe('State Persistence', () => {
    beforeEach(() => {
      useVisualStore.getState().setEdgeThickness(2)
      useVisualStore.getState().setLightEnabled(true)
    })

    it('should persist metallic value across rerenders', () => {
      useVisualStore.getState().setEdgeMetallic(0.7)

      const { rerender } = render(<EdgeMaterialControls />)

      expect(useVisualStore.getState().edgeMetallic).toBe(0.7)

      rerender(<EdgeMaterialControls />)

      expect(useVisualStore.getState().edgeMetallic).toBe(0.7)
    })

    it('should persist roughness value across rerenders', () => {
      useVisualStore.getState().setEdgeRoughness(0.2)

      const { rerender } = render(<EdgeMaterialControls />)

      expect(useVisualStore.getState().edgeRoughness).toBe(0.2)

      rerender(<EdgeMaterialControls />)

      expect(useVisualStore.getState().edgeRoughness).toBe(0.2)
    })
  })
})
