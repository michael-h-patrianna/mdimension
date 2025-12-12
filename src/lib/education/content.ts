/**
 * Educational Content
 * Information about n-dimensional geometry
 */

export interface EducationTopic {
  id: string
  title: string
  description: string
  details: string[]
}

export interface DimensionInfo {
  dimension: number
  name: string
  description: string
  examples: string[]
  properties: string[]
}

export const DIMENSION_INFO: Record<number, DimensionInfo> = {
  3: {
    dimension: 3,
    name: '3D Space',
    description: 'Three-dimensional space is the familiar physical space we inhabit.',
    examples: [
      'A cube has 8 vertices, 12 edges, and 6 faces',
      'We navigate 3D space using x, y, and z coordinates',
      'Objects can rotate around 3 axes (pitch, yaw, roll)',
    ],
    properties: [
      '3 perpendicular axes',
      '3 rotation planes (XY, XZ, YZ)',
      'Volume is measured in cubic units',
    ],
  },
  4: {
    dimension: 4,
    name: '4D Space',
    description:
      'Four-dimensional space extends 3D space with an additional perpendicular direction, often called W.',
    examples: [
      'A tesseract (4D hypercube) has 16 vertices, 32 edges, 24 faces, and 8 cells',
      'The 4th dimension is perpendicular to all 3D directions',
      'We can only see 3D "shadows" of 4D objects',
    ],
    properties: [
      '4 perpendicular axes (X, Y, Z, W)',
      '6 rotation planes (XY, XZ, XW, YZ, YW, ZW)',
      'Hypervolume is measured in 4D units',
    ],
  },
  5: {
    dimension: 5,
    name: '5D Space',
    description: 'Five-dimensional space adds a fifth perpendicular direction, often called V.',
    examples: [
      'A 5D hypercube (penteract) has 32 vertices',
      '10 rotation planes exist in 5D',
      'Each 4D "cell" becomes a 5D "teron"',
    ],
    properties: [
      '5 perpendicular axes (X, Y, Z, W, V)',
      '10 rotation planes',
      'Much harder to visualize than 4D',
    ],
  },
  6: {
    dimension: 6,
    name: '6D Space',
    description: 'Six-dimensional space extends into a sixth perpendicular direction.',
    examples: [
      'A 6D hypercube (hexeract) has 64 vertices',
      '15 rotation planes exist in 6D',
      'String theory uses 6 extra compact dimensions',
    ],
    properties: [
      '6 perpendicular axes',
      '15 rotation planes',
      'Used in theoretical physics models',
    ],
  },
}

export const POLYTOPE_INFO: Record<string, EducationTopic> = {
  hypercube: {
    id: 'hypercube',
    title: 'Hypercube',
    description: 'The n-dimensional analog of a cube. Each vertex has n perpendicular edges.',
    details: [
      'In 3D: Cube (8 vertices, 12 edges, 6 faces)',
      'In 4D: Tesseract (16 vertices, 32 edges, 24 faces, 8 cells)',
      'In 5D: Penteract (32 vertices)',
      'Formed by moving a (n-1)-cube perpendicular to itself',
    ],
  },
  simplex: {
    id: 'simplex',
    title: 'Simplex',
    description:
      'The simplest polytope in n dimensions. Has n+1 vertices, all mutually equidistant.',
    details: [
      'In 2D: Triangle (3 vertices)',
      'In 3D: Tetrahedron (4 vertices)',
      'In 4D: 5-cell/Pentachoron (5 vertices)',
      'Every vertex is connected to every other vertex',
    ],
  },
  'cross-polytope': {
    id: 'cross-polytope',
    title: 'Cross-Polytope',
    description:
      'The n-dimensional analog of an octahedron. Has 2n vertices arranged along the axes.',
    details: [
      'In 2D: Square (4 vertices)',
      'In 3D: Octahedron (6 vertices)',
      'In 4D: 16-cell (8 vertices)',
      'Vertices placed at +1 and -1 on each axis',
    ],
  },
}

export const PROJECTION_INFO: EducationTopic = {
  id: 'projection',
  title: 'Projection',
  description:
    'Projection reduces higher-dimensional objects to lower dimensions for visualization.',
  details: [
    'Perspective projection: objects farther away appear smaller',
    'Orthographic projection: parallel lines stay parallel',
    'We project 4D→3D, then 3D→2D for screen display',
    'Projection distance affects how "spread out" the object appears',
  ],
}

export const ROTATION_INFO: EducationTopic = {
  id: 'rotation',
  title: 'Rotation',
  description: 'In n dimensions, rotations occur in planes, not around axes.',
  details: [
    'In 3D: 3 rotation planes (XY, XZ, YZ)',
    'In 4D: 6 rotation planes include XW, YW, ZW',
    'Each plane rotates two coordinates while others stay fixed',
  ],
}

/**
 *
 * @param dimension
 */
export function getDimensionInfo(dimension: number): DimensionInfo | undefined {
  return DIMENSION_INFO[dimension]
}

/**
 *
 * @param type
 */
export function getPolytopeInfo(type: string): EducationTopic | undefined {
  return POLYTOPE_INFO[type]
}

/**
 *
 * @param dimension
 */
export function getRotationPlaneCount(dimension: number): number {
  // Formula: n*(n-1)/2
  return (dimension * (dimension - 1)) / 2
}

/**
 *
 * @param dimension
 */
export function getHypercubeVertexCount(dimension: number): number {
  return Math.pow(2, dimension)
}

/**
 *
 * @param dimension
 */
export function getSimplexVertexCount(dimension: number): number {
  return dimension + 1
}

/**
 *
 * @param dimension
 */
export function getCrossPolytopeVertexCount(dimension: number): number {
  return 2 * dimension
}
