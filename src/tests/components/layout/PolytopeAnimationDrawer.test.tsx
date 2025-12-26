/**
 * PolytopeAnimationDrawer Component Tests
 *
 * Tests for the polytope animation controls drawer in TimelineControls.
 * Tests cover the radial breathing modulation with amplitude, frequency, wave, and bias controls.
 *
 * @see src/components/layout/TimelineControls/PolytopeAnimationDrawer.tsx
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PolytopeAnimationDrawer } from '@/components/layout/TimelineControls/PolytopeAnimationDrawer'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { DEFAULT_POLYTOPE_CONFIG } from '@/lib/geometry/extended/types'

describe('PolytopeAnimationDrawer', () => {
  beforeEach(() => {
    // Reset store to defaults
    useExtendedObjectStore.setState({
      polytope: { ...DEFAULT_POLYTOPE_CONFIG },
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('Vertex Modulation', () => {
    it('toggles modulation on/off', () => {
      render(<PolytopeAnimationDrawer />)

      const toggleButton = screen.getByRole('button', { name: /toggle vertex modulation/i })
      expect(toggleButton.textContent).toBe('ON') // Enabled by default

      fireEvent.click(toggleButton)
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(false)

      fireEvent.click(toggleButton)
      expect(useExtendedObjectStore.getState().polytope.facetOffsetEnabled).toBe(true)
    })

    it('updates amplitude via Slider component', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      })

      render(<PolytopeAnimationDrawer />)

      // The Slider component uses aria-label on the hidden range input
      const amplitudeSlider = screen.getByRole('slider', { name: 'Amplitude' })
      fireEvent.change(amplitudeSlider, { target: { value: '0.5' } })

      expect(useExtendedObjectStore.getState().polytope.facetOffsetAmplitude).toBe(0.5)
    })

    it('updates frequency via Slider component', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      })

      render(<PolytopeAnimationDrawer />)

      const frequencySlider = screen.getByRole('slider', { name: 'Frequency' })
      fireEvent.change(frequencySlider, { target: { value: '0.10' } })

      expect(useExtendedObjectStore.getState().polytope.facetOffsetFrequency).toBe(0.1)
    })

    it('updates wave via Slider component', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      })

      render(<PolytopeAnimationDrawer />)

      const waveSlider = screen.getByRole('slider', { name: 'Wave' })
      fireEvent.change(waveSlider, { target: { value: '0.5' } })

      expect(useExtendedObjectStore.getState().polytope.facetOffsetPhaseSpread).toBe(0.5)
    })

    it('updates bias via Slider component', () => {
      useExtendedObjectStore.setState({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG, facetOffsetEnabled: true },
      })

      render(<PolytopeAnimationDrawer />)

      const biasSlider = screen.getByRole('slider', { name: 'Bias' })
      fireEvent.change(biasSlider, { target: { value: '0.7' } })

      expect(useExtendedObjectStore.getState().polytope.facetOffsetBias).toBe(0.7)
    })
  })
})
