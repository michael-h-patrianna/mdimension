export const modulationBlock = `
    // Vertex modulation uniforms
    uniform float uAnimTime;       // Time in seconds
    uniform float uModAmplitude;   // Displacement amplitude (0-1)
    uniform float uModFrequency;   // Oscillation frequency
    uniform float uModWave;        // Phase offset based on distance (wave effect)
    uniform float uModBias;        // Per-vertex/dimension phase variation

    // Radial breathing modulation - smooth coherent motion
    vec3 modulateVertex(vec3 pos, float extraDimSum) {
      if (uModAmplitude < 0.001) return pos;

      // Very slow base oscillation
      float t = uAnimTime * uModFrequency * 0.1;

      // Wave: phase offset based on distance from origin (radial wave effect)
      float dist = length(pos);
      float wavePhase = dist * uModWave * 2.0;

      // Bias: per-vertex variation based on position coordinates
      // Creates unique phase for each vertex based on its spatial location
      float vertexBias = (pos.x * 1.0 + pos.y * 1.618 + pos.z * 2.236) * uModBias;

      // Bias: per-dimension variation using extra dimension coordinates
      // Vertices in higher dimensions get additional phase offset
      float dimensionBias = extraDimSum * uModBias * 0.5;

      // Combined phase
      float totalPhase = t + wavePhase + vertexBias + dimensionBias;

      // Single sine wave controls radial scale
      float scale = 1.0 + sin(totalPhase) * uModAmplitude * 0.05;

      return pos * scale;
    }
`;
