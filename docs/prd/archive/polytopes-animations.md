## 1: Truncation family (smoothly “shave” vertices/edges)

A single parameter 𝑡 controls how far you cut supporting planes inwards. As 𝑡 increases, new faces appear and grow.

Config

mode: vertexTruncate | edgeTruncate | cantellate | chamfer t (0…tMax), tSpeed (monotone; loop by switching to another operation, not oscillating)

preserve: volume | circumradius | inradius | none

featureWeights: e.g. bias cuts to high-valence vertices / long edges

Notes

This does change combinatorics, but it’s still smooth if you rebuild continuously (or do keyframed meshes and cross-fade topology).

Dual morph (P ↔ P*)

Dualization is very “polytope-y”: vertices ↔ facets. You can animate from a polytope to its polar dual through a normalization.

Config

dualNormalize: unitSphere | inradius1 | circumradius1

t (0..1), speed

blendSpace: supportFunction | halfspaceOffsets (prefer these over naïve vertex lerp)

## 2: Facet-offset morph (H-representation “breathing”, but not puls-y)

Represent the polytope as 𝐴𝑥≤𝑏. Keep facet normals 𝐴 fixed; animate the offsets 𝑏(𝑡) along a smooth path. This produces very organic evolving but still “rigidly polytope” motion.

Config

facetGroup: which constraints to move

offsetPath: linear | bezier | spline (in parameter space)

deltaBPerFacet[] (signed)

keepCentered: recenter after each solve

minMargin: avoid degeneracy (facet collapses)

Why it avoids nausea
No oscillation needed: you can run along a one-way spline through shape-space.


3) Minkowski morph between two polytopes (continuous, always convex)

Define P(t)=(1−t)P0+tP1 (Minkowski sum with scaling). This is an extremely “clean” evolution.

Config

polytopeA, polytopeB
t (0..1), speed

alignment: centroid | principalAxes | userMatrix

normalize: volume | radius | none

Implementation reality
Easiest if you have both in H-rep with shared normals (then it’s just interpolating offsets). Otherwise you’ll need hull/halfspace conversion each frame.


## 4: Dual morph (P ↔ P*)

Dualization is very “polytope-y”: vertices ↔ facets. You can animate from a polytope to its polar dual through a normalization.

Config

dualNormalize: unitSphere | inradius1 | circumradius1

t (0..1), speed

blendSpace: supportFunction | halfspaceOffsets (prefer these over naïve vertex lerp)

## How to plug this into your renderer (minimal changes)

Right now you build geometry once from baseVertices into position + aExtraDim0..6 PolytopeScene and the shader transforms them faceVertex.glsl.

New: Morph targets in the vertex shader (smooth + fast)

Add a second set of attributes: position2, aExtraDim0_2..aExtraDim6_2, plus uniform uMorphT.

Then in transformND(), blend inputs before rotation/projection:
inputs = mix(inputsA, inputsB, uMorphT);

(Your N-D transform is already isolated in transformND(): edgeVertex.glsl
