/**
 * Fog Controls Component
 *
 * UI controls for scene fog effect.
 * Supports linear fog (near/far) and volumetric fog (exponential density).
 * Also includes "Object Effect" controls for how fog affects rendered objects.
 */

import { Slider } from '@/components/ui/Slider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Switch } from '@/components/ui/Switch';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { type FogType } from '@/stores/slices/fogSlice';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

const FOG_TYPE_OPTIONS: { value: FogType; label: string; description: string }[] = [
  { value: 'linear', label: 'Linear', description: 'Sharp boundaries' },
  { value: 'volumetric', label: 'Volumetric', description: 'Atmospheric density' },
];

export const FogControls: React.FC = () => {
  // Scene fog settings (Three.js fog)
  const {
    fogEnabled,
    fogType,
    fogDensity,
    fogNear,
    fogFar,
    fogColor,
    setFogEnabled,
    setFogType,
    setFogDensity,
    setFogNear,
    setFogFar,
    setFogColor,
    resetFog,
  } = useEnvironmentStore(
    useShallow((state) => ({
      fogEnabled: state.fogEnabled,
      fogType: state.fogType,
      fogDensity: state.fogDensity,
      fogNear: state.fogNear,
      fogFar: state.fogFar,
      fogColor: state.fogColor,
      setFogEnabled: state.setFogEnabled,
      setFogType: state.setFogType,
      setFogDensity: state.setFogDensity,
      setFogNear: state.setFogNear,
      setFogFar: state.setFogFar,
      setFogColor: state.setFogColor,
      resetFog: state.resetFog,
    }))
  );

  // Object fog effect settings (how fog affects rendered objects)
  const {
    fogIntegrationEnabled,
    fogContribution,
    internalFogDensity,
    setFogIntegrationEnabled,
    setFogContribution,
    setInternalFogDensity,
  } = useAppearanceStore(
    useShallow((state) => ({
      fogIntegrationEnabled: state.fogIntegrationEnabled,
      fogContribution: state.fogContribution,
      internalFogDensity: state.internalFogDensity,
      setFogIntegrationEnabled: state.setFogIntegrationEnabled,
      setFogContribution: state.setFogContribution,
      setInternalFogDensity: state.setInternalFogDensity,
    }))
  );

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <Switch
        data-testid="fog-toggle"
        checked={fogEnabled}
        onCheckedChange={setFogEnabled}
        label="Enable Fog"
      />

      {/* Fog Controls - disabled when fog is off */}
      <div
        className={`space-y-4 transition-opacity duration-200 ${
          fogEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}
      >
        {/* Fog Type Toggle */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-text-secondary">
            Fog Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FOG_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFogType(option.value)}
                className={`
                  px-3 py-2 rounded-lg border text-left transition-all
                  ${fogType === option.value
                    ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                    : 'border-white/10 bg-white/5 text-text-secondary hover:bg-white/10'
                  }
                `}
                data-testid={`fog-type-${option.value}`}
              >
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="block text-[10px] text-text-tertiary">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Fog Color */}
        <ColorPicker
          label="Fog Color"
          value={fogColor}
          onChange={setFogColor}
          disableAlpha={true}
        />


        {/* Volumetric-specific controls */}
        {fogType === 'volumetric' && (
          <div className="space-y-4 p-3 bg-white/5 rounded-lg">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
              Volumetric Settings
            </span>
            <Slider
              label="Density"
              value={fogDensity}
              min={0}
              max={0.1}
              step={0.001}
              onChange={setFogDensity}
              tooltip="Fog density - higher values create thicker atmospheric fog"
              data-testid="fog-density"
            />
          </div>
        )}

        {/* Linear-specific controls */}
        {fogType === 'linear' && (
          <div className="space-y-4 p-3 bg-white/5 rounded-lg">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
              Linear Settings
            </span>
            <Slider
              label="Near Distance"
              value={fogNear}
              min={0}
              max={50}
              step={1}
              onChange={setFogNear}
              tooltip="Distance where fog starts to appear"
              data-testid="fog-near"
            />
            <Slider
              label="Far Distance"
              value={fogFar}
              min={10}
              max={150}
              step={1}
              onChange={setFogFar}
              tooltip="Distance where fog becomes fully opaque"
              data-testid="fog-far"
            />
          </div>
        )}

        {/* Object Effect - how fog affects rendered objects */}
        <div className="space-y-3 p-3 bg-white/5 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
              Object Effect
            </span>
            <ToggleButton
              pressed={fogIntegrationEnabled}
              onToggle={() => setFogIntegrationEnabled(!fogIntegrationEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle fog effect on objects"
              data-testid="fog-object-effect-toggle"
            >
              {fogIntegrationEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>
          <p className="text-[10px] text-text-tertiary">
            How fog affects the rendered object
          </p>
          {fogIntegrationEnabled && (
            <Slider
              label="Contribution"
              value={fogContribution}
              min={0}
              max={2}
              step={0.1}
              onChange={setFogContribution}
              tooltip="How strongly scene fog affects the object (0 = none, 2 = double)"
              showValue
              data-testid="fog-contribution"
            />
          )}
          <Slider
            label="Internal Density"
            value={internalFogDensity}
            min={0}
            max={1}
            step={0.05}
            onChange={setInternalFogDensity}
            tooltip="Additional fog density inside the object for depth effect"
            showValue
            data-testid="fog-internal-density"
          />
        </div>

        {/* Reset Button */}
        <button
          type="button"
          onClick={resetFog}
          className="w-full mt-2 px-3 py-1.5 text-xs text-text-tertiary hover:text-text-primary border border-white/10 rounded transition-colors"
          data-testid="fog-reset"
        >
          Reset Fog Settings
        </button>
      </div>
    </div>
  );
};
