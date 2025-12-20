/**
 * Color Algorithm Selector Component
 *
 * Dropdown for selecting the color algorithm used for face/surface coloring.
 * Object-specific algorithms are filtered based on current object type:
 * - Quantum algorithms (phase, mixed, blackbody) only shown for Schroedinger
 * - Black hole algorithms (accretionGradient, etc.) only shown for Black Hole
 */

import { Select } from '@/components/ui/Select';
import {
  COLOR_ALGORITHM_OPTIONS,
  type ColorAlgorithm,
  isQuantumOnlyAlgorithm,
  isBlackHoleOnlyAlgorithm,
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

  // Filter algorithms based on object type
  const availableOptions = useMemo(() => {
    const isSchroedinger = objectType === 'schroedinger';
    const isBlackHole = objectType === 'blackhole';

    return COLOR_ALGORITHM_OPTIONS.filter((opt) => {
      // Show quantum algorithms only for Schroedinger
      if (isQuantumOnlyAlgorithm(opt.value)) {
        return isSchroedinger;
      }
      // Show black hole algorithms only for Black Hole
      if (isBlackHoleOnlyAlgorithm(opt.value)) {
        return isBlackHole;
      }
      // Show all other algorithms for all objects
      return true;
    });
  }, [objectType]);

  return (
    <div className={className}>
      <Select
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
