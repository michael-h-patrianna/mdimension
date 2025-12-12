// ============================================
// Hyperbulb Fragment Shader - OPTIMIZED
// D-dimensional (4D-11D) raymarching
// Hand-optimized: no dynamic loops, no arrays in hot path
// ============================================

precision highp float;

uniform vec3 uCameraPosition;
uniform float uPower;
uniform float uIterations;
uniform float uEscapeRadius;
uniform vec3 uColor;
uniform int uPaletteMode;
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

uniform bool uLightEnabled;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform float uAmbientIntensity;
uniform float uSpecularIntensity;
uniform float uSpecularPower;

varying vec3 vPosition;
varying vec2 vUv;

// Performance constants - tuned for quality/speed balance
#define MAX_MARCH_STEPS 96
#define SURF_DIST 0.003
#define MAX_ITER 48
#define BOUND_R 2.0
#define EPS 1e-6

#define PI 3.14159265359
#define HALF_PI 1.57079632679

// Palette modes
#define PAL_MONO 0
#define PAL_ANALOG 1
#define PAL_COMP 2
#define PAL_TRIAD 3
#define PAL_SPLIT 4

// ============================================
// Color utilities (kept minimal)
// ============================================

vec3 rgb2hsl(vec3 c) {
    float maxC = max(max(c.r, c.g), c.b);
    float minC = min(min(c.r, c.g), c.b);
    float l = (maxC + minC) * 0.5;
    if (maxC == minC) return vec3(0.0, 0.0, l);
    float d = maxC - minC;
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    float h;
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    return vec3(h / 6.0, s, l);
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 0.16667) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 0.66667) return p + (q - p) * (0.66667 - t) * 6.0;
    return p;
}

vec3 hsl2rgb(vec3 hsl) {
    if (hsl.y == 0.0) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    return vec3(hue2rgb(p, q, hsl.x + 0.33333), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 0.33333));
}

vec3 getPaletteColor(vec3 hsl, float t, int mode) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    float minL = min(l * 0.15, 0.08);
    float maxL = l + (1.0 - l) * 0.7;
    if (s < 0.1 && mode != PAL_MONO) { h = 0.0; s = 0.4; }
    float newL = mix(minL, maxL, t);
    if (mode == PAL_MONO) return hsl2rgb(vec3(h, hsl.y, newL));
    if (mode == PAL_ANALOG) return hsl2rgb(vec3(fract(h + (t - 0.5) * 0.167), s, newL));
    if (mode == PAL_COMP) return hsl2rgb(vec3(t < 0.5 ? h : fract(h + 0.5), s, newL));
    if (mode == PAL_TRIAD) {
        float nh = t < 0.333 ? h : (t < 0.667 ? fract(h + 0.333) : fract(h + 0.667));
        return hsl2rgb(vec3(nh, s, newL));
    }
    if (mode == PAL_SPLIT) {
        float nh = t < 0.333 ? h : (t < 0.667 ? fract(h + 0.417) : fract(h + 0.583));
        return hsl2rgb(vec3(nh, s, newL));
    }
    return hsl2rgb(vec3(h, hsl.y, newL));
}

