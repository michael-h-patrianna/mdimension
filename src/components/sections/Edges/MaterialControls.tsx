/**
 * Material Controls Component
 *
 * Controls for material properties: diffuse intensity and specular settings.
 * Only visible when using Surface shader with light enabled.
 */

import { Slider } from '@/components/ui/Slider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import {
  DEFAULT_SPECULAR_COLOR,
} from '@/stores/defaults/visualDefaults';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface MaterialControlsProps {
  className?: string;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider pt-2 pb-1 border-t border-panel-border mt-2 first:mt-0 first:border-t-0 first:pt-0">
    {title}
  </div>
);

export const MaterialControls: React.FC<MaterialControlsProps> = React.memo(({
  className = '',
}) => {
  const shaderType = useAppearanceStore((state) => state.shaderType);

  const lightingSelector = useShallow((state: any) => ({
    lightEnabled: state.lightEnabled,
    specularIntensity: state.specularIntensity,
    shininess: state.shininess,
    specularColor: state.specularColor,
    diffuseIntensity: state.diffuseIntensity,
    setSpecularIntensity: state.setSpecularIntensity,
    setShininess: state.setShininess,
    setSpecularColor: state.setSpecularColor,
    setDiffuseIntensity: state.setDiffuseIntensity,
  }));
  const {
    lightEnabled,
    specularIntensity,
    shininess,
    specularColor,
    diffuseIntensity,
    setSpecularIntensity,
    setShininess,
    setSpecularColor,
    setDiffuseIntensity,
  } = useLightingStore(lightingSelector);

  // Only show for Surface shader with light enabled
  if (shaderType !== 'surface' || !lightEnabled) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Diffuse */}
      <SectionHeader title="Diffuse" />
      <Slider
        label="Diffuse Intensity"
        min={0}
        max={2}
        step={0.01}
        value={diffuseIntensity}
        onChange={setDiffuseIntensity}
        showValue
      />

      {/* Specular */}
      <SectionHeader title="Specular" />

      {/* Specular Color */}
      <div className="flex items-center justify-between">
        <ColorPicker
          label="Specular Color"
          value={specularColor}
          onChange={setSpecularColor}
          disableAlpha={true}
        />
        {specularColor !== DEFAULT_SPECULAR_COLOR && (
            <button
              onClick={() => setSpecularColor(DEFAULT_SPECULAR_COLOR)}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
              title="Reset to default"
            >
              Reset
            </button>
        )}
      </div>


      {/* Specular Intensity */}
      <Slider
        label="Specular Intensity"
        min={0}
        max={2}
        step={0.1}
        value={specularIntensity}
        onChange={setSpecularIntensity}
        showValue
      />

      {/* Shininess */}
      <Slider
        label="Shininess"
        min={1}
        max={128}
        step={1}
        value={shininess}
        onChange={setShininess}
        showValue
      />
    </div>
  );
});
