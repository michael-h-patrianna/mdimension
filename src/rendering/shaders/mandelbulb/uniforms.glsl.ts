export const mandelbulbUniformsBlock = `
// Power Animation uniforms (Technique B - power oscillation)
uniform bool uPowerAnimationEnabled;
uniform float uAnimatedPower;         // Computed on CPU: center + amplitude * sin(time * speed)

// Alternate Power uniforms (Technique B variant - blend between two powers)
uniform bool uAlternatePowerEnabled;
uniform float uAlternatePowerValue;   // Second power value to blend with
uniform float uAlternatePowerBlend;   // 0.0-1.0 blend factor

// Dimension Mixing uniforms (Technique A - shear matrix inside iteration)
uniform bool uDimensionMixEnabled;
uniform float uMixIntensity;          // 0.0-0.3 strength of mixing
uniform float uMixTime;               // Animated time for mixing matrix

// Phase Shift uniforms (angular twisting)
uniform bool uPhaseEnabled;
uniform float uPhaseTheta;            // Phase offset for theta angle
uniform float uPhasePhi;              // Phase offset for phi angle
`;
