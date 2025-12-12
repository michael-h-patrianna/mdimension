/**
 * Rotation Controls Panel
 * Provides UI for controlling rotations in all available planes
 */

import { useState, useCallback, useMemo } from 'react';
import { useRotationStore } from '@/stores';
import { RotationSlider } from './RotationSlider';
import { groupPlanesByDimension, getAxisColor } from '@/utils/rotationUtils';

const STYLES = {
  container: "p-4 bg-panel-bg rounded-lg shadow-lg",
  header: "flex items-center justify-between mb-4",
  title: "text-xl font-bold text-text-primary",
  resetButton: "px-3 py-1 bg-accent/20 hover:bg-accent/30 text-accent text-sm rounded border border-accent/50 transition-colors",
  groupsContainer: "space-y-3",
  group: "bg-panel-border rounded-lg overflow-hidden",
  groupHeader: "w-full px-4 py-2 flex items-center justify-between bg-black/20 hover:bg-black/30 transition-colors",
  groupTitle: "font-semibold text-text-primary",
  groupIcon: "text-text-secondary",
  groupContent: "px-4 py-2 space-y-1"
} as const;

/**
 * Main component for controlling object rotations in N-dimensional space.
 * 
 * Groups rotation sliders by the dimension they affect (3D, 4D, etc.).
 * Allows resetting individual rotations or all rotations at once.
 */
export function RotationControls() {
  const dimension = useRotationStore((state) => state.dimension);
  const rotations = useRotationStore((state) => state.rotations);
  const setRotation = useRotationStore((state) => state.setRotation);
  const resetRotation = useRotationStore((state) => state.resetRotation);
  const resetAllRotations = useRotationStore((state) => state.resetAllRotations);

  const planeGroups = useMemo(() => groupPlanesByDimension(dimension), [dimension]);

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    return new Set(['3D Rotations']);
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
    <div className={STYLES.container}>
      {/* Header */}
      <div className={STYLES.header}>
        <h2 className={STYLES.title}>Rotation Controls</h2>
        <button
          onClick={resetAllRotations}
          className={STYLES.resetButton}
        >
          Reset All
        </button>
      </div>

      {/* Rotation plane groups */}
      <div className={STYLES.groupsContainer}>
        {planeGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.title);

          return (
            <div key={group.title} className={STYLES.group}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.title)}
                className={STYLES.groupHeader}
              >
                <span className={STYLES.groupTitle}>{group.title}</span>
                <span className={STYLES.groupIcon}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Group content */}
              {isExpanded && (
                <div className={STYLES.groupContent}>
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