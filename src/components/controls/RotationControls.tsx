/**
 * Rotation Controls Panel
 * Provides UI for controlling rotations in all available planes
 */

import { useState, useCallback, useMemo } from 'react';
import { useRotationStore } from '@/stores';
import { getRotationPlanes, getAxisName } from '@/lib/math';
import { RotationSlider } from './RotationSlider';

interface PlaneGroup {
  title: string;
  planes: string[];
  defaultExpanded: boolean;
  color: string;
}

/**
 * Determines which axis group a plane belongs to based on its name
 */
function getAxisColor(planeName: string): string {
  // 3D planes (XY, XZ, YZ): blue
  if (planeName.length === 2 && !planeName.includes('W') && !planeName.includes('V') && !planeName.includes('U')) {
    return 'blue';
  }
  
  // High dimensions - cycle through colors
  if (planeName.includes('W')) return 'purple';
  if (planeName.includes('V')) return 'orange';
  if (planeName.includes('U')) return 'green';
  
  // For A6+ (7D+), cycle colors or use a default
  // Just simple heuristic based on the last character or presence of 'A'
  if (planeName.includes('A')) return 'pink';
  
  return 'blue';
}

/**
 * Groups rotation planes by dimension level
 */
function groupPlanesByDimension(dimension: number): PlaneGroup[] {
  const planes = getRotationPlanes(dimension);
  const groups: PlaneGroup[] = [];

  // 1. Group 3D rotations (indices 0, 1, 2 only)
  // These are planes where both indices are < 3.
  const planes3D = planes
    .filter((p) => Math.max(...p.indices) < 3)
    .map((p) => p.name);

  if (planes3D.length > 0) {
    groups.push({
      title: '3D Rotations',
      planes: planes3D,
      defaultExpanded: true,
      color: 'blue',
    });
  }

  // 2. Group higher dimensions (4D+)
  // For each dimension d from 4 up to current dimension:
  // The new axis is at index d-1.
  // We collect planes where the highest index IS d-1.
  for (let d = 4; d <= dimension; d++) {
    const axisIndex = d - 1;
    const axisName = getAxisName(axisIndex);
    
    const planesForDim = planes
      .filter((p) => Math.max(...p.indices) === axisIndex)
      .map((p) => p.name);

    if (planesForDim.length > 0) {
      // Determine color
      let color = 'gray';
      if (axisName === 'W') color = 'purple';
      else if (axisName === 'V') color = 'orange';
      else if (axisName === 'U') color = 'green';
      else color = 'pink'; // 7D+

      groups.push({
        title: `${d}th Dimension (${axisName})`,
        planes: planesForDim,
        defaultExpanded: false,
        color,
      });
    }
  }

  return groups;
}

export function RotationControls() {
  const dimension = useRotationStore((state) => state.dimension);
  const rotations = useRotationStore((state) => state.rotations);
  const setRotation = useRotationStore((state) => state.setRotation);
  const resetRotation = useRotationStore((state) => state.resetRotation);
  const resetAllRotations = useRotationStore((state) => state.resetAllRotations);

  const planeGroups = useMemo(() => groupPlanesByDimension(dimension), [dimension]);

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Re-calculating initial expanded based on current logic is tricky if we want persistence across re-renders
    // but the previous code just did this once on mount.
    // However, since planeGroups changes with dimension, we might want to update this?
    // The previous code initialized state once.
    // Let's stick to simple init for "3D Rotations" usually.
    return new Set(['3D Rotations']);
  });

  // Effect to ensure new groups might be handled or keep 3D open. 
  // Actually, standard behavior is fine. User opens what they want.

  const toggleGroup = useCallback((groupTitle: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupTitle)) {
        next.delete(groupTitle);
      } else {
        next.add(groupTitle);
      }
      return next;
    });
  }, []);

  const handleRotationChange = useCallback(
    (plane: string, value: number) => {
      setRotation(plane, value);
    },
    [setRotation]
  );

  const handleRotationReset = useCallback(
    (plane: string) => {
      resetRotation(plane);
    },
    [resetRotation]
  );

  return (
    <div className="p-4 bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Rotation Controls</h2>
        <button
          onClick={resetAllRotations}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
        >
          Reset All
        </button>
      </div>

      {/* Rotation plane groups */}
      <div className="space-y-3">
        {planeGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.title);

          return (
            <div key={group.title} className="bg-gray-800 rounded-lg overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full px-4 py-2 flex items-center justify-between bg-gray-750 hover:bg-gray-700 transition-colors"
              >
                <span className="font-semibold text-white">{group.title}</span>
                <span className="text-gray-400">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Group content */}
              {isExpanded && (
                <div className="px-4 py-2 space-y-1">
                  {group.planes.map((plane) => (
                    <RotationSlider
                      key={plane}
                      plane={plane}
                      value={rotations.get(plane) ?? 0}
                      onChange={(value) => handleRotationChange(plane, value)}
                      onReset={() => handleRotationReset(plane)}
                      axisBadgeColor={getAxisColor(plane)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