// ============================================
// 4D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf4D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float cw = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];

    // z = iteration variable, starts at 0
    float zx = 0.0, zy = 0.0, zz = 0.0, zw = 0.0;
    float dr = 1.0;
    float r = 0.0;

    // Orbit traps
    float minPlane = 1000.0, minAxis = 1000.0, minSphere = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= maxIt) break;

        // r = |z|
        r = sqrt(zx*zx + zy*zy + zz*zz + zw*zw);
        if (r > bail) { escIt = i; break; }

        // Orbit traps
        minPlane = min(minPlane, abs(zy));
        minAxis = min(minAxis, sqrt(zx*zx + zz*zz));
        minSphere = min(minSphere, abs(r - 0.8));

        // Derivative
        dr = pow(r, pwr - 1.0) * pwr * dr + 1.0;

        // Skip if at origin
        if (r < EPS) {
            zx = cx; zy = cy; zz = cz; zw = cw;
            escIt = i;
            continue;
        }

        // To hyperspherical: 4D needs 3 angles
        float t0 = acos(clamp(zx / r, -1.0, 1.0));
        float ryzw = sqrt(zy*zy + zz*zz + zw*zw);
        float t1 = ryzw > EPS ? acos(clamp(zy / ryzw, -1.0, 1.0)) : 0.0;
        float t2 = atan(zw, zz);

        // Power map: r^n, angles * n
        float rp = pow(r, pwr);
        float p0 = t0 * pwr;
        float p1 = t1 * pwr;
        float p2 = t2 * pwr;

        // From hyperspherical: precompute sin/cos
        float c0 = cos(p0), s0 = sin(p0);
        float c1 = cos(p1), s1 = sin(p1);
        float c2 = cos(p2), s2 = sin(p2);

        float rs0 = rp * s0;
        float rs0s1 = rs0 * s1;
        zx = rp * c0 + cx;
        zy = rs0 * c1 + cy;
        zz = rs0s1 * c2 + cz;
        zw = rs0s1 * s2 + cw;
        escIt = i;
    }

    trap = exp(-minPlane * 5.0) * 0.3 + exp(-minAxis * 3.0) * 0.2 +
           exp(-minSphere * 8.0) * 0.2 + float(escIt) / float(maxIt) * 0.3;
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

float sdf4D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float cw = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float zx = 0.0, zy = 0.0, zz = 0.0, zw = 0.0;
    float dr = 1.0, r = 0.0;

    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + zw*zw);
        if (r > bail) break;
        dr = pow(r, pwr - 1.0) * pwr * dr + 1.0;
        if (r < EPS) { zx = cx; zy = cy; zz = cz; zw = cw; continue; }

        float t0 = acos(clamp(zx / r, -1.0, 1.0));
        float ryzw = sqrt(zy*zy + zz*zz + zw*zw);
        float t1 = ryzw > EPS ? acos(clamp(zy / ryzw, -1.0, 1.0)) : 0.0;
        float t2 = atan(zw, zz);

        float rp = pow(r, pwr);
        float c0 = cos(t0 * pwr), s0 = sin(t0 * pwr);
        float c1 = cos(t1 * pwr), s1 = sin(t1 * pwr);
        float c2 = cos(t2 * pwr), s2 = sin(t2 * pwr);

        float rs0s1 = rp * s0 * s1;
        zx = rp * c0 + cx;
        zy = rp * s0 * c1 + cy;
        zz = rs0s1 * c2 + cz;
        zw = rs0s1 * s2 + cw;
    }
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

// ============================================
// 5D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf5D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float zx = 0.0, zy = 0.0, zz = 0.0, z3 = 0.0, z4 = 0.0;
    float dr = 1.0, r = 0.0;
    float minP = 1000.0, minA = 1000.0, minS = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4);
        if (r > bail) { escIt = i; break; }
        minP = min(minP, abs(zy));
        minA = min(minA, sqrt(zx*zx + zz*zz));
        minS = min(minS, abs(r - 0.8));
        dr = pow(r, pwr - 1.0) * pwr * dr + 1.0;

        if (r < EPS) { zx = cx; zy = cy; zz = cz; z3 = c3; z4 = c4; escIt = i; continue; }

        // 5D: 4 angles
        float t0 = acos(clamp(zx / r, -1.0, 1.0));
        float r1 = sqrt(zy*zy + zz*zz + z3*z3 + z4*z4);
        float t1 = r1 > EPS ? acos(clamp(zy / r1, -1.0, 1.0)) : 0.0;
        float r2 = sqrt(zz*zz + z3*z3 + z4*z4);
        float t2 = r2 > EPS ? acos(clamp(zz / r2, -1.0, 1.0)) : 0.0;
        float t3 = atan(z4, z3);

        float rp = pow(r, pwr);
        float p0 = t0 * pwr, p1 = t1 * pwr, p2 = t2 * pwr, p3 = t3 * pwr;
        float c0 = cos(p0), s0_ = sin(p0);
        float c1 = cos(p1), s1_ = sin(p1);
        float c2 = cos(p2), s2_ = sin(p2);
        float c3_ = cos(p3), s3_ = sin(p3);

        float sp = rp * s0_ * s1_ * s2_;
        zx = rp * c0 + cx;
        zy = rp * s0_ * c1 + cy;
        zz = rp * s0_ * s1_ * c2 + cz;
        z3 = sp * c3_ + c3;
        z4 = sp * s3_ + c4;
        escIt = i;
    }

    trap = exp(-minP * 5.0) * 0.3 + exp(-minA * 3.0) * 0.2 + exp(-minS * 8.0) * 0.2 + float(escIt) / float(maxIt) * 0.3;
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

float sdf5D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float zx = 0.0, zy = 0.0, zz = 0.0, z3 = 0.0, z4 = 0.0;
    float dr = 1.0, r = 0.0;

    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4);
        if (r > bail) break;
        dr = pow(r, pwr - 1.0) * pwr * dr + 1.0;
        if (r < EPS) { zx = cx; zy = cy; zz = cz; z3 = c3; z4 = c4; continue; }

        float t0 = acos(clamp(zx / r, -1.0, 1.0));
        float r1 = sqrt(zy*zy + zz*zz + z3*z3 + z4*z4);
        float t1 = r1 > EPS ? acos(clamp(zy / r1, -1.0, 1.0)) : 0.0;
        float r2 = sqrt(zz*zz + z3*z3 + z4*z4);
        float t2 = r2 > EPS ? acos(clamp(zz / r2, -1.0, 1.0)) : 0.0;
        float t3 = atan(z4, z3);

        float rp = pow(r, pwr);
        float c0 = cos(t0*pwr), s0_ = sin(t0*pwr);
        float c1 = cos(t1*pwr), s1_ = sin(t1*pwr);
        float c2 = cos(t2*pwr), s2_ = sin(t2*pwr);
        float c3_ = cos(t3*pwr), s3_ = sin(t3*pwr);
        float sp = rp * s0_ * s1_ * s2_;
        zx = rp * c0 + cx; zy = rp * s0_ * c1 + cy; zz = rp * s0_ * s1_ * c2 + cz;
        z3 = sp * c3_ + c3; z4 = sp * s3_ + c4;
    }
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

// ============================================
// 6D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf6D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float zx = 0.0, zy = 0.0, zz = 0.0, z3 = 0.0, z4 = 0.0, z5 = 0.0;
    float dr = 1.0, r = 0.0;
    float minP = 1000.0, minA = 1000.0, minS = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5);
        if (r > bail) { escIt = i; break; }
        minP = min(minP, abs(zy)); minA = min(minA, sqrt(zx*zx + zz*zz)); minS = min(minS, abs(r - 0.8));
        dr = pow(r, pwr - 1.0) * pwr * dr + 1.0;
        if (r < EPS) { zx = cx; zy = cy; zz = cz; z3 = c3; z4 = c4; z5 = c5; escIt = i; continue; }

        // 6D: 5 angles
        float t0 = acos(clamp(zx / r, -1.0, 1.0));
        float r1 = sqrt(zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5);
        float t1 = r1 > EPS ? acos(clamp(zy / r1, -1.0, 1.0)) : 0.0;
        float r2 = sqrt(zz*zz + z3*z3 + z4*z4 + z5*z5);
        float t2 = r2 > EPS ? acos(clamp(zz / r2, -1.0, 1.0)) : 0.0;
        float r3 = sqrt(z3*z3 + z4*z4 + z5*z5);
        float t3 = r3 > EPS ? acos(clamp(z3 / r3, -1.0, 1.0)) : 0.0;
        float t4 = atan(z5, z4);

        float rp = pow(r, pwr);
        float c0 = cos(t0*pwr), s0_ = sin(t0*pwr);
        float c1 = cos(t1*pwr), s1_ = sin(t1*pwr);
        float c2 = cos(t2*pwr), s2_ = sin(t2*pwr);
        float c3_ = cos(t3*pwr), s3_ = sin(t3*pwr);
        float c4_ = cos(t4*pwr), s4_ = sin(t4*pwr);

        float sp = rp * s0_ * s1_ * s2_ * s3_;
        zx = rp * c0 + cx;
        zy = rp * s0_ * c1 + cy;
        zz = rp * s0_ * s1_ * c2 + cz;
        z3 = rp * s0_ * s1_ * s2_ * c3_ + c3;
        z4 = sp * c4_ + c4;
        z5 = sp * s4_ + c5;
        escIt = i;
    }

    trap = exp(-minP * 5.0) * 0.3 + exp(-minA * 3.0) * 0.2 + exp(-minS * 8.0) * 0.2 + float(escIt) / float(maxIt) * 0.3;
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

float sdf6D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float zx = 0.0, zy = 0.0, zz = 0.0, z3 = 0.0, z4 = 0.0, z5 = 0.0;
    float dr = 1.0, r = 0.0;
    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5);
        if (r > bail) break;
        dr = pow(r, pwr - 1.0) * pwr * dr + 1.0;
        if (r < EPS) { zx = cx; zy = cy; zz = cz; z3 = c3; z4 = c4; z5 = c5; continue; }
        float t0 = acos(clamp(zx/r, -1.0, 1.0));
        float r1 = sqrt(zy*zy+zz*zz+z3*z3+z4*z4+z5*z5); float t1 = r1>EPS ? acos(clamp(zy/r1,-1.0,1.0)) : 0.0;
        float r2 = sqrt(zz*zz+z3*z3+z4*z4+z5*z5); float t2 = r2>EPS ? acos(clamp(zz/r2,-1.0,1.0)) : 0.0;
        float r3 = sqrt(z3*z3+z4*z4+z5*z5); float t3 = r3>EPS ? acos(clamp(z3/r3,-1.0,1.0)) : 0.0;
        float t4 = atan(z5, z4);
        float rp = pow(r, pwr);
        float c0=cos(t0*pwr),s0_=sin(t0*pwr),c1=cos(t1*pwr),s1_=sin(t1*pwr);
        float c2=cos(t2*pwr),s2_=sin(t2*pwr),c3_=cos(t3*pwr),s3_=sin(t3*pwr);
        float c4_=cos(t4*pwr),s4_=sin(t4*pwr);
        float sp = rp*s0_*s1_*s2_*s3_;
        zx=rp*c0+cx; zy=rp*s0_*c1+cy; zz=rp*s0_*s1_*c2+cz;
        z3=rp*s0_*s1_*s2_*c3_+c3; z4=sp*c4_+c4; z5=sp*s4_+c5;
    }
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

// ============================================
// 7D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf7D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float c6 = uOrigin[6] + pos.x*uBasisX[6] + pos.y*uBasisY[6] + pos.z*uBasisZ[6];
    float zx=0.0,zy=0.0,zz=0.0,z3=0.0,z4=0.0,z5=0.0,z6=0.0;
    float dr=1.0, r=0.0;
    float minP=1000.0, minA=1000.0, minS=1000.0;
    int escIt=0;

    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx+zy*zy+zz*zz+z3*z3+z4*z4+z5*z5+z6*z6);
        if (r > bail) { escIt=i; break; }
        minP=min(minP,abs(zy)); minA=min(minA,sqrt(zx*zx+zz*zz)); minS=min(minS,abs(r-0.8));
        dr = pow(r, pwr-1.0)*pwr*dr + 1.0;
        if (r < EPS) { zx=cx;zy=cy;zz=cz;z3=c3;z4=c4;z5=c5;z6=c6; escIt=i; continue; }

        // 7D: 6 angles
        float t0=acos(clamp(zx/r,-1.0,1.0));
        float r1=sqrt(zy*zy+zz*zz+z3*z3+z4*z4+z5*z5+z6*z6); float t1=r1>EPS?acos(clamp(zy/r1,-1.0,1.0)):0.0;
        float r2=sqrt(zz*zz+z3*z3+z4*z4+z5*z5+z6*z6); float t2=r2>EPS?acos(clamp(zz/r2,-1.0,1.0)):0.0;
        float r3=sqrt(z3*z3+z4*z4+z5*z5+z6*z6); float t3=r3>EPS?acos(clamp(z3/r3,-1.0,1.0)):0.0;
        float r4=sqrt(z4*z4+z5*z5+z6*z6); float t4=r4>EPS?acos(clamp(z4/r4,-1.0,1.0)):0.0;
        float t5=atan(z6,z5);

        float rp=pow(r,pwr);
        float s0=sin(t0*pwr),c0_=cos(t0*pwr);
        float s1=sin(t1*pwr),c1_=cos(t1*pwr);
        float s2=sin(t2*pwr),c2_=cos(t2*pwr);
        float s3=sin(t3*pwr),c3_=cos(t3*pwr);
        float s4=sin(t4*pwr),c4_=cos(t4*pwr);
        float s5=sin(t5*pwr),c5_=cos(t5*pwr);

        float p0=rp, p1=p0*s0, p2=p1*s1, p3=p2*s2, p4=p3*s3, p5=p4*s4;
        zx=p0*c0_+cx; zy=p1*c1_+cy; zz=p2*c2_+cz; z3=p3*c3_+c3; z4=p4*c4_+c4;
        z5=p5*c5_+c5; z6=p5*s5+c6;
        escIt=i;
    }
    trap = exp(-minP*5.0)*0.3 + exp(-minA*3.0)*0.2 + exp(-minS*8.0)*0.2 + float(escIt)/float(maxIt)*0.3;
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

float sdf7D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float c6 = uOrigin[6] + pos.x*uBasisX[6] + pos.y*uBasisY[6] + pos.z*uBasisZ[6];
    float zx=0.0,zy=0.0,zz=0.0,z3=0.0,z4=0.0,z5=0.0,z6=0.0;
    float dr=1.0,r=0.0;
    for(int i=0;i<MAX_ITER;i++){
        if(i>=maxIt)break;
        r=sqrt(zx*zx+zy*zy+zz*zz+z3*z3+z4*z4+z5*z5+z6*z6);
        if(r>bail)break;
        dr=pow(r,pwr-1.0)*pwr*dr+1.0;
        if(r<EPS){zx=cx;zy=cy;zz=cz;z3=c3;z4=c4;z5=c5;z6=c6;continue;}
        float t0=acos(clamp(zx/r,-1.0,1.0));
        float r1=sqrt(zy*zy+zz*zz+z3*z3+z4*z4+z5*z5+z6*z6);float t1=r1>EPS?acos(clamp(zy/r1,-1.0,1.0)):0.0;
        float r2=sqrt(zz*zz+z3*z3+z4*z4+z5*z5+z6*z6);float t2=r2>EPS?acos(clamp(zz/r2,-1.0,1.0)):0.0;
        float r3=sqrt(z3*z3+z4*z4+z5*z5+z6*z6);float t3=r3>EPS?acos(clamp(z3/r3,-1.0,1.0)):0.0;
        float r4=sqrt(z4*z4+z5*z5+z6*z6);float t4=r4>EPS?acos(clamp(z4/r4,-1.0,1.0)):0.0;
        float t5=atan(z6,z5);
        float rp=pow(r,pwr);
        float s0=sin(t0*pwr),c0_=cos(t0*pwr),s1=sin(t1*pwr),c1_=cos(t1*pwr);
        float s2=sin(t2*pwr),c2_=cos(t2*pwr),s3=sin(t3*pwr),c3_=cos(t3*pwr);
        float s4=sin(t4*pwr),c4_=cos(t4*pwr),s5=sin(t5*pwr),c5_=cos(t5*pwr);
        float p1=rp*s0,p2=p1*s1,p3=p2*s2,p4=p3*s3,p5=p4*s4;
        zx=rp*c0_+cx;zy=p1*c1_+cy;zz=p2*c2_+cz;z3=p3*c3_+c3;z4=p4*c4_+c4;z5=p5*c5_+c5;z6=p5*s5+c6;
    }
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

