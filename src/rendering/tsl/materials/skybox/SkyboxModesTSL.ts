/**
 * SkyboxModesTSL - TSL implementations of 7 procedural skybox modes
 *
 * Ports all GLSL skybox modes to TSL Fn() functions.
 */

import {
  atan,
  float,
  Fn,
  select,
  vec2,
  vec3,
} from 'three/tsl'
import type { Node } from 'three/tsl'

// TSL atan is overloaded to accept 2 args (like atan2) but types don't reflect this
type FloatNode = ReturnType<typeof float>
const atan2Args = atan as unknown as (y: Node, x: Node) => FloatNode

import {
  cosinePalette,
  fbm2,
  hsv2rgb,
  noise3D,
  PI,
  rgb2hsv,
  TAU,
  voronoi3D,
} from './SkyboxUtilsTSL'

// ============================================================================
// Uniform interface - passed to each mode function
// ============================================================================

export interface SkyboxUniforms {
  uTime: Node
  uTimeScale: Node
  uIntensity: Node
  uScale: Node
  uComplexity: Node
  uEvolution: Node
  uTurbulence: Node
  uColor1: Node
  uColor2: Node
  uPalA: Node
  uPalB: Node
  uPalC: Node
  uPalD: Node
  uUsePalette: Node
  uHue: Node
  uSaturation: Node
  // Aurora
  uAuroraCurtainHeight: Node
  uAuroraWaveFrequency: Node
  // Horizon
  uHorizonGradientContrast: Node
  uHorizonSpotlightFocus: Node
  // Ocean
  uOceanCausticIntensity: Node
  uOceanDepthGradient: Node
  uOceanBubbleDensity: Node
  uOceanSurfaceShimmer: Node
  // Cube texture (for classic mode)
  uTex?: Node
}

// ============================================================================
// Mode 1: Aurora - Flowing Vertical Curtains
// ============================================================================

