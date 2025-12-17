import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { DEFAULT_ROOT_SYSTEM_CONFIG } from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React from 'react';

/**
 * Root System settings controls
 *
 * Root systems always have edges enabled (like polytopes).
 * Provides scale control (0.5-2.0) for adjusting the size of the root system.
 */
export function RootSystemSettings() {
  const dimension = useGeometryStore((state) => state.dimension);
  const config = useExtendedObjectStore((state) => state.rootSystem);
  const setRootType = useExtendedObjectStore((state) => state.setRootSystemType);
  const setScale = useExtendedObjectStore((state) => state.setRootSystemScale);

  // Build available root types based on dimension
  const rootTypeOptions = React.useMemo(() => {
    const options: { value: 'A' | 'D' | 'E8'; label: string }[] = [
      { value: 'A', label: `A${dimension - 1} (${dimension * (dimension - 1)} roots)` },
    ];

    // D_n requires n >= 4
    if (dimension >= 4) {
      options.push({
        value: 'D',
        label: `D${dimension} (${2 * dimension * (dimension - 1)} roots)`,
      });
    }

    // E8 requires exactly 8 dimensions
    if (dimension === 8) {
      options.push({ value: 'E8', label: 'E8 (240 roots)' });
    }

    return options;
  }, [dimension]);

  return (
    <div className="space-y-4" data-testid="root-system-settings">
      {/* Root type selection */}
      <Select<'A' | 'D' | 'E8'>
        label="Root System Type"
        options={rootTypeOptions}
        value={config.rootType}
        onChange={setRootType}
        data-testid="root-system-type"
      />

      {/* Scale slider */}
      <Slider
        label="Root System Scale"
        min={0.5}
        max={4.0}
        step={0.1}
        value={config.scale}
        onChange={setScale}
        showValue
        data-testid="root-system-scale"
      />
    </div>
  );
}
