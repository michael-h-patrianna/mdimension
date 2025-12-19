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
}