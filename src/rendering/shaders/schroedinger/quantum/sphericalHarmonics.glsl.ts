/**
 * Spherical Harmonics Y_lm(θ, φ)
 *
 * Spherical harmonics form the angular part of hydrogen atom wavefunctions.
 * They describe how electron probability density varies with direction.
 *
 * Complex form:
 *   Y_lm(θ, φ) = K_l^m · P^{|m|}_l(cos θ) · e^{imφ}
 *
 * Real form (for px, py, pz notation):
 *   m > 0: Y_lm^real = √2 · Re(Y_lm) = √2 · K · P · cos(mφ)
 *   m < 0: Y_lm^real = √2 · Im(Y_{l|m|}) = √2 · K · P · sin(|m|φ)
 *   m = 0: Y_l0^real = Y_l0 (already real)
 *
 * @see https://en.wikipedia.org/wiki/Spherical_harmonics
 */
export const sphericalHarmonicsBlock = `
// ============================================
// Spherical Harmonics Y_lm(θ, φ)
// ============================================

/**
 * Factorial function for small integers
 * Used in normalization constants
 */
float factorial(int n) {
    if (n <= 1) return 1.0;
    float result = 1.0;
    for (int i = 2; i <= n; i++) {
        result *= float(i);
    }
    return result;
}

/**
 * Compute normalization constant K_l^m for spherical harmonics
 *
 * K_l^m = sqrt((2l+1)/(4π) · (l-|m|)!/(l+|m|)!)
 *
 * This ensures ∫|Y_lm|² dΩ = 1
 *
 * @param l - Degree
 * @param m - Order
 * @return Normalization constant
 */
float sphericalHarmonicNorm(int l, int m) {
    int absM = abs(m);

    // (2l+1) / (4π)
    float front = float(2 * l + 1) / (4.0 * PI);

    // (l-|m|)! / (l+|m|)!
    // Compute as product to avoid large factorial values
    float factRatio = 1.0;
    for (int i = l - absM + 1; i <= l + absM; i++) {
        factRatio *= float(i);
    }
    factRatio = 1.0 / factRatio;

    return sqrt(front * factRatio);
}

/**
 * Compute complex spherical harmonic Y_lm(θ, φ)
 *
 * Returns vec2(Re, Im) representing the complex value.
 *
 * @param l - Degree (0 to MAX_LEGENDRE_L)
 * @param m - Order (-l to +l)
 * @param theta - Polar angle from z-axis [0, π]
 * @param phi - Azimuthal angle [0, 2π]
 * @return Complex Y_lm as vec2(re, im)
 */
vec2 sphericalHarmonic(int l, int m, float theta, float phi) {
    // Normalization constant
    float K = sphericalHarmonicNorm(l, m);

    // Associated Legendre polynomial P^{|m|}_l(cos θ)
    float P = legendre(l, m, cos(theta));

    // Phase factor e^{imφ}
    float mPhi = float(m) * phi;
    vec2 phase = vec2(cos(mPhi), sin(mPhi));

    // Y_lm = K · P · e^{imφ}
    return K * P * phase;
}

/**
 * Compute real spherical harmonic for orbital visualization
 *
 * Real spherical harmonics are linear combinations of Y_lm and Y_l(-m)
 * that produce real-valued functions. These correspond to the familiar
 * orbital shapes: px, py, pz, dxy, dxz, etc.
 *
 * Real form:
 *   m > 0: S_lm = √2 · (-1)^m · Re(Y_lm) ∝ cos(mφ)
 *   m < 0: S_lm = √2 · (-1)^m · Im(Y_{l|m|}) ∝ sin(|m|φ)
 *   m = 0: S_l0 = Y_l0 (already real)
 *
 * @param l - Degree
 * @param m - Order
 * @param theta - Polar angle [0, π]
 * @param phi - Azimuthal angle [0, 2π]
 * @param useReal - If true, return real orbital; if false, return |Y_lm|
 * @return Real spherical harmonic value
 */
float realSphericalHarmonic(int l, int m, float theta, float phi, bool useReal) {
    if (!useReal) {
        // Return magnitude of complex spherical harmonic
        vec2 Y = sphericalHarmonic(l, m, theta, phi);
        return length(Y);
    }

    // Real spherical harmonic
    // Note: The Condon-Shortley phase (-1)^m is already included in the
    // legendre() function (see legendre.glsl.ts line 62), so we don't
    // apply it again here. This follows the quantum chemistry convention.
    float K = sphericalHarmonicNorm(l, abs(m));
    float P = legendre(l, abs(m), cos(theta));

    if (m == 0) {
        // m = 0: Y_l0 is already real
        return K * P;
    } else if (m > 0) {
        // m > 0: proportional to cos(mφ)
        // S_lm = √2 · K · P · cos(mφ)
        return sqrt(2.0) * K * P * cos(float(m) * phi);
    } else {
        // m < 0: proportional to sin(|m|φ)
        // S_l(-m) = √2 · K · P · sin(|m|φ)
        return sqrt(2.0) * K * P * sin(float(-m) * phi);
    }
}

/**
 * Fast evaluation for common orbital shapes
 *
 * Direct computation without Legendre recursion for l <= 2.
 * These are the most commonly visualized orbitals.
 *
 * @param l - Degree (0, 1, or 2)
 * @param m - Order
 * @param theta - Polar angle
 * @param phi - Azimuthal angle
 * @return Real spherical harmonic value
 */
float fastRealSphericalHarmonic(int l, int m, float theta, float phi) {
    float ct = cos(theta);
    float st = sin(theta);

    // s orbital (l=0)
    if (l == 0) {
        // Y_00 = 1/(2√π)
        return 0.28209479; // 1/(2*sqrt(PI))
    }

    // p orbitals (l=1)
    if (l == 1) {
        float norm = 0.48860251; // sqrt(3/(4*PI))
        if (m == 0) {
            // pz: ∝ cos(θ)
            return norm * ct;
        } else if (m == 1) {
            // px: ∝ sin(θ)cos(φ)
            return norm * st * cos(phi);
        } else { // m == -1
            // py: ∝ sin(θ)sin(φ)
            return norm * st * sin(phi);
        }
    }

    // d orbitals (l=2)
    if (l == 2) {
        float ct2 = ct * ct;
        float st2 = st * st;

        if (m == 0) {
            // dz2: ∝ (3cos²θ - 1)
            float norm = 0.31539157; // sqrt(5/(16*PI))
            return norm * (3.0 * ct2 - 1.0);
        } else if (m == 1) {
            // dxz: ∝ sin(θ)cos(θ)cos(φ)
            float norm = 0.77254840; // sqrt(15/(4*PI))
            return norm * st * ct * cos(phi);
        } else if (m == -1) {
            // dyz: ∝ sin(θ)cos(θ)sin(φ)
            float norm = 0.77254840;
            return norm * st * ct * sin(phi);
        } else if (m == 2) {
            // dxy: ∝ sin²(θ)sin(2φ)
            float norm = 0.54627422; // sqrt(15/(16*PI))
            return norm * st2 * sin(2.0 * phi);
        } else { // m == -2
            // dx2-y2: ∝ sin²(θ)cos(2φ)
            float norm = 0.54627422;
            return norm * st2 * cos(2.0 * phi);
        }
    }

    // Fall back to general computation for l > 2
    return realSphericalHarmonic(l, m, theta, phi, true);
}
`;
