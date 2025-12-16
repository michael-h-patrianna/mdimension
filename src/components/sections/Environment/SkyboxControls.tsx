import React from 'react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useShallow } from 'zustand/react/shallow';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { SkyboxTexture, SkyboxAnimationMode } from '@/stores/defaults/visualDefaults';

// Import thumbnails and icons
import spaceBlueThumb from '@/assets/skyboxes/space_blue/thumbnail.png';
import spaceLightBlueThumb from '@/assets/skyboxes/space_lightblue/thumbnail.png';
import spaceRedThumb from '@/assets/skyboxes/space_red/thumbnail.png';
import checkmarkIcon from '@/assets/icons/checkmark.svg';
import blockedIcon from '@/assets/icons/blocked.svg';
import undoIcon from '@/assets/icons/undo.svg';

interface SkyboxOption {
  id: SkyboxTexture;
  name: string;
  thumbnail: string | null;
  description: string;
}

const SKYBOX_OPTIONS: SkyboxOption[] = [
  { id: 'none', name: 'None', thumbnail: null, description: 'No skybox' },
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

export const SkyboxControls: React.FC = () => {
  const {
    skyboxEnabled,
    skyboxTexture,
    skyboxBlur,
    skyboxIntensity,
    skyboxRotation,
    skyboxAnimationMode,
    skyboxAnimationSpeed,
    skyboxHighQuality,
    setSkyboxEnabled,
    setSkyboxTexture,
    setSkyboxBlur,
    setSkyboxIntensity,
    setSkyboxRotation,
    setSkyboxAnimationMode,
    setSkyboxAnimationSpeed,
    setSkyboxHighQuality,
    resetSkyboxSettings
  } = useEnvironmentStore(
    useShallow((state) => ({
      skyboxEnabled: state.skyboxEnabled,
      skyboxTexture: state.skyboxTexture,
      skyboxBlur: state.skyboxBlur,
      skyboxIntensity: state.skyboxIntensity,
      skyboxRotation: state.skyboxRotation,
      skyboxAnimationMode: state.skyboxAnimationMode,
      skyboxAnimationSpeed: state.skyboxAnimationSpeed,
      skyboxHighQuality: state.skyboxHighQuality,
      setSkyboxEnabled: state.setSkyboxEnabled,
      setSkyboxTexture: state.setSkyboxTexture,
      setSkyboxBlur: state.setSkyboxBlur,
      setSkyboxIntensity: state.setSkyboxIntensity,
      setSkyboxRotation: state.setSkyboxRotation,
      setSkyboxAnimationMode: state.setSkyboxAnimationMode,
      setSkyboxAnimationSpeed: state.setSkyboxAnimationSpeed,
      setSkyboxHighQuality: state.setSkyboxHighQuality,
      resetSkyboxSettings: state.resetSkyboxSettings,
    }))
  );

  const handleSelect = (id: SkyboxTexture) => {
    if (id === 'none') {
      setSkyboxEnabled(false);
      setSkyboxTexture('none');
    } else {
      if (!skyboxEnabled) setSkyboxEnabled(true);
      setSkyboxTexture(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`transition-opacity duration-200 ${skyboxEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <Switch
          checked={skyboxHighQuality}
          onCheckedChange={setSkyboxHighQuality}
          label="High Quality Textures"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {SKYBOX_OPTIONS.map((option) => {
          const isSelected = option.id === 'none' ? !skyboxEnabled : (skyboxEnabled && skyboxTexture === option.id);
          
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={`
                group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ease-out
                hover:scale-105 hover:shadow-lg
                focus:outline-none focus:ring-2 focus:ring-accent-primary
                ${isSelected 
                  ? 'border-accent-primary ring-1 ring-accent-primary/50 shadow-md' 
                  : 'border-panel-border hover:border-text-primary/30'}
              `}
              title={option.description}
            >
              {option.thumbnail ? (
                <img 
                  src={option.thumbnail} 
                  alt={option.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full bg-panel-bg-lighter flex items-center justify-center">
                  <img src={blockedIcon} alt="None" className="w-6 h-6 opacity-30 group-hover:opacity-50 transition-opacity" />
                </div>
              )}
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

              {/* Checkmark Overlay */}
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-accent-primary/20 backdrop-blur-[1px]">
                  <img src={checkmarkIcon} className="w-6 h-6 drop-shadow-md" alt="Selected" />
                </div>
              )}

              {/* Name Label */}
              <div className="absolute bottom-0 left-0 right-0 p-1.5 text-center">
                <span className="text-[10px] font-medium text-white/90 truncate block drop-shadow-sm">
                  {option.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className={`space-y-5 transition-all duration-300 ${skyboxEnabled ? 'opacity-100 translate-y-0' : 'opacity-50 pointer-events-none grayscale'}`}>
        <div className="flex items-center justify-between border-b border-panel-border pb-2">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Adjustments</span>
          <button 
            onClick={resetSkyboxSettings}
            className="p-1.5 rounded-md hover:bg-panel-bg-lighter text-text-secondary hover:text-text-primary transition-colors"
            title="Reset to defaults"
          >
            <img src={undoIcon} className="w-3.5 h-3.5" alt="Reset" />
          </button>
        </div>

        <Slider
          label="Blur"
          value={skyboxBlur}
          min={0}
          max={0.5} 
          step={0.01}
          onChange={setSkyboxBlur}
          tooltip="Blur the skybox environment (0 = sharp)"
        />

        <Slider
          label="Intensity"
          value={skyboxIntensity}
          min={0}
          max={5}
          step={0.1}
          onChange={setSkyboxIntensity}
          tooltip="Brightness of the skybox"
        />

        <Slider
          label="Rotation"
          value={skyboxRotation}
          min={0}
          max={360}
          step={1}
          onChange={setSkyboxRotation}
          tooltip="Rotate the skybox environment"
        />

        <div className="flex items-center justify-between border-b border-panel-border pb-2 mt-4">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Animation</span>
        </div>

        <Select
            label="Mode"
            options={ANIMATION_MODES}
            value={skyboxAnimationMode}
            onChange={setSkyboxAnimationMode}
        />

        {skyboxAnimationMode !== 'none' && (
             <Slider
                label="Speed"
                value={skyboxAnimationSpeed}
                min={0.001}
                max={0.1}
                step={0.001}
                onChange={setSkyboxAnimationSpeed}
                tooltip="Speed of the skybox animation"
            />
        )}
      </div>
    </div>
  );
};