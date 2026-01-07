/**
 * TSL Emission Color for Volumetric Rendering
 *
 * Computes the emission color at each point based on:
 * - User's color palette (uColor as base)
 * - Density (brightness/saturation)
 * - Wavefunction phase (subtle hue modulation)
 *
 * Uses unified uColorAlgorithm system:
 * - Algorithms 0-7: Delegated to shared getColorByAlgorithm()
 * - Algorithm 8 (Phase): Quantum phase coloring using actual wavefunction phase
 * - Algorithm 9 (Mixed): Quantum phase + density blending
 * - Algorithm 10 (Blackbody): Density mapped to temperature gradient
 *
 * Ported exactly from WebGL: shaders/schroedinger/volume/emission.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/volume/emission
 */

import {
  Fn,
  float,
  vec3,
  clamp,
  max,
  pow,
  sin,
  PI,
  select,
  dot,
  length,
  abs,
  If,
  exp,
  smoothstep,
  Loop,
  int,
  cross,
  fract,
} from 'three/tsl'
import type { Node, UniformNode, UniformArrayNode } from 'three/tsl'
import type * as THREE from 'three'
import { Vector3 } from 'three'
import { sFromRho } from '../quantum/density'
import {
  computePBRSpecular,
  fresnelSchlick,
  getDistanceAttenuation,
  getSpotAttenuation,
} from '../../lighting'
import {
  MAX_LIGHTS,
  LIGHT_TYPE_POINT,
  LIGHT_TYPE_DIRECTIONAL,
  LIGHT_TYPE_SPOT,
} from '../../../lighting/light-uniforms'
import { safeNormalize3, safeNormalizeUp } from '../../../utils/safe-math'
import { createColorSelector } from '../../../color/selector'
import type { ColorTSLUniforms } from '../../../color/color-uniforms'

// Type aliases
type Vec3Node = Node
type FloatNode = Node
type ColorUniform = UniformNode<THREE.Color>

// Color algorithm constants (matching WebGL)
const COLOR_ALG_PHASE = 8
const COLOR_ALG_MIXED = 9
const COLOR_ALG_BLACKBODY = 10

// Phase influence on hue
const PHASE_HUE_INFLUENCE = 0.4

/**
 * Uniforms for emission color computation.
 * Extended with full multi-light, shadow, AO, and SSS support to match WebGL.
 */
export interface EmissionUniforms {
  // Core
  uColor: ColorUniform
  uColorAlgorithm: UniformNode<number>
  uDensityGain: UniformNode<number>
  uTime: UniformNode<number>
  uTimeScale: UniformNode<number>

  // Material
  uMetallic: UniformNode<number>
  uRoughness: UniformNode<number>
  uAmbientColor: UniformNode<THREE.Color>
  uAmbientIntensity: UniformNode<number>
  uAmbientEnabled: UniformNode<boolean>
  uSpecularColor: UniformNode<THREE.Color>
  uSpecularIntensity: UniformNode<number>

  // Volume effects
  uPowderScale: UniformNode<number>
  uScatteringAnisotropy: UniformNode<number>

  // Emission
  uEmissionIntensity: UniformNode<number>
  uEmissionThreshold: UniformNode<number>
  uEmissionColorShift: UniformNode<number>
  uEmissionPulsing: UniformNode<boolean>

  // Rim/Fresnel
  uFresnelEnabled?: UniformNode<boolean>
  uFresnelIntensity?: UniformNode<number>
  uRimExponent?: UniformNode<number>
  uRimColor?: UniformNode<THREE.Color>

  // Nodal
  uNodalEnabled?: UniformNode<boolean>
  uNodalColor?: UniformNode<THREE.Color>
  uNodalStrength?: UniformNode<number>

  // Energy color
  uEnergyColorEnabled?: UniformNode<boolean>

  // Multi-light system (matches LightTSLUniforms)
  uNumLights?: UniformNode<number>
  uLightsEnabled?: UniformArrayNode<number>
  uLightTypes?: UniformArrayNode<number>
  uLightPositions?: UniformArrayNode<Vector3>
  uLightDirections?: UniformArrayNode<Vector3>
  uLightColors?: UniformArrayNode<Vector3>
  uLightIntensities?: UniformArrayNode<number>
  uLightRanges?: UniformArrayNode<number>
  uLightDecays?: UniformArrayNode<number>
  uSpotCosInner?: UniformArrayNode<number>
  uSpotCosOuter?: UniformArrayNode<number>

  // Volumetric shadows
  uShadowsEnabled?: UniformNode<boolean>
  uShadowStrength?: UniformNode<number>
  uShadowSteps?: UniformNode<number>
  uFastMode?: UniformNode<boolean>

  // Volumetric AO
  uAoEnabled?: UniformNode<boolean>
  uAoStrength?: UniformNode<number>
  uAoRadius?: UniformNode<number>
  uAoSteps?: UniformNode<number>
  uAoColor?: UniformNode<THREE.Color>

  // Subsurface Scattering
  uSssEnabled?: UniformNode<boolean>
  uSssIntensity?: UniformNode<number>
  uSssColor?: UniformNode<THREE.Color>
  uSssThickness?: UniformNode<number>
  uSssJitter?: UniformNode<number>

  // Color system uniforms (for algorithms 0-7)
  colorUniforms?: ColorTSLUniforms
}

/**
 * Density sampler function type for shadows/AO.
 * Takes position and time, returns density value.
 */
export type DensitySampler = (pos: Vec3Node, time: FloatNode) => FloatNode

/**
 * Convert linear density (rho) to normalized [0, 1] range for color mapping.
 */
export const normalizedDensity = Fn(([rho]: [Node]) => {
  const s = sFromRho(rho)
  // Map log scale roughly from -8 to 0 to 0 to 1
  return clamp(s.add(8).div(8), float(0), float(1))
})

/**
 * Analytic approximation of blackbody color (RGB).
 * Guards against Temp <= 0 which causes undefined behavior.
 *
 * @param temp - Temperature in Kelvin
 * @returns RGB color
 */
export const blackbody = Fn(([temp]: [Node]) => {
  const safeTemp = max(temp, float(1))
  const invTemp = pow(safeTemp, float(-1.5))

  const r = float(56100000).mul(invTemp).add(148).div(255)
  const g = float(100040000).mul(invTemp).add(66).div(255)
  const b = float(194180000).mul(invTemp).add(30).div(255)

  return vec3(clamp(r, float(0), float(1)), clamp(g, float(0), float(1)), clamp(b, float(0), float(1)))
})

/**
 * Henyey-Greenstein Phase Function for anisotropic scattering.
 *
 * @param dotLH - Dot product of light and half vector
 * @param g - Asymmetry parameter (-1 to 1)
 * @returns Phase function value
 */
export const henyeyGreenstein = Fn(([dotLH, g]: [Node, Node]) => {
  const g2 = g.mul(g)
  const denom = float(1).add(g2).sub(float(2).mul(g).mul(dotLH))
  return float(1).sub(g2).div(float(4).mul(PI).mul(pow(max(denom, float(0.001)), float(1.5))))
})

/**
 * Convert RGB to HSL color space.
 *
 * @param rgb - RGB color
 * @returns HSL color
 */
export const rgb2hsl = Fn(([rgb]: [Vec3Node]) => {
  const r = rgb.x
  const g = rgb.y
  const b = rgb.z

  const maxC = max(r, max(g, b))
  const minC = r.min(g.min(b))
  const delta = maxC.sub(minC)

  // Lightness
  const l = maxC.add(minC).mul(0.5)

  // Saturation
  const s = delta.div(float(1).sub(abs(float(2).mul(l).sub(1))).add(0.0001))

  // Hue (simplified)
  // CRITICAL: Guard delta against zero - GPU evaluates ALL branches (see docs/tsl.md GPU Branch Evaluation)
  const safeDelta = max(delta, float(0.0001))
  const h = float(0).toVar()
  If(delta.greaterThan(0.0001), () => {
    const rCase = g.sub(b).div(safeDelta).mod(6).div(6)
    const gCase = b.sub(r).div(safeDelta).add(2).div(6)
    const bCase = r.sub(g).div(safeDelta).add(4).div(6)

    h.assign(
      select(
        r.equal(maxC),
        rCase,
        select(g.equal(maxC), gCase, bCase)
      )
    )
  })

  return vec3(h, s, l)
})

/**
 * Convert HSL to RGB color space.
 *
 * @param hsl - HSL color
 * @returns RGB color
 */
export const hsl2rgb = Fn(([hsl]: [Vec3Node]) => {
  const h = hsl.x
  const s = hsl.y
  const l = hsl.z

  const c = float(1).sub(abs(float(2).mul(l).sub(1))).mul(s)
  const x = c.mul(float(1).sub(abs(h.mul(6).mod(2).sub(1))))
  const m = l.sub(c.mul(0.5))

  const h6 = h.mul(6)

  // Color component selection based on hue sector
  const r = float(0).toVar()
  const g = float(0).toVar()
  const b = float(0).toVar()

  // Sector 0: r=c, g=x, b=0
  // Sector 1: r=x, g=c, b=0
  // Sector 2: r=0, g=c, b=x
  // Sector 3: r=0, g=x, b=c
  // Sector 4: r=x, g=0, b=c
  // Sector 5: r=c, g=0, b=x

  r.assign(
    select(
      h6.lessThan(1),
      c,
      select(
        h6.lessThan(2),
        x,
        select(h6.lessThan(4), float(0), select(h6.lessThan(5), x, c))
      )
    )
  )

  g.assign(
    select(
      h6.lessThan(1),
      x,
      select(
        h6.lessThan(3),
        c,
        select(h6.lessThan(4), x, float(0))
      )
    )
  )

  b.assign(
    select(
      h6.lessThan(2),
      float(0),
      select(
        h6.lessThan(3),
        x,
        select(h6.lessThan(5), c, x)
      )
    )
  )

  return vec3(r.add(m), g.add(m), b.add(m))
})

/**
 * Map wavefunction phase to hue (rainbow coloring).
 *
 * @param phase - Wavefunction phase in radians [-π, π]
 * @returns Hue value [0, 1]
 */
export const phaseToHue = Fn(([phase]: [Node]) => {
  return phase.add(PI).div(PI.mul(2))
})

/**
 * Compute base surface color (no lighting applied).
 *
 * Quantum-specific algorithms (8-10) use actual wavefunction phase.
 * Algorithms 0-7 are delegated to the shared color system (getColorByAlgorithm).
 *
 * @param uniforms - Emission uniforms
 * @returns TSL Fn for base color computation
 */
export function createComputeBaseColor(uniforms: EmissionUniforms) {
  // Create color selector if color uniforms are provided (for algorithms 0-7)
  const colorSelector = uniforms.colorUniforms ? createColorSelector(uniforms.colorUniforms) : null

  return Fn(([rho, phase, pos]: [Node, Node, Vec3Node]) => {
    // Normalize log-density to [0, 1] range
    const s = sFromRho(rho)
    const normalized = clamp(s.add(8).div(8), float(0), float(1))

    // Get base color from user's palette
    // NOTE: uniforms.uColor is already a vec3 node - do NOT wrap in vec3()
    const baseHSL = rgb2hsl(uniforms.uColor).toVar()

    // Energy Level Coloring (optional)
    if (uniforms.uEnergyColorEnabled) {
      If(uniforms.uEnergyColorEnabled, () => {
        const r = length(pos)
        const energyProxy = clamp(r.mul(0.5), float(0), float(1))
        const hue = float(0.8).mul(energyProxy)
        baseHSL.assign(vec3(hue, float(1), float(0.5)))
      })
    }

    // Color algorithm selection
    const alg = uniforms.uColorAlgorithm

    // Phase-based values
    const phaseNorm = phase.add(PI).div(PI.mul(2))
    const hueShift = phaseNorm.sub(0.5).mul(PHASE_HUE_INFLUENCE)

    // Algorithm 8: Quantum Phase coloring
    const phaseHue = baseHSL.x.add(hueShift).fract()
    const phaseColor = hsl2rgb(vec3(phaseHue, float(0.75), float(0.35)))

    // Algorithm 9: Mixed (Quantum Phase + Density)
    const mixedHue = baseHSL.x.add(hueShift).fract()
    const mixedLightness = float(0.15).add(float(0.35).mul(normalized))
    const mixedSaturation = float(0.7).add(float(0.25).mul(normalized))
    const mixedColor = hsl2rgb(vec3(mixedHue, mixedSaturation, mixedLightness))

    // Algorithm 10: Blackbody (Heat)
    const blackbodyTemp = normalized.mul(12000)
    const blackbodyColor = select(blackbodyTemp.lessThan(500), vec3(0, 0, 0), blackbody(blackbodyTemp))

    // Algorithms 0-7: Delegate to shared color system
    // Uses the unified getColorByAlgorithm for these algorithms
    // Default: modulated base color (fallback if no color uniforms provided)
    const defaultColor = colorSelector
      ? colorSelector(normalized, vec3(0, 1, 0), baseHSL, pos)
      : hsl2rgb(baseHSL).mul(normalized)

    // Select based on algorithm
    // Algorithms 8, 9, 10 are quantum-specific, all others use shared color system
    return select(
      alg.equal(COLOR_ALG_PHASE),
      phaseColor,
      select(
        alg.equal(COLOR_ALG_MIXED),
        mixedColor,
        select(alg.equal(COLOR_ALG_BLACKBODY), blackbodyColor, defaultColor)
      )
    )
  })
}

/**
 * Compute emission with ambient lighting only (for fast mode).
 *
 * @param uniforms - Emission uniforms
 * @returns TSL Fn for emission with ambient only
 */
