x Use threejs orbitcontrols for camera movement


Scene settings
- Add new sidebar section "Scene" -> code goes into src/components/sidebar/Scene
- Extend visualstore to also store information about the scene setup itself
- Settings to start with
  - Axis Helper: toggle (on/off) - whether to use  scene.add(new THREE.AxesHelper(5)
- Ground color: move from the "Visual" section in the sidebar
- Ground visible: move from the "Visual" section in the sidebar



Review this bug report:
PNG export exports an empty image



next task is to clean up and standardize the sidebar sections
1. each section has a folder in src/components/sidebar/ where the section component itself is and all components that are specifically made for it, e.g. the "Object Geometry" section is in src/components/sidebar/Geometry/ and also the src/components/controls/DimensionSelector.tsx dimension selector goes into this folder because only the object geometry section is using it
2. the sidebar.tsx itself only loads the sections and does not control what is in the section

refactor sidebar:



Soft Fill (good for hyppercubes)
- Vertices: off
- Edges: on
- Faces: on
- Face opacity: 0.3
- Surface color: #33cc9e
- Fresnel Rim: on
- Bloom: on
- Bloom intensity: 1.6
- Bloom threshold: 0
- Bloom soft knee: 0
- Bloom radius: 0.30
- Bloom blur levels: 4
- Light: on
- Light color: #ffffff
- Light horizontal angle: 45 degrees
- Light vertical angle: 30 degrees
- Ambient intensity: 0.30
- Specular intensity: 1.00
- Specular Power: 32
- Vertex color: #19e697
- Edge color: #19e697
- Edge thickness: 1
- Vertex size: 1


hypercube: 1.8 (scale)
simplex: 4 (scale)
hypersphere: 3 (radius)
root system: 2 - (scale)
clifford torus: 3 (radius)

1. Integrate GPU shaders into renderers - Replace CPU transforms in PolytopeScene/PointCloudScene with the new UnifiedMaterial system for additional performance gains
  1. Performance benchmarking - Measure actual FPS improvements and memory usage
  2. Visual feature enhancements - The UnifiedMaterial system supports:
    - Palette color gradients
    - Fresnel rim lighting
    - Depth-based coloring



// Old Film Look
  filmPass = new THREE.FilmPass();
  composer.addPass(filmPass);

  // Vignette Shader
  shaderVignette = THREE.VignetteShader;
  effectVignette = new THREE.ShaderPass(shaderVignette);

  effectVignette.uniforms["offset"].value = 1.5;
  effectVignette.uniforms["darkness"].value = .9;
  effectVignette.renderToScreen = true;
  composer.addPass(effectVignette);


 review the animations for the menger box. currently we have as only settings: bias (impact rotation delta n) and animation planes. research what other values we could animate
  how and should give as an option to the user in the sidebar's Animation section for the object type to create even more interesting, visually stunning animations at different dimension numbers.
  use websearch for research. discuss with sequential thinking and make a few suggestions


CameraController.tsx:113 [Violation] Added non-passive event listener to a scroll-blocking 'wheel' event. Consider marking event handler as 'passive' to make the page more responsive. See https://www.chromestatus.com/feature/5745543795965952
OrbitControls.connect @ chunk-KWWNF4DW.js?v=835f2dbc:38636
OrbitControls @ chunk-KWWNF4DW.js?v=835f2dbc:39196
(anonymous) @ CameraController.tsx:113
react-stack-bottom-frame @ chunk-I3FAUOZW.js?v=835f2dbc:10537
runWithFiberInDEV @ chunk-I3FAUOZW.js?v=835f2dbc:918
commitHookEffectListMount @ chunk-I3FAUOZW.js?v=835f2dbc:6958
commitHookPassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:7016
reconnectPassiveEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8417
recursivelyTraverseReconnectPassiveEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8396
reconnectPassiveEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8410
recursivelyTraverseReconnectPassiveEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8396
reconnectPassiveEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8410
recursivelyTraverseReconnectPassiveEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8396
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8363
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8385
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8385
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8385
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8385
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8296
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8385
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8296
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8385
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8296
recursivelyTraversePassiveMountEffects @ chunk-I3FAUOZW.js?v=835f2dbc:8283
commitPassiveMountOnFiber @ chunk-I3FAUOZW.js?v=835f2dbc:8306
flushPassiveEffects @ chunk-I3FAUOZW.js?v=835f2dbc:9682
(anonymous) @ chunk-I3FAUOZW.js?v=835f2dbc:9605
performWorkUntilDeadline @ chunk-I3FAUOZW.js?v=835f2dbc:238
chunk-I3FAUOZW.js?v=835f2dbc:14218 [Violation] 'requestAnimationFrame' handler took 141ms


this is broken. the "Progressive Refinement" feature is supposed to trigger when:
- zooming or moving or rotating the camera
- when the canvas gets resized



the RefinementIndicator is only shown after:
- user hides the right sidebar
- user switches cinematic mode on

it is not displayed at all after:
- all the camera related actions that were working before
- user toggles the right sidebar visible
- users switches cinematic mode off
- user toggles the left sidebar visible
- user hides the left sidebar
- user switches full screen mode on
- user switches full screen mode off

note: the feature itself is working and in the sidebar performance optimization section you can see the sidebar control updating. it is just that the RefinementIndicator is not displayed in all cases when it should be displayed.
