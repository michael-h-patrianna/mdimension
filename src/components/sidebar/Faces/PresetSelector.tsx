/**
 * Preset Selector Component
 *
 * Dropdown for selecting pre-configured cosine palette presets.
 */

import { Select } from '@/components/ui/Select';
import { COSINE_PRESET_OPTIONS } from '@/lib/shaders/palette';
import { useVisualStore } from '@/stores/visualStore';
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface PresetSelectorProps {
  className?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  className = '',
}) => {
  const { cosineCoefficients, setCosineCoefficients } = useVisualStore(
    useShallow((state) => ({
      cosineCoefficients: state.cosineCoefficients,
      setCosineCoefficients: state.setCosineCoefficients,
    }))
  );

  // Find current preset by matching coefficients
  const currentPreset = useMemo(() => {
    for (const preset of COSINE_PRESET_OPTIONS) {
      const c = preset.coefficients;
      if (
        JSON.stringify(c.a) === JSON.stringify(cosineCoefficients.a) &&
        JSON.stringify(c.b) === JSON.stringify(cosineCoefficients.b) &&
        JSON.stringify(c.c) === JSON.stringify(cosineCoefficients.c) &&
        JSON.stringify(c.d) === JSON.stringify(cosineCoefficients.d)
      ) {
        return preset.value;
      }
    }
    return 'custom';
  }, [cosineCoefficients]);

  const options = [
    ...COSINE_PRESET_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
    })),
    { value: 'custom', label: 'Custom' },
  ];

  const handleChange = (value: string) => {
    if (value === 'custom') return;

    const preset = COSINE_PRESET_OPTIONS.find((p) => p.value === value);
    if (preset) {
      setCosineCoefficients(preset.coefficients);
    }
  };

  return (
    <div className={className}>
      <Select
        label="Palette Preset"
        options={options}
        value={currentPreset}
        onChange={handleChange}
      />
    </div>
  );
};