export function createComputeEmission(uniforms: EmissionUniforms) {
  const computeBaseColor = createComputeBaseColor(uniforms)

  return Fn(([rho, phase, pos]: [Node, Node, Vec3Node]) => {
    const baseColor = computeBaseColor(rho, phase, pos)

    // Energy-conserved ambient: metals don't scatter diffuse light
    const diffuseFactor = max(float(1).sub(uniforms.uMetallic), float(0))
    const ambient = baseColor
      .mul(diffuseFactor)
      .mul(uniforms.uAmbientColor)
      .mul(uniforms.uAmbientIntensity)
      .mul(select(uniforms.uAmbientEnabled, float(1), float(0)))

    // Nodal surface highlighting
    const col = ambient.toVar()

    const nodalEnabled = uniforms.uNodalEnabled
    const nodalColor = uniforms.uNodalColor
    const nodalStrength = uniforms.uNodalStrength
    if (nodalEnabled && nodalColor && nodalStrength) {
      const s = sFromRho(rho)
      const isNodal = s.lessThan(-5).and(s.greaterThan(-12))
      If(nodalEnabled.and(isNodal), () => {
        const intensity = float(1).sub(smoothstep(float(-12), float(-5), s))
        const nodalGlow = (nodalColor as Node).mul(nodalStrength as Node).mul(intensity).mul(2)
        col.assign(col.add(nodalGlow))
      })
    }

    return col
  })
}

/**
 * Compute emission with full scene lighting (for HQ mode).
 *
 * Full parity with WebGL computeEmissionLit:
 * - Multi-light loop with all light types
 * - Powder effect (multiple scattering)
 * - Henyey-Greenstein phase function
 * - PBR GGX specular with energy conservation
 * - Volumetric self-shadowing
 * - Subsurface scattering (SSS)
 * - Volumetric ambient occlusion
 * - Fresnel rim lighting
 * - HDR emission glow
 * - Nodal surface highlighting
 *
 * @param uniforms - Emission uniforms including lights, shadows, AO, SSS
 * @param sampleDensity - Optional density sampler for shadows/AO (matches WebGL sampleDensity)
 * @returns TSL Fn for lit emission
 */
