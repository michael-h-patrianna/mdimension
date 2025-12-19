# PRD: Blackbody Radiation Coloring

## 1. Overview
Replace the abstract "Cosine Palette" with a physically based Blackbody Radiation temperature gradient. This visually connects "Probability Density" with "Energy Density."

## 2. Mathematical Concept
Planck's Law describes the spectral radiance of a body at temperature $T$.
Mapping:
- **Low Density ($\rho \approx 0$)**: 0K (Black/Invisible)
- **Mid Density ($\rho \approx 0.5$)**: 1000K (Deep Red/Orange)
- **High Density ($\rho \approx 1.0$)**: 6000K (White/Yellow)
- **Peak Density ($\rho > 5.0$)**: 15000K (Blue-White/UV)

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/volume/emission.glsl.ts`

Add helper function `blackbody(float temp)`:

```glsl
// Analytic approximation of blackbody color (rgb)
vec3 blackbody(float Temp) {
    vec3 col = vec3(255.);
    col.x = 56100000. * pow(Temp,(-3. / 2.)) + 148.;
    col.y = 100040000. * pow(Temp,(-3. / 2.)) + 66.;
    col.z = 194180000. * pow(Temp,(-3. / 2.)) + 30.;
    col = col / 255.;
    return clamp(col, 0., 1.);
}
// Note: Use a more optimized curve fit or texture lookup in production.
```

Modify `computeBaseColor`:

```glsl
float temperature = uTemperatureScale * density; // e.g., 5000 * rho
vec3 emission = blackbody(temperature);
```

## 4. Uniforms Required
- `uTemperatureScale` (float): Scaling factor to map density to Kelvin (e.g., 2000.0 to 10000.0).

## 5. Performance Impact
🟢 **Low Cost**: Simple math or 1 texture lookup.

```