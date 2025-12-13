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
 * - Sample count display
 *
 * Edge rendering is controlled by the general "Edges" toggle in the sidebar,
 * not by a dedicated setting in this component.
 *
 * @see docs/prd/ndimensional-mandelbrot.md
 */

import { useShallow } from 'zustand/react/shallow';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { calculateGridEdgeCount } from '@/lib/geometry/extended/mandelbrot';
import {
  DEFAULT_MANDELBROT_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
  type MandelbrotColorMode,
  type MandelbrotQualityPreset,
} from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useVisualStore } from '@/stores/visualStore';
import React from 'react';

/**
 * Props for the MandelbrotControls component.
 */
export interface MandelbrotControlsProps {
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
 * Mandelbulb/Hyperbulb power presets
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
 * MandelbrotControls component
 *
 * Provides controls for Mandelbrot set generation:
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
export const MandelbrotControls: React.FC<MandelbrotControlsProps> = React.memo(({
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
    setMandelbulbPower,
    setMandelbrotParameterValue,
    resetMandelbrotParameters,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.mandelbrot,
      setQualityPreset: state.setMandelbrotQualityPreset,
      setMaxIterations: state.setMandelbrotMaxIterations,
      setEscapeRadius: state.setMandelbrotEscapeRadius,
      setResolution: state.setMandelbrotResolution,
      setColorMode: state.setMandelbrotColorMode,
      setBoundaryThreshold: state.setMandelbrotBoundaryThreshold,
      setMandelbulbPower: state.setMandelbrotMandelbulbPower,
      setMandelbrotParameterValue: state.setMandelbrotParameterValue,
      resetMandelbrotParameters: state.resetMandelbrotParameters,
    }))
  );

  // Get current dimension to show/hide 3D-specific controls
  const dimension = useGeometryStore((state) => state.dimension);

  // Consolidate visual store selectors with useShallow
  const { edgesVisible, facesVisible } = useVisualStore(
    useShallow((state) => ({
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
    }))
  );

  // Determine if we are in Ray Marching mode (Mandelbrot 3D+ with Faces ON)
  const isRayMarching = dimension >= 3 && facesVisible;

  // Calculate estimated sample and edge counts for display
  // 2D uses resolution^2 (2D grid), 3D+ uses resolution^3 (3D volume)
  const estimatedSamples = dimension === 2
    ? config.resolution ** 2
    : config.resolution ** 3;
  // Edges are generated when the general "Edges" toggle is enabled
  const estimatedEdges = edgesVisible
    ? (dimension === 2
        ? 2 * config.resolution * (config.resolution - 1) // 2D grid edges
        : calculateGridEdgeCount(config.resolution))       // 3D grid edges
    : 0;

  return (
    <div className={`space-y-4 ${className}`}>




      {/* Shared Controls: Quality & Iterations */}
      {!isRayMarching && (
        <Select
          label="Quality Preset"
          options={qualityOptions}
          value={config.qualityPreset}
          onChange={(v) => setQualityPreset(v as MandelbrotQualityPreset)}
        />
      )}

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

      <Slider
        label={dimension >= 4 ? 'Escape Radius (8+ recommended for 4D+)' : 'Escape Radius'}
        min={2.0}
        max={16.0}
        step={0.5}
        value={config.escapeRadius}
        onChange={setEscapeRadius}
        onReset={() => setEscapeRadius(dimension >= 4 ? 8.0 : DEFAULT_MANDELBROT_CONFIG.escapeRadius)}
        showValue
      />

      {/* Point Cloud Only Controls */}
      {!isRayMarching && (
        <>
          {/* Color Mode */}
          <Select
            label="Color Mode"
            options={colorModeOptions}
            value={config.colorMode}
            onChange={(v) => setColorMode(v as MandelbrotColorMode)}
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
                />
                <Slider
                  label="Max"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.boundaryThreshold[1]}
                  onChange={(v) => setBoundaryThreshold([config.boundaryThreshold[0], v])}
                  showValue={false}
                />
              </div>
              <p className="text-xs text-text-tertiary">
                Shows points with escape times between these percentages of max iterations
              </p>
            </div>
          )}
        </>
      )}

      {/* Power Control (shown for 3D+ Mandelbulb/Hyperbulb) */}
      {dimension >= 3 && (
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">
            {dimension === 3 ? 'Mandelbulb' : 'Hyperbulb'} Power (n={config.mandelbulbPower})
          </label>
          <ToggleGroup
            options={powerPresets.map((p) => ({
              value: String(p.value),
              label: p.label,
            }))}
            value={String(config.mandelbulbPower)}
            onChange={(v) => setMandelbulbPower(parseInt(v, 10))}
            ariaLabel={`${dimension === 3 ? 'Mandelbulb' : 'Hyperbulb'} power preset`}
          />
          <Slider
            label="Custom Power"
            min={2}
            max={16}
            step={1}
            value={config.mandelbulbPower}
            onChange={setMandelbulbPower}
            onReset={() => setMandelbulbPower(DEFAULT_MANDELBROT_CONFIG.mandelbulbPower)}
            showValue
          />
          <p className="text-xs text-text-tertiary">
            {dimension === 3
              ? 'Controls the shape of the 3D Mandelbulb fractal'
              : `Controls the shape of the ${dimension}D Hyperbulb fractal`}
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
              onClick={() => resetMandelbrotParameters()}
              className="text-xs text-accent hover:underline"
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
              onChange={(v) => setMandelbrotParameterValue(i, v)}
              onReset={() => setMandelbrotParameterValue(i, 0)}
              showValue
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
              Preset: {MANDELBROT_QUALITY_PRESETS[config.qualityPreset].maxIterations} iter,{' '}
              {MANDELBROT_QUALITY_PRESETS[config.qualityPreset].resolution}³ grid
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
