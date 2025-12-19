export type OpacityMode = 'solid' | 'simpleAlpha' | 'layeredSurfaces' | 'volumetricDensity';

export interface ShaderConfig {
  dimension: number;
  shadows: boolean;
  temporal: boolean;
  ambientOcclusion: boolean;
  opacityMode: OpacityMode;
  overrides?: string[];
  /** Enable SSS module compilation (conditionally compiled) */
  sss?: boolean;
  /** Enable Fresnel rim lighting module compilation (conditionally compiled) */
  fresnel?: boolean;
  /** Enable Fog integration module compilation (conditionally compiled) */
  fog?: boolean;
  /** Enable Curl noise flow distortion (conditionally compiled) */
  curl?: boolean;
  /** Enable Chromatic dispersion effect (conditionally compiled) */
  dispersion?: boolean;
  /** Enable Nodal surface highlighting (conditionally compiled) */
  nodal?: boolean;
  /** Enable Energy level coloring (conditionally compiled) */
  energyColor?: boolean;
  /** Enable Uncertainty shimmer effect (conditionally compiled) */
  shimmer?: boolean;
  /** Enable Edge erosion effect (conditionally compiled) */
  erosion?: boolean;
}