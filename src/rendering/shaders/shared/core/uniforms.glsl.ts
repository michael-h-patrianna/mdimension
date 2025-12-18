export const uniformsBlock = `
uniform vec2 uResolution;
uniform vec3 uCameraPosition;
uniform float uPower;
uniform float uIterations;
uniform float uEscapeRadius;
uniform vec3 uColor;
uniform mat4 uModelMatrix;
uniform mat4 uInverseModelMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

uniform int uDimension;

// D-dimensional rotated coordinate system
// c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
uniform float uBasisX[11];
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];

// Multi-Light System Uniforms
uniform int uNumLights;
uniform bool uLightsEnabled[MAX_LIGHTS];
uniform int uLightTypes[MAX_LIGHTS];
uniform vec3 uLightPositions[MAX_LIGHTS];
uniform vec3 uLightDirections[MAX_LIGHTS];
uniform vec3 uLightColors[MAX_LIGHTS];
uniform float uLightIntensities[MAX_LIGHTS];
uniform float uSpotAngles[MAX_LIGHTS];
uniform float uSpotPenumbras[MAX_LIGHTS];
uniform float uSpotCosInner[MAX_LIGHTS];
uniform float uSpotCosOuter[MAX_LIGHTS];
uniform float uLightRanges[MAX_LIGHTS];
uniform float uLightDecays[MAX_LIGHTS];

// Global lighting uniforms
uniform float uAmbientIntensity;
uniform vec3 uAmbientColor;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;
uniform float uMetallic;

// Fresnel rim lighting uniforms
uniform bool uFresnelEnabled;
uniform float uFresnelIntensity;
uniform vec3 uRimColor;

// Advanced Color System uniforms
uniform int uColorAlgorithm;
uniform vec3 uCosineA;
uniform vec3 uCosineB;
uniform vec3 uCosineC;
uniform vec3 uCosineD;
uniform float uDistPower;
uniform float uDistCycles;
uniform float uDistOffset;
uniform float uLchLightness;
uniform float uLchChroma;
uniform vec3 uMultiSourceWeights;

// Performance mode
uniform bool uFastMode;
uniform float uQualityMultiplier;

// Temporal Reprojection uniforms
uniform sampler2D uPrevDepthTexture;
uniform mat4 uPrevViewProjectionMatrix;
uniform mat4 uPrevInverseViewProjectionMatrix;
uniform bool uTemporalEnabled;
uniform vec2 uDepthBufferResolution;

// Orthographic projection uniforms
uniform bool uOrthographic;
uniform vec3 uOrthoRayDir;
uniform mat4 uInverseViewProjectionMatrix;

// Opacity Mode System uniforms
uniform int uOpacityMode;
uniform float uSimpleAlpha;
uniform int uLayerCount;
uniform float uLayerOpacity;
uniform float uVolumetricDensity;
uniform int uSampleQuality;
uniform bool uVolumetricReduceOnAnim;

// Shadow System uniforms
uniform bool uShadowEnabled;
uniform int uShadowQuality;
uniform float uShadowSoftness;
uniform int uShadowAnimationMode;

// Ambient Occlusion uniforms
uniform bool uAoEnabled;
`;
