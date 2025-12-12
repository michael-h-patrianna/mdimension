/**
 * MandelbrotControls Component
 *
 * Controls for configuring n-dimensional Mandelbrot set visualization.
 *
 * Features:
 * - Quality preset selector (draft/standard/high/ultra)
 * - Max iterations slider
 * - Escape radius slider
 * - Resolution preset buttons
 * - Edge mode toggle (enables wireframe/shader support)
 * - Sample count display
 *
 * @see docs/prd/ndimensional-mandelbrot.md
 */

import React from 'react';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import {
  DEFAULT_MANDELBROT_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
  type MandelbrotQualityPreset,
  type MandelbrotEdgeMode,
} from '@/lib/geometry/extended/types';
import { calculateGridEdgeCount } from '@/lib/geometry/extended/mandelbrot';

export interface MandelbrotControlsProps {
  className?: string;
}

/**
 * Quality preset options for the dropdown
 */
const qualityOptions = [
  { value: 'draft', label: 'Draft (Fast)' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High Quality' },
  { value: 'ultra', label: 'Ultra (Slow)' },
];

/**
 * Resolution preset values
 */
const resolutionPresets = [
  { value: 16, label: '16' },
  { value: 24, label: '24' },
  { value: 32, label: '32' },
  { value: 48, label: '48' },
  { value: 64, label: '64' },
];

/**
 * MandelbrotControls component
 *
 * Provides controls for Mandelbrot set generation:
 * - Quality presets that set iteration count and resolution together
 * - Manual iteration count adjustment
 * - Escape radius adjustment
 * - Resolution grid selector
 * - Edge mode toggle for wireframe/shader support
 *
 * @param props - Component props
 * @param props.className
 * @returns React component
 */
export const MandelbrotControls: React.FC<MandelbrotControlsProps> = ({
  className = '',
}) => {
  const config = useExtendedObjectStore((state) => state.mandelbrot);
  const setQualityPreset = useExtendedObjectStore((state) => state.setMandelbrotQualityPreset);
  const setMaxIterations = useExtendedObjectStore((state) => state.setMandelbrotMaxIterations);
  const setEscapeRadius = useExtendedObjectStore((state) => state.setMandelbrotEscapeRadius);
  const setResolution = useExtendedObjectStore((state) => state.setMandelbrotResolution);
  const setEdgeMode = useExtendedObjectStore((state) => state.setMandelbrotEdgeMode);

  // Calculate estimated sample and edge counts for display
  const estimatedSamples = config.resolution ** 3;
  const estimatedEdges = config.edgeMode === 'grid'
    ? calculateGridEdgeCount(config.resolution)
    : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Quality Preset */}
      <Select
        label="Quality Preset"
        options={qualityOptions}
        value={config.qualityPreset}
        onChange={(v) => setQualityPreset(v as MandelbrotQualityPreset)}
      />

      {/* Max Iterations */}
      <Slider
        label="Max Iterations"
        min={10}
        max={500}
        step={10}
        value={config.maxIterations}
        onChange={setMaxIterations}
        onReset={() => setMaxIterations(DEFAULT_MANDELBROT_CONFIG.maxIterations)}
        showValue
      />

      {/* Escape Radius */}
      <Slider
        label="Escape Radius"
        min={2.0}
        max={10.0}
        step={0.5}
        value={config.escapeRadius}
        onChange={setEscapeRadius}
        onReset={() => setEscapeRadius(DEFAULT_MANDELBROT_CONFIG.escapeRadius)}
        showValue
      />

      {/* Resolution Grid */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Grid Resolution ({config.resolution}³)
        </label>
        <ToggleGroup
          options={resolutionPresets.map((p) => ({
            value: String(p.value),
            label: p.label,
          }))}
          value={String(config.resolution)}
          onChange={(v) => setResolution(parseInt(v, 10))}
          ariaLabel="Grid resolution"
        />
      </div>

      {/* Edge Mode (enables wireframe/shader support) */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">Edge Rendering</label>
        <ToggleGroup<MandelbrotEdgeMode>
          options={[
            { value: 'none', label: 'None' },
            { value: 'grid', label: 'Grid' },
          ]}
          value={config.edgeMode}
          onChange={setEdgeMode}
          ariaLabel="Mandelbrot edge mode"
        />
        {config.edgeMode === 'grid' && (
          <p className="text-xs text-text-tertiary">
            Enables wireframe and dual outline shaders
          </p>
        )}
      </div>

      {/* Sample/Edge Count Info */}
      <div className="text-xs text-text-secondary space-y-1">
        <p>Estimated samples: {estimatedSamples.toLocaleString()}</p>
        {config.edgeMode === 'grid' && (
          <p>Estimated edges: {estimatedEdges.toLocaleString()}</p>
        )}
        <p className="text-text-tertiary">
          Preset: {MANDELBROT_QUALITY_PRESETS[config.qualityPreset].maxIterations} iter,{' '}
          {MANDELBROT_QUALITY_PRESETS[config.qualityPreset].resolution}³ grid
        </p>
      </div>

      {/* Performance warning for high sample counts */}
      {estimatedSamples > 100000 && (
        <p className="text-xs text-warning">
          High sample count may cause slowdowns. Consider reducing resolution.
        </p>
      )}

      {/* Warning for grid edges with high resolution */}
      {config.edgeMode === 'grid' && estimatedEdges > 200000 && (
        <p className="text-xs text-warning">
          High edge count ({estimatedEdges.toLocaleString()}) may cause slowdowns.
        </p>
      )}
    </div>
  );
};
