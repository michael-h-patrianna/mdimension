/**
 * Hydrogen ND for 7D - Hydrogen orbital + 4 HO dimensions
 *
 * Fully unrolled for performance.
 */
export const hydrogenND7dBlock = `
// ============================================
// Hydrogen ND - 7D (4 Extra Dimensions)
// ============================================

vec2 evalHydrogenNDPsi7D(float xND[MAX_DIM], float t) {
    float x0 = xND[0], x1 = xND[1], x2 = xND[2];
    float x3 = xND[3], x4 = xND[4], x5 = xND[5], x6 = xND[6];

    // 7D radius
    float r7D = sqrt(x0*x0 + x1*x1 + x2*x2 + x3*x3 + x4*x4 + x5*x5 + x6*x6);
    float r3D = radius3D(x0, x1, x2);

    vec2 angles = sphericalAngles3D(x0, x1, x2, r3D);
    float theta = angles.x, phi = angles.y;

    float R = hydrogenRadial(uPrincipalN, uAzimuthalL, r7D, uBohrRadius);
    float Y = evalHydrogenNDAngular(uAzimuthalL, uMagneticM, theta, phi, uUseRealOrbitals);

    // Unrolled extra dimension factors
    float ef0 = extraDimFactor(0, x3);
    float ef1 = extraDimFactor(1, x4);
    float ef2 = extraDimFactor(2, x5);
    float ef3 = extraDimFactor(3, x6);
    float extraProduct = ef0 * ef1 * ef2 * ef3;

    float psiReal = R * Y * extraProduct;
    return hydrogenNDTimeEvolution(psiReal, uPrincipalN, t);
}
`;
