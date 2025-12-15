/**
 * Edge Material Controls Component
 *
 * Controls for edge/tube material properties: metallic and roughness.
 * Only visible when edge thickness > 1 (tube rendering mode).
 */

import { Slider } from '@/components/ui/Slider'
import {
  DEFAULT_EDGE_METALLIC,
  DEFAULT_EDGE_ROUGHNESS,
} from '@/stores/defaults/visualDefaults';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import React from 'react'
import { useShallow } from 'zustand/react/shallow'

export interface EdgeMaterialControlsProps {
  className?: string
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider pt-2 pb-1 border-t border-panel-border mt-2 first:mt-0 first:border-t-0 first:pt-0">
    {title}
  </div>
)

export const EdgeMaterialControls: React.FC<EdgeMaterialControlsProps> = React.memo(
  ({ className = '' }) => {
    const {
      edgeThickness,
      edgeMetallic,
      edgeRoughness,
      setEdgeMetallic,
      setEdgeRoughness,
    } = useAppearanceStore(
      useShallow((state) => ({
        edgeThickness: state.edgeThickness,
        edgeMetallic: state.edgeMetallic,
        edgeRoughness: state.edgeRoughness,
        setEdgeMetallic: state.setEdgeMetallic,
        setEdgeRoughness: state.setEdgeRoughness,
      }))
    );

    const lightEnabled = useLightingStore((state) => state.lightEnabled);

    // Only show when tube rendering is active (thickness > 1) and light is enabled
    if (edgeThickness <= 1 || !lightEnabled) {
      return null
    }

    return (
      <div className={`space-y-3 ${className}`}>
        <SectionHeader title="Edge Material" />

        {/* Metallic */}
        <Slider
          label="Metallic"
          min={0}
          max={1}
          step={0.01}
          value={edgeMetallic}
          onChange={setEdgeMetallic}
          onReset={() => setEdgeMetallic(DEFAULT_EDGE_METALLIC)}
          showValue
        />

        {/* Roughness */}
        <Slider
          label="Roughness"
          min={0}
          max={1}
          step={0.01}
          value={edgeRoughness}
          onChange={setEdgeRoughness}
          onReset={() => setEdgeRoughness(DEFAULT_EDGE_ROUGHNESS)}
          showValue
        />
      </div>
    )
  }
)
