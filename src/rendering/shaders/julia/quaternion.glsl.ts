export const quaternionBlock = `
// ============================================
// Power helper
// ============================================

float getEffectivePower() {
    float basePower = uPowerAnimationEnabled ? uAnimatedPower : uPower;
    return max(basePower, 2.0);
}

// ============================================
// Quaternion Operations
// ============================================

// Quaternion multiplication: q1 * q2
vec4 quatMul(vec4 q1, vec4 q2) {
    return vec4(
        q1.x * q2.x - q1.y * q2.y - q1.z * q2.z - q1.w * q2.w,
        q1.x * q2.y + q1.y * q2.x + q1.z * q2.w - q1.w * q2.z,
        q1.x * q2.z - q1.y * q2.w + q1.z * q2.x + q1.w * q2.y,
        q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x
    );
}

// Quaternion squared: q * q
vec4 quatSqr(vec4 q) {
    float xx = q.x * q.x;
    float yy = q.y * q.y;
    float zz = q.z * q.z;
    float ww = q.w * q.w;
    return vec4(
        xx - yy - zz - ww,
        2.0 * q.x * q.y,
        2.0 * q.x * q.z,
        2.0 * q.x * q.w
    );
}

// Quaternion power using hyperspherical coordinates
// For generalized power n (including non-integer)
// OPTIMIZATION: Uses fast path for n=2 (the most common case) to avoid
// expensive transcendental functions (acos, cos, sin, pow)
vec4 quatPow(vec4 q, float n) {
    // Fast path for n=2 (most common Julia set)
    // Avoids: 1 acos, 2 cos/sin, 1 pow = saves ~20 ALU operations
    if (abs(n - 2.0) < 0.01) {
        return quatSqr(q);
    }

    // Fast path for n=3 (cubic Julia)
    if (abs(n - 3.0) < 0.01) {
        return quatMul(quatSqr(q), q);
    }

    // Fast path for n=4 (quartic Julia)
    if (abs(n - 4.0) < 0.01) {
        vec4 q2 = quatSqr(q);
        return quatSqr(q2);
    }

    float r = length(q);
    if (r < EPS) return vec4(0.0);

    // Normalize the vector part
    vec3 v = q.yzw;
    float vLen = length(v);

    if (vLen < EPS) {
        // Pure scalar quaternion
        float rn = pow(r, n);
        return vec4(rn * (q.x >= 0.0 ? 1.0 : -1.0), 0.0, 0.0, 0.0);
    }

    // Convert to hyperspherical: q = r * (cos(theta) + sin(theta) * v_hat)
    float theta = acos(clamp(q.x / r, -1.0, 1.0));
    vec3 vHat = v / vLen;

    // Apply power: q^n = r^n * (cos(n*theta) + sin(n*theta) * v_hat)
    float rn = pow(r, n);
    float nTheta = n * theta;
    float cosNT = cos(nTheta);
    float sinNT = sin(nTheta);

    return vec4(rn * cosNT, rn * sinNT * vHat);
}
`;
