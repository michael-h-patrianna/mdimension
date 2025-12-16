/**
 * Shared controls for all procedural skybox modes
 * Includes: Structure, Appearance, and Delight Features
 */
import { Slider } from '@/components/ui/Slider'
import { Switch } from '@/components/ui/Switch'
import { SkyboxProceduralSettings } from '@/stores/defaults/visualDefaults'
import React from 'react'
import { SkyboxPaletteEditor } from '../SkyboxPaletteEditor'

interface SkyboxSharedProceduralControlsProps {
  proceduralSettings: SkyboxProceduralSettings
  skyboxIntensity: number
  setProceduralSettings: (settings: Partial<SkyboxProceduralSettings>) => void
  setSkyboxIntensity: (value: number) => void
}

export const SkyboxSharedProceduralControls: React.FC<SkyboxSharedProceduralControlsProps> = ({
  proceduralSettings,
  skyboxIntensity,
  setProceduralSettings,
  setSkyboxIntensity,
}) => {
  return (
    <div className="space-y-6">
      {/* Structure Settings */}
      <div className="space-y-4 border-l-2 border-accent-primary/20 pl-4">
        <span className="text-xs font-bold text-accent-primary uppercase tracking-wider block mb-2">
          Structure
        </span>
        <Slider
          label="Scale"
          value={proceduralSettings.scale}
          min={0.1}
          max={3.0}
          step={0.1}
          onChange={(v) => setProceduralSettings({ scale: v })}
        />
        <Slider
          label="Complexity"
          value={proceduralSettings.complexity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setProceduralSettings({ complexity: v })}
        />
        <Slider
          label="Evolution (Seed)"
          value={proceduralSettings.evolution}
          min={0}
          max={10}
          step={0.01}
          onChange={(v) => setProceduralSettings({ evolution: v })}
        />
      </div>

      {/* Appearance Settings */}
      <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
          Appearance
        </span>
        <Switch
          data-testid="skybox-sync-toggle"
          checked={proceduralSettings.syncWithObject}
          onCheckedChange={(v) => setProceduralSettings({ syncWithObject: v })}
          label="Sync Color with Object"
        />

        {!proceduralSettings.syncWithObject && <SkyboxPaletteEditor />}

        <Slider
          label="Brightness"
          value={skyboxIntensity}
          min={0}
          max={3}
          step={0.1}
          onChange={setSkyboxIntensity}
        />

        <Slider
          label="Time Flow"
          value={proceduralSettings.timeScale}
          min={0}
          max={2.0}
          step={0.01}
          onChange={(v) => setProceduralSettings({ timeScale: v })}
        />
      </div>

      {/* Delight Features */}
      <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
          Features
        </span>

        <div className="grid grid-cols-2 gap-4">
          <Slider
            label="Atmosphere"
            value={proceduralSettings.horizon}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setProceduralSettings({ horizon: v })}
          />
          <Slider
            label="Turbulence"
            value={proceduralSettings.turbulence}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setProceduralSettings({ turbulence: v })}
          />
          <Slider
            label="Aberration"
            value={proceduralSettings.chromaticAberration}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setProceduralSettings({ chromaticAberration: v })}
          />
          <Slider
            label="Grain"
            value={proceduralSettings.noiseGrain}
            min={0}
            max={0.1}
            step={0.005}
            onChange={(v) => setProceduralSettings({ noiseGrain: v })}
          />
        </div>

        <Slider
          label="Sun Intensity"
          value={proceduralSettings.sunIntensity}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => setProceduralSettings({ sunIntensity: v })}
        />
      </div>
    </div>
  )
}
