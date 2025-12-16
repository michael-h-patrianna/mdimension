import React from 'react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useShallow } from 'zustand/react/shallow';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { SkyboxTexture, SkyboxAnimationMode, SkyboxMode } from '@/stores/defaults/visualDefaults';

// Import thumbnails and icons
import spaceBlueThumb from '@/assets/skyboxes/space_blue/thumbnail.png';
import spaceLightBlueThumb from '@/assets/skyboxes/space_lightblue/thumbnail.png';
import spaceRedThumb from '@/assets/skyboxes/space_red/thumbnail.png';
import undoIcon from '@/assets/icons/undo.svg';

interface SkyboxOption {
  id: SkyboxTexture;
  name: string;
  thumbnail: string | null;
  description: string;
}

const SKYBOX_OPTIONS: SkyboxOption[] = [
  { id: 'space_blue', name: 'Deep Space', thumbnail: spaceBlueThumb, description: 'Cold, deep space environment' },
  { id: 'space_lightblue', name: 'Nebula', thumbnail: spaceLightBlueThumb, description: 'Bright nebula with stars' },
  { id: 'space_red', name: 'Red Giant', thumbnail: spaceRedThumb, description: 'Warm, intense red space' },
];

const ANIMATION_MODES: { value: SkyboxAnimationMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'cinematic', label: 'Cinematic (Smooth Orbit)' },
  { value: 'heatwave', label: 'Heatwave (Distortion)' },
  { value: 'tumble', label: 'Tumble (Chaos)' },
  { value: 'ethereal', label: 'Ethereal (Magical)' },
  { value: 'nebula', label: 'Nebula (Color Shift)' },
];

const SKYBOX_MODES: { value: SkyboxMode; label: string }[] = [
  { value: 'classic', label: 'Classic (Images)' },
  { value: 'procedural_aurora', label: 'Aurora (Procedural)' },
  { value: 'procedural_nebula', label: 'Nebula (Procedural)' },
  { value: 'procedural_void', label: 'The Void (Procedural)' },
];

export const SkyboxControls: React.FC = () => {
  const {
    skyboxEnabled,
    skyboxMode,
    skyboxTexture,
    skyboxBlur,
    skyboxIntensity,
    skyboxAnimationMode,
    skyboxAnimationSpeed,
    skyboxHighQuality,
    proceduralSettings,
    setSkyboxEnabled,
    setSkyboxMode,
    setSkyboxTexture,
    setSkyboxBlur,
    setSkyboxIntensity,
    setSkyboxAnimationMode,
    setSkyboxAnimationSpeed,
    setSkyboxHighQuality,
    setProceduralSettings,
    resetSkyboxSettings,
  } = useEnvironmentStore(
    useShallow((state) => ({
      skyboxEnabled: state.skyboxEnabled,
      skyboxMode: state.skyboxMode,
      skyboxTexture: state.skyboxTexture,
      skyboxBlur: state.skyboxBlur,
      skyboxIntensity: state.skyboxIntensity,
      skyboxRotation: state.skyboxRotation,
      skyboxAnimationMode: state.skyboxAnimationMode,
      skyboxAnimationSpeed: state.skyboxAnimationSpeed,
      skyboxHighQuality: state.skyboxHighQuality,
      proceduralSettings: state.proceduralSettings,
      setSkyboxEnabled: state.setSkyboxEnabled,
      setSkyboxMode: state.setSkyboxMode,
      setSkyboxTexture: state.setSkyboxTexture,
      setSkyboxBlur: state.setSkyboxBlur,
      setSkyboxIntensity: state.setSkyboxIntensity,
      setSkyboxRotation: state.setSkyboxRotation,
      setSkyboxAnimationMode: state.setSkyboxAnimationMode,
      setSkyboxAnimationSpeed: state.setSkyboxAnimationSpeed,
      setSkyboxHighQuality: state.setSkyboxHighQuality,
      setProceduralSettings: state.setProceduralSettings,
      resetSkyboxSettings: state.resetSkyboxSettings,
    }))
  );

  const handleModeChange = (mode: SkyboxMode) => {
      if (!skyboxEnabled) setSkyboxEnabled(true);
      setSkyboxMode(mode);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <Switch
            checked={skyboxEnabled}
            onCheckedChange={setSkyboxEnabled}
            label="Enable Skybox"
          />
          <button 
            onClick={resetSkyboxSettings}
            className="p-1.5 rounded-md hover:bg-panel-bg-lighter text-text-secondary hover:text-text-primary transition-colors"
            title="Reset to defaults"
          >
            <img src={undoIcon} className="w-3.5 h-3.5" alt="Reset" />
          </button>
      </div>

      <div className={`space-y-5 transition-all duration-300 ${skyboxEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
        
        <Select
            data-testid="skybox-mode-select"
            label="Skybox Mode"
            options={SKYBOX_MODES}
            value={skyboxMode}
            onChange={handleModeChange}
        />

        {/* --- CLASSIC MODE CONTROLS --- */}
        {skyboxMode === 'classic' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {SKYBOX_OPTIONS.map((option) => {
                  const isSelected = skyboxTexture === option.id;
                  return (
                    <button
                      key={option.id}
                      data-testid={`skybox-texture-${option.id}`}
                      onClick={() => setSkyboxTexture(option.id)}
                      className={`
                        group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ease-out
                        hover:scale-105 hover:shadow-lg
                        ${isSelected 
                          ? 'border-accent-primary ring-1 ring-accent-primary/50 shadow-md' 
                          : 'border-panel-border hover:border-text-primary/30'}
                      `}
                      title={option.description}
                    >
                      {option.thumbnail && (
                        <img 
                          src={option.thumbnail} 
                          alt={option.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-center backdrop-blur-sm">
                        <span className="text-[10px] font-medium text-white block">
                          {option.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

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
          </div>
        )}

        {/* --- PROCEDURAL MODE CONTROLS --- */}
        {skyboxMode !== 'classic' && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
                
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
                        <div className="flex gap-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-1 flex-1">
                                <label className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">Primary</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" 
                                        value={proceduralSettings.color1}
                                        onChange={(e) => setProceduralSettings({ color1: e.target.value })}
                                        className="w-full h-8 rounded cursor-pointer border border-panel-border bg-transparent"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1 flex-1">
                                <label className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">Secondary</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" 
                                        value={proceduralSettings.color2}
                                        onChange={(e) => setProceduralSettings({ color2: e.target.value })}
                                        className="w-full h-8 rounded cursor-pointer border border-panel-border bg-transparent"
                                    />
                                </div>
                            </div>
                        </div>
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
                            max={0.2}
                            step={0.01}
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
        )}

      </div>
    </div>
  );
};