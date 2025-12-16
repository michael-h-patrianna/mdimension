export type SkyboxMode =
  | 'classic'
  | 'aurora'
  | 'nebula'
  | 'void'
  | 'crystalline'
  | 'horizon'
  | 'ocean'
  | 'twilight'
  | 'starfield';

export interface SkyboxEffects {
  atmosphere: boolean;
  sun: boolean;
  vignette: boolean;
  grain: boolean;
  aberration: boolean;
}

export interface SkyboxShaderConfig {
  mode: SkyboxMode;
  effects: SkyboxEffects;
  parallax?: boolean;
  overrides?: string[];
}
