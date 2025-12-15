/**
 * URL State Serializer
 * Serializes and deserializes app state to/from URL parameters
 *
 * Supports both polytope and extended object types.
 */

import type { ObjectType } from '@/lib/geometry/types';
import type { OpacityMode, SampleQuality, VolumetricAnimationQuality } from '@/lib/opacity/types';
import {
  DEFAULT_OPACITY_MODE,
  DEFAULT_LAYER_COUNT,
  DEFAULT_LAYER_OPACITY,
  DEFAULT_SAMPLE_QUALITY,
  DEFAULT_SIMPLE_ALPHA_OPACITY,
  DEFAULT_VOLUMETRIC_ANIMATION_QUALITY,
  DEFAULT_VOLUMETRIC_DENSITY,
  URL_KEY_LAYER_COUNT,
  URL_KEY_LAYER_OPACITY,
  URL_KEY_OPACITY_MODE,
  URL_KEY_SAMPLE_QUALITY,
  URL_KEY_SIMPLE_ALPHA,
  URL_KEY_VOLUMETRIC_ANIM_QUALITY,
  URL_KEY_VOLUMETRIC_DENSITY,
} from '@/lib/opacity/constants';
import type { ShadowAnimationMode, ShadowQuality } from '@/lib/shadows/types';
import {
  DEFAULT_SHADOW_QUALITY,
  DEFAULT_SHADOW_SOFTNESS,
  DEFAULT_SHADOW_ANIMATION_MODE,
  SHADOW_QUALITY_OPTIONS,
  SHADOW_ANIMATION_MODE_OPTIONS,
  SHADOW_SOFTNESS_RANGE,
  URL_KEY_SHADOW_ENABLED,
  URL_KEY_SHADOW_QUALITY,
  URL_KEY_SHADOW_SOFTNESS,
  URL_KEY_SHADOW_ANIMATION_MODE,
} from '@/lib/shadows/constants';
import type { ShaderType, AllShaderSettings, ToneMappingAlgorithm } from '@/lib/shaders/types';
import { MAX_DIMENSION, MIN_DIMENSION } from '@/stores/geometryStore';
import { DEFAULT_SHADER_TYPE, DEFAULT_SHADER_SETTINGS, DEFAULT_TONE_MAPPING_ALGORITHM, DEFAULT_EXPOSURE, DEFAULT_SPECULAR_COLOR, DEFAULT_DIFFUSE_INTENSITY } from '@/stores/defaults/visualDefaults';

/** Valid shader types for URL validation */
const VALID_SHADER_TYPES: ShaderType[] = [
  'wireframe',
  'surface',
];

/** Legacy shader type for backward compatibility */
const LEGACY_SHADER_TYPE_DUAL_OUTLINE = 'dualOutline';

/** Valid object types for URL validation */
const VALID_OBJECT_TYPES: ObjectType[] = [
  'hypercube',
  'simplex',
  'cross-polytope',
  'root-system',
  'clifford-torus',
  'mandelbrot',
  'mandelbox',
  'menger',
];

export interface ShareableState {
  dimension: number;
  objectType: ObjectType;
  uniformScale?: number;
  // Visual settings (PRD Story 1 AC6, Story 7 AC7)
  shaderType?: ShaderType;
  shaderSettings?: AllShaderSettings;
  edgeColor?: string;
  backgroundColor?: string;
  // Render mode toggles (PRD: Render Mode Toggles)
  edgesVisible?: boolean;
  facesVisible?: boolean;
  // Bloom settings (Dual Filter Bloom)
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  bloomSoftKnee?: number;
  bloomLevels?: number;
  // Enhanced lighting settings
  specularColor?: string;
  toneMappingEnabled?: boolean;
  toneMappingAlgorithm?: ToneMappingAlgorithm;
  exposure?: number;
  diffuseIntensity?: number;
  // Hyperbulb opacity settings
  opacityMode?: OpacityMode;
  simpleAlphaOpacity?: number;
  layerCount?: 2 | 3 | 4;
  layerOpacity?: number;
  volumetricDensity?: number;
  sampleQuality?: SampleQuality;
  volumetricAnimationQuality?: VolumetricAnimationQuality;
  // Shadow settings
  shadowEnabled?: boolean;
  shadowQuality?: ShadowQuality;
  shadowSoftness?: number;
  shadowAnimationMode?: ShadowAnimationMode;
}

/**
 * Serializes state to URL search params
 * @param state
 */
