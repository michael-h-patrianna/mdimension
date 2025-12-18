/**
 * FX Controls Component (formerly MiscControls)
 *
 * UI controls for post-processing FX effects:
 * - Ambient Occlusion - Unified controls for all object types:
 *   - SSAO for mesh-based objects (polytopes, etc.)
 *   - Volumetric AO for Schrödinger (cone-traced, expensive)
 * - Anti-aliasing method selector: None, FXAA, SMAA
 * - Object depth settings
 *
 * @see {@link PostProcessing} for the effect implementation
 * @see {@link usePostProcessingStore} for state management
 */

import { ColorPicker } from '@/components/ui/ColorPicker';
import { ControlGroup } from '@/components/ui/ControlGroup';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { type AntiAliasingMethod } from '@/stores/defaults/visualDefaults';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface MiscControlsProps {
  className?: string;
}

/** Anti-aliasing method options for the select dropdown */
const ANTI_ALIASING_OPTIONS: SelectOption<AntiAliasingMethod>[] = [
  { value: 'none', label: 'None' },
  { value: 'fxaa', label: 'FXAA' },
  { value: 'smaa', label: 'SMAA' },
];

/** AO Quality options for Schrödinger volumetric AO */
const AO_QUALITY_OPTIONS: SelectOption<string>[] = [
  { value: '3', label: '3 cones (Fast)' },
  { value: '4', label: '4 cones (Balanced)' },
  { value: '6', label: '6 cones (Quality)' },
  { value: '8', label: '8 cones (High)' },
];

/**
 * FX Controls component for post-processing effects.
 * AO is featured prominently as the primary effect in this tab.
 */
