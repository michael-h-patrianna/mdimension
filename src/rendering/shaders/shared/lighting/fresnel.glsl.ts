export const fresnelBlock = `
// Fresnel (Schlick approximation)
// Optimized version
float fresnelSchlick(float cosTheta, float F0) {
    float x = 1.0 - cosTheta;
    float x2 = x * x;
    float x5 = x2 * x2 * x; // x^5 with 4 multiplies total
    return F0 + (1.0 - F0) * x5;
}
`;
