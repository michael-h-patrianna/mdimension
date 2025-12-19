Fixed: TubeWireframe and PolytopeScene shader recompilation issues.

- Modified `src/rendering/renderers/TubeWireframe/TubeWireframe.tsx`: Removed `color`, `metallic`, `roughness`, `radius`, and `dimension` from `useTrackedShaderMaterial` deps.
- Modified `src/rendering/renderers/Polytope/PolytopeScene.tsx`: Removed `faceColor` from `useTrackedShaderMaterial` deps.
- Verified with existing tests.
