import { getRotationPlanes, getAxisName } from '@/lib/math';

/**
 * Group of rotation planes, organized by dimension or category
 */
export interface PlaneGroup {
  /** Display title for the group */
  title: string;
  /** List of plane names (e.g. "XY", "XW") in this group */
  planes: string[];
  /** Whether the group is expanded by default */
  defaultExpanded: boolean;
  /** Color theme for this group */
  color: string;
}

/**
 * Determines which axis group a plane belongs to based on its name
 * @param planeName
 */
export function getAxisColor(planeName: string): string {
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
 * @param dimension
 */
export function groupPlanesByDimension(dimension: number): PlaneGroup[] {
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
