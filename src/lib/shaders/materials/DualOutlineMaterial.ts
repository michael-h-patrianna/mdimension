/**
 * Dual Outline Material for Edge Rendering
 *
 * Creates Three.js materials for rendering edges with a double-line effect.
 * Renders an inner and outer line with configurable gap between them.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import { ShaderMaterial, Color, DoubleSide } from 'three';
import type { DualOutlineSettings } from '../types';

/**
 * Configuration for dual outline material creation
 */
export interface DualOutlineMaterialConfig extends DualOutlineSettings {
  /** Base edge opacity (0-1) */
  opacity?: number;
}

/**
 * GLSL vertex shader for dual outline inner line.
 */
const dualOutlineVertexShader = `
varying vec3 vPosition;
varying vec3 vViewPosition;

void main() {
  vPosition = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * GLSL fragment shader for dual outline inner line.
 */
const innerLineFragmentShader = `
uniform vec3 lineColor;
uniform float opacity;

void main() {
  gl_FragColor = vec4(lineColor, opacity);
}
`;

/**
 * GLSL vertex shader for dual outline outer line.
 * Expands the line outward based on gap setting.
 */
const outerLineVertexShader = `
uniform float lineGap;
attribute vec3 lineNormal;
varying vec3 vPosition;

void main() {
  // Expand position outward along the line normal
  vec3 expandedPos = position + lineNormal * lineGap * 0.01;
  vPosition = expandedPos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(expandedPos, 1.0);
}
`;

/**
 * GLSL fragment shader for dual outline outer line.
 */
const outerLineFragmentShader = `
uniform vec3 lineColor;
uniform float opacity;

void main() {
  gl_FragColor = vec4(lineColor, opacity);
}
`;

/**
 * Create a dual outline material for the inner line.
 *
 * @param config - Material configuration
 * @returns ShaderMaterial instance for inner line rendering
 *
 * @example
 * ```ts
 * const innerMaterial = createDualOutlineInnerMaterial({
 *   innerColor: '#FFFFFF',
 *   outerColor: '#00FFFF',
 *   gap: 2,
 * });
 * ```
 */
export function createDualOutlineInnerMaterial(
  config: DualOutlineMaterialConfig
): ShaderMaterial {
  const { innerColor, opacity = 1.0 } = config;

  return new ShaderMaterial({
    vertexShader: dualOutlineVertexShader,
    fragmentShader: innerLineFragmentShader,
    uniforms: {
      lineColor: { value: new Color(innerColor) },
      opacity: { value: opacity },
    },
    transparent: true,
    side: DoubleSide,
    depthWrite: true,
  });
}

/**
 * Create a dual outline material for the outer line.
 *
 * This material should be rendered first (before inner line) and uses
 * a custom vertex shader that expands the line outward.
 *
 * @param config - Material configuration
 * @returns ShaderMaterial instance for outer line rendering
 *
 * @remarks
 * The outer line requires a custom 'lineNormal' attribute on the geometry
 * to know which direction to expand. For simple use cases, use
 * createSimpleDualOutlineMaterial instead.
 */
export function createDualOutlineOuterMaterial(
  config: DualOutlineMaterialConfig
): ShaderMaterial {
  const { outerColor, gap, opacity = 1.0 } = config;

  return new ShaderMaterial({
    vertexShader: outerLineVertexShader,
    fragmentShader: outerLineFragmentShader,
    uniforms: {
      lineColor: { value: new Color(outerColor) },
      lineGap: { value: gap },
      opacity: { value: opacity },
    },
    transparent: true,
    side: DoubleSide,
    depthWrite: true,
  });
}

/**
 * Simple vertex shader for dual outline without custom attributes.
 * Uses a scale transform to create the offset effect.
 */
const simpleOuterVertexShader = `
uniform float lineGap;
varying vec3 vPosition;

void main() {
  // Scale position slightly to create offset effect
  float scale = 1.0 + lineGap * 0.02;
  vec3 scaledPos = position * scale;
  vPosition = scaledPos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(scaledPos, 1.0);
}
`;

/**
 * Create a simple dual outline material for the outer line.
 *
 * This version uses a scale transform instead of custom attributes,
 * making it easier to use with existing geometries.
 *
 * @param config - Material configuration
 * @returns ShaderMaterial instance
 */
export function createSimpleDualOutlineOuterMaterial(
  config: DualOutlineMaterialConfig
): ShaderMaterial {
  const { outerColor, gap, opacity = 1.0 } = config;

  return new ShaderMaterial({
    vertexShader: simpleOuterVertexShader,
    fragmentShader: outerLineFragmentShader,
    uniforms: {
      lineColor: { value: new Color(outerColor) },
      lineGap: { value: gap },
      opacity: { value: opacity * 0.7 }, // Slightly more transparent for outer line
    },
    transparent: true,
    side: DoubleSide,
    depthWrite: false, // Outer line renders behind inner
  });
}

/**
 * Update dual outline material uniforms.
 *
 * @param material - ShaderMaterial to update
 * @param updates - Properties to update
 */
export function updateDualOutlineMaterial(
  material: ShaderMaterial,
  updates: Partial<{
    lineColor: string;
    gap: number;
    opacity: number;
  }>
): void {
  if (updates.lineColor !== undefined) {
    material.uniforms.lineColor!.value = new Color(updates.lineColor);
  }
  if (updates.gap !== undefined && material.uniforms.lineGap) {
    material.uniforms.lineGap.value = updates.gap;
  }
  if (updates.opacity !== undefined) {
    material.uniforms.opacity!.value = updates.opacity;
  }

  material.needsUpdate = true;
}

/**
 * Create both inner and outer materials for dual outline effect.
 *
 * Returns an object containing both materials for convenient use.
 *
 * @param config - Material configuration
 * @returns Object with inner and outer ShaderMaterial instances
 *
 * @example
 * ```ts
 * const { inner, outer } = createDualOutlineMaterials({
 *   innerColor: '#FFFFFF',
 *   outerColor: '#00FFFF',
 *   gap: 2,
 * });
 *
 * // Render outer first, then inner on top
 * <line material={outer} />
 * <line material={inner} />
 * ```
 */
export function createDualOutlineMaterials(config: DualOutlineMaterialConfig): {
  inner: ShaderMaterial;
  outer: ShaderMaterial;
} {
  return {
    inner: createDualOutlineInnerMaterial(config),
    outer: createSimpleDualOutlineOuterMaterial(config),
  };
}
