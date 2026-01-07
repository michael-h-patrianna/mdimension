/**
 * Buffer Preview TSL Node
 *
 * TSL port of BufferPreviewPass for WebGPU compatibility.
 * Provides debug visualization of various G-buffer contents:
 * - Depth buffer (raw, linear, focus zones)
 * - Normal buffer
 * - Temporal depth buffer
 *
 * Matches WebGL BufferPreviewPass.ts behavior line-by-line.
 *
 * @module rendering/tsl/postprocessing/bufferPreviewTSL
 */

import {
  abs,
  clamp,
  float,
  Fn,
  length,
  max,
  step,
  vec3,
  vec4,
  type Node,
  type ShaderNodeObject,
  type TextureNode,
} from 'three/tsl'

/**
 * Convert perspective depth buffer value to linear view-space Z.
 *
 * Matches WebGL: perspectiveDepthToViewZ(depth, near, far)
 *
 * @param depth - Raw depth buffer value (0-1)
 * @param near - Near clip plane distance
 * @param far - Far clip plane distance
 * @returns Positive view-space Z distance
 */
const perspectiveDepthToViewZ = Fn(([depth, near, far]: [Node, Node, Node]) => {
  // Standard perspective depth linearization
  // Formula: (near * far) / ((far - near) * depth - far)
  const numerator = near.mul(far)
  const denominator = far.sub(near).mul(depth).sub(far)
  return numerator.div(denominator)
})

/**
 * Depth buffer preview effect - visualizes depth as grayscale.
 *
 * Matches WebGL BufferPreviewPass.ts Type 1 (Depth) with Mode 1 (Linear):
 * - Converts perspective depth to linear view-space Z
 * - Normalizes to near/far range
 * - Outputs grayscale value
 *
 * @param depthNode - Depth texture node
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @returns RGBA vec4 with depth visualization
 */
export const createDepthPreviewNode = (
  depthNode: ShaderNodeObject<TextureNode>,
  near: Node,
  far: Node
): Node => {
  return Fn(() => {
    // Sample depth - matches WebGL: float depth = texel.x;
    const depth = depthNode.x

    // Convert to view-space Z
    // Matches WebGL: float viewZ = -perspectiveDepthToViewZ(depth, uNearClip, uFarClip);
    const viewZ = perspectiveDepthToViewZ(depth, near, far).negate()

    // Normalize to 0-1 range
    // Matches WebGL: float normalized = (viewZ - uNearClip) / (uFarClip - uNearClip);
    const normalized = viewZ.sub(near).div(far.sub(near))

    // Clamp and output grayscale
    // Matches WebGL: fragColor = vec4(vec3(clamp(normalized, 0.0, 1.0)), 1.0);
    const gray = clamp(normalized, float(0), float(1))
    return vec4(gray, gray, gray, float(1))
  })()
}

/**
 * Normal buffer preview effect - visualizes normals as RGB.
 *
 * Matches WebGL BufferPreviewPass.ts Type 2 (Normal):
 * - Remaps normals from [-1, 1] to [0, 1] for visualization
 * - Shows background color for empty/zero normals
 *
 * @param normalNode - Normal texture node
 * @returns RGBA vec4 with normal visualization
 */
export const createNormalPreviewNode = (
  normalNode: ShaderNodeObject<TextureNode>
): Node => {
  return Fn(() => {
    // Sample normal - matches WebGL: vec3 normal = texel.rgb;
    const normal = normalNode.xyz

    // Check for valid data (empty/background = near-zero)
    // Matches WebGL: float hasNormal = step(0.01, length(normal));
    const hasNormal = step(float(0.01), length(normal))

    // Background color for empty normals
    // Matches WebGL: fragColor = vec4(0.05, 0.05, 0.1, 1.0);
    const bgColor = vec3(0.05, 0.05, 0.1)

    // Remap normals from [-1, 1] to [0, 1] for visualization
    // Matches WebGL: vec3 displayNormal = normal * 0.5 + 0.5;
    const displayNormal = normal.mul(0.5).add(0.5)

    // Select between background and display normal based on hasNormal
    // Matches WebGL if-else structure
    const finalColor = bgColor.mix(displayNormal, hasNormal)

    return vec4(finalColor.x, finalColor.y, finalColor.z, float(1))
  })()
}

/**
 * Temporal depth buffer preview effect - visualizes temporal ray distance.
 *
 * Matches WebGL BufferPreviewPass.ts Type 3 (TemporalDepth):
 * - Reads ray distance from .w channel (gPosition buffer format)
 * - Normalizes to near/far range
 * - Inverts so near=white, far=black
 *
 * @param temporalNode - Temporal buffer texture node (gPosition format)
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @returns RGBA vec4 with temporal depth visualization
 */
export const createTemporalDepthPreviewNode = (
  temporalNode: ShaderNodeObject<TextureNode>,
  near: Node,
  far: Node
): Node => {
  return Fn(() => {
    // Sample temporal depth from .w channel
    // Matches WebGL: float temporalDepth = texel.w;  // Use .w (ray distance), NOT .r!
    const temporalDepth = temporalNode.w

    // Check for invalid/empty data (no hit)
    // Matches WebGL: if (temporalDepth < 0.0001)
    const isValid = step(float(0.0001), temporalDepth)

    // Normalize linear ray distance to 0-1 range
    // Matches WebGL: float normalized = (temporalDepth - uNearClip) / (uFarClip - uNearClip);
    const normalized = temporalDepth.sub(near).div(far.sub(near))

    // Invert: Near=White, Far=Black
    // Matches WebGL: fragColor = vec4(vec3(1.0 - clamp(normalized, 0.0, 1.0)), 1.0);
    const inverted = float(1).sub(clamp(normalized, float(0), float(1)))

    // Select between black (invalid) and inverted (valid)
    const gray = inverted.mul(isValid)

    return vec4(gray, gray, gray, float(1))
  })()
}

/**
 * Focus zones depth preview effect - colorizes depth by focus distance.
 *
 * Matches WebGL BufferPreviewPass.ts Type 1 Mode 2 (FocusZones):
 * - Green: In focus
 * - Red: Behind focus
 * - Blue: In front of focus
 *
 * @param depthNode - Depth texture node
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @param focus - Focus distance
 * @param focusRange - Focus range
 * @returns RGBA vec4 with focus zone visualization
 */
export const createFocusZonesPreviewNode = (
  depthNode: ShaderNodeObject<TextureNode>,
  near: Node,
  far: Node,
  focus: Node,
  focusRange: Node
): Node => {
  return Fn(() => {
    // Sample depth
    const depth = depthNode.x

    // Convert to view-space Z
    const viewZ = perspectiveDepthToViewZ(depth, near, far).negate()

    // Calculate difference from focus
    // Matches WebGL: float diff = viewZ - uFocus;
    const diff = viewZ.sub(focus)
    const absDiff = abs(diff)

    // Guard against focusRange = 0
    // Matches WebGL: float safeFocusRange = max(uFocusRange, 0.0001);
    const safeFocusRange = max(focusRange, float(0.0001))

    // Green: In Focus
    // Matches WebGL: float inFocus = 1.0 - clamp(absDiff / safeFocusRange, 0.0, 1.0);
    const inFocus = float(1).sub(clamp(absDiff.div(safeFocusRange), float(0), float(1)))

    // Red: Behind focus
    // Matches WebGL: float behind = clamp(diff / (safeFocusRange * 3.0), 0.0, 1.0);
    const behind = clamp(diff.div(safeFocusRange.mul(3)), float(0), float(1))

    // Blue: In front of focus
    // Matches WebGL: float infront = clamp(-diff / (safeFocusRange * 3.0), 0.0, 1.0);
    const infront = clamp(diff.negate().div(safeFocusRange.mul(3)), float(0), float(1))

    // Matches WebGL: fragColor = vec4(behind, inFocus, infront, 1.0);
    return vec4(behind, inFocus, infront, float(1))
  })()
}

/**
 * Buffer preview type for selecting which buffer to visualize.
 */
export type BufferPreviewType = 'none' | 'depth' | 'normal' | 'temporalDepth'

/**
 * Creates the appropriate buffer preview node based on type.
 *
 * Factory function that selects the correct preview visualization.
 *
 * @param type - Which buffer to preview
 * @param depthNode - Depth texture node
 * @param normalNode - Normal texture node (may be null)
 * @param temporalNode - Temporal buffer texture node (may be null)
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @returns Preview node or null if type is 'none'
 */
export const createBufferPreviewNode = (
  type: BufferPreviewType,
  depthNode: ShaderNodeObject<TextureNode> | null,
  normalNode: ShaderNodeObject<TextureNode> | null,
  temporalNode: ShaderNodeObject<TextureNode> | null,
  near: Node,
  far: Node
): Node | null => {
  switch (type) {
    case 'depth':
      if (depthNode) {
        return createDepthPreviewNode(depthNode, near, far)
      }
      return null
    case 'normal':
      if (normalNode) {
        return createNormalPreviewNode(normalNode)
      }
      return null
    case 'temporalDepth':
      if (temporalNode) {
        return createTemporalDepthPreviewNode(temporalNode, near, far)
      }
      return null
    default:
      return null
  }
}

