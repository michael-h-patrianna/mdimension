/**
 * Visual Controls Component
 * Controls for customizing the visual appearance of polytopes edges and raymarching rim lighting (which appears as pseudo-edges).
 */

import { Slider } from '@/components/ui/Slider';
import {
  DEFAULT_EDGE_THICKNESS,
  useVisualStore
} from '@/stores/visualStore';
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
  } = useVisualStore(
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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Edge Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={edgeColor}
            onChange={(e) => setEdgeColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-panel-border"
            aria-label="Edge Color"
          />
          <span className="text-xs font-mono text-text-secondary">{edgeColor}</span>
        </div>
      </div>

      {/* Edge Thickness */}
      <Slider
        label="Edge Thickness"
        min={1}
        max={5}
        step={0.1}
        value={edgeThickness}
        onChange={setEdgeThickness}
        onReset={() => setEdgeThickness(DEFAULT_EDGE_THICKNESS)}
        showValue
      />

      {/* Edge Material Controls (only visible when thickness > 1) */}
      <EdgeMaterialControls />
    </div>
  );
});