export function serializeState(state: ShareableState): string {
  const params = new URLSearchParams();

  params.set('d', state.dimension.toString());
  params.set('t', state.objectType);

  if (state.uniformScale !== undefined && state.uniformScale !== 1) {
    params.set('s', state.uniformScale.toFixed(2));
  }

  // Visual settings (PRD Story 1 AC6)
  if (state.shaderType && state.shaderType !== DEFAULT_SHADER_TYPE) {
    params.set('sh', state.shaderType);
  }

  if (state.edgeColor) {
    params.set('ec', state.edgeColor.replace('#', ''));
  }

  if (state.backgroundColor) {
    params.set('bg', state.backgroundColor.replace('#', ''));
  }

  // Render mode toggles (PRD: Render Mode Toggles)
  // ev=0 when edges are hidden (omit when true, the default)
  if (state.edgesVisible === false) {
    params.set('ev', '0');
  }

  // fv=1 when faces are visible (omit when false, the default)
  if (state.facesVisible === true) {
    params.set('fv', '1');
  }

  // Bloom settings (Dual Filter Bloom)
  if (state.bloomEnabled === false) {
    params.set('be', '0');
  }

  if (state.bloomIntensity !== undefined && state.bloomIntensity !== 1.60) {
    params.set('bi', state.bloomIntensity.toFixed(2));
  }

  if (state.bloomThreshold !== undefined && state.bloomThreshold !== 0) {
    params.set('bt', state.bloomThreshold.toFixed(2));
  }

  if (state.bloomRadius !== undefined && state.bloomRadius !== 0.65) {
    params.set('br', state.bloomRadius.toFixed(2));
  }

  if (state.bloomSoftKnee !== undefined && state.bloomSoftKnee !== 0) {
    params.set('bk', state.bloomSoftKnee.toFixed(2));
  }

  if (state.bloomLevels !== undefined && state.bloomLevels !== 4) {
    params.set('bl', state.bloomLevels.toString());
  }

  // Enhanced lighting settings (omit defaults for shorter URLs)
  if (state.specularColor && state.specularColor !== DEFAULT_SPECULAR_COLOR) {
    params.set('sc', state.specularColor.replace('#', ''));
  }

  // tm=0 when tone mapping is disabled (omit when true, the default)
  if (state.toneMappingEnabled === false) {
    params.set('tm', '0');
  }

  if (state.toneMappingAlgorithm && state.toneMappingAlgorithm !== DEFAULT_TONE_MAPPING_ALGORITHM) {
    params.set('ta', state.toneMappingAlgorithm);
  }

  if (state.exposure !== undefined && state.exposure !== DEFAULT_EXPOSURE) {
    params.set('ex', state.exposure.toFixed(1));
  }

  if (state.diffuseIntensity !== undefined && state.diffuseIntensity !== DEFAULT_DIFFUSE_INTENSITY) {
    params.set('di', state.diffuseIntensity.toFixed(1));
  }

  // Per-shader settings (PRD Story 7 AC7)
  if (state.shaderSettings && state.shaderType) {
    const settings = state.shaderSettings[state.shaderType];
    if (settings) {
      const defaultSettings = DEFAULT_SHADER_SETTINGS[state.shaderType];
      const settingsParts: string[] = [];

      // Serialize only non-default values
      const settingsObj = settings as unknown as Record<string, unknown>;
      const defaultObj = defaultSettings as unknown as Record<string, unknown>;

      Object.entries(settingsObj).forEach(([key, value]) => {
        const defaultValue = defaultObj[key];
        if (value !== defaultValue) {
          if (typeof value === 'string') {
            // Remove # from colors
            settingsParts.push(`${key}:${value.replace('#', '')}`);
          } else if (typeof value === 'boolean') {
            settingsParts.push(`${key}:${value ? '1' : '0'}`);
          } else {
            settingsParts.push(`${key}:${value}`);
          }
        }
      });

      if (settingsParts.length > 0) {
        params.set('ss', settingsParts.join(','));
      }
    }
  }

  // Hyperbulb opacity settings (only serialize non-default values)
  if (state.opacityMode && state.opacityMode !== DEFAULT_OPACITY_MODE) {
    // Map mode names to compact integers: 1=simpleAlpha, 2=layered, 3=volumetric
    const modeMap: Record<OpacityMode, string> = {
      solid: '0',
      simpleAlpha: '1',
      layeredSurfaces: '2',
      volumetricDensity: '3',
    };
    params.set(URL_KEY_OPACITY_MODE, modeMap[state.opacityMode]);

    // Mode-specific settings
    if (state.opacityMode === 'simpleAlpha') {
      if (state.simpleAlphaOpacity !== undefined && state.simpleAlphaOpacity !== DEFAULT_SIMPLE_ALPHA_OPACITY) {
        params.set(URL_KEY_SIMPLE_ALPHA, state.simpleAlphaOpacity.toFixed(2));
      }
    } else if (state.opacityMode === 'layeredSurfaces') {
      if (state.layerCount !== undefined && state.layerCount !== DEFAULT_LAYER_COUNT) {
        params.set(URL_KEY_LAYER_COUNT, String(state.layerCount));
      }
      if (state.layerOpacity !== undefined && state.layerOpacity !== DEFAULT_LAYER_OPACITY) {
        params.set(URL_KEY_LAYER_OPACITY, state.layerOpacity.toFixed(2));
      }
    } else if (state.opacityMode === 'volumetricDensity') {
      if (state.volumetricDensity !== undefined && state.volumetricDensity !== DEFAULT_VOLUMETRIC_DENSITY) {
        params.set(URL_KEY_VOLUMETRIC_DENSITY, state.volumetricDensity.toFixed(2));
      }
      if (state.sampleQuality && state.sampleQuality !== DEFAULT_SAMPLE_QUALITY) {
        const sqMap: Record<SampleQuality, string> = { low: '0', medium: '1', high: '2' };
        params.set(URL_KEY_SAMPLE_QUALITY, sqMap[state.sampleQuality]);
      }
      if (state.volumetricAnimationQuality && state.volumetricAnimationQuality !== DEFAULT_VOLUMETRIC_ANIMATION_QUALITY) {
        const vaqMap: Record<VolumetricAnimationQuality, string> = { reduce: '0', full: '1' };
        params.set(URL_KEY_VOLUMETRIC_ANIM_QUALITY, vaqMap[state.volumetricAnimationQuality]);
      }
    }
  }

  // Shadow settings (omit defaults for shorter URLs)
  if (state.shadowEnabled === true) {
    params.set(URL_KEY_SHADOW_ENABLED, '1');
  }
  if (state.shadowQuality && state.shadowQuality !== DEFAULT_SHADOW_QUALITY) {
    params.set(URL_KEY_SHADOW_QUALITY, state.shadowQuality);
  }
  if (state.shadowSoftness !== undefined && state.shadowSoftness !== DEFAULT_SHADOW_SOFTNESS) {
    params.set(URL_KEY_SHADOW_SOFTNESS, state.shadowSoftness.toFixed(1));
  }
  if (state.shadowAnimationMode && state.shadowAnimationMode !== DEFAULT_SHADOW_ANIMATION_MODE) {
    params.set(URL_KEY_SHADOW_ANIMATION_MODE, state.shadowAnimationMode);
  }

  return params.toString();
}

