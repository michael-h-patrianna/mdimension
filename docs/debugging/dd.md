Important: This is a test of your autonomous capabilities and your UI/UX design and frontend coding abilities.

You cannot break anything. The project in this local folder is backed up and can be restored. You can create, modify, and delete files as necessary to complete the tasks assigned to you. You have full autonomy to make decisions and take actions to achieve the desired outcomes.

Your task:
This project has a very rudimentary theming system for its UI. All it does is change some text colors, while all backgrounds are fixed to be a dark mode in the same colors.

Design and implement a truly advanced best-of-class theming system that caters to all type of user, user abilities and user taste.

Workflow:
- Review the UI and components and theming solution in detail.
- Review what industry leaders in web and app design are considering best practices for a best-of-class theming solution.
- Design such a best-of-class theming solution for this app.
- Implement and integrate.
- Test and fix until no more bugs, race conditions, side effects can be found.

Important Reminder: This is a test of your autonomous capabilities and your ability to design and implemented exceptional modern web and mobile UI. You are expected to take initiative and make decisions independently. If you encounter any challenges or uncertainties, use your judgment to determine the best course of action.

The quality and completeness of the project in this folder when you return the prompt to the user will be the only criteria for success. If you deliver unfinished or less than exceptional looking work, this test and you are a failure. Be exceptional. Do not just complete the task. Ace it. There is no time or token limit. Do it right instead of fast. Be exceptional.




Compared current implementation against `docs/plans/refactor-rendering-architecture.md` across phases 0–6. check for:
- bugs
- unfinished implementations
- code not in line with our tech stack and versions (React 19, WebGL2, Zustand 5, GSLS3)
- dead code
- ui components not "wired" to their actual parameters in the render graph
- logic flaws
- broken math
- broken transformations, projections, rotation
- disfunctional post processing effects
- broken sdf raymarching, broken volume raymarching
- broken temporal reprojection (both: temporal depth and temporal cloud)
- broken normal/depth/temporal depth buffers


Your task is to fix the temporal reprojection for the schroedinger object type.

symptoms: looking at the temporal buffer texture image it does not show the object shape. on top of that, the scene itself shows a glitchy backgdrop to the object - showing that there is something applied that turns the backdrop black and glitchy.

your task: fix this

your workflow:
1. add debug code for experiments and information gathering and output it to the browser console.
2. use playwright or/and google chrome dev tools to open the dev server at port 3000, go to the page, and read the console (the website always loads schroedinger automatically)
3. inspect the debug messages, formulate a hypothesis, write more debug code and repeat or start to fix

success criteria:
1. deactivate the object rendering for debugging. if you then take the color of the pixel in the center of the scene, it will not be black if everything is working.
2. with the object rendering active, check the debug texture of the temporal debug buffer. check the color value of the pixel in the center and the value of the pixel in position 1,1. both pixels will have different colors if everything works.

work autonomously. you have complete freedom. this project folder is backed up and only for you to find the solution to this severe problem nobody could fix so far. you can edit everything. you can add new files. do whatever it takes to fix this bug.

BUT: simply deactivating temporal reprojection is not a solution. changing the fundamental approach of the feature is also not a solution.


MANDATORY QUALITY GATE
both these tests must pass for success:
1. deactivate the object rendering for debugging. if you then take the color of the pixel in the center of the scene, it will not be black if everything is working.
2. with the object rendering active, check the debug texture of the temporal debug buffer. check the color value of the pixel in the center and the value of the pixel in position 1,1. both pixels will have different colors if everything works.

Plan and implement this optimization:
When any of these post-processing effects is set to a setting where they have no visible impact, they get completely disabled and do not use any CPU or GPU computation resources (the slider that should disable the effect fully when set to 0 in brackets):
- Grain (Grain)
- Vignette (Vignette)
- Tone Mapping (Exposure)
- Bloom (Intensity)
- Bokeh (Blur intensity)
- SSR (Intensity)
- Refraction (Strength)

after this refactor, remove the now obsolete on/off toggle switches for
- Bloom
- SSR
- Refraction
- Tone Mapping
- Bokeh





Review this bug report:
No object type is rendered correctly. It appears that the object is kind of appearing but just tinting the whole scene. Maybe we are zoomed in to the extreme, or the whole render graph is doing something very wrong in its position, vertex, face, rotation, scale, perspective or scale calculations.

these two tests need to pass to even a tiny chance that everything is rendered correctly:
scripts/playwright/object-types-rendering.spec.ts
scripts/playwright/polytope-rendering.spec.ts

notes:
- except for the black hole, scene will show green tint as all object types have a green material color in the start. except the black hole which at its center is obviously black.


  1. The "Tunable Handoff" (Recommended Fix)
  Fix the mathematical errors in the current approach to make the transitions seamless.

   * Implementation:
       * Fix Aspect Ratio: In the shader, correct the distance calculation by multiplying the UV x-coordinate by the screen aspect ratio (vUv.x * uAspectRatio). This turns the ellipsoid mask back into a sphere.
       * Align Radii: Change the innerRadius logic. Instead of multiplying by an arbitrary 2.5, pass the exact "end" radius of the internal raymarcher (e.g., 5.0) to the SSL shader.
       * Gradient Mix: Introduce a smooth smoothstep transition at the boundary instead of a hard cut-off to blend the internal raymarched lensing with the external screen-space lensing.
   * Pros:
       * Lowest Risk: Minimal code changes; purely correcting existing logic.
       * High Performance: Keeps the expensive raymarching constrained to the center and cheap screen-space hacks for the periphery.
   * Cons:
       * Imperfection: It is still a screen-space effect. Objects passing behind the black hole might still have minor visual discontinuities where the two effects meet.

  1. Depth-Aware 3D Distortion (High Quality Post-FX)
  Upgrade the SSL shader to calculate distortion in View Space rather than UV Space.

   * Implementation:
       * reconstruct the World Position of every pixel using the Depth Buffer.
       * Calculate the distance from the Black Hole's actual 3D center to that pixel's 3D position.
       * Apply the distortion vector based on 3D proximity, then project back to screen UVs.
       * Use the depth buffer to strictly mask out pixels that are in front of the black hole (to avoid distorting the black hole with its own background).
   * Pros:
       * Geometrically Correct: The "ellipsoid" issue vanishes completely because math happens in 3D.
       * Robust: Handles camera movement and FOV changes perfectly.
   * Cons:
       * Complexity: Requires accurate depth reconstruction and inverse projection matrices in the shader.
       * Performance: Slightly heavier on the GPU than simple 2D UV distortion.

  1. Vertex Shader Displacement (The "Object-Level" Approach)
  Move the lensing effect out of Post-Processing entirely and into the materials of the surrounding objects (Walls, Skybox).

   * Implementation:
       * Add a "Gravitational Lensing" chunk to the vertex shaders of the wall and skybox materials.
       * Distort the gl_Position or varying UVs of the geometry itself based on proximity to the black hole uniform.
   * Pros:
       * Perfect Occlusion: Solves all "masking" issues naturally. The black hole (an object) simply sits in front of the distorted walls. No need to "handoff" between effects.
       * Artifact-Free: No screen-edge smearing or resolution-dependent artifacts.
   * Cons:
       * Invasive: Requires modifying the shader code for every object type in the scene that needs to be lensed.
       * Tessellation Dependent: If the walls are simple cubes with few vertices, the distortion will look jagged unless highly subdivided.

Do a full in-depth code review of the new feature(s). Is the implementation 100% complete. Is the integration 100% complete (you tend to forget to integrate features). Were any bugs, race conditions, performance issues or side effects introduced? Is legacy code removed? Is all code and all patterns in line with our current tech stack's abilities and constraints? Is everything fully functional and integrated and ready to be used in production?


  Implementation Options

  Option A: CAS in ToScreenPass (Simplest)

  Render (scaled) → AA (scaled) → ToScreenPass+CAS (upscale + sharpen)

  Just add CAS to the ToScreenPass fragment shader. One uniform for sharpness (0-1).

  Option B: FSR 1.0 Upscaler (Better Quality)

  Render (scaled) → AA (scaled) → EASU (smart upscale) → RCAS (sharpen) → Screen

  Requires two new passes but gives best results. AMD provides the shader code under MIT license.

  Option C: Full Pipeline

  Render (scaled) → EASU upscale → FXAA (full res) → RCAS sharpen → Screen

  Best quality but most passes.

  ---
  Recommendation: Start with Option A (CAS in ToScreenPass). It's:
  - Single shader change
  - ~0.1ms cost
  - Significant quality improvement
  - Easy to add sharpness slider

  Want me to implement CAS in ToScreenPass with a sharpness control?