// ============================================
// 8D-11D: Array-based with rotated basis
// ============================================

float sdf8D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    float c[8];
    for(int j=0;j<8;j++) c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
    float z[8]; for(int j=0;j<8;j++)z[j]=0.0;
    float dr=1.0,r=0.0,minP=1000.0,minA=1000.0,minS=1000.0;
    int escIt=0;

    for(int i=0;i<MAX_ITER;i++){
        if(i>=maxIt)break;
        r=sqrt(z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4]+z[5]*z[5]+z[6]*z[6]+z[7]*z[7]);
        if(r>bail){escIt=i;break;}
        minP=min(minP,abs(z[1]));minA=min(minA,sqrt(z[0]*z[0]+z[2]*z[2]));minS=min(minS,abs(r-0.8));
        dr=pow(r,pwr-1.0)*pwr*dr+1.0;
        if(r<EPS){for(int j=0;j<8;j++)z[j]=c[j];escIt=i;continue;}

        // 8D: 7 angles - compute tails and angles
        float t[7];
        float tail=r;
        for(int k=0;k<6;k++){
            t[k]=acos(clamp(z[k]/tail,-1.0,1.0));
            tail=sqrt(max(tail*tail-z[k]*z[k],EPS));
        }
        t[6]=atan(z[7],z[6]);

        float rp=pow(r,pwr);
        float sp=rp;
        z[0]=rp*cos(t[0]*pwr)+c[0];
        for(int k=1;k<7;k++){
            sp*=sin(t[k-1]*pwr);
            z[k]=sp*cos(t[k]*pwr)+c[k];
        }
        sp*=sin(t[5]*pwr);
        z[6]=sp*cos(t[6]*pwr)+c[6];
        z[7]=sp*sin(t[6]*pwr)+c[7];
        escIt=i;
    }
    trap=exp(-minP*5.0)*0.3+exp(-minA*3.0)*0.2+exp(-minS*8.0)*0.2+float(escIt)/float(maxIt)*0.3;
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

float sdf8D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    float c[8];
    for(int j=0;j<8;j++) c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
    float z[8];for(int j=0;j<8;j++)z[j]=0.0;
    float dr=1.0,r=0.0;
    for(int i=0;i<MAX_ITER;i++){
        if(i>=maxIt)break;
        r=sqrt(z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4]+z[5]*z[5]+z[6]*z[6]+z[7]*z[7]);
        if(r>bail)break;
        dr=pow(r,pwr-1.0)*pwr*dr+1.0;
        if(r<EPS){for(int j=0;j<8;j++)z[j]=c[j];continue;}
        float t[7];float tail=r;
        for(int k=0;k<6;k++){t[k]=acos(clamp(z[k]/tail,-1.0,1.0));tail=sqrt(max(tail*tail-z[k]*z[k],EPS));}
        t[6]=atan(z[7],z[6]);
        float rp=pow(r,pwr),sp=rp;
        z[0]=rp*cos(t[0]*pwr)+c[0];
        for(int k=1;k<6;k++){sp*=sin(t[k-1]*pwr);z[k]=sp*cos(t[k]*pwr)+c[k];}
        sp*=sin(t[5]*pwr);z[6]=sp*cos(t[6]*pwr)+c[6];z[7]=sp*sin(t[6]*pwr)+c[7];
    }
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