/**
 * Deserializes state from URL search params
 * @param searchParams
 */
export function deserializeState(searchParams: string): Partial<ShareableState> {
  const params = new URLSearchParams(searchParams);
  const state: Partial<ShareableState> = {};

  const dimension = params.get('d');
  if (dimension) {
    const dim = parseInt(dimension, 10);
    if (dim >= MIN_DIMENSION && dim <= MAX_DIMENSION) {
      state.dimension = dim;
    }
  }

  const objectType = params.get('t');
  if (objectType && VALID_OBJECT_TYPES.includes(objectType as ObjectType)) {
    state.objectType = objectType as ObjectType;
  }

  // Note: 'pd' (projectionDistance) is no longer used but we ignore it for backward compatibility

  const uniformScale = params.get('s');
  if (uniformScale) {
    const s = parseFloat(uniformScale);
    if (!isNaN(s) && s > 0) {
      state.uniformScale = s;
    }
  }

  // Visual settings (PRD Story 1 AC6)
  const shaderType = params.get('sh');
  if (shaderType) {
    if (VALID_SHADER_TYPES.includes(shaderType as ShaderType)) {
      state.shaderType = shaderType as ShaderType;
    } else if (shaderType === LEGACY_SHADER_TYPE_DUAL_OUTLINE) {
      // Backward compatibility: map dualOutline to wireframe
      state.shaderType = 'wireframe';
    }
  }

  const edgeColor = params.get('ec');
  if (edgeColor && /^[0-9A-Fa-f]{6}$/.test(edgeColor)) {
    state.edgeColor = `#${edgeColor}`;
  }

  const backgroundColor = params.get('bg');
  if (backgroundColor && /^[0-9A-Fa-f]{6}$/.test(backgroundColor)) {
    state.backgroundColor = `#${backgroundColor}`;
  }

  // Render mode toggles (PRD: Render Mode Toggles)
  const edgesVisible = params.get('ev');
  if (edgesVisible === '0') {
    state.edgesVisible = false;
  } else if (edgesVisible === '1') {
    state.edgesVisible = true;
  }

  const facesVisible = params.get('fv');
  if (facesVisible === '1') {
    state.facesVisible = true;
  } else if (facesVisible === '0') {
    state.facesVisible = false;
  }

  // Bloom settings (Dual Filter Bloom)
  const bloomEnabled = params.get('be');
  if (bloomEnabled === '0') {
    state.bloomEnabled = false;
  } else if (bloomEnabled === '1') {
    state.bloomEnabled = true;
  }

  const bloomIntensity = params.get('bi');
  if (bloomIntensity) {
    const bi = parseFloat(bloomIntensity);
    if (!isNaN(bi) && bi >= 0 && bi <= 2) {
      state.bloomIntensity = bi;
    }
  }

  const bloomThreshold = params.get('bt');
  if (bloomThreshold) {
    const bt = parseFloat(bloomThreshold);
    if (!isNaN(bt) && bt >= 0 && bt <= 1) {
      state.bloomThreshold = bt;
    }
  }

  const bloomRadius = params.get('br');
  if (bloomRadius) {
    const br = parseFloat(bloomRadius);
    if (!isNaN(br) && br >= 0 && br <= 1) {
      state.bloomRadius = br;
    }
  }

  const bloomSoftKnee = params.get('bk');
  if (bloomSoftKnee) {
    const bk = parseFloat(bloomSoftKnee);
    if (!isNaN(bk) && bk >= 0 && bk <= 1) {
      state.bloomSoftKnee = bk;
    }
  }

  const bloomLevels = params.get('bl');
  if (bloomLevels) {
    const bl = parseInt(bloomLevels, 10);
    if (!isNaN(bl) && bl >= 1 && bl <= 8) {
      state.bloomLevels = bl;
    }
  }

  // Enhanced lighting settings
  const specularColor = params.get('sc');
  if (specularColor && /^[0-9A-Fa-f]{6}$/.test(specularColor)) {
    state.specularColor = `#${specularColor}`;
  }

  const toneMappingEnabled = params.get('tm');
  if (toneMappingEnabled === '0') {
    state.toneMappingEnabled = false;
  } else if (toneMappingEnabled === '1') {
    state.toneMappingEnabled = true;
  }

  const toneMappingAlgorithm = params.get('ta');
  if (toneMappingAlgorithm) {
    const validAlgorithms: ToneMappingAlgorithm[] = ['none', 'linear', 'reinhard', 'cineon', 'aces', 'agx', 'neutral'];
    if (validAlgorithms.includes(toneMappingAlgorithm as ToneMappingAlgorithm)) {
      state.toneMappingAlgorithm = toneMappingAlgorithm as ToneMappingAlgorithm;
    }
  }

  const exposure = params.get('ex');
  if (exposure) {
    const ex = parseFloat(exposure);
    if (!isNaN(ex) && ex >= 0.1 && ex <= 3) {
      state.exposure = ex;
    }
  }

  const diffuseIntensity = params.get('di');
  if (diffuseIntensity) {
    const di = parseFloat(diffuseIntensity);
    if (!isNaN(di) && di >= 0 && di <= 2) {
      state.diffuseIntensity = di;
    }
  }

  // Per-shader settings (PRD Story 7 AC7)
  const shaderSettingsStr = params.get('ss');
  if (shaderSettingsStr && state.shaderType) {
    const shaderSettings: AllShaderSettings = {
      wireframe: { ...DEFAULT_SHADER_SETTINGS.wireframe },
      surface: { ...DEFAULT_SHADER_SETTINGS.surface },
    };
    const currentSettings = shaderSettings[state.shaderType] as unknown as Record<string, unknown>;
    const defaultObj = DEFAULT_SHADER_SETTINGS[state.shaderType] as unknown as Record<string, unknown>;

    shaderSettingsStr.split(',').forEach((pair) => {
      const [key, value] = pair.split(':');
      if (key && value) {
        // Determine the type based on the default settings
        const defaultValue = defaultObj[key];
        if (defaultValue !== undefined) {
          if (typeof defaultValue === 'string') {
            // Re-add # prefix to colors and validate
            const colorVal = value.startsWith('#') ? value : `#${value}`;
            if (/^#[0-9A-Fa-f]{6}$/.test(colorVal)) {
              currentSettings[key] = colorVal;
            }
          } else if (typeof defaultValue === 'boolean') {
            currentSettings[key] = value === '1';
          } else if (typeof defaultValue === 'number') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              currentSettings[key] = numValue;
            }
          }
        }
      }
    });

    state.shaderSettings = shaderSettings;
  }

  // Hyperbulb opacity settings
  const opacityModeStr = params.get(URL_KEY_OPACITY_MODE);
  if (opacityModeStr) {
    const modeMap: Record<string, OpacityMode> = {
      '0': 'solid',
      '1': 'simpleAlpha',
      '2': 'layeredSurfaces',
      '3': 'volumetricDensity',
    };
    const mode = modeMap[opacityModeStr];
    if (mode) {
      state.opacityMode = mode;

      // Parse mode-specific settings
      if (mode === 'simpleAlpha') {
        const sao = params.get(URL_KEY_SIMPLE_ALPHA);
        if (sao) {
          const value = parseFloat(sao);
          if (!isNaN(value) && value >= 0 && value <= 1) {
            state.simpleAlphaOpacity = value;
          }
        }
      } else if (mode === 'layeredSurfaces') {
        const lc = params.get(URL_KEY_LAYER_COUNT);
        if (lc) {
          const value = parseInt(lc, 10);
          if (value === 2 || value === 3 || value === 4) {
            state.layerCount = value;
          }
        }
        const lo = params.get(URL_KEY_LAYER_OPACITY);
        if (lo) {
          const value = parseFloat(lo);
          if (!isNaN(value) && value >= 0.1 && value <= 0.9) {
            state.layerOpacity = value;
          }
        }
      } else if (mode === 'volumetricDensity') {
        const vd = params.get(URL_KEY_VOLUMETRIC_DENSITY);
        if (vd) {
          const value = parseFloat(vd);
          if (!isNaN(value) && value >= 0.1 && value <= 2.0) {
            state.volumetricDensity = value;
          }
        }
        const sq = params.get(URL_KEY_SAMPLE_QUALITY);
        if (sq) {
          const sqMap: Record<string, SampleQuality> = { '0': 'low', '1': 'medium', '2': 'high' };
          if (sqMap[sq]) {
            state.sampleQuality = sqMap[sq];
          }
        }
        const vaq = params.get(URL_KEY_VOLUMETRIC_ANIM_QUALITY);
        if (vaq) {
          const vaqMap: Record<string, VolumetricAnimationQuality> = { '0': 'reduce', '1': 'full' };
          if (vaqMap[vaq]) {
            state.volumetricAnimationQuality = vaqMap[vaq];
          }
        }
      }
    }
  }

  // Shadow settings
  const shadowEnabled = params.get(URL_KEY_SHADOW_ENABLED);
  if (shadowEnabled === '1') {
    state.shadowEnabled = true;
  } else if (shadowEnabled === '0') {
    state.shadowEnabled = false;
  }

  const shadowQuality = params.get(URL_KEY_SHADOW_QUALITY);
  if (shadowQuality) {
    if (SHADOW_QUALITY_OPTIONS.includes(shadowQuality as ShadowQuality)) {
      state.shadowQuality = shadowQuality as ShadowQuality;
    } else {
      // Invalid quality param = disable shadows (PRD AC: invalid defaults to OFF)
      state.shadowEnabled = false;
    }
  }

  const shadowSoftness = params.get(URL_KEY_SHADOW_SOFTNESS);
  if (shadowSoftness) {
    const softness = parseFloat(shadowSoftness);
    if (!isNaN(softness) && softness >= SHADOW_SOFTNESS_RANGE.min && softness <= SHADOW_SOFTNESS_RANGE.max) {
      state.shadowSoftness = softness;
    }
  }

  const shadowAnimationMode = params.get(URL_KEY_SHADOW_ANIMATION_MODE);
  if (shadowAnimationMode) {
    if (SHADOW_ANIMATION_MODE_OPTIONS.includes(shadowAnimationMode as ShadowAnimationMode)) {
      state.shadowAnimationMode = shadowAnimationMode as ShadowAnimationMode;
    }
  }

  return state;
}

/**
 * Generates a shareable URL with current state
 * @param state
 */
export function generateShareUrl(state: ShareableState): string {
  const serialized = serializeState(state);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return serialized ? `${baseUrl}?${serialized}` : baseUrl;
}

/**
 * Parses the current URL to extract state
 */
export function parseCurrentUrl(): Partial<ShareableState> {
  if (typeof window === 'undefined') {
    return {};
  }
  return deserializeState(window.location.search);
}