export function createComputeEmissionLit(
  uniforms: EmissionUniforms,
  sampleDensity?: DensitySampler
) {
  const computeBaseColor = createComputeBaseColor(uniforms)
  const computeEmission = createComputeEmission(uniforms)

  return Fn(([rho, phase, pos, gradient, viewDir]: [Node, Node, Vec3Node, Vec3Node, Vec3Node]) => {
    // Early return: no lights means simple emission
    const numLights = uniforms.uNumLights
    if (!numLights) {
      return computeEmission(rho, phase, pos)
    }

    const hasNoLights = numLights.equal(0)
    const simpleEmission = computeEmission(rho, phase, pos)
    const col = simpleEmission.toVar()

    // Only process multi-light if we have lights
    If(hasNoLights.not(), () => {
      const surfaceColor = computeBaseColor(rho, phase, pos)

      // Start with ambient (energy-conserved: metals don't scatter diffuse)
      const diffuseFactor = max(float(1).sub(uniforms.uMetallic), float(0))
      col.assign(
        surfaceColor
          .mul(diffuseFactor)
          .mul(uniforms.uAmbientColor)
          .mul(uniforms.uAmbientIntensity)
          .mul(select(uniforms.uAmbientEnabled, float(1), float(0)))
      )

      // Normalize gradient as pseudo-normal
      const gradLen = length(gradient)
      const hasGradient = gradLen.greaterThan(0.0001)
      // CRITICAL: Guard gradLen BEFORE the If() block - GPU evaluates ALL branches
      // so gradient.div(gradLen) executes even when hasGradient is false
      const safeGradLen = max(gradLen, float(0.0001))

      If(hasGradient, () => {
        const n = gradient.div(safeGradLen)
        const roughness = max(uniforms.uRoughness, float(0.04))

        // Multi-light loop (MAX_LIGHTS = 8)
        if (uniforms.uLightsEnabled && uniforms.uLightTypes && uniforms.uLightPositions &&
            uniforms.uLightDirections && uniforms.uLightColors && uniforms.uLightIntensities &&
            uniforms.uLightRanges && uniforms.uLightDecays && uniforms.uSpotCosInner && uniforms.uSpotCosOuter) {

          // Unroll loop over MAX_LIGHTS using JavaScript for loop
          // CRITICAL: Using JS for loop instead of TSL Loop() because uniformArray.element()
          // with a TSL IntNode index causes "Invalid PipelineLayout" WebGPU errors.
          for (let i = 0; i < MAX_LIGHTS; i++) {
            const isInRange = int(i).lessThan(numLights)
            const isEnabled = uniforms.uLightsEnabled!.element(i).greaterThan(0.5)
            const isActive = isInRange.and(isEnabled)

            If(isActive, () => {
              // Get light properties using .element() with constant JS index
              const lightPos = uniforms.uLightPositions!.element(i)
              const lightDir = uniforms.uLightDirections!.element(i)
              const lightColor = uniforms.uLightColors!.element(i)
              const lightType = uniforms.uLightTypes!.element(i)
              const lightIntensity = float(uniforms.uLightIntensities!.element(i))
              const range = float(uniforms.uLightRanges!.element(i))
              const decay = float(uniforms.uLightDecays!.element(i))
              const cosInner = float(uniforms.uSpotCosInner!.element(i))
              const cosOuter = float(uniforms.uSpotCosOuter!.element(i))

              // Calculate light direction based on type
              const isPoint = lightType.equal(LIGHT_TYPE_POINT)
              const isDirectional = lightType.equal(LIGHT_TYPE_DIRECTIONAL)
              const isSpot = lightType.equal(LIGHT_TYPE_SPOT)

              // CRITICAL: Use safe normalize - GPU evaluates ALL branches
              // even if isActive is false, so normalize(zeroVec) would produce NaN
              // See docs/tsl.md "GPU Branch Evaluation"
              // NOTE: lightPos/lightDir are already vec3 nodes from uniformArray.element()
              // Do NOT wrap in vec3() - TSL throws "Length of parameters exceeds maximum"
              const L_point = safeNormalize3(lightPos.sub(pos), vec3(0, 1, 0))
              const L_dir = safeNormalize3(lightDir.negate(), vec3(0, -1, 0))
              const L = select(isDirectional, L_dir, L_point).toVar()

              // Base attenuation
              const attenuation = lightIntensity.toVar()

              // Distance attenuation for point/spot
              If(isPoint.or(isSpot), () => {
                const dist = length(lightPos.sub(pos))
                const distAtten = getDistanceAttenuation(dist, range, decay)
                attenuation.mulAssign(distAtten)
              })

              // Spot attenuation
              If(isSpot, () => {
                // CRITICAL: Use safe normalize - can be zero when at light position
                const lightToFrag = safeNormalize3(pos.sub(lightPos), vec3(0, -1, 0))
                // getSpotAttenuation expects (lightToFrag, spotDir, cosInner, cosOuter)
                const spotAtten = getSpotAttenuation(
                  lightToFrag,
                  lightDir,
                  cosInner,
                  cosOuter
                )
                attenuation.mulAssign(spotAtten)
              })

              // Skip if attenuation is negligible
              If(attenuation.greaterThan(0.001), () => {
                // Powder effect (multiple scattering approximation)
                const powder = float(1).toVar()
                If(uniforms.uPowderScale.greaterThan(0), () => {
                  const powderRaw = float(1).sub(
                    exp(rho.negate().mul(uniforms.uDensityGain).mul(uniforms.uPowderScale).mul(4))
                  )
                  powder.assign(float(0.5).add(float(1.5).mul(powderRaw)))
                })

                // Anisotropic Scattering (Henyey-Greenstein)
                const phaseFactor = float(1).toVar()
                If(abs(uniforms.uScatteringAnisotropy).greaterThan(0.01), () => {
                  const cosTheta = dot(L.negate(), viewDir)
                  const hg = henyeyGreenstein(cosTheta, uniforms.uScatteringAnisotropy)
                  phaseFactor.assign(hg.mul(12.56)) // Normalize for isotropic brightness
                })

                // GGX Specular (PBR) with energy conservation
                const NdotL = max(dot(n, L), float(0))
                const F0 = vec3(0.04).mix(surfaceColor, uniforms.uMetallic)
                // CRITICAL: Use safe normalize - L + viewDir can be zero when opposite
                const H = safeNormalize3(L.add(viewDir), n)
                const HdotV = max(dot(H, viewDir), float(0))
                const F = fresnelSchlick(HdotV, F0)

                // Energy conservation: kS is specular, kD is diffuse
                const kS = F
                const kD = vec3(1).sub(kS).mul(float(1).sub(uniforms.uMetallic))

                // Diffuse (Lambertian BRDF with powder and phase)
                const diffuse = kD.mul(surfaceColor).div(PI).mul(lightColor).mul(NdotL).mul(attenuation).mul(powder).mul(phaseFactor)
                col.addAssign(diffuse)

                // Specular (GGX)
                const specular = computePBRSpecular(n, viewDir, L, roughness, F0)

                // Volumetric Self-Shadowing
                const shadowFactor = float(1).toVar()
                if (uniforms.uShadowsEnabled && uniforms.uShadowStrength && uniforms.uShadowSteps && sampleDensity) {
                  // Cache optional uniform to avoid TypeScript narrowing issues in callbacks
                  const shadowStrength = uniforms.uShadowStrength
                  If(uniforms.uShadowsEnabled.and(shadowStrength.greaterThan(0)), () => {
                    const shadowDens = float(0).toVar()
                    const shadowStep = float(0.1).toVar()
                    const tShadow = float(0.05).toVar()

                    // Get effective steps (halve in fast mode)
                    // Provide defaults for optional uniforms
                    const shadowSteps = uniforms.uShadowSteps ?? int(4)
                    const fastMode = uniforms.uFastMode ?? float(0)
                    const maxSteps = select(
                      fastMode,
                      max(shadowSteps.div(2), int(1)),
                      shadowSteps
                    )

                    // Unrolled loop for 8 shadow samples (max)
                    Loop(int(8), ({ i: sIdx }) => {
                      If(sIdx.lessThan(maxSteps), () => {
                        const shadowPos = pos.add(L.mul(tShadow))
                        const time = uniforms.uTime.mul(uniforms.uTimeScale)
                        const rhoS = sampleDensity(shadowPos, time)
                        shadowDens.addAssign(rhoS.mul(shadowStep))
                        shadowStep.mulAssign(1.5)
                        tShadow.addAssign(shadowStep)
                      })
                    })

                    shadowFactor.assign(
                      exp(shadowDens.negate().mul(uniforms.uDensityGain).mul(shadowStrength))
                    )
                  })
                }

                // Add specular with shadow
                col.addAssign(
                  specular
                    .mul(uniforms.uSpecularColor)
                    .mul(lightColor)
                    .mul(NdotL)
                    .mul(uniforms.uSpecularIntensity)
                    .mul(attenuation)
                    .mul(shadowFactor)
                )

                // Subsurface Scattering (SSS)
                if (uniforms.uSssEnabled && uniforms.uSssIntensity && uniforms.uSssColor && uniforms.uSssThickness) {
                  // Cache optional uniforms to avoid TypeScript narrowing issues in callbacks
                  const sssThickness = uniforms.uSssThickness
                  const shadowsEnabled = uniforms.uShadowsEnabled ?? float(0)
                  If(uniforms.uSssEnabled.and(uniforms.uSssIntensity.greaterThan(0)), () => {
                    // Jittered distortion for SSS
                    const jitter = uniforms.uSssJitter ?? float(0)
                    const sssNoise = fract(sin(dot(pos.xy.mul(0.1), vec3(127.1, 311.7, 0).xy)).mul(43758.5453)).mul(2).sub(1)
                    const jitteredDistortion = float(0.5).mul(float(1).add(sssNoise.mul(jitter)))

                    // CRITICAL: Use safe normalize - can be near-zero with specific combinations
                    const halfVec = safeNormalize3(L.add(n.mul(jitteredDistortion)), n)
                    const trans = pow(
                      clamp(dot(viewDir, halfVec.negate()), float(0), float(1)),
                      sssThickness.mul(4)
                    )

                    // Transmission with shadow or self-attenuation
                    const transmission = trans.toVar()
                    transmission.assign(select(shadowsEnabled, trans.mul(shadowFactor), trans.mul(exp(rho.negate().mul(sssThickness)))))

                    col.addAssign(
                      (uniforms.uSssColor as Node)
                        .mul(lightColor)
                        .mul(transmission)
                        .mul(uniforms.uSssIntensity as Node)
                        .mul(attenuation)
                    )
                  })
                }
              })
            })
          }
        }

        // Volumetric Ambient Occlusion
        const aoFactor = float(1).toVar()
        if (uniforms.uAoEnabled && uniforms.uAoStrength && uniforms.uAoRadius && uniforms.uAoSteps && uniforms.uAoColor && sampleDensity) {
          // Cache optional uniforms to avoid TypeScript narrowing issues in callbacks
          const aoStrength = uniforms.uAoStrength
          const aoRadius = uniforms.uAoRadius
          If(uniforms.uAoEnabled.and(aoStrength.greaterThan(0)), () => {
            const ao = float(0).toVar()

            // Build tangent frame
            // CRITICAL: Use safe normalize - cross product can be near-zero when n ≈ up
            // The 0.001 offset helps but doesn't fully prevent zero-length result
            const t1 = safeNormalize3(cross(n, vec3(0, 1, 0.001)), vec3(1, 0, 0))
            const t2 = cross(n, t1)

            // Get effective steps (halve in fast mode, min 2)
            // Provide defaults for optional uniforms
            const aoSteps = uniforms.uAoSteps ?? int(4)
            const aoFastMode = uniforms.uFastMode ?? float(0)
            const maxAoSteps = select(
              aoFastMode,
              max(aoSteps.div(2), int(2)),
              aoSteps
            )

            // 8 hemisphere directions (unrolled for performance)
            // k=0: n, k=1: n+t1, k=2: n-t1, k=3: n+t2, k=4: n-t2, k=5: n+t1+t2, k=6: n-t1-t2, k=7: n+t1-t2
            const time = uniforms.uTime.mul(uniforms.uTimeScale)

            Loop(int(8), ({ i: k }) => {
              If(k.lessThan(maxAoSteps), () => {
                // Direction based on k (unrolled pattern matching WebGL)
                // CRITICAL: Use safe normalize - these sums can theoretically be zero
                // though unlikely with proper t1/t2 computation
                const dir = n.toVar()
                If(k.equal(1), () => { dir.assign(safeNormalizeUp(n.add(t1))) })
                If(k.equal(2), () => { dir.assign(safeNormalizeUp(n.sub(t1))) })
                If(k.equal(3), () => { dir.assign(safeNormalizeUp(n.add(t2))) })
                If(k.equal(4), () => { dir.assign(safeNormalizeUp(n.sub(t2))) })
                If(k.equal(5), () => { dir.assign(safeNormalizeUp(n.add(t1).add(t2))) })
                If(k.equal(6), () => { dir.assign(safeNormalizeUp(n.sub(t1).sub(t2))) })
                If(k.equal(7), () => { dir.assign(safeNormalizeUp(n.add(t1).sub(t2))) })

                const samplePos = pos.add(dir.mul(aoRadius))
                const sampleRho = sampleDensity(samplePos, time)
                ao.addAssign(sampleRho)
              })
            })

            // Average and apply
            ao.divAssign(float(8)) // Always divide by max samples for consistency
            aoFactor.assign(exp(ao.negate().mul(uniforms.uDensityGain).mul(aoStrength).mul(2)))

            // Apply AO color modulation
            const aoModulator = (uniforms.uAoColor as Node).mix(vec3(1), aoFactor)
            col.mulAssign(aoModulator)
          })
        }

        // Fresnel / Rim Lighting
        if (uniforms.uFresnelEnabled && uniforms.uFresnelIntensity && uniforms.uRimExponent && uniforms.uRimColor) {
          If(uniforms.uFresnelEnabled.and((uniforms.uFresnelIntensity as Node).greaterThan(0)), () => {
            const NdotV = max(dot(n, viewDir), float(0))
            let rim = pow(float(1).sub(NdotV), uniforms.uRimExponent as Node).mul(uniforms.uFresnelIntensity as Node)
            // Apply AO to rim if AO is enabled
            if (uniforms.uAoEnabled) {
              rim = rim.mul(select(uniforms.uAoEnabled, aoFactor, float(1)))
            }
            col.addAssign((uniforms.uRimColor as Node).mul(rim))
          })
        }
      })

      // Cache sFromRho for HDR and Nodal
      const cachedS = sFromRho(rho)

      // HDR Emission Glow
      If(uniforms.uEmissionIntensity.greaterThan(0), () => {
        const normalizedRho = clamp(cachedS.add(8).div(8), float(0), float(1))

        If(normalizedRho.greaterThan(uniforms.uEmissionThreshold), () => {
          const emissionFactor = normalizedRho.sub(uniforms.uEmissionThreshold).div(float(1).sub(uniforms.uEmissionThreshold))
          const ef2 = emissionFactor.mul(emissionFactor)

          const emissionColor = surfaceColor.toVar()

          If(abs(uniforms.uEmissionColorShift).greaterThan(0.01), () => {
            const hsl = rgb2hsl(emissionColor)
            const shiftedHSL = vec3(
              select(
                uniforms.uEmissionColorShift.greaterThan(0),
                hsl.x.mul(float(1).sub(uniforms.uEmissionColorShift.mul(0.5))).add(float(0.08).mul(uniforms.uEmissionColorShift.mul(0.5))),
                hsl.x.mul(float(1).add(uniforms.uEmissionColorShift.mul(0.5))).add(float(0.6).mul(uniforms.uEmissionColorShift.negate().mul(0.5)))
              ),
              hsl.y,
              hsl.z
            )
            emissionColor.assign(hsl2rgb(shiftedHSL))
          })

          const pulse = float(1).toVar()
          If(uniforms.uEmissionPulsing, () => {
            const phaseNorm = phase.add(PI).div(PI.mul(2))
            pulse.assign(float(1).add(float(0.5).mul(sin(phaseNorm.mul(6.28).add(uniforms.uTime.mul(uniforms.uTimeScale).mul(2))))))
          })

          col.addAssign(emissionColor.mul(uniforms.uEmissionIntensity).mul(ef2).mul(pulse))
        })
      })

      // Nodal surface highlighting
      if (uniforms.uNodalEnabled && uniforms.uNodalColor && uniforms.uNodalStrength) {
        const isNodal = cachedS.lessThan(-5).and(cachedS.greaterThan(-12))
        If(uniforms.uNodalEnabled.and(isNodal), () => {
          const intensity = float(1).sub(smoothstep(float(-12), float(-5), cachedS))
          col.addAssign((uniforms.uNodalColor as Node).mul(uniforms.uNodalStrength as Node).mul(intensity).mul(2))
        })
      }
    })

    return col
  })
}

