/**
 * Fog Controls Component
 *
 * UI controls for physical volumetric fog effect.
 * Physical fog uses height-based density with 3D noise for realistic atmospheric effects.
 */

import { Slider } from '@/components/ui/Slider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Switch } from '@/components/ui/Switch';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { Vector3Input } from '@/components/sections/Lights/Vector3Input';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export const FogControls: React.FC = () => {
  // Physical fog settings
  const {
    fogEnabled,
    fogDensity,
    fogColor,
    fogHeight,
    fogFalloff,
    fogNoiseScale,
    fogNoiseSpeed,
    fogScattering,
    volumetricShadows,
    setFogEnabled,
    setFogDensity,
    setFogColor,
    setFogHeight,
    setFogFalloff,
    setFogNoiseScale,
    setFogNoiseSpeed,
    setFogScattering,
    setVolumetricShadows,
    resetFog,
  } = useEnvironmentStore(
    useShallow((state) => ({
      fogEnabled: state.fogEnabled,
      fogDensity: state.fogDensity,
      fogColor: state.fogColor,
      fogHeight: state.fogHeight,
      fogFalloff: state.fogFalloff,
      fogNoiseScale: state.fogNoiseScale,
      fogNoiseSpeed: state.fogNoiseSpeed,
      fogScattering: state.fogScattering,
      volumetricShadows: state.volumetricShadows,
      setFogEnabled: state.setFogEnabled,
      setFogDensity: state.setFogDensity,
      setFogColor: state.setFogColor,
      setFogHeight: state.setFogHeight,
      setFogFalloff: state.setFogFalloff,
      setFogNoiseScale: state.setFogNoiseScale,
      setFogNoiseSpeed: state.setFogNoiseSpeed,
      setFogScattering: state.setFogScattering,
      setVolumetricShadows: state.setVolumetricShadows,
      resetFog: state.resetFog,
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
        {/* Fog Color */}
        <ColorPicker
          label="Fog Color"
          value={fogColor}
          onChange={setFogColor}
          disableAlpha={true}
        />

        {/* Fog Density */}
        <Slider
          label="Density"
          value={fogDensity}
          min={0}
          max={0.15}
          step={0.001}
          onChange={setFogDensity}
          tooltip="Fog density - higher values create thicker fog"
          showValue
          data-testid="fog-density"
        />

        {/* Physical fog controls */}
        <div className="space-y-4 p-3 bg-white/5 rounded-lg">
          <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
            Height & Falloff
          </span>
          <Slider
            label="Height"
            value={fogHeight}
            min={0}
            max={50}
            step={0.5}
            onChange={setFogHeight}
            tooltip="Maximum height of the fog layer (world Y)"
            showValue
            data-testid="fog-height"
          />
          <Slider
            label="Falloff"
            value={fogFalloff}
            min={0.01}
            max={1}
            step={0.01}
            onChange={setFogFalloff}
            tooltip="Vertical density falloff (higher = fades out faster)"
            showValue
            data-testid="fog-falloff"
          />
        </div>

        {/* Noise settings */}
        <div className="space-y-4 p-3 bg-white/5 rounded-lg">
          <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
            Turbulence
          </span>
          <Slider
            label="Noise Scale"
            value={fogNoiseScale}
            min={0.01}
            max={1}
            step={0.01}
            onChange={setFogNoiseScale}
            tooltip="Scale of 3D turbulence (higher = smaller features)"
            showValue
            data-testid="fog-noise-scale"
          />
          <Vector3Input
            label="Noise Speed"
            value={fogNoiseSpeed}
            onChange={setFogNoiseSpeed}
            step={0.01}
            className="pt-1"
          />
        </div>

        {/* Light scattering */}
        <div className="space-y-4 p-3 bg-white/5 rounded-lg">
          <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
            Light Scattering
          </span>
          <Slider
            label="Scattering"
            value={fogScattering}
            min={-0.99}
            max={0.99}
            step={0.01}
            onChange={setFogScattering}
            tooltip="Anisotropy of light scattering (-1 back, 0 isotropic, 1 forward)"
            showValue
            data-testid="fog-scattering"
          />
          <Switch
            checked={volumetricShadows}
            onCheckedChange={setVolumetricShadows}
            label="Volumetric Shadows"
            data-testid="fog-volumetric-shadows"
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
