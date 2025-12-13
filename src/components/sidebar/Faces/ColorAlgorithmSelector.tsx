/**
 * Color Algorithm Selector Component
 *
 * Dropdown for selecting the color algorithm used for face/surface coloring.
 */

import { Select } from '@/components/ui/Select';
import {
  COLOR_ALGORITHM_OPTIONS,
  type ColorAlgorithm,
} from '@/lib/shaders/palette';
import { useVisualStore } from '@/stores/visualStore';
import React from 'react';

export interface ColorAlgorithmSelectorProps {
  className?: string;
}

export const ColorAlgorithmSelector: React.FC<ColorAlgorithmSelectorProps> = ({
  className = '',
}) => {
  const colorAlgorithm = useVisualStore((state) => state.colorAlgorithm);
  const setColorAlgorithm = useVisualStore((state) => state.setColorAlgorithm);

  return (
    <div className={className}>
      <Select
        label="Color Algorithm"
        options={COLOR_ALGORITHM_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
        value={colorAlgorithm}
        onChange={(v) => setColorAlgorithm(v as ColorAlgorithm)}
      />
    </div>
  );
};