// 9D-11D use array-based approach with rotated basis
float sdfHighD(vec3 pos, int D, float pwr, float bail, int maxIt, out float trap) {
    float c[11],z[11];
    for(int j=0;j<11;j++) c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
    for(int j=0;j<11;j++)z[j]=0.0;

    float dr=1.0,r=0.0,minP=1000.0,minA=1000.0,minS=1000.0;
    int escIt=0;

    for(int i=0;i<MAX_ITER;i++){
        if(i>=maxIt)break;

        // Compute r - unrolled for speed
        r=z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4];
        r+=z[5]*z[5]+z[6]*z[6]+z[7]*z[7]+z[8]*z[8]+z[9]*z[9]+z[10]*z[10];
        r=sqrt(r);

        if(r>bail){escIt=i;break;}
        minP=min(minP,abs(z[1]));minA=min(minA,sqrt(z[0]*z[0]+z[2]*z[2]));minS=min(minS,abs(r-0.8));
        dr=pow(r,pwr-1.0)*pwr*dr+1.0;

        if(r<EPS){for(int j=0;j<11;j++)z[j]=c[j];escIt=i;continue;}

        // Compute angles
        float t[10];
        float tail2=r*r;
        for(int k=0;k<D-2;k++){
            float tail=sqrt(max(tail2,EPS));
            t[k]=acos(clamp(z[k]/tail,-1.0,1.0));
            tail2-=z[k]*z[k];
        }
        t[D-2]=atan(z[D-1],z[D-2]);

        // Power map and reconstruct
        float rp=pow(r,pwr);
        float sp=rp;
        z[0]=rp*cos(t[0]*pwr)+c[0];
        for(int k=1;k<D-2;k++){
            sp*=sin(t[k-1]*pwr);
            z[k]=sp*cos(t[k]*pwr)+c[k];
        }
        sp*=sin(t[D-3]*pwr);
        z[D-2]=sp*cos(t[D-2]*pwr)+c[D-2];
        z[D-1]=sp*sin(t[D-2]*pwr)+c[D-1];
        // Zero out unused dimensions
        for(int k=D;k<11;k++)z[k]=0.0;
        escIt=i;
    }
    trap=exp(-minP*5.0)*0.3+exp(-minA*3.0)*0.2+exp(-minS*8.0)*0.2+float(escIt)/float(maxIt)*0.3;
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

float sdfHighD_simple(vec3 pos, int D, float pwr, float bail, int maxIt) {
    float c[11],z[11];
    for(int j=0;j<11;j++) c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
    for(int j=0;j<11;j++)z[j]=0.0;
    float dr=1.0,r=0.0;

    for(int i=0;i<MAX_ITER;i++){
        if(i>=maxIt)break;
        r=z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4];
        r+=z[5]*z[5]+z[6]*z[6]+z[7]*z[7]+z[8]*z[8]+z[9]*z[9]+z[10]*z[10];
        r=sqrt(r);
        if(r>bail)break;
        dr=pow(r,pwr-1.0)*pwr*dr+1.0;
        if(r<EPS){for(int j=0;j<11;j++)z[j]=c[j];continue;}

        float t[10];float tail2=r*r;
        for(int k=0;k<D-2;k++){float tail=sqrt(max(tail2,EPS));t[k]=acos(clamp(z[k]/tail,-1.0,1.0));tail2-=z[k]*z[k];}
        t[D-2]=atan(z[D-1],z[D-2]);

        float rp=pow(r,pwr),sp=rp;
        z[0]=rp*cos(t[0]*pwr)+c[0];
        for(int k=1;k<D-2;k++){sp*=sin(t[k-1]*pwr);z[k]=sp*cos(t[k]*pwr)+c[k];}
        sp*=sin(t[D-3]*pwr);
        z[D-2]=sp*cos(t[D-2]*pwr)+c[D-2];
        z[D-1]=sp*sin(t[D-2]*pwr)+c[D-1];
        for(int k=D;k<11;k++)z[k]=0.0;
    }
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

