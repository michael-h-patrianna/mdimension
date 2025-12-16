export const aoBlock = `
// Ambient occlusion (3 SDF evaluations)
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    occ += (0.02 - GetDist(p + 0.02 * n));
    occ += (0.08 - GetDist(p + 0.08 * n)) * 0.7;
    occ += (0.16 - GetDist(p + 0.16 * n)) * 0.5;
    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}
`;
