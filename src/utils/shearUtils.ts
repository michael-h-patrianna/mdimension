import { getRotationPlanes } from '@/lib/math';

export interface ShearPlaneGroup {
  title: string;
  planes: string[];
}

/**
 * Get shear plane groups for display, organized by dimension
 * @param dimension
 */
export function getShearPlaneGroups(dimension: number): ShearPlaneGroup[] {
  const planes = getRotationPlanes(dimension);
  const groups: ShearPlaneGroup[] = [];

  // 3D shears (XY, XZ, YZ)
  const planes3D = planes
    .filter(
      (p) =>
        !p.name.includes('W') &&
        !p.name.includes('V') &&
        !p.name.includes('U') &&
        !p.name.includes('A')
    )
    .map((p) => p.name);

  if (planes3D.length > 0) {
    groups.push({ title: '3D Shears', planes: planes3D });
  }

  // 4D shears (W-axis)
  if (dimension >= 4) {
    const planesW = planes
      .filter(
        (p) =>
          p.name.includes('W') &&
          !p.name.includes('V') &&
          !p.name.includes('U')
      )
      .map((p) => p.name);

    if (planesW.length > 0) {
      groups.push({ title: '4th Dimension (W)', planes: planesW });
    }
  }

  // 5D shears (V-axis)
  if (dimension >= 5) {
    const planesV = planes
      .filter((p) => p.name.includes('V') && !p.name.includes('U'))
      .map((p) => p.name);

    if (planesV.length > 0) {
      groups.push({ title: '5th Dimension (V)', planes: planesV });
    }
  }

  // 6D shears (U-axis)
  if (dimension >= 6) {
    const planesU = planes.filter((p) => p.name.includes('U')).map((p) => p.name);

    if (planesU.length > 0) {
      groups.push({ title: '6th Dimension (U)', planes: planesU });
    }
  }

  // 7D+ shears (A-axis)
  if (dimension >= 7) {
    const planesA = planes.filter((p) => p.name.includes('A')).map((p) => p.name);
    if (planesA.length > 0) {
       groups.push({ title: 'High Dimensions', planes: planesA });
    }
  }

  return groups;
}