// ============================================
// Dispatch to dimension-specific SDF
// ============================================

float GetDist(vec3 pos) {
    float pwr = max(uPower, 2.0);
    float bail = max(uEscapeRadius, 2.0);
    int maxIt = int(min(uIterations, float(MAX_ITER)));

    if (uDimension == 4) return sdf4D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 5) return sdf5D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 6) return sdf6D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 7) return sdf7D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 8) return sdf8D_simple(pos, pwr, bail, maxIt);
    return sdfHighD_simple(pos, uDimension, pwr, bail, maxIt);
}

float GetDistWithTrap(vec3 pos, out float trap) {
    float pwr = max(uPower, 2.0);
    float bail = max(uEscapeRadius, 2.0);
    int maxIt = int(min(uIterations, float(MAX_ITER)));

    if (uDimension == 4) return sdf4D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 5) return sdf5D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 6) return sdf6D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 7) return sdf7D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 8) return sdf8D(pos, pwr, bail, maxIt, trap);
    return sdfHighD(pos, uDimension, pwr, bail, maxIt, trap);
}

// ============================================
// Raymarching & Rendering
// ============================================

vec2 intersectSphere(vec3 ro, vec3 rd, float radius) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

float RayMarch(vec3 ro, vec3 rd, out float trap) {
    trap = 0.0;
    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) return maxDist + 1.0;

    float dO = max(0.0, tSphere.x);
    float maxT = min(tSphere.y, maxDist);

    for (int i = 0; i < MAX_MARCH_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float currentTrap;
        float dS = GetDistWithTrap(p, currentTrap);

        // Safety: clamp distance to reasonable range
        dS = clamp(dS, SURF_DIST * 0.5, maxT);

        if (dS < SURF_DIST) { trap = currentTrap; return dO; }
        dO += dS;
        if (dO > maxT) break;
    }
    return maxDist + 1.0;
}

vec3 GetNormal(vec3 p) {
    float d = GetDist(p);
    vec2 e = vec2(0.001, 0);
    return normalize(d - vec3(GetDist(p-e.xyy), GetDist(p-e.yxy), GetDist(p-e.yyx)));
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    occ += (0.02 - GetDist(p + 0.02 * n));
    occ += (0.08 - GetDist(p + 0.08 * n)) * 0.7;
    occ += (0.16 - GetDist(p + 0.16 * n)) * 0.5;
    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

void main() {
    vec3 ro = (uInverseModelMatrix * vec4(uCameraPosition, 1.0)).xyz;
    vec3 worldRayDir = normalize(vPosition - uCameraPosition);
    vec3 rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);

    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    float trap;
    float d = RayMarch(ro, rd, trap);

    if (d > maxDist) discard;

    vec3 p = ro + rd * d;
    vec3 n = GetNormal(p);
    float ao = calcAO(p, n);

    vec3 baseHSL = rgb2hsl(uColor);
    vec3 surfaceColor = getPaletteColor(baseHSL, 1.0 - trap, uPaletteMode);
    surfaceColor *= (0.3 + 0.7 * ao);

    vec3 col;
    if (uLightEnabled) {
        vec3 l = normalize((uInverseModelMatrix * vec4(uLightDirection, 0.0)).xyz);
        float dif = clamp(dot(n, l), 0.0, 1.0);
        float diffStr = 1.0 - uAmbientIntensity;
        col = surfaceColor * (uAmbientIntensity + diffStr * dif) * uLightColor;
        vec3 ref = reflect(-l, n);
        float spec = pow(max(dot(ref, -rd), 0.0), uSpecularPower);
        col += uLightColor * spec * uSpecularIntensity * 0.5;
    } else {
        col = surfaceColor * uAmbientIntensity;
    }

    vec4 worldHitPos = uModelMatrix * vec4(p, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    gl_FragDepth = clamp((clipPos.z / clipPos.w) * 0.5 + 0.5, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
}
