/**
 * Edge Material Controls Component
 *
 * Controls for edge/tube material properties: metallic and roughness.
 * Only visible when edge thickness > 1 (tube rendering mode).
 */

import { Slider } from '@/components/ui/Slider'
import { ControlGroup } from '@/components/ui/ControlGroup'
import { useAppearanceStore, type AppearanceSlice } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import React from 'react'
import { useShallow } from 'zustand/react/shallow'

export interface EdgeMaterialControlsProps {
  className?: string
}

export const EdgeMaterialControls: React.FC<EdgeMaterialControlsProps> = React.memo(
  ({ className = '' }) => {
    const appearanceSelector = useShallow((state: AppearanceSlice) => ({
      edgeThickness: state.edgeThickness,
      edgeMetallic: state.edgeMetallic,
      edgeRoughness: state.edgeRoughness,
      setEdgeMetallic: state.setEdgeMetallic,
      setEdgeRoughness: state.setEdgeRoughness,
    }));
    const {
      edgeThickness,
      edgeMetallic,
      edgeRoughness,
      setEdgeMetallic,
      setEdgeRoughness,
    } = useAppearanceStore(appearanceSelector);

    const lightEnabled = useLightingStore((state) => state.lightEnabled);
    const showMaterialControls = edgeThickness > 1 && lightEnabled;

    if (!showMaterialControls) return null;

    return (
      <ControlGroup title="Edge Material" className={className} defaultOpen>
        {/* Metallic */}
        <Slider
            label="Metallic"
            min={0}
            max={1}
            step={0.01}
            value={edgeMetallic}
            onChange={setEdgeMetallic}
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
            showValue
        />
      </ControlGroup>
    )
  }
)