export const createAuroraMode = (u: SkyboxUniforms) => Fn(([dir, time]: [Node, Node]) => {
  // Spherical coordinates
  const theta = atan2Args(dir.x, dir.z) // Horizontal angle
  const phi = dir.y.clamp(-1, 1).asin() // Vertical angle

  // Aurora vertical coverage
  const heightLow = float(-0.2).mix(float(0.1), u.uAuroraCurtainHeight)
  const heightHigh = float(0.3).mix(float(0.8), u.uAuroraCurtainHeight)
  const auroraHeight = dir.y.smoothstep(heightLow, heightHigh)

  const waveFreq = u.uAuroraWaveFrequency

  // Curtain wave
  const h1 = theta.mul(3).add(u.uEvolution.mul(TAU))
  const wave1 = h1.add(time.mul(0.3)).sin().mul(theta.mul(2).add(time.mul(0.2)).cos())

  // Primary fold
  const fold1 = phi.mul(8).mul(waveFreq).add(wave1.mul(2).mul(u.uTurbulence)).add(time.mul(0.5)).sin()
  let curtain = fold1.smoothstep(0, 0.8).mul(fold1.smoothstep(1, 0.3))

  // Secondary detail
  const detail = phi.mul(12).mul(waveFreq).add(theta.mul(5)).add(time.mul(0.7)).sin().mul(0.3)
  curtain = curtain.add(detail.mul(curtain.smoothstep(0.2, 0.6)))

  // Pulsing glow
  const pulseGlow = time.mul(0.18).add(theta.mul(2)).sin().mul(0.15).add(1)

  // Vertical fade
  const verticalFade = dir.y.add(0.2).clamp(0, 1).pow(0.5)
  const bottomFade = dir.y.smoothstep(-0.3, 0.2)

  // Combined intensity
  const intensity = curtain.mul(verticalFade).mul(bottomFade).mul(pulseGlow).mul(u.uScale)
  const v = intensity.clamp(0, 1)

  // Dark sky background
  const nightSky = vec3(0.02, 0.02, 0.05)

  // Color calculation
  const colorShift = time.mul(0.08).sin().mul(0.1)
  const usePalette = u.uUsePalette.greaterThan(0.5)

  const paletteT = v.mul(0.7).add(0.15).add(colorShift)
  const paletteColor = cosinePalette(paletteT, u.uPalA, u.uPalB, u.uPalC, u.uPalD)

  // Vertical color variation
  const heightColor = dir.y.smoothstep(0, 0.6)
  const topColor = cosinePalette(float(0.8), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const paletteWithTop = paletteColor.mix(topColor, heightColor.mul(0.4))

  const gradientT = dir.y.smoothstep(0, 0.5).add(colorShift).clamp(0, 1)
  const simpleColor = u.uColor1.mix(u.uColor2, gradientT)

  const auroraColor = select(usePalette, paletteWithTop, simpleColor)

  // Final composite
  return nightSky.mix(auroraColor, intensity.mul(auroraHeight).mul(1.5))
})

// ============================================================================
// Mode 2: Nebula - Volumetric Clouds
// ============================================================================

export const createNebulaMode = (u: SkyboxUniforms) => Fn(([dir, time]: [Node, Node]) => {
  let p = dir.mul(u.uScale).mul(2).toVar('nebulaPos')

  // Slow drift
  p.assign(p.add(vec3(time.mul(-0.05), float(0), time.mul(0.03))))
  p.assign(p.add(u.uEvolution.mul(3)))

  // Main structure
  const mainCoord = p.mul(0.7).add(vec3(time.mul(0.05), float(0), time.mul(0.03)))
  const mainDensity = fbm2(mainCoord).smoothstep(0.25, 0.75)

  // Detail layer
  const detailCoord = p.mul(1.5).add(mainDensity.mul(u.uTurbulence).mul(0.5))
  const detailDensity = fbm2(detailCoord).smoothstep(0.3, 0.7)

  // Bright knots
  const knotNoise = noise3D(p.mul(3).add(time.mul(0.05)))
  const knots = knotNoise.smoothstep(0.6, 0.9).pow(3).mul(u.uComplexity)

  // Combined density
  const totalDensity = mainDensity.mul(0.6).add(detailDensity.mul(0.25)).add(knots.mul(0.25))

  // Absorption
  const absorption = mainDensity.oneMinus().mul(detailDensity).mul(0.3)

  // Coloring
  const usePalette = u.uUsePalette.greaterThan(0.5)

  const deepPal = cosinePalette(float(0.1), u.uPalA, u.uPalB, u.uPalC, u.uPalD).mul(0.1)
  const emissionPal = cosinePalette(mainDensity.mul(0.6).add(0.2), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const knotPal = cosinePalette(float(0.85), u.uPalA, u.uPalB, u.uPalC, u.uPalD).mul(1.5)

  const deepSimple = u.uColor1.mul(0.1)
  const emissionSimple = u.uColor1.mix(u.uColor2, mainDensity)
  const knotSimple = u.uColor2.mul(1.5)

  const deepColor = select(usePalette, deepPal, deepSimple)
  const emissionColor = select(usePalette, emissionPal, emissionSimple)
  const knotColor = select(usePalette, knotPal, knotSimple)

  let col = deepColor.toVar('nebulaCol')
  col.assign(col.mix(emissionColor, mainDensity.mul(0.8)))
  col.assign(col.mix(deepColor, absorption))
  col.assign(col.add(knotColor.mul(knots)))
  col.assign(col.mul(totalDensity.smoothstep(0, 0.4).mul(0.7).add(0.3)))

  return col
})

// ============================================================================
// Mode 3: Crystalline - Geometric Voronoi patterns
// ============================================================================

export const createCrystallineMode = (u: SkyboxUniforms) => Fn(([dir, time]: [Node, Node]) => {
  let p = dir.mul(u.uScale).mul(3).toVar('crystalPos')

  // Slow rotation - manual 2D rotation in XZ plane
  const rotAngle = time.mul(0.02)
  const c = rotAngle.cos()
  const s = rotAngle.sin()
  // Manual 2D rotation: x' = x*cos - z*sin, z' = x*sin + z*cos
  const rotatedX = p.x.mul(c).sub(p.z.mul(s))
  const rotatedZ = p.x.mul(s).add(p.z.mul(c))
  p.assign(vec3(rotatedX, p.y, rotatedZ))

  // Evolution offset
  p.assign(p.add(u.uEvolution.mul(2)))

  // Multi-layer voronoi
  const v1 = voronoi3D(p)
  const v2 = voronoi3D(p.mul(2).add(100))

  // Edge detection
  const edge1 = v1.y.sub(v1.x).smoothstep(0.02, 0.08)
  const edge2 = v2.y.sub(v2.x).smoothstep(0.02, 0.06)

  // Cell value
  const cellValue = v1.x.mul(0.6).add(v2.x.mul(0.4))

  // Iridescence
  const iridescence = dir.dot(vec3(0, 1, 0)).mul(0.5).add(0.5)
    .add(cellValue.mul(TAU).add(time.mul(0.1)).sin().mul(0.2))

  const usePalette = u.uUsePalette.greaterThan(0.5)

  const palColor = cosinePalette(iridescence, u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const palBlended = palColor.mul(0.3).mix(palColor, edge1.mul(edge2))
  const shimmerPal = cosinePalette(float(0.9), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const palWithShimmer = palBlended.add(shimmerPal.mul(0.15).mul(edge1.oneMinus()).mul(iridescence.mul(iridescence)))

  const simpleColor = u.uColor1.mix(u.uColor2, iridescence)
  const simpleBlended = simpleColor.mul(0.2).mix(simpleColor, edge1.mul(edge2))
  const simpleWithShimmer = simpleBlended.add(u.uColor2.mul(0.15).mul(edge1.oneMinus()).mul(iridescence.mul(iridescence)))

  return select(usePalette, palWithShimmer, simpleWithShimmer)
})

// ============================================================================
// Mode 4: Horizon - Clean Studio Environment
// ============================================================================

export const createHorizonMode = (u: SkyboxUniforms) => Fn(([dir, time]: [Node, Node]) => {
  const y = dir.y
  const contrastMod = float(0.5).add(u.uHorizonGradientContrast)

  // Gradient zones
  const floorZone = y.smoothstep(float(-1), contrastMod.mul(-0.2))
  const horizonZone = y.abs().mul(contrastMod.mul(0.5).add(1)).oneMinus().max(0).pow(contrastMod.add(1.5))
  const upperZone = y.smoothstep(contrastMod.mul(-0.1), contrastMod.mul(0.8))

  // Gradient position
  let gradientPos = y.mul(0.5).add(0.5).clamp(0, 1).pow(u.uComplexity.mul(0.4).add(0.8))

  // Horizontal sweep
  const sweep = dir.x.mul(PI).mul(0.5).sin().mul(0.05)
  gradientPos = gradientPos.add(sweep.mul(y.abs().oneMinus()))

  // Animations
  const breathe = time.mul(0.2).sin().mul(0.02)
  gradientPos = gradientPos.add(breathe.mul(horizonZone))

  const tempPulse = time.mul(0.12).sin().mul(0.08).add(time.mul(0.07).sin().mul(0.04))

  const sweepAngle = time.mul(0.15).mod(TAU)
  const lightAngle = atan2Args(dir.x, dir.z).sub(sweepAngle)
  const lightSweep = lightAngle.sin().max(0).pow(8).mul(0.15).mul(horizonZone)

  const ambientPulse = time.mul(0.1).add(dir.x.mul(0.5)).sin().mul(0.03).add(1)

  const usePalette = u.uUsePalette.greaterThan(0.5)

  // Palette colors
  const floorPal = cosinePalette(tempPulse.mul(0.1).add(0.1), u.uPalA, u.uPalB, u.uPalC, u.uPalD).mul(0.6)
  const horizonPal = cosinePalette(tempPulse.mul(0.05).add(0.4), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const midPal = cosinePalette(float(0.6), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const topPal = cosinePalette(tempPulse.mul(-0.05).add(0.85), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const sweepPal = cosinePalette(float(0.95), u.uPalA, u.uPalB, u.uPalC, u.uPalD)

  let colPal = floorPal.mix(horizonPal, floorZone)
  colPal = colPal.mix(midPal, y.smoothstep(-0.1, 0.3))
  colPal = colPal.mix(topPal, upperZone)
  colPal = colPal.add(horizonPal.mul(horizonZone).mul(u.uScale).mul(0.2))
  colPal = colPal.add(sweepPal.mul(lightSweep))

  // Simple colors
  const tempShift = tempPulse.mul(0.1)
  const floorSimple = u.uColor1.mul(tempShift.add(0.5))
  const horizonSimple = u.uColor1.mix(u.uColor2, tempShift.add(0.5))
  const topSimple = u.uColor2.mul(tempShift.mul(-0.5).add(1))

  let colSimple = floorSimple.mix(horizonSimple, floorZone)
  colSimple = colSimple.mix(topSimple, upperZone)
  colSimple = colSimple.add(horizonSimple.mul(horizonZone).mul(u.uScale).mul(0.15))
  colSimple = colSimple.add(u.uColor1.mix(u.uColor2, float(0.8)).mul(lightSweep))

  let col = select(usePalette, colPal, colSimple)
  col = col.mul(ambientPulse)

  // Micro texture
  const microTexture = noise3D(dir.mul(50)).mul(u.uComplexity).mul(0.015)
  col = col.add(microTexture)

  // Spotlight
  const spotlightStrength = u.uHorizonSpotlightFocus.mul(0.25).add(0.05)
  const spotlightMin = u.uHorizonSpotlightFocus.oneMinus().mul(0.25).add(0.7)
  const spotlight = vec2(dir.x, dir.z).length().mul(spotlightStrength).oneMinus()
  col = col.mul(spotlight.max(spotlightMin))

  return col
})

// ============================================================================
// Mode 5: Ocean - Underwater atmosphere
// ============================================================================

export const createOceanMode = (u: SkyboxUniforms) => Fn(([dir, time]: [Node, Node]) => {
  // Depth gradient
  const depthBase = dir.y.mul(0.5).add(0.5).oneMinus()
  const depthPow = u.uOceanDepthGradient.mul(0.5).add(0.5)
  const depth = depthBase.pow(depthPow)

  let p = dir.mul(u.uScale).mul(4)
  p = vec3(p.x, p.y.mul(0.5), p.z)

  // Caustic layers
  const c1 = p.add(vec3(time.mul(0.03), time.mul(0.02), float(0)))
  const caustic1Raw = c1.x.mul(2).add(c1.z.mul(3).sin()).sin()
    .mul(c1.z.mul(2).add(c1.x.mul(3).sin()).sin())
  const caustic1 = caustic1Raw.mul(0.5).add(0.5).clamp(0, 1).pow(2.5)

  const c2 = p.mul(1.5).add(vec3(time.mul(-0.02), time.mul(0.015), time.mul(0.01)))
  const caustic2Raw = c2.x.mul(3).add(c2.z.mul(2).sin()).sin()
    .mul(c2.z.mul(3).add(c2.x.mul(2).sin()).sin())
  const caustic2 = caustic2Raw.mul(0.5).add(0.5).clamp(0, 1).pow(2.5)

  const c3 = p.mul(2.5).add(vec3(time.mul(0.01), time.mul(-0.025), time.mul(0.02)))
  const caustic3Raw = c3.x.mul(4).add(c3.z.mul(5).add(c3.y.mul(2)).sin()).sin()
    .mul(c3.z.mul(4).add(c3.x.mul(5).sub(c3.y.mul(2)).sin()).sin())
  const caustic3 = caustic3Raw.mul(0.5).add(0.5).clamp(0, 1).mul(caustic3Raw.mul(0.5).add(0.5).clamp(0, 1))

  let caustics = caustic1.mul(0.4).add(caustic2.mul(0.35)).add(caustic3.mul(0.25))
  caustics = caustics.mul(depth.mul(0.4).oneMinus())
  caustics = caustics.mul(u.uComplexity).mul(u.uOceanCausticIntensity).mul(2.5)

  const usePalette = u.uUsePalette.greaterThan(0.5)

  // User colors
  const userDeepPal = cosinePalette(float(0), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const userMidPal = cosinePalette(float(0.5), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const userSurfPal = cosinePalette(float(1), u.uPalA, u.uPalB, u.uPalC, u.uPalD)

  const userDeep = select(usePalette, userDeepPal, u.uColor1)
  const userMid = select(usePalette, userMidPal, u.uColor1.mix(u.uColor2, float(0.5)))
  const userSurf = select(usePalette, userSurfPal, u.uColor2)

  // Contrast boost
  const deepLum = userDeep.dot(vec3(0.299, 0.587, 0.114))
  const surfLum = userSurf.dot(vec3(0.299, 0.587, 0.114))
  const paletteContrast = surfLum.sub(deepLum).abs()
  const contrastBoost = paletteContrast.oneMinus().mul(1.5).add(1)

  // Enhanced colors
  const colorDir = userSurf.sub(userDeep).add(0.001).normalize()
  const seaweedHighlight = userMid.add(colorDir.mul(0.4).mul(contrastBoost))
  const seaweedShadow = userMid.sub(colorDir.mul(0.3).mul(contrastBoost))

  // Base water color
  const surfaceColor = userSurf
  const deepColor = userDeep.mul(contrastBoost.mul(0.1).add(0.15))
  const midColor = userMid.mul(contrastBoost.mul(0.1).add(0.5))

  let col = surfaceColor.mix(midColor, depth)
  col = col.mix(deepColor, depth.mul(depth))

  // Seaweed pattern
  const seaweedColor = seaweedShadow.mix(seaweedHighlight, caustics)
  const seaweedDepthMask = depth.smoothstep(0, 0.3).mul(depth.smoothstep(1, 0.5)).max(0.3)

  // Overlay blend
  const below = col.mul(seaweedColor).mul(2)
  const above = col.oneMinus().mul(seaweedColor.oneMinus()).mul(2).oneMinus()
  const seaweedOverlay = select(col.x.greaterThan(0.5), above, below)

  col = col.mix(seaweedOverlay, seaweedDepthMask.mul(u.uOceanCausticIntensity).mul(0.8))
  col = col.add(caustics.mul(seaweedHighlight).mul(0.4))

  // Bubbles (simplified for performance)
  const bubblePos = dir.mul(u.uScale).mul(8).sub(vec3(0, time.mul(0.05), 0))
  const bubbleNoise = noise3D(bubblePos.mul(3)).smoothstep(u.uOceanBubbleDensity.mul(-0.15).add(0.55), float(0.7))
  const bubbleFade = depth.mul(0.7).oneMinus().mul(0.3)
  col = col.add(bubbleNoise.mul(seaweedHighlight).mul(bubbleFade).mul(u.uOceanBubbleDensity).mul(0.35))

  // Surface shimmer
  const surfaceProximity = depth.smoothstep(0.5, 0)
  const shimmerUV = vec2(dir.x, dir.z).mul(u.uScale).mul(6)
  const shimmer1 = shimmerUV.x.mul(2).add(time.mul(0.4)).sin()
    .mul(shimmerUV.y.mul(2.5).add(time.mul(0.35)).sin())
    .mul(0.5).add(0.5)
  const shimmer = shimmer1.mul(shimmer1).mul(surfaceProximity).mul(u.uOceanSurfaceShimmer)
  col = col.add(shimmer.mul(seaweedHighlight).mul(0.45))

  return col
})

// ============================================================================
// Mode 6: Twilight - Sunset/sunrise gradient
// ============================================================================

export const createTwilightMode = (u: SkyboxUniforms) => Fn(([dir, time]: [Node, Node]) => {
  const y = dir.y
  const tempShift = time.mul(0.02).sin().mul(0.5).add(0.5)

  // Sun direction
  const sunAngle = time.mul(0.01).add(u.uEvolution)
  const sunDir = vec3(sunAngle.cos(), float(0.1), sunAngle.sin()).normalize()

  // Atmospheric scattering
  const scatter = y.abs().oneMinus().mul(y.abs().oneMinus())

  const gradientY = y.mul(0.5).add(0.5)

  const usePalette = u.uUsePalette.greaterThan(0.5)

  // Palette mode
  const palettePos = gradientY.add(tempShift.mul(0.2)).sub(0.1).clamp(0, 1)
  const skyColorPal = cosinePalette(palettePos, u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  const horizonColorPal = cosinePalette(tempShift.mul(0.3).add(0.5), u.uPalA, u.uPalB, u.uPalC, u.uPalD)
  let colPal = horizonColorPal.mix(skyColorPal, y.abs().sqrt())

  // Sun glow
  const sunDot = dir.dot(sunDir).max(0)
  const sunGlow = sunDot.mul(sunDot).mul(sunDot).mul(sunDot)
  const sunColorPal = cosinePalette(tempShift, u.uPalA, u.uPalB, u.uPalC, u.uPalD).mul(1.5)
  colPal = colPal.mix(sunColorPal, sunGlow.mul(0.5))

  // Simple mode
  const topColor = u.uColor1.mix(u.uColor2, tempShift)
  const horizonColorSimple = u.uColor2.mix(u.uColor1, tempShift).mul(1.2)
  const bottomColor = u.uColor1.mul(0.3)

  const aboveHorizon = y.greaterThan(0)
  const colAbove = horizonColorSimple.mix(topColor, y.pow(0.7))
  const colBelow = horizonColorSimple.mix(bottomColor, y.negate().sqrt())
  let colSimple = select(aboveHorizon, colAbove, colBelow)

  const sunColorSimple = u.uColor2.mix(u.uColor1, tempShift).mul(1.5)
  colSimple = colSimple.mix(sunColorSimple, sunGlow.mul(0.5))

  let col = select(usePalette, colPal, colSimple)

  // Atmospheric layers
  const atmNoise = noise3D(dir.mul(4).add(time.mul(0.01)))
  const layers = y.mul(20).add(atmNoise.mul(2)).sin().mul(0.02)
  col = col.add(layers.mul(scatter))

  // Haze
  const haze = scatter.mul(atmNoise).mul(0.1)
  col = col.mix(col.mul(1.2), haze)

  return col
})

// ============================================================================
// Mode 7: Classic - Cube texture sampling
// ============================================================================

export const createClassicMode = (u: SkyboxUniforms) => Fn(([dir, _time]: [Node, Node]) => {
  // For classic mode, we need cube texture sampling which requires different approach
  // This returns a placeholder - actual cube sampling happens in the material
  // The classic mode in WebGPU should use a standard cubemap material

  // Fallback: return a simple gradient
  const y = dir.y.mul(0.5).add(0.5)
  const baseColor = u.uColor1.mix(u.uColor2, y)

  // Apply hue/saturation if set
  const hsv = rgb2hsv(baseColor)
  const adjustedHsv = vec3(
    hsv.x.add(u.uHue),
    hsv.y.mul(u.uSaturation),
    hsv.z.mul(u.uIntensity)
  )

  return hsv2rgb(adjustedHsv)
})
