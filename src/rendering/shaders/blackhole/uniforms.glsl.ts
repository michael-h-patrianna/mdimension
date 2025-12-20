/**
 * Black Hole Uniforms
 *
 * Shader uniforms for n-dimensional black hole visualization.
 * Includes gravitational lensing, photon shell, and accretion manifold parameters.
 */

/**
 * Black hole-specific uniforms
 */
export const blackHoleUniformsBlock = /* glsl */ `
//----------------------------------------------
// BLACK HOLE UNIFORMS
//----------------------------------------------

// Time
uniform float uTime;                // Global time for animations

// Basic
uniform float uHorizonRadius;       // Event horizon radius
uniform float uGravityStrength;     // Lensing intensity k
uniform float uManifoldIntensity;   // Accretion disk emission
uniform float uManifoldThickness;   // Disk thickness
uniform float uPhotonShellWidth;    // Photon shell ring width
uniform float uTimeScale;           // Animation time scale
uniform vec3 uBaseColor;            // Base accretion color
uniform int uPaletteMode;           // 0=diskGradient, 1=normalBased, 2=shellOnly, 3=heatmap
uniform float uBloomBoost;          // HDR bloom multiplier

// Lensing
uniform float uDimensionEmphasis;   // alpha: dimension blend factor
uniform float uDistanceFalloff;     // beta: distance falloff exponent
uniform float uEpsilonMul;          // Numerical stability epsilon
uniform float uBendScale;           // Ray bend scale
uniform float uBendMaxPerStep;      // Max bend angle per step
uniform float uLensingClamp;        // Maximum lensing effect
uniform int uRayBendingMode;        // 0=spiral, 1=orbital (Einstein-ring)
uniform float uDimPower;            // Pre-calculated pow(DIMENSION, emphasis)
uniform float uOriginOffsetLengthSq; // Pre-calculated lengthSq of extra-dim offset

// Photon shell
uniform float uPhotonShellRadiusMul;    // R_p multiplier (default 1.3)
uniform float uPhotonShellRadiusDimBias; // Dimension bias for R_p
uniform float uShellGlowStrength;       // Shell emission intensity
uniform vec3 uShellGlowColor;           // Shell color
uniform float uShellStepMul;            // Step size near shell
uniform float uShellContrastBoost;      // Shell sharpness

// Manifold / Accretion
uniform int uManifoldType;          // 0=auto, 1=disk, 2=sheet, 3=slab, 4=field
uniform float uDensityFalloff;      // Density falloff exponent
uniform float uDiskInnerRadiusMul;  // Inner disk radius multiplier
uniform float uDiskOuterRadiusMul;  // Outer disk radius multiplier
uniform float uRadialSoftnessMul;   // Radial edge softness
uniform float uThicknessPerDimMax;  // Max thickness per extra dimension
uniform float uHighDimWScale;       // W coordinate scaling for high-D
uniform float uSwirlAmount;         // Spiral/swirl intensity
uniform float uNoiseScale;          // Turbulence noise scale
uniform float uNoiseAmount;         // Turbulence noise amount
uniform float uMultiIntersectionGain; // Gain for multiple manifold hits

// Rotation damping
uniform float uDampInnerMul;        // Inner damping multiplier
uniform float uDampOuterMul;        // Outer damping multiplier

// Rendering quality
uniform int uMaxSteps;              // Max raymarch steps
uniform float uStepBase;            // Base step size
uniform float uStepMin;             // Minimum step size
uniform float uStepMax;             // Maximum step size
uniform float uStepAdaptG;          // Adaptive step gravity factor
uniform float uStepAdaptR;          // Adaptive step radius factor
uniform bool uEnableAbsorption;     // Enable volumetric absorption
uniform float uAbsorption;          // Absorption coefficient
uniform float uTransmittanceCutoff; // Early exit transmittance threshold
uniform float uFarRadius;           // Far clipping radius

// Lighting
uniform int uLightingMode;          // 0=emissiveOnly, 1=fakeLit
uniform float uRoughness;           // Surface roughness
uniform float uSpecular;            // Specular intensity
uniform float uAmbientTint;         // Ambient contribution

// Edge glow / Horizon
uniform bool uEdgeGlowEnabled;      // Enable horizon edge glow
uniform float uEdgeGlowWidth;       // Edge glow width
uniform vec3 uEdgeGlowColor;        // Edge glow color
uniform float uEdgeGlowIntensity;   // Edge glow brightness

// Background (uses general skybox system, no built-in fallback)
uniform float uEnvMapReady;         // 1.0 when envMap is valid, 0.0 otherwise

// Doppler effect
uniform bool uDopplerEnabled;       // Enable Doppler shift
uniform float uDopplerStrength;     // Doppler intensity
uniform float uDopplerHueShift;     // Max hue shift

// Polar jets
uniform bool uJetsEnabled;          // Enable polar jets
uniform float uJetsHeight;          // Jet height in R_h units
uniform float uJetsWidth;           // Jet width / cone angle
uniform float uJetsIntensity;       // Jet emission intensity
uniform vec3 uJetsColor;            // Jet base color
uniform float uJetsFalloff;         // Jet intensity falloff
uniform float uJetsNoiseAmount;     // Jet turbulence
uniform float uJetsPulsation;       // Jet pulsation speed

// Motion blur
uniform bool uMotionBlurEnabled;    // Enable motion blur
uniform float uMotionBlurStrength;  // Blur intensity
uniform int uMotionBlurSamples;     // Blur sample count
uniform float uMotionBlurRadialFalloff; // Radial falloff

// Animation state
uniform bool uSwirlAnimationEnabled; // Enable swirl animation
uniform float uSwirlAnimationSpeed;  // Swirl animation speed
uniform bool uPulseEnabled;          // Enable pulse animation
uniform float uPulseSpeed;           // Pulse speed
uniform float uPulseAmount;          // Pulse amount

// Note: N-dimensional basis vectors (uBasisX, uBasisY, uBasisZ, uOrigin) are in shared/core/uniforms.glsl.ts
// Note: uParamValues is declared in compose.ts with dynamic size based on dimension
// Note: uInverseViewProjectionMatrix is in shared/core/uniforms.glsl.ts

// Temporal accumulation (black hole specific)
uniform vec2 uBayerOffset;           // Bayer pattern offset for temporal sampling
uniform vec2 uFullResolution;        // Full resolution (before 1/4 downscale)
`
