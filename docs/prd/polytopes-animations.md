1) Slicing / scanning (instant “wow” mode)
N-D hyperplane slice (cross-section animation)

Render only parts where an N-D dot product is near an offset (a moving slice through the polytope).

Params: sliceNormalND[] (unit), sliceOffset, sliceThickness, offsetSpeed, feather, multiSlices(count, spacing)

Implementation note: you’ll likely want to pass more than just vFaceDepth (currently derived from extra dims

) so the fragment shader can evaluate the slice precisely.

Why: turns “rotate the whole thing” into “discover structure inside it”.

2) Shader-driven motion (cheap, high payoff)
Traveling edge/face waves (color + opacity)

Drive a phase based on “depth” (sum of extra dims) and time.

Params: waveSpeed, wavelength, direction(choose dims), contrast, edgeGlowStrength, opacityPulse

Where it plugs in: uDistOffset / uDistCycles already exist and are updated per frame

PolytopeScene

—add a distOffsetSpeed and animate it.

Palette drift / palette beat

Slowly drift cosine palette parameters or just rotate the palette phase.

Params: palettePhaseSpeed, paletteDriftAmount, beatRate, beatStrength, lockHues (keep harmony)

Why: even if geometry motion is subtle, color motion keeps attention.

Procedural micro-jitter (controlled noise)

Tiny vertex offset in projected 3D (or normal perturb in fragment) using a stable per-vertex hash.

Params: jitterAmp, noiseScale, noiseSpeed, axisMask, freeze (for stills)

Why: adds “energy” without ruining the form—if kept small.
