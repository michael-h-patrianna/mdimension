/**
 * Visual Controls Component
 * Controls for customizing the visual appearance of polytopes
 */

import { Slider } from '@/components/ui/Slider';
import { ToggleButton } from '@/components/ui/ToggleButton';
import {
  DEFAULT_EDGE_THICKNESS,
  DEFAULT_VERTEX_SIZE,
  useVisualStore
} from '@/stores/visualStore';
import React from 'react';

export interface VisualControlsProps {
  className?: string;
}

export const VisualControls: React.FC<VisualControlsProps> = ({
  className = '',
}) => {
  const edgeColor = useVisualStore((state) => state.edgeColor);
  const edgeThickness = useVisualStore((state) => state.edgeThickness);
  const vertexSize = useVisualStore((state) => state.vertexSize);
  const vertexColor = useVisualStore((state) => state.vertexColor);
  const backgroundColor = useVisualStore((state) => state.backgroundColor);
  const showGroundPlane = useVisualStore((state) => state.showGroundPlane);

  const setEdgeColor = useVisualStore((state) => state.setEdgeColor);
  const setEdgeThickness = useVisualStore((state) => state.setEdgeThickness);
  const setVertexSize = useVisualStore((state) => state.setVertexSize);
  const setVertexColor = useVisualStore((state) => state.setVertexColor);
  const setBackgroundColor = useVisualStore((state) => state.setBackgroundColor);
  const setShowGroundPlane = useVisualStore((state) => state.setShowGroundPlane);

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

      {/* Vertex Color - always visible, controlled by Vertices toggle at top */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Vertex Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={vertexColor}
            onChange={(e) => setVertexColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-panel-border"
            aria-label="Vertex Color"
          />
          <span className="text-xs font-mono text-text-secondary">{vertexColor}</span>
        </div>
      </div>

      {/* Vertex Size - always visible, controlled by Vertices toggle at top */}
      <Slider
        label="Vertex Size"
        min={1}
        max={10}
        step={0.1}
        value={vertexSize}
        onChange={setVertexSize}
        onReset={() => setVertexSize(DEFAULT_VERTEX_SIZE)}
        showValue
      />

      {/* Background Color */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Background Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-panel-border"
            aria-label="Background Color"
          />
          <span className="text-xs font-mono text-text-secondary">{backgroundColor}</span>
        </div>
      </div>

      {/* Ground Plane Toggle */}
      <ToggleButton
        pressed={showGroundPlane}
        onToggle={setShowGroundPlane}
        ariaLabel="Show Ground Plane"
      >
        Show Ground Plane
      </ToggleButton>
    </div>
  );
};
