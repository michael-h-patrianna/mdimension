import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { SkyboxAnimationMode, SkyboxSelection } from '@/stores/defaults/visualDefaults';
import { useEnvironmentStore } from '@/stores/environmentStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SkyboxPaletteEditor } from './SkyboxPaletteEditor';

// Import thumbnails and icons
import spaceBlueThumb from '@/assets/skyboxes/space_blue/thumbnail.png';
import spaceLightBlueThumb from '@/assets/skyboxes/space_lightblue/thumbnail.png';
import spaceRedThumb from '@/assets/skyboxes/space_red/thumbnail.png';

interface SkyboxOption {
  id: SkyboxSelection;
  name: string;
  thumbnail: string | null;
  gradientClass: string | null;
  description: string;
  type: 'none' | 'classic' | 'procedural';
}

const ALL_SKYBOX_OPTIONS: SkyboxOption[] = [
  // No skybox
  { id: 'none', name: 'None', thumbnail: null, gradientClass: 'bg-black', description: 'No skybox', type: 'none' },
  // Classic textures
  { id: 'space_blue', name: 'Deep Space', thumbnail: spaceBlueThumb, gradientClass: null, description: 'Cold, deep space environment', type: 'classic' },
  { id: 'space_lightblue', name: 'Nebula', thumbnail: spaceLightBlueThumb, gradientClass: null, description: 'Bright nebula with stars', type: 'classic' },
  { id: 'space_red', name: 'Red Giant', thumbnail: spaceRedThumb, gradientClass: null, description: 'Warm, intense red space', type: 'classic' },
  // Original procedural
  { id: 'procedural_aurora', name: 'Aurora', thumbnail: null, gradientClass: 'bg-gradient-to-b from-cyan-400 via-emerald-600 to-slate-900', description: 'Northern lights effect', type: 'procedural' },
  { id: 'procedural_nebula', name: 'Cosmic Nebula', thumbnail: null, gradientClass: 'bg-gradient-to-br from-purple-500 via-fuchsia-600 to-slate-900', description: 'Volumetric clouds', type: 'procedural' },
  { id: 'procedural_void', name: 'The Void', thumbnail: null, gradientClass: 'bg-[radial-gradient(circle_at_30%_30%,_#475569_0%,_#0f172a_50%,_#000_100%)]', description: 'Dark gradient with glow', type: 'procedural' },
  // NEW: Premium procedural skyboxes
  { id: 'procedural_crystalline', name: 'Crystalline', thumbnail: null, gradientClass: 'bg-[conic-gradient(from_45deg,_#0ea5e9_0%,_#8b5cf6_25%,_#ec4899_50%,_#0ea5e9_75%,_#8b5cf6_100%)]', description: 'Geometric Voronoi patterns with iridescence', type: 'procedural' },
  { id: 'procedural_horizon', name: 'Horizon', thumbnail: null, gradientClass: 'bg-gradient-to-b from-slate-900 via-slate-700 to-slate-400', description: 'Cinematic studio gradient', type: 'procedural' },
  { id: 'procedural_ocean', name: 'Deep Ocean', thumbnail: null, gradientClass: 'bg-gradient-to-b from-cyan-300 via-blue-600 to-slate-900', description: 'Underwater atmosphere with caustics', type: 'procedural' },
  { id: 'procedural_twilight', name: 'Twilight', thumbnail: null, gradientClass: 'bg-gradient-to-b from-amber-400 via-rose-500 to-indigo-900', description: 'Sunset gradient with atmosphere', type: 'procedural' },
  { id: 'procedural_starfield', name: 'Starfield', thumbnail: null, gradientClass: 'bg-[radial-gradient(circle,_#1e293b_0%,_#020617_70%,_#000_100%)]', description: 'Minimal elegant stars', type: 'procedural' },
];

const ANIMATION_MODES: { value: SkyboxAnimationMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'cinematic', label: 'Cinematic (Smooth Orbit)' },
  { value: 'heatwave', label: 'Heatwave (Distortion)' },
  { value: 'tumble', label: 'Tumble (Chaos)' },
  { value: 'ethereal', label: 'Ethereal (Magical)' },
  { value: 'nebula', label: 'Nebula (Color Shift)' },
];

