export type OpacityMode = 'solid' | 'simpleAlpha' | 'layeredSurfaces' | 'volumetricDensity';

export interface ShaderConfig {
  dimension: number;
  shadows: boolean;
  temporal: boolean;
  ambientOcclusion: boolean;
  opacityMode: OpacityMode;
  overrides?: string[];
  // Future: lighting, normals, etc.
}