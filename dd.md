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
