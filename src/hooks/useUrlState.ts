/**
 * URL State Hook
 *
 * Initializes app state from URL parameters on mount.
 * Uses the state serializer to parse URL and applies to stores.
 */

import { parseCurrentUrl } from '@/lib/url/state-serializer'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePostProcessingStore } from '@/stores/postProcessingStore'
import { useEffect, useRef } from 'react'

/**
 * Hook to initialize app state from URL parameters.
 * Only runs once on mount - does not react to URL changes.
 *
 * Parses URL search params and applies them to the appropriate stores.
 * URL format: /?t=hypercube&d=4&fv=1&ev=0
 */
export function useUrlState(): void {
  const initialized = useRef(false)

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return
    initialized.current = true

    // Parse URL state
    const urlState = parseCurrentUrl()

    // Skip if no URL params
    if (Object.keys(urlState).length === 0) return

    // Apply to geometry store
    if (urlState.dimension !== undefined) {
      useGeometryStore.getState().setDimension(urlState.dimension)
    }
    if (urlState.objectType !== undefined) {
      useGeometryStore.getState().setObjectType(urlState.objectType)
    }

    // Apply to appearance store
    if (urlState.facesVisible !== undefined) {
      useAppearanceStore.getState().setFacesVisible(urlState.facesVisible)
    }
    if (urlState.edgesVisible !== undefined) {
      useAppearanceStore.getState().setEdgesVisible(urlState.edgesVisible)
    }
    if (urlState.edgeColor !== undefined) {
      useAppearanceStore.getState().setEdgeColor(urlState.edgeColor)
    }
    if (urlState.backgroundColor !== undefined) {
      useAppearanceStore.getState().setBackgroundColor(urlState.backgroundColor)
    }
    if (urlState.shaderType !== undefined) {
      useAppearanceStore.getState().setShaderType(urlState.shaderType)
    }

    // Apply to lighting store
    if (urlState.toneMappingEnabled !== undefined) {
      useLightingStore.getState().setToneMappingEnabled(urlState.toneMappingEnabled)
    }
    if (urlState.exposure !== undefined) {
      useLightingStore.getState().setExposure(urlState.exposure)
    }
    if (urlState.shadowEnabled !== undefined) {
      useLightingStore.getState().setShadowEnabled(urlState.shadowEnabled)
    }

    // Apply to post-processing store (bloom settings moved here from lighting)
    if (urlState.bloomEnabled !== undefined) {
      usePostProcessingStore.getState().setBloomEnabled(urlState.bloomEnabled)
    }
    if (urlState.bloomIntensity !== undefined) {
      usePostProcessingStore.getState().setBloomIntensity(urlState.bloomIntensity)
    }
    if (urlState.bloomThreshold !== undefined) {
      usePostProcessingStore.getState().setBloomThreshold(urlState.bloomThreshold)
    }

    // Apply to extended object store for mandelbulb settings
    // Note: These use the mandelbulb config-based setters

    // Apply uniformScale if present
    if (urlState.uniformScale !== undefined) {
      // Scale is applied to the polytope config
      useExtendedObjectStore.getState().setPolytopeScale(urlState.uniformScale)
    }
  }, [])
}