/**
 * Compute emission optimized for volumetric raymarching loop.
 *
 * This function provides good visual parity with WebGL while being simple enough
 * to work in the volumetric inner loop (called 32-64x per ray).
 *
 * Features included (efficient):
 * - Base color from shared color system (algorithms 0-10)
 * - Ambient lighting with energy conservation
 * - Single main light with Lambertian diffuse
 * - Powder effect (multiple scattering approximation)
 * - Henyey-Greenstein phase function for anisotropic scattering
 * - Nodal surface highlighting
 *
 * Features excluded (too expensive for inner loop):
 * - Multi-light loop (uses only first active light)
 * - PBR GGX specular
 * - Volumetric shadows
 * - Ambient occlusion
 * - Subsurface scattering
 * - Fresnel rim lighting
 * - HDR emission glow
 *
 * @param uniforms - Emission uniforms
 * @returns TSL Fn for volumetric emission
 */
export function createComputeEmissionVolumetric(uniforms: EmissionUniforms) {
  const computeBaseColor = createComputeBaseColor(uniforms)

  return Fn(([rho, phase, pos, gradient, viewDir]: [Node, Node, Vec3Node, Vec3Node, Vec3Node]) => {
    // Get base surface color using shared color system
    const surfaceColor = computeBaseColor(rho, phase, pos)

    // Energy-conserved ambient: metals don't scatter diffuse light
    const diffuseFactor = max(float(1).sub(uniforms.uMetallic), float(0))
    const col = surfaceColor
      .mul(diffuseFactor)
      .mul(uniforms.uAmbientColor)
      .mul(uniforms.uAmbientIntensity)
      .mul(select(uniforms.uAmbientEnabled, float(1), float(1)))
      .toVar()

    // Use first active light for single-light mode
    const numLights = uniforms.uNumLights
    if (numLights && uniforms.uLightsEnabled && uniforms.uLightTypes && uniforms.uLightPositions &&
        uniforms.uLightDirections && uniforms.uLightColors && uniforms.uLightIntensities) {

      // Check if we have any lights and gradient is valid
      const gradLen = length(gradient)
      const hasGradient = gradLen.greaterThan(0.0001)
      const hasLights = numLights.greaterThan(0)

      If(hasGradient.and(hasLights), () => {
        const n = gradient.div(max(gradLen, float(0.0001)))

        // Use first light (index 0)
        const lightEnabled = uniforms.uLightsEnabled!.element(0).greaterThan(0.5)

        If(lightEnabled, () => {
          const lightPos = uniforms.uLightPositions!.element(0)
          const lightDir = uniforms.uLightDirections!.element(0)
          const lightColor = uniforms.uLightColors!.element(0)
          const lightType = uniforms.uLightTypes!.element(0)
          const lightIntensity = float(uniforms.uLightIntensities!.element(0))

          // Calculate light direction based on type
          const isDirectional = lightType.equal(LIGHT_TYPE_DIRECTIONAL)
          const L_point = safeNormalize3(lightPos.sub(pos), vec3(0, 1, 0))
          const L_dir = safeNormalize3(lightDir.negate(), vec3(0, -1, 0))
          const L = select(isDirectional, L_dir, L_point)

          // Basic attenuation (skip distance/spot for simplicity in inner loop)
          const attenuation = lightIntensity

          // Powder effect (multiple scattering approximation)
          const powder = float(1).toVar()
          If(uniforms.uPowderScale.greaterThan(0), () => {
            const powderRaw = float(1).sub(
              exp(rho.negate().mul(uniforms.uDensityGain).mul(uniforms.uPowderScale).mul(4))
            )
            powder.assign(float(0.5).add(float(1.5).mul(powderRaw)))
          })

          // Anisotropic Scattering (Henyey-Greenstein)
          const phaseFactor = float(1).toVar()
          If(abs(uniforms.uScatteringAnisotropy).greaterThan(0.01), () => {
            const cosTheta = dot(L.negate(), viewDir)
            const hg = henyeyGreenstein(cosTheta, uniforms.uScatteringAnisotropy)
            phaseFactor.assign(hg.mul(12.56)) // Normalize for isotropic brightness
          })

          // Lambertian diffuse
          const NdotL = max(dot(n, L), float(0))
          const diffuse = surfaceColor
            .mul(diffuseFactor)
            .div(PI)
            .mul(lightColor)
            .mul(NdotL)
            .mul(attenuation)
            .mul(powder)
            .mul(phaseFactor)

          col.addAssign(diffuse)
        })
      })
    }

    // Nodal surface highlighting
    if (uniforms.uNodalEnabled && uniforms.uNodalColor && uniforms.uNodalStrength) {
      const s = sFromRho(rho)
      const isNodal = s.lessThan(-5).and(s.greaterThan(-12))
      If(uniforms.uNodalEnabled.and(isNodal), () => {
        const intensity = float(1).sub(smoothstep(float(-12), float(-5), s))
        col.addAssign((uniforms.uNodalColor as Node).mul(uniforms.uNodalStrength as Node).mul(intensity).mul(2))
      })
    }

    return col
  })
}
