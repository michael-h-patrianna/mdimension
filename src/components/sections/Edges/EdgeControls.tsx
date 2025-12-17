/**
 * Visual Controls Component
 * Controls for customizing the visual appearance of polytopes edges and raymarching rim lighting (which appears as pseudo-edges).
 */

import { Slider } from '@/components/ui/Slider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { useAppearanceStore } from '@/stores/appearanceStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EdgeMaterialControls } from './EdgeMaterialControls';

export interface EdgesControlsProps {
  className?: string;
}

export const EdgeControls: React.FC<EdgesControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate visual store selectors with useShallow to reduce subscriptions
  const {
    edgeColor,
    edgeThickness,
    setEdgeColor,
    setEdgeThickness,
  } = useAppearanceStore(
    useShallow((state) => ({
      edgeColor: state.edgeColor,
      edgeThickness: state.edgeThickness,
      setEdgeColor: state.setEdgeColor,
      setEdgeThickness: state.setEdgeThickness,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>

      {/* Edge Color */}
      <ColorPicker
        label="Edge Color"
        value={edgeColor}
        onChange={setEdgeColor}
        disableAlpha={true}
      />


      {/* Edge Thickness */}
      <Slider
        label="Edge Thickness"
        min={0}
        max={5}
        step={0.1}
        value={edgeThickness}
        onChange={setEdgeThickness}
        showValue
      />

      {/* Edge Material Controls (only visible when thickness > 1) */}
      <EdgeMaterialControls />
    </div>
  );
});
