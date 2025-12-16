/**
 * SchroedingerControls Component
 *
 * Controls for configuring n-dimensional Schroedinger set visualization.
 *
 * Features:
 * - Quality preset selector (draft/standard/high/ultra)
 * - Max iterations slider
 * - Escape radius slider
 * - Resolution preset buttons
 * - Sample count display
 *
 * Edge rendering is controlled by the general "Edges" toggle in the sidebar,
 * not by a dedicated setting in this component.
 *
 * @see docs/prd/ndimensional-schroedinger.md
 */

import { useShallow } from 'zustand/react/shallow';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { calculateGridEdgeCount } from '@/lib/geometry/extended/schroedinger';
import {
  DEFAULT_SCHROEDINGER_CONFIG,
  SCHROEDINGER_QUALITY_PRESETS,
  type SchroedingerColorMode,
  type SchroedingerQualityPreset,
} from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import React from 'react';

/**
 * Props for the SchroedingerControls component.
 */
export interface SchroedingerControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
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
 * Color mode options for visualization
 */
const colorModeOptions = [
  { value: 'escapeTime', label: 'Escape Time' },
  { value: 'smoothColoring', label: 'Smooth Coloring' },
  { value: 'boundaryOnly', label: 'Boundary Only' },
  { value: 'interiorOnly', label: 'Interior Only' },
];

/**
 * Schroedinger/Schroedinger power presets
 */
const powerPresets = [
  { value: 3, label: 'Flower' },
  { value: 4, label: 'Quad' },
  { value: 8, label: 'Classic' },
  { value: 12, label: 'Spiky' },
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
 * SchroedingerControls component
 *
 * Provides controls for Schroedinger set generation:
 * - Quality presets that set iteration count and resolution together
 * - Manual iteration count adjustment
 * - Escape radius adjustment
 * - Resolution grid selector
 *
 * Edge rendering is controlled by the general "Edges" toggle in the sidebar.
 *
 * @param props - Component props
 * @param props.className
 * @returns React component
 */
export const SchroedingerControls: React.FC<SchroedingerControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const {
    config,
    setQualityPreset,
    setMaxIterations,
    setEscapeRadius,
    setResolution,
    setColorMode,
    setBoundaryThreshold,
    setSchroedingerPower,
    setSchroedingerParameterValue,
    resetSchroedingerParameters,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.schroedinger,
      setQualityPreset: state.setSchroedingerQualityPreset,
      setMaxIterations: state.setSchroedingerMaxIterations,
      setEscapeRadius: state.setSchroedingerEscapeRadius,
      setResolution: state.setSchroedingerResolution,
      setColorMode: state.setSchroedingerColorMode,
      setBoundaryThreshold: state.setSchroedingerBoundaryThreshold,
      setSchroedingerPower: state.setSchroedingerSchroedingerPower,
      setSchroedingerParameterValue: state.setSchroedingerParameterValue,
      resetSchroedingerParameters: state.resetSchroedingerParameters,
    }))
  );

  // Get current dimension to show/hide 3D-specific controls
  const dimension = useGeometryStore((state) => state.dimension);

  // Consolidate visual store selectors with useShallow
  const { edgesVisible, facesVisible } = useAppearanceStore(
    useShallow((state) => ({
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
    }))
  );

  // Determine if we are in Ray Marching mode (Schroedinger 3D+ with Faces ON)
  const isRayMarching = dimension >= 3 && facesVisible;

  // Calculate estimated sample and edge counts for display
  // 3D+ uses resolution^3 (3D volume)
  const estimatedSamples = config.resolution ** 3;
  // Edges are generated when the general "Edges" toggle is enabled
  const estimatedEdges = edgesVisible
    ? calculateGridEdgeCount(config.resolution)
    : 0;

  return (
    <div className={`space-y-4 ${className}`} data-testid="schroedinger-controls">

      {/* Shared Controls: Quality & Iterations */}
      {!isRayMarching && (
        <Select
          label="Quality Preset"
          options={qualityOptions}
          value={config.qualityPreset}
          onChange={(v) => setQualityPreset(v as SchroedingerQualityPreset)}
          data-testid="schroedinger-quality"
        />
      )}

      <Slider
        label="Max Iterations"
        min={10}
        max={500}
        step={10}
        value={config.maxIterations}
        onChange={setMaxIterations}
        onReset={() => setMaxIterations(DEFAULT_SCHROEDINGER_CONFIG.maxIterations)}
        showValue
        data-testid="schroedinger-iterations"
      />

      <Slider
        label={dimension >= 4 ? 'Escape Radius (8+ recommended for 4D+)' : 'Escape Radius'}
        min={2.0}
        max={16.0}
        step={0.5}
        value={config.escapeRadius}
        onChange={setEscapeRadius}
        onReset={() => setEscapeRadius(dimension >= 4 ? 8.0 : DEFAULT_SCHROEDINGER_CONFIG.escapeRadius)}
        showValue
        data-testid="schroedinger-escape-radius"
      />

      {/* Point Cloud Only Controls */}
      {!isRayMarching && (
        <>
          {/* Color Mode */}
          <Select
            label="Color Mode"
            options={colorModeOptions}
            value={config.colorMode}
            onChange={(v) => setColorMode(v as SchroedingerColorMode)}
            data-testid="schroedinger-color-mode"
          />

          {/* Boundary Threshold (shown only for boundaryOnly mode) */}
          {config.colorMode === 'boundaryOnly' && (
            <div className="space-y-2">
              <label className="text-xs text-text-secondary">
                Boundary Threshold ({(config.boundaryThreshold[0] * 100).toFixed(0)}% - {(config.boundaryThreshold[1] * 100).toFixed(0)}%)
              </label>
              <div className="flex gap-2">
                <Slider
                  label="Min"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.boundaryThreshold[0]}
                  onChange={(v) => setBoundaryThreshold([v, config.boundaryThreshold[1]])}
                  showValue={false}
                  data-testid="schroedinger-boundary-min"
                />
                <Slider
                  label="Max"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.boundaryThreshold[1]}
                  onChange={(v) => setBoundaryThreshold([config.boundaryThreshold[0], v])}
                  showValue={false}
                  data-testid="schroedinger-boundary-max"
                />
              </div>
              <p className="text-xs text-text-tertiary">
                Shows points with escape times between these percentages of max iterations
              </p>
            </div>
          )}
        </>
      )}

      {/* Power Control (shown for 3D+ Schroedinger/Schroedinger) */}
      {dimension >= 3 && (
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">
            {dimension === 3 ? 'Schroedinger' : 'Schroedinger'} Power (n={config.schroedingerPower})
          </label>
          <ToggleGroup
            options={powerPresets.map((p) => ({
              value: String(p.value),
              label: p.label,
            }))}
            value={String(config.schroedingerPower)}
            onChange={(v) => setSchroedingerPower(parseInt(v, 10))}
            ariaLabel={`${dimension === 3 ? 'Schroedinger' : 'Schroedinger'} power preset`}
            data-testid="schroedinger-power-preset"
          />
          <Slider
            label="Custom Power"
            min={2}
            max={16}
            step={1}
            value={config.schroedingerPower}
            onChange={setSchroedingerPower}
            onReset={() => setSchroedingerPower(DEFAULT_SCHROEDINGER_CONFIG.schroedingerPower)}
            showValue
            data-testid="schroedinger-power-slider"
          />
          <p className="text-xs text-text-tertiary">
            {dimension === 3
              ? 'Controls the shape of the 3D Schroedinger fractal'
              : `Controls the shape of the ${dimension}D Schroedinger fractal`}
          </p>
        </div>
      )}

      {/* Slice Parameters - shown for 4D+ raymarching */}
      {dimension >= 4 && isRayMarching && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs text-text-secondary">
              Slice Parameters ({dimension - 3} dim{dimension > 4 ? 's' : ''})
            </label>
            <button
              onClick={() => resetSchroedingerParameters()}
              className="text-xs text-accent hover:underline"
              data-testid="schroedinger-reset-params"
            >
              Reset
            </button>
          </div>
          {Array.from({ length: dimension - 3 }, (_, i) => (
            <Slider
              key={`slice-dim-${i + 3}`}
              label={`Dim ${i + 3}`}
              min={-2.0}
              max={2.0}
              step={0.1}
              value={config.parameterValues[i] ?? 0}
              onChange={(v) => setSchroedingerParameterValue(i, v)}
              onReset={() => setSchroedingerParameterValue(i, 0)}
              showValue
              data-testid={`schroedinger-slice-dim-${i + 3}`}
            />
          ))}
          <p className="text-xs text-text-tertiary">
            Explore different {dimension}D cross-sections
          </p>
        </div>
      )}

      {/* Resolution Grid - Point Cloud Only */}
      {!isRayMarching && (
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
            data-testid="schroedinger-resolution"
          />
        </div>
      )}

      {/* Info Stats */}
      <div className="text-xs text-text-secondary space-y-1 border-t border-white/10 pt-2">
        {isRayMarching ? (
          <p>Rendering: GPU Ray Marching</p>
        ) : (
          <>
            <p>Estimated samples: {estimatedSamples.toLocaleString()}</p>
            {edgesVisible && (
              <p>Estimated edges: {estimatedEdges.toLocaleString()}</p>
            )}
            <p className="text-text-tertiary">
              Preset: {SCHROEDINGER_QUALITY_PRESETS[config.qualityPreset].maxIterations} iter,{' '}
              {SCHROEDINGER_QUALITY_PRESETS[config.qualityPreset].resolution}³ grid
            </p>
          </>
        )}
      </div>

      {/* Warnings */}
      {!isRayMarching && estimatedSamples > 100000 && (
        <p className="text-xs text-warning">
          High sample count may cause slowdowns.
        </p>
      )}
    </div>
  );
});
