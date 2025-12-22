/**
 * Normal Composite Shader (GLSL ES 3.00)
 *
 * Composites environment normals with main object MRT normals, and optionally
 * overlays volumetric normals from the temporal cloud buffer.
 */

export const normalCompositeFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uNormalEnv;
uniform sampler2D uMainNormal;
uniform sampler2D uMainDepth;
uniform sampler2D uSceneDepth;
uniform sampler2D uCloudNormal;
uniform float uCloudAvailable;

in vec2 vUv;
layout(location = 0) out vec4 fragColor;

float normalMagnitude(vec4 n) {
  return length(n.rgb);
}

void main() {
  vec4 envNormal = texture(uNormalEnv, vUv);
  vec4 mainNormal = texture(uMainNormal, vUv);
  float mainDepth = texture(uMainDepth, vUv).r;
  float sceneDepth = texture(uSceneDepth, vUv).r;

  vec4 outNormal = envNormal;

  float hasMainNormal = step(0.001, normalMagnitude(mainNormal));
  if (hasMainNormal > 0.5 && mainDepth <= sceneDepth + 0.0001) {
    outNormal = mainNormal;
  }

  if (uCloudAvailable > 0.5) {
    vec4 cloudNormal = texture(uCloudNormal, vUv);
    float hasCloudNormal = step(0.001, normalMagnitude(cloudNormal));
    if (hasCloudNormal > 0.5) {
      outNormal = cloudNormal;
    }
  }

  fragColor = outNormal;
}
`;
