/**
 * Rotation Controls Panel
 * Provides UI for controlling rotations in all available planes
 */

import { useState, useCallback, useMemo } from 'react';
import { useRotationStore } from '@/stores';
import { getRotationPlanes } from '@/lib/math';
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
  // W-axis planes (XW, YW, ZW): purple
  if (planeName.includes('W')) {
    return 'purple';
  }
  // V-axis planes (XV, YV, ZV, WV): orange
  if (planeName.includes('V')) {
    return 'orange';
  }
  // U-axis planes: green
  if (planeName.includes('U')) {
    return 'green';
  }
  return 'blue';
}

/**
 * Groups rotation planes by dimension level
 */
function groupPlanesByDimension(dimension: number): PlaneGroup[] {
  const planes = getRotationPlanes(dimension);
  const groups: PlaneGroup[] = [];

  // 3D rotations (XY, XZ, YZ)
  const plane3D = planes
    .filter((p) => {
      const name = p.name;
      return (
        !name.includes('W') &&
        !name.includes('V') &&
        !name.includes('U') &&
        name.match(/^[XYZ]{2}$/)
      );
    })
    .map((p) => p.name);

  if (plane3D.length > 0) {
    groups.push({
      title: '3D Rotations',
      planes: plane3D,
      defaultExpanded: true,
      color: 'blue',
    });
  }

  // 4th dimension (W-axis)
  if (dimension >= 4) {
    const planesW = planes
      .filter((p) => p.name.includes('W') && !p.name.includes('V') && !p.name.includes('U'))
      .map((p) => p.name);

    if (planesW.length > 0) {
      groups.push({
        title: '4th Dimension (W)',
        planes: planesW,
        defaultExpanded: false,
        color: 'purple',
      });
    }
  }

  // 5th dimension (V-axis)
  if (dimension >= 5) {
    const planesV = planes
      .filter((p) => p.name.includes('V') && !p.name.includes('U'))
      .map((p) => p.name);

    if (planesV.length > 0) {
      groups.push({
        title: '5th Dimension (V)',
        planes: planesV,
        defaultExpanded: false,
        color: 'orange',
      });
    }
  }

  // 6th dimension (U-axis)
  if (dimension >= 6) {
    const planesU = planes
      .filter((p) => p.name.includes('U'))
      .map((p) => p.name);

    if (planesU.length > 0) {
      groups.push({
        title: '6th Dimension (U)',
        planes: planesU,
        defaultExpanded: false,
        color: 'green',
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
    const initialExpanded = new Set<string>();
    planeGroups.forEach((group) => {
      if (group.defaultExpanded) {
        initialExpanded.add(group.title);
      }
    });
    return initialExpanded;
  });

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
