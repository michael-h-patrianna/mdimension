/**
 * Starfield-specific skybox controls
 */
import { Slider } from '@/components/ui/Slider'
import { SkyboxProceduralSettings } from '@/stores/defaults/visualDefaults'
import React from 'react'

interface StarfieldControlsProps {
  proceduralSettings: SkyboxProceduralSettings
  setProceduralSettings: (settings: Partial<SkyboxProceduralSettings>) => void
}

export const StarfieldControls: React.FC<StarfieldControlsProps> = ({
  proceduralSettings,
  setProceduralSettings,
}) => {
  return (
    <div className="space-y-4 border-l-2 border-yellow-500/30 pl-4">
      <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider block mb-2">
        Star Field
      </span>

      <Slider
        label="Density"
        value={proceduralSettings.starfield.density}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) =>
          setProceduralSettings({
            starfield: { ...proceduralSettings.starfield, density: v },
          })
        }
      />

      <Slider
        label="Brightness"
        value={proceduralSettings.starfield.brightness}
        min={0.1}
        max={2}
        step={0.05}
        onChange={(v) =>
          setProceduralSettings({
            starfield: { ...proceduralSettings.starfield, brightness: v },
          })
        }
      />

      <Slider
        label="Star Size"
        value={proceduralSettings.starfield.size}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) =>
          setProceduralSettings({
            starfield: { ...proceduralSettings.starfield, size: v },
          })
        }
      />

      <Slider
        label="Twinkle"
        value={proceduralSettings.starfield.twinkle}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) =>
          setProceduralSettings({
            starfield: { ...proceduralSettings.starfield, twinkle: v },
          })
        }
      />

      <Slider
        label="Glow"
        value={proceduralSettings.starfield.glow}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) =>
          setProceduralSettings({
            starfield: { ...proceduralSettings.starfield, glow: v },
          })
        }
      />

      <Slider
        label="Color Variation"
        value={proceduralSettings.starfield.colorVariation}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) =>
          setProceduralSettings({
            starfield: { ...proceduralSettings.starfield, colorVariation: v },
          })
        }
      />
    </div>
  )
}
