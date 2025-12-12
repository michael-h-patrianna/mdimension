/**
 * Visual Controls Component
 * Controls for customizing the visual appearance of polytopes
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import {
  useVisualStore,
  VISUAL_PRESETS,
  DEFAULT_EDGE_THICKNESS,
  DEFAULT_VERTEX_SIZE,
} from '@/stores/visualStore';
import type { VisualPreset } from '@/stores/visualStore';

export interface VisualControlsProps {
  className?: string;
}

const PRESET_NAMES: Record<VisualPreset, string> = {
  neon: 'Neon',
  blueprint: 'Blueprint',
  hologram: 'Hologram',
  scientific: 'Scientific',
  synthwave: 'Synthwave',
};

export const VisualControls: React.FC<VisualControlsProps> = ({
  className = '',
}) => {
  const edgeColor = useVisualStore((state) => state.edgeColor);
  const edgeThickness = useVisualStore((state) => state.edgeThickness);
  const vertexVisible = useVisualStore((state) => state.vertexVisible);
  const vertexSize = useVisualStore((state) => state.vertexSize);
  const vertexColor = useVisualStore((state) => state.vertexColor);
  const backgroundColor = useVisualStore((state) => state.backgroundColor);
  const showGroundPlane = useVisualStore((state) => state.showGroundPlane);

  const setEdgeColor = useVisualStore((state) => state.setEdgeColor);
  const setEdgeThickness = useVisualStore((state) => state.setEdgeThickness);
  const setVertexVisible = useVisualStore((state) => state.setVertexVisible);
  const setVertexSize = useVisualStore((state) => state.setVertexSize);
  const setVertexColor = useVisualStore((state) => state.setVertexColor);
  const setBackgroundColor = useVisualStore((state) => state.setBackgroundColor);
  const setShowGroundPlane = useVisualStore((state) => state.setShowGroundPlane);
  const applyPreset = useVisualStore((state) => state.applyPreset);
  const reset = useVisualStore((state) => state.reset);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Presets */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(VISUAL_PRESETS) as VisualPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className="px-3 py-2 text-sm bg-panel-border text-text-primary rounded-md hover:bg-panel-border/80 transition-colors"
            >
              {PRESET_NAMES[preset]}
            </button>
          ))}
        </div>
      </div>

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
          />
          <span className="text-xs font-mono text-text-secondary">{edgeColor}</span>
        </div>
      </div>

      {/* Edge Thickness */}
      <Slider
        label="Edge Thickness"
        min={1}
        max={5}
        step={0.5}
        value={edgeThickness}
        onChange={setEdgeThickness}
        onReset={() => setEdgeThickness(DEFAULT_EDGE_THICKNESS)}
        showValue
      />

      {/* Vertex Visibility */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVertexVisible(!vertexVisible)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
            ${vertexVisible
              ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50'
              : 'bg-panel-border text-text-secondary border border-panel-border'
            }
          `}
          aria-pressed={vertexVisible}
        >
          <span>Show Vertices</span>
        </button>
      </div>

      {/* Vertex Color */}
      {vertexVisible && (
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
            />
            <span className="text-xs font-mono text-text-secondary">{vertexColor}</span>
          </div>
        </div>
      )}

      {/* Vertex Size */}
      {vertexVisible && (
        <Slider
          label="Vertex Size"
          min={1}
          max={10}
          step={1}
          value={vertexSize}
          onChange={setVertexSize}
          onReset={() => setVertexSize(DEFAULT_VERTEX_SIZE)}
          showValue
        />
      )}

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
          />
          <span className="text-xs font-mono text-text-secondary">{backgroundColor}</span>
        </div>
      </div>

      {/* Ground Plane Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowGroundPlane(!showGroundPlane)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
            ${showGroundPlane
              ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50'
              : 'bg-panel-border text-text-secondary border border-panel-border'
            }
          `}
          aria-pressed={showGroundPlane}
        >
          <span>Show Ground Plane</span>
        </button>
      </div>

      {/* Reset */}
      <Button
        variant="secondary"
        size="sm"
        onClick={reset}
        className="w-full"
      >
        Reset Visual Settings
      </Button>
    </div>
  );
};
