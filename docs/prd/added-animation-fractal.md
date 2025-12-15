# Domain‑Warped Distance Estimators (Warp ND Space First)
### What it is
Take any fractal that looks too rigid, and make it alive by **warping the ND input space** before evaluating the fractal. If the warp lives in ND, then rotating your slice changes which parts of the warp you sample, producing evolving anatomy.

### Core math idea
Instead of `de(p)`, do:
- `p' = p + warp(p, t)`
- return `de_base(p')`

Warp should be **smooth**, **bounded**, and ideally **divergence-free-ish** (to avoid collapsing everything).

### Implementation sketch (cheap analytic warp)
A simple ND “curl-ish” warp using sines:
```glsl
vecN warp(vecN p, float t) {
  vecN w;
  for (int i=0; i<N; i++) {
    float a = p[(i+1)%N];
    float b = p[(i+2)%N];
    w[i] = sin(a*freq1 + t) + cos(b*freq2 - 0.7*t);
  }
  return warpAmp * w;
}

float de(vecN p) {
  vecN pw = p + warp(p, t);
  return de_base(pw);
}
```

### What to look out for
- **Raymarch stability:** warps break perfect SDF properties. Use:
  - smaller step multiplier (e.g. `dist *= 0.7–0.9`)
  - clamp max step
- **Over-warping:** keep `warpAmp` small relative to scene scale.
- **Aliasing:** keep warp frequencies moderate; animate smoothly.

### What to animate
- Warp amplitude (small breathing)
- Warp frequencies (very slowly)
- Phase offsets per dimension
- Blend between 2 warp functions over time
