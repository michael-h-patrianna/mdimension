export const juliaUniformsBlock = `
// Julia constant (fixed c value, not derived from sample position)
uniform vec4 uJuliaConstant;

// Power Animation uniforms
uniform bool uPowerAnimationEnabled;
uniform float uAnimatedPower;

// Dimension Mixing uniforms
uniform bool uDimensionMixEnabled;
uniform float uMixIntensity;
uniform float uMixTime;

// Advanced Rendering
uniform float uRoughness;         // GGX roughness (0.0-1.0)
uniform bool uSssEnabled;         // Enable subsurface scattering
uniform float uSssIntensity;      // SSS intensity
uniform vec3 uSssColor;           // SSS tint color
uniform float uSssThickness;      // SSS thickness factor
uniform float uSssJitter;         // SSS jitter amount (0.0-1.0)

// Atmosphere
uniform bool uFogEnabled;         // Enable scene fog
uniform float uFogContribution;   // Fog contribution
uniform float uInternalFogDensity;// Internal fog density (0.0-1.0)

// LOD
uniform bool uLodEnabled;         // Enable distance-adaptive LOD
uniform float uLodDetail;         // Detail multiplier (epsilon scalar)
`;