export const SkyboxControls: React.FC = () => {
  const {
    skyboxSelection,
    skyboxBlur,
    skyboxIntensity,
    skyboxAnimationMode,
    skyboxAnimationSpeed,
    skyboxHighQuality,
    proceduralSettings,
    setSkyboxSelection,
    setSkyboxBlur,
    setSkyboxIntensity,
    setSkyboxAnimationMode,
    setSkyboxAnimationSpeed,
    setSkyboxHighQuality,
    setProceduralSettings,
  } = useEnvironmentStore(
    useShallow((state) => ({
      skyboxSelection: state.skyboxSelection,
      skyboxBlur: state.skyboxBlur,
      skyboxIntensity: state.skyboxIntensity,
      skyboxAnimationMode: state.skyboxAnimationMode,
      skyboxAnimationSpeed: state.skyboxAnimationSpeed,
      skyboxHighQuality: state.skyboxHighQuality,
      proceduralSettings: state.proceduralSettings,
      setSkyboxSelection: state.setSkyboxSelection,
      setSkyboxBlur: state.setSkyboxBlur,
      setSkyboxIntensity: state.setSkyboxIntensity,
      setSkyboxAnimationMode: state.setSkyboxAnimationMode,
      setSkyboxAnimationSpeed: state.setSkyboxAnimationSpeed,
      setSkyboxHighQuality: state.setSkyboxHighQuality,
      setProceduralSettings: state.setProceduralSettings,
    }))
  );

  const selectedOption = ALL_SKYBOX_OPTIONS.find(opt => opt.id === skyboxSelection);
  const isClassicMode = selectedOption?.type === 'classic';
  const isProceduralMode = selectedOption?.type === 'procedural';
  const isStarfieldMode = skyboxSelection === 'procedural_starfield';
  const hasControls = skyboxSelection !== 'none';

  return (
    <div className="space-y-6">


      {/* Unified thumbnail grid */}
      <div className="grid grid-cols-3 gap-3">
        {ALL_SKYBOX_OPTIONS.map((option) => {
          const isSelected = skyboxSelection === option.id;
          return (
            <button
              key={option.id}
              data-testid={`skybox-option-${option.id}`}
              onClick={() => setSkyboxSelection(option.id)}
              className={`
                group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ease-out
                hover:scale-105 hover:shadow-lg
                ${isSelected
                  ? 'border-accent-primary ring-1 ring-accent-primary/50 shadow-md'
                  : 'border-panel-border hover:border-text-primary/30'}
              `}
              title={option.description}
            >
              {/* Thumbnail content - either image or gradient */}
              {option.thumbnail ? (
                <img
                  src={option.thumbnail}
                  alt={option.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className={`w-full h-full ${option.gradientClass} transition-transform duration-500 group-hover:scale-110`} />
              )}

              {/* Label overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-center backdrop-blur-sm">
                <span className="text-[10px] font-medium text-white block">
                  {option.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mode-specific controls */}
      {hasControls && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-5">

          {/* --- CLASSIC MODE CONTROLS --- */}
          {isClassicMode && (
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

              {/* Color Adjustments for Classic Textures */}
              <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4 mt-4">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Color</span>
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

              {/* Atmosphere Controls for Classic Textures */}
              <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4 mt-4">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Atmosphere</span>
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

              {/* Effects for Classic Textures */}
              <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4 mt-4">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Effects</span>
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
          )}

          {/* --- PROCEDURAL MODE CONTROLS --- */}
          {isProceduralMode && (
            <div className="space-y-6">

              {/* Visual Settings */}
              <div className="space-y-4 border-l-2 border-accent-primary/20 pl-4">
                <span className="text-xs font-bold text-accent-primary uppercase tracking-wider block mb-2">Structure</span>
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

              {/* Appearance */}
              <div className="space-y-4 border-l-2 border-text-secondary/20 pl-4">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Appearance</span>
                <Switch
                  data-testid="skybox-sync-toggle"
                  checked={proceduralSettings.syncWithObject}
                  onCheckedChange={(v) => setProceduralSettings({ syncWithObject: v })}
                  label="Sync Color with Object"
                />

                {!proceduralSettings.syncWithObject && (
                  <SkyboxPaletteEditor />
                )}

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
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Delight Features</span>

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

              {/* Starfield-specific controls */}
              {isStarfieldMode && (
                <div className="space-y-4 border-l-2 border-yellow-500/30 pl-4">
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider block mb-2">Star Field</span>

                  <Slider
                    label="Density"
                    value={proceduralSettings.starfield.density}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setProceduralSettings({
                      starfield: { ...proceduralSettings.starfield, density: v }
                    })}
                  />

                  <Slider
                    label="Brightness"
                    value={proceduralSettings.starfield.brightness}
                    min={0.1}
                    max={2}
                    step={0.05}
                    onChange={(v) => setProceduralSettings({
                      starfield: { ...proceduralSettings.starfield, brightness: v }
                    })}
                  />

                  <Slider
                    label="Star Size"
                    value={proceduralSettings.starfield.size}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setProceduralSettings({
                      starfield: { ...proceduralSettings.starfield, size: v }
                    })}
                  />

                  <Slider
                    label="Twinkle"
                    value={proceduralSettings.starfield.twinkle}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setProceduralSettings({
                      starfield: { ...proceduralSettings.starfield, twinkle: v }
                    })}
                  />

                  <Slider
                    label="Glow"
                    value={proceduralSettings.starfield.glow}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setProceduralSettings({
                      starfield: { ...proceduralSettings.starfield, glow: v }
                    })}
                  />

                  <Slider
                    label="Color Variation"
                    value={proceduralSettings.starfield.colorVariation}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setProceduralSettings({
                      starfield: { ...proceduralSettings.starfield, colorVariation: v }
                    })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
