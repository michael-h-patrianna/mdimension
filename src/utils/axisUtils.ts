/**
 * Utility functions for parsing axis names.
 */

const AXIS_NAMES = ['X', 'Y', 'Z', 'W', 'V', 'U'];

/**
 * Parses an axis name into its index.
 * Supports standard names (X, Y, Z, W, V, U) and indexed names (A0, A1, etc.).
 *
 * @param name - The axis name to parse.
 * @returns The axis index, or -1 if invalid.
 */
export const parseAxisName = (name: string): number => {
  const idx = AXIS_NAMES.indexOf(name);
  if (idx !== -1) return idx;
  if (name.startsWith('A')) {
    const num = parseInt(name.slice(1), 10);
    if (!isNaN(num)) return num;
  }
  return -1;
};

/**
 * Parses a shear plane string (e.g., "XY", "A0A1") into two axis indices.
 *
 * @param plane - The plane string.
 * @param dimension - The current dimension (for validation).
 * @returns Tuple of [axis1, axis2] or null if invalid.
 */
export const parseShearPlane = (plane: string, dimension: number): [number, number] | null => {
  // Regex to match two axis names.
  // This matches "XY", "XZ", "A1A2", "XA1", etc.
  // It assumes axes are either single letters (A-Z except A followed by digit) or A followed by digits.
  // Actually, the original code used `parts = plane.match(/[A-Z][0-9]* /g)`.
  // Let's stick to a robust regex.
  const parts = plane.match(/[A-Z][0-9]*/g);
  if (parts && parts.length === 2 && parts[0] && parts[1]) {
    const axis1 = parseAxisName(parts[0]);
    const axis2 = parseAxisName(parts[1]);
    if (axis1 >= 0 && axis1 < dimension && axis2 >= 0 && axis2 < dimension) {
      return [axis1, axis2];
    }
  }
  return null;
};
