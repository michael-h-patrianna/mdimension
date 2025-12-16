/**
 * Shared controls for all classic (texture-based) skybox modes
 * Includes: Quality, Blur, Parallax, Animation, Color, Atmosphere, Effects
 */
import { Select } from '@/components/ui/Select'
import { Slider } from '@/components/ui/Slider'
import { Switch } from '@/components/ui/Switch'
import { SkyboxAnimationMode, SkyboxProceduralSettings } from '@/stores/defaults/visualDefaults'
import React from 'react'
import { SkyboxPaletteEditor } from '../SkyboxPaletteEditor'

const ANIMATION_MODES: { value: SkyboxAnimationMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'cinematic', label: 'Cinematic (Smooth Orbit)' },
  { value: 'heatwave', label: 'Heatwave (Distortion)' },
  { value: 'tumble', label: 'Tumble (Chaos)' },
  { value: 'ethereal', label: 'Ethereal (Magical)' },
  { value: 'nebula', label: 'Nebula (Color Shift)' },
]

interface SkyboxSharedClassicControlsProps {
  skyboxBlur: number
  skyboxIntensity: number
  skyboxAnimationMode: SkyboxAnimationMode
  skyboxAnimationSpeed: number
  skyboxHighQuality: boolean
  proceduralSettings: SkyboxProceduralSettings
  setSkyboxBlur: (value: number) => void
  setSkyboxIntensity: (value: number) => void
  setSkyboxAnimationMode: (value: SkyboxAnimationMode) => void
  setSkyboxAnimationSpeed: (value: number) => void
  setSkyboxHighQuality: (value: boolean) => void
  setProceduralSettings: (settings: Partial<SkyboxProceduralSettings>) => void
}

export const SkyboxSharedClassicControls: React.FC<SkyboxSharedClassicControlsProps> = ({
  skyboxBlur,
  skyboxIntensity,
  skyboxAnimationMode,
  skyboxAnimationSpeed,
  skyboxHighQuality,
  proceduralSettings,
  setSkyboxBlur,
  setSkyboxIntensity,
  setSkyboxAnimationMode,
  setSkyboxAnimationSpeed,
  setSkyboxHighQuality,
  setProceduralSettings,
}) => {
  return (
    <>
      <Switch
        data-testid="skybox-hq-toggle"
        checked={skyboxHighQuality}
        onCheckedChange={setSkyboxHighQuality}
        label="High Quality Textures (KTX2)"
      />

      <Slider
        label="Blur"
        value={skyboxBlur}
        min={0}
        max={0.5}
        step={0.01}
        onChange={setSkyboxBlur}
      />

      <Switch
        data-testid="skybox-parallax-toggle"
        checked={proceduralSettings.parallaxEnabled}
        onCheckedChange={(v) => setProceduralSettings({ parallaxEnabled: v })}
        label="Parallax Depth"
      />

      {proceduralSettings.parallaxEnabled && (
        <Slider
          label="Depth Strength"
          value={proceduralSettings.parallaxStrength}
          min={0.1}
          max={1}
          step={0.05}
          onChange={(v) => setProceduralSettings({ parallaxStrength: v })}
        />
      )}

      <Select
        label="Animation"
        options={ANIMATION_MODES}
        value={skyboxAnimationMode}
        onChange={setSkyboxAnimationMode}
      />

      {skyboxAnimationMode !== 'none' && (
        <Slider
          label="Animation Speed"
          value={skyboxAnimationSpeed}
          min={0.001}
          max={0.1}
          step={0.001}
          onChange={setSkyboxAnimationSpeed}
        />
      )}

      {/* Color Adjustments */}
      <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4 mt-4">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
          Color
        </span>
        <Slider
          label="Brightness"
          value={skyboxIntensity}
          min={0}
          max={2}
          step={0.05}
          onChange={setSkyboxIntensity}
        />
        <Slider
          label="Hue Shift"
          value={proceduralSettings.hue ?? 0}
          min={-0.5}
          max={0.5}
          step={0.01}
          onChange={(v) => setProceduralSettings({ hue: v })}
        />
        <Slider
          label="Saturation"
          value={proceduralSettings.saturation ?? 1}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => setProceduralSettings({ saturation: v })}
        />
      </div>

      {/* Atmosphere Controls */}
      <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4 mt-4">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
          Atmosphere
        </span>
        <Slider
          label="Strength"
          value={proceduralSettings.horizon}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setProceduralSettings({ horizon: v })}
        />
        <SkyboxPaletteEditor />
      </div>

      {/* Effects */}
      <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4 mt-4">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
          Effects
        </span>
        <Slider
          label="Chromatic Aberration"
          value={proceduralSettings.chromaticAberration}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setProceduralSettings({ chromaticAberration: v })}
        />
        <Slider
          label="Film Grain"
          value={proceduralSettings.noiseGrain}
          min={0}
          max={0.1}
          step={0.005}
          onChange={(v) => setProceduralSettings({ noiseGrain: v })}
        />
      </div>
    </>
  )
}