export const MiscControls: React.FC<MiscControlsProps> = React.memo(({
  className = '',
}) => {
  // Get current object type
  const objectType = useGeometryStore((state) => state.objectType);
  const isSchroedinger = objectType === 'schroedinger';

  // Global SSAO settings (for non-Schrödinger objects)
  const {
    antiAliasingMethod,
    setAntiAliasingMethod,
    smaaThreshold,
    setSmaaThreshold,
    objectOnlyDepth,
    setObjectOnlyDepth,
    ssaoEnabled,
    setSSAOEnabled,
    ssaoIntensity,
    setSSAOIntensity,
  } = usePostProcessingStore(
    useShallow((state) => ({
      antiAliasingMethod: state.antiAliasingMethod,
      setAntiAliasingMethod: state.setAntiAliasingMethod,
      smaaThreshold: state.smaaThreshold,
      setSmaaThreshold: state.setSmaaThreshold,
      objectOnlyDepth: state.objectOnlyDepth,
      setObjectOnlyDepth: state.setObjectOnlyDepth,
      ssaoEnabled: state.ssaoEnabled,
      setSSAOEnabled: state.setSSAOEnabled,
      ssaoIntensity: state.ssaoIntensity,
      setSSAOIntensity: state.setSSAOIntensity,
    }))
  );

  // Schrödinger-specific AO settings
  const {
    schroedingerAoEnabled,
    schroedingerAoStrength,
    schroedingerAoQuality,
    schroedingerAoRadius,
    schroedingerAoColor,
    setSchroedingerAoEnabled,
    setSchroedingerAoStrength,
    setSchroedingerAoQuality,
    setSchroedingerAoRadius,
    setSchroedingerAoColor,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      schroedingerAoEnabled: state.schroedinger.aoEnabled,
      schroedingerAoStrength: state.schroedinger.aoStrength,
      schroedingerAoQuality: state.schroedinger.aoQuality,
      schroedingerAoRadius: state.schroedinger.aoRadius,
      schroedingerAoColor: state.schroedinger.aoColor,
      setSchroedingerAoEnabled: state.setSchroedingerAoEnabled,
      setSchroedingerAoStrength: state.setSchroedingerAoStrength,
      setSchroedingerAoQuality: state.setSchroedingerAoQuality,
      setSchroedingerAoRadius: state.setSchroedingerAoRadius,
      setSchroedingerAoColor: state.setSchroedingerAoColor,
    }))
  );

  // Use appropriate values based on object type
  const effectiveAoEnabled = isSchroedinger ? schroedingerAoEnabled : ssaoEnabled;
  const effectiveAoIntensity = isSchroedinger ? schroedingerAoStrength : ssaoIntensity;

  // Handlers that update the appropriate store
  const handleAoToggle = (enabled: boolean) => {
    if (isSchroedinger) {
      setSchroedingerAoEnabled(enabled);
    } else {
      setSSAOEnabled(enabled);
    }
  };

  const handleAoIntensityChange = (intensity: number) => {
    if (isSchroedinger) {
      setSchroedingerAoStrength(intensity);
    } else {
      setSSAOIntensity(intensity);
    }
  };

  // Get AO type label
  const aoTypeLabel = isSchroedinger
    ? 'Volumetric (Schrödinger) - Very Expensive'
    : 'Screen-Space (SSAO)';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Ambient Occlusion - Unified controls */}
      <ControlGroup
        title="Ambient Occlusion"
        rightElement={
          <Switch
            checked={effectiveAoEnabled}
            onCheckedChange={handleAoToggle}
            data-testid="ao-toggle"
          />
        }
      >
        <p className="text-[10px] text-text-secondary mb-2">
          AO type: {aoTypeLabel}
        </p>
        <div
          className={`space-y-3 ${!effectiveAoEnabled ? 'opacity-50 pointer-events-none' : ''}`}
          aria-disabled={!effectiveAoEnabled}
        >
          {/* Shared Intensity/Strength slider */}
          <Slider
            label="Intensity"
            value={effectiveAoIntensity ?? 1.0}
            min={0}
            max={2}
            step={0.1}
            onChange={handleAoIntensityChange}
            showValue
            tooltip="Higher values create darker crevice shadows."
            data-testid="ao-intensity-slider"
          />

          {/* Schrödinger-specific controls - shown but disabled when not Schrödinger */}
          <div
            className={`space-y-3 ${!isSchroedinger ? 'opacity-50 pointer-events-none' : ''}`}
            aria-disabled={!isSchroedinger}
          >
            <p className="text-[10px] text-text-secondary border-t border-white/5 pt-2">
              Volumetric AO Settings {!isSchroedinger && '(Schrödinger only)'}
            </p>
            <Select<string>
              label="Quality"
              options={AO_QUALITY_OPTIONS}
              value={String(schroedingerAoQuality ?? 4)}
              onChange={(val) => setSchroedingerAoQuality(parseInt(val, 10))}
              data-testid="ao-quality-select"
            />
            <Slider
              label="Radius"
              min={0.1}
              max={2.0}
              step={0.1}
              value={schroedingerAoRadius ?? 0.5}
              onChange={setSchroedingerAoRadius}
              showValue
              tooltip="Sampling radius for cone-traced AO"
              data-testid="ao-radius-slider"
            />
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-secondary">Shadow Tint</label>
              <ColorPicker
                value={schroedingerAoColor ?? '#000000'}
                onChange={setSchroedingerAoColor}
                disableAlpha={true}
                className="w-24"
                data-testid="ao-color-picker"
              />
            </div>
          </div>
        </div>
      </ControlGroup>

      {/* Anti-aliasing */}
      <ControlGroup title="Anti-aliasing">
        <Select<AntiAliasingMethod>
          label=""
          options={ANTI_ALIASING_OPTIONS}
          value={antiAliasingMethod}
          onChange={setAntiAliasingMethod}
          data-testid="anti-aliasing-select"
        />

        {/* SMAA Threshold - only visible when SMAA is selected */}
        {antiAliasingMethod === 'smaa' && (
          <Slider
            label="Threshold"
            value={smaaThreshold}
            min={0.01}
            max={0.2}
            step={0.01}
            onChange={setSmaaThreshold}
            showValue
            tooltip="Edge detection sensitivity. Lower = more aggressive."
            minLabel="Strong"
            maxLabel="Subtle"
            data-testid="smaa-threshold-slider"
          />
        )}
      </ControlGroup>

      {/* Depth Settings */}
      <ControlGroup title="Depth">
        <Switch
          checked={objectOnlyDepth}
          onCheckedChange={setObjectOnlyDepth}
          label="Object Only Depth"
        />
        <p className="text-[10px] text-text-secondary mt-1">
          Exclude background from depth-based effects.
        </p>
      </ControlGroup>
    </div>
  );
});

MiscControls.displayName = 'MiscControls';
