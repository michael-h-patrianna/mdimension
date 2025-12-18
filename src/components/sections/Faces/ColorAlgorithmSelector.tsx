/**
 * Color Algorithm Selector Component
 *
 * Dropdown for selecting the color algorithm used for face/surface coloring.
 * Quantum-specific algorithms (phase, mixed, blackbody) are only shown for Schroedinger.
 */

import { Select } from '@/components/ui/Select';
import {
  COLOR_ALGORITHM_OPTIONS,
  type ColorAlgorithm,
  isQuantumOnlyAlgorithm,
} from '@/rendering/shaders/palette';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React, { useMemo } from 'react';

export interface ColorAlgorithmSelectorProps {
  className?: string;
}

export const ColorAlgorithmSelector: React.FC<ColorAlgorithmSelectorProps> = ({
  className = '',
}) => {
  const colorAlgorithm = useAppearanceStore((state) => state.colorAlgorithm);
  const setColorAlgorithm = useAppearanceStore((state) => state.setColorAlgorithm);
  const objectType = useGeometryStore((state) => state.objectType);

  // Filter out quantum-only algorithms for non-Schroedinger objects
  const availableOptions = useMemo(() => {
    const isSchroedinger = objectType === 'schroedinger';
    return COLOR_ALGORITHM_OPTIONS.filter(
      (opt) => isSchroedinger || !isQuantumOnlyAlgorithm(opt.value)
    );
  }, [objectType]);

  return (
    <div className={className}>
      <Select
        label="Color Algorithm"
        options={availableOptions.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
        value={colorAlgorithm}
        onChange={(v) => setColorAlgorithm(v as ColorAlgorithm)}
      />
    </div>
  );
};