do a comparison between the webgl and the webgpu/tsl implementation of the mandelbulb and julia object types. only compare code and
  architecture. do not run tests or do anything else than looking at code. this requires a thorough deep review to find all gaps in terms of features and optimizations (including microoptimizations). no quick
  scan!

BE AS CLOSE AS POSSIBLE TO WEBGL!!!! WE HAVE SOLVED SO MANY PROBLEMS ALREADY IN WEBGL!!! I DO NOT WANT YOU TO WRITE AI SLOP AND THEN WE SPEND ANOTHER 2 WEEKS TO SOLVE THE PROBLEMS AGAIN BECAUSE YOU REFUSE TO
 FOLLOW THE INSTRUCTION: 100% WEBGL PARITY!!! ONLY PORT WHAT NEEDS TO BE PORTED TO MAKE THIS ALSO WORK FULLY IN WEBGPU


Compare in detail the WebGPU port of the perfectly fine working and well optimized WebGL implemetion of the mandelbulb and julia objects.

Find missing features. Find added features not existing in WebGL. Find deviations that are unnecessary for making WebGPU work. Find anything that is not closely following WebGL and is not required to make WebGPU work.

Do a thorough and in-depth comparison. No quick scan!!!

Guiding Principle: 100% WebGL Parity Through Exact Porting

  Core Rule: Port WebGL code line-by-line. Do not reinvent, abstract, or "improve."

  What This Means in Practice

  1. Read WebGL first, then port
    - Before writing any TSL code, read the exact WebGL implementation
    - Match the structure, variable names, and logic flow
    - If WebGL does something inline, TSL does it inline
    - If WebGL uses a helper function, TSL uses an equivalent helper function
  2. No new abstractions
    - If a function doesn't exist in WebGL, don't create it in TSL
    - If WebGL calculates PBR inline in a loop, TSL calculates PBR inline in a loop
    - Abstractions that "seem cleaner" are forbidden - they hide bugs and diverge from the proven WebGL code
  3. Reuse existing TSL infrastructure
    - Check what already exists in src/rendering/tsl/ before writing new code
    - The polytope code already has working lighting, color algorithms, SSS, IBL
    - Import and reuse, don't duplicate
  4. Same uniforms, same names, same defaults
    - Uniform names must match WebGL exactly
    - Default values must match WebGL exactly
    - Array sizes must match WebGL exactly
  5. The WebGL code is the specification
    - It's been battle-tested and debugged
    - Every "optimization" or "improvement" I might think of has likely already been considered and rejected for good reason
    - My job is to translate, not to design



we chose MeshBasicNodeMaterial to avoid double-lighting issues with MeshStandardNodeMaterial

NodeMaterial

"USER GOAL: Create a truly custom material in WebGPU/TSL like WebGL's ShaderMaterial. WebGL approach: ShaderMaterial with complete custom GLSL - vertex shader (transform-nd.glsl), fragment shader (compose.ts), all uniforms manually declared, NO reliance on Three.js built-in lighting/shadows. TSL equivalent:
                                       Use base NodeMaterial (NOT MeshStandardNodeMaterial), set vertexNode for custom vertex transforms, set fragmentNode for complete fragment output. This gives same control as ShaderMaterial. Need to: 1) Review how WebGL ShaderMaterial is instantiated, 2) Plan TSL NodeMaterial equivalent, 3) Ensure all features work (IBL,
                                       PBR, multi-light, shadows, SSS, MRT, custom colors


 Now I see the complete WebGL fragment shader structure. The key flow:

  1. Normal (screen-space dFdx/dFdy or vertex-computed)
  2. Color algorithm → baseColor
  3. PBR F0 = mix(0.04, baseColor, metallic)
  4. Ambient (energy-conserved)
  5. Light loop: direction, attenuation, shadow, NdotL, diffuse, specular, SSS
  6. Fresnel rim (after loop)
  7. IBL (after loop)
  8. MRT output: gColor, gNormal, gPosition
For TSL, I need to create a fragmentNode that does EXACTLY this same computation. Let me create a complete custom material:
