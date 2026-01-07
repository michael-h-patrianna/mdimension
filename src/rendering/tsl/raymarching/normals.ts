/**
 * TSL Normal Calculation for Raymarching
 *
 * Provides normal calculation methods using finite differences.
 * Supports both 6-sample central differences and 4-sample tetrahedron method.
 *
 * @module rendering/tsl/raymarching/normals
 */

import {
  dot,
  float,
  Fn,
  If,
  max,
  sqrt,
  sub,
  vec2,
  vec3,
} from 'three/tsl'

// Type aliases for TSL nodes
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>
type SDFFunc = (p: Vec3Node) => FloatNode

/**
 * Calculate surface normal using tetrahedron method (4 SDF samples)
 *
 * Exact port of WebGL GetNormalTetra():
 * ```glsl
 * float h = 0.0005;
 * vec3 n = k0 * GetDist(p + h * k0) + k1 * GetDist(p + h * k1) + ...
 * float lenSq = dot(n, n);
 * return lenSq > 1e-8 ? n * inversesqrt(lenSq) : vec3(0.0, 1.0, 0.0);
 * ```
 *
 * @param sdf - SDF evaluation function
 * @param eps - Epsilon for finite differences (default 0.0005 matching WebGL)
 * @returns A function that calculates the normal at a point
 */
export const createGetNormalTetra = (sdf: SDFFunc, eps: FloatNode = float(0.0005)) => {
  return Fn(([p]: [Vec3Node]) => {
    // WebGL: Tetrahedron vertices (pre-normalized, sum to zero for symmetric sampling)
    const k0 = vec3(1, -1, -1)
    const k1 = vec3(-1, -1, 1)
    const k2 = vec3(-1, 1, -1)
    const k3 = vec3(1, 1, 1)

    // WebGL: Weighted sum of tetrahedron samples
    const d0 = sdf(p.add(k0.mul(eps)))
    const d1 = sdf(p.add(k1.mul(eps)))
    const d2 = sdf(p.add(k2.mul(eps)))
    const d3 = sdf(p.add(k3.mul(eps)))

    const n = k0.mul(d0).add(k1.mul(d1)).add(k2.mul(d2)).add(k3.mul(d3))

    // WebGL: OPT-H9 inversesqrt normalization with zero-length fallback
    // float lenSq = dot(n, n);
    // return lenSq > 1e-8 ? n * inversesqrt(lenSq) : vec3(0.0, 1.0, 0.0);
    const lenSq = dot(n, n)
    const result = vec3(0, 1, 0).toVar('normalResult')
    // CRITICAL: Guard sqrt against near-zero values. In TSL, all branches are evaluated,
    // so sqrt(lenSq) is computed even when condition is false. Must clamp to avoid NaN/Inf.
    const safeLenSq = max(lenSq, float(1e-8))
    If(lenSq.greaterThan(1e-8), () => {
      // WebGL: n * inversesqrt(lenSq) - TSL types don't export inverseSqrt, use 1/sqrt
      result.assign(n.div(sqrt(safeLenSq)))
    })

    return result
  })
}

/**
 * Calculate surface normal using central differences (6 SDF samples)
 *
 * Exact port of WebGL GetNormal():
 * ```glsl
 * float h = 0.0005;
 * vec3 n = vec3(
 *     GetDist(p + vec3(h, 0, 0)) - GetDist(p - vec3(h, 0, 0)),
 *     GetDist(p + vec3(0, h, 0)) - GetDist(p - vec3(0, h, 0)),
 *     GetDist(p + vec3(0, 0, h)) - GetDist(p - vec3(0, 0, h))
 * );
 * float lenSq = dot(n, n);
 * return lenSq > 1e-8 ? n * inversesqrt(lenSq) : vec3(0.0, 1.0, 0.0);
 * ```
 *
 * @param sdf - SDF evaluation function
 * @param eps - Epsilon for finite differences (default 0.0005 matching WebGL)
 * @returns A function that calculates the normal at a point
 */
export const createGetNormalCentral = (sdf: SDFFunc, eps: FloatNode = float(0.0005)) => {
  return Fn(([p]: [Vec3Node]) => {
    const h = vec2(eps, float(0))

    const dx = sub(
      sdf(p.add(vec3(h.x, h.y, h.y))),
      sdf(p.sub(vec3(h.x, h.y, h.y)))
    )
    const dy = sub(
      sdf(p.add(vec3(h.y, h.x, h.y))),
      sdf(p.sub(vec3(h.y, h.x, h.y)))
    )
    const dz = sub(
      sdf(p.add(vec3(h.y, h.y, h.x))),
      sdf(p.sub(vec3(h.y, h.y, h.x)))
    )

    // WebGL: OPT-H9 inversesqrt normalization with zero-length fallback
    const n = vec3(dx, dy, dz)
    const lenSq = dot(n, n)
    const result = vec3(0, 1, 0).toVar('normalResult')
    // CRITICAL: Guard sqrt against near-zero values. In TSL, all branches are evaluated,
    // so sqrt(lenSq) is computed even when condition is false. Must clamp to avoid NaN/Inf.
    const safeLenSq = max(lenSq, float(1e-8))
    If(lenSq.greaterThan(1e-8), () => {
      // WebGL: n * inversesqrt(lenSq) - TSL types don't export inverseSqrt, use 1/sqrt
      result.assign(n.div(sqrt(safeLenSq)))
    })

    return result
  })
}

/**
 * Calculate normal with adaptive epsilon based on distance
 *
 * Uses larger epsilon for distant surfaces, smaller for close ones.
 * Helps prevent artifacts at different viewing distances.
 *
 * NOTE: This is NOT in WebGL (WebGL uses fixed epsilon).
 * Keeping for flexibility but uses same zero-length fallback pattern.
 *
 * @param sdf - SDF evaluation function
 * @param baseEps - Base epsilon value (default 0.0005 matching WebGL)
 * @returns A function that calculates the normal with distance-based epsilon
 */
export const createGetNormalAdaptive = (sdf: SDFFunc, baseEps: FloatNode = float(0.0005)) => {
  return Fn(([p, dist]: [Vec3Node, FloatNode]) => {
    // Scale epsilon by distance to maintain quality at all ranges
    const eps = baseEps.mul(dist.mul(0.1).add(1))

    const k0 = vec3(1, -1, -1)
    const k1 = vec3(-1, -1, 1)
    const k2 = vec3(-1, 1, -1)
    const k3 = vec3(1, 1, 1)

    const d0 = sdf(p.add(k0.mul(eps)))
    const d1 = sdf(p.add(k1.mul(eps)))
    const d2 = sdf(p.add(k2.mul(eps)))
    const d3 = sdf(p.add(k3.mul(eps)))

    const n = k0.mul(d0).add(k1.mul(d1)).add(k2.mul(d2)).add(k3.mul(d3))

    // Use same inversesqrt + zero-length pattern as WebGL
    const lenSq = dot(n, n)
    const result = vec3(0, 1, 0).toVar('normalResult')
    // CRITICAL: Guard sqrt against near-zero values. In TSL, all branches are evaluated,
    // so sqrt(lenSq) is computed even when condition is false. Must clamp to avoid NaN/Inf.
    const safeLenSq = max(lenSq, float(1e-8))
    If(lenSq.greaterThan(1e-8), () => {
      // WebGL: n * inversesqrt(lenSq) - TSL types don't export inverseSqrt, use 1/sqrt
      result.assign(n.div(sqrt(safeLenSq)))
    })

    return result
  })
}
