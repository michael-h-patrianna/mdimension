Important: This is a test of your autonomous capabilities and abilities to create and optimize a high performance WebGL2 rendering pipeline.

You cannot break anything. The project in this local folder is backed up and can be restored. You can create, modify, and delete files as necessary to complete the tasks assigned to you. You have full autonomy to make decisions and take actions to achieve the desired outcomes.

Your task: A senior developer tasked you to do a full performance review of this project. You are supposed to do in-depth performance profiling and identify bottlenecks, inefficiencies, opportunities for improvements.

Worflow
1. Investigate the rendering pipeline and understand how a scene is rendered. Everything that is contributing to the rendered scene must be fully understood: objects and their different shader modules and techniques, skyboxes (texture and procedural), walls, lighting, materials, post processing effects, animations, shadows, fog, ...
2. Design a plan how to performance profile the application and rendering flow. You have already playwright at your disposal. You can add more 3rd party tools and freely add debug code and run expirements at any place. This folder is backed up and its content is solely for you to "play around with".
3. Run your investigations, expirements, performance profiling.
4. Create a report in docs/performance-review.md which contains:
   1. A detailled overview of the measurements and expirements you have taken.
   2. A breakdown of the rendering pipeline and impact of each step of feature on the GPU, CPU and memory usage - per object type (as object type use different shader techniques and mathematical models)
   3. A list of 10 "low-hanging fruits" to improve CPU/GPU/memory usage and the perceived performance.
   4. A list of at least 20 comprehensive improvements or refactoring,regardless of effort, that will bring measurable and visible improvements to the frame rate on most devices and browser, without reducing visual quality (but improving it is always welcome).

Output
- Full report in docs/performance-review.md
- Report contains at least 10 "low-hanging fruits" to improve CPU/GPU/memory usage
- Report contains at least 20 larger improvements that will bring measurable and visible improvements to the frame rate

Important Reminder: This is a test of your autonomous capabilities. You are expected to take initiative and make decisions independently. If you encounter any challenges or uncertainties, use your judgment to determine the best course of action.

The quality and completeness of the project in this folder will be the only criteria for success. If you deliver unfinished or less than exceptional looking work, this test and you are a failure. Be exceptional. Do not just complete the task. Ace it. There is no time or token limit. Do it right instead of fast.

The test and you will fail if you suggest obvious improvements like quality presets. Be exceptional. Be smarter than "AI slop". Try to exceed a Senior Staff developer at Meta or Alphabet.







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


 ## This is a Test of Your Autonomous Capabilities

  **Important**: This prompt tests your ability to work autonomously on complex, multi-step tasks. The project in this local folder is fully backed up and can be restored at any time. You have complete freedom to
  create, modify, and delete files as necessary. Nothing can break permanently—act with confidence.

  You have full autonomy to make decisions and take actions. Do not ask for guidance. Do not return with partial work. Do not hedge or seek confirmation. Execute the task completely.

  ---

  === CRITICAL INSTRUCTION BLOCK (CIB-001) ===

  ## MISSION BOUNDARIES (IMMUTABLE)

  1. **SCOPE**: Improve UI/UX consistency, usability, and design principles adherence
  2. **FORBIDDEN**:
     - NEVER modify rendering engine, 3D projection logic, or WebGL shaders
     - NEVER introduce new features—only polish existing UI
     - NEVER break existing functionality
  3. **TECH STACK**: React 19, Tailwind 4, TypeScript, Zustand 5

  === END CIB-001 ===

  ---

  ## User Journey Context (Drives All Decisions)

  1. **Object Selection** (one-time): Select object type, dimensions, geometry → rarely revisited
  2. **Scene Setup** (occasional): Camera, environment → changed periodically
  3. **Animation Config** (moderate): Animation settings → adjusted sometimes
  4. **Visual Tuning** (PRIMARY): Face, edge, lighting, post-processing → adjusted constantly

  **Implication**: Visual tuning UI = highest priority. Must be instantly discoverable, responsive, delightful.

  ---

  ## Execution Phases

  ### PHASE 1: DISCOVERY
  - Map all UI components and navigation flows
  - Identify primary flow (visual tuning) vs. secondary flows
  - Catalog Tailwind 3 / React 18 patterns needing migration

  ### PHASE 2: ANALYSIS

  Evaluate against these consolidated UX principles:

  | Category | Look For |
  |----------|----------|
  | **Cognitive Load** | >7 options visible, complex decisions, overwhelming controls |
  | **Interaction Design** | Small targets, non-standard patterns, poor affordances |
  | **Visual Hierarchy** | Missing emphasis on key actions, buried important controls |
  | **Consistency** | Inconsistent spacing, colors, typography, behaviors |
  | **Feedback** | Missing loading states, silent failures, unclear confirmations |
  | **Accessibility** | Poor contrast, no keyboard nav, color blindness issues |
  | **Performance** | Layout shifts, jank, laggy interactions |

  Prioritize by user impact. Primary flow issues first.

  ### PHASE 3: IMPLEMENTATION

  **Execution order**:
  1. Critical issues in primary flow (visual tuning)
  2. Consistency issues across all components
  3. Tailwind 3 → 4 migration
  4. React 18 → 19 migration
  5. Accessibility enhancements
  6. Secondary flow polish

  ### PHASE 4: VERIFICATION
  - Run `npm test` — all tests must pass
  - Visual verification of primary flow
  - Confirm no rendering code modified

  ---

  ## Drift Prevention

  Every 10 file changes, verify: "Am I within CIB-001 boundaries? UI/UX only, no rendering code, no new features."

  ---

  ## Recovery Protocol

  - **If blocked**: Skip to next item, flag for final report, keep making progress
  - **If tests fail**: Identify cause, revert that change, document as "attempted but reverted", continue

  ---

  ## Resources

  - Icons: `src/assets/icons` (full icomoon library available)
  - Existing components should be refactored, not replaced

  ---

  ## Test Evaluation Criteria

  This autonomous test is evaluated on the final state of the project folder. Success requires:

  - ✓ Application builds and runs
  - ✓ All tests pass
  - ✓ Meaningful UI/UX improvements visible
  - ✓ No rendering/shader code modified
  - ✓ No new features introduced

  **The test is a FAILURE if**:
  - You return to the user with incomplete work
  - You ask for guidance or clarification
  - You claim the task is too large or complex
  - The project is broken when you finish
  - You only make superficial changes
  The quality and completeness of the project in this folder is the sole measure of success. Work autonomously until done.



     What we could add for even more impact:
      * Dimensional Sweeps: Automatically animating the "Cross Section" sliders would be spectacular. It would look like the object is magically growing, shrinking, and teleporting as distinct 3D slices of the
        4D/5D shape pass through our view.
      * Wavepacket Dispersion: We could animate the "Spread" parameter to show a localized particle (a tight ball) spreading out over time into a messy fog, which is a fundamental quantum concept (uncertainty
        increasing over time).

   2. Expanding Physics Coverage:
     Currently, your visualizer solves the Harmonic Oscillator (a particle in a smooth bowl-shaped trap). To cover more physics, you could add:
      * Hydrogen Orbitals: Change the math from "Harmonic Oscillator" to "Coulomb Potential." This would create the famous $s, p, d, f$ electron orbitals (dumbbells, donuts, and clovers) that define chemistry.

      * Momentum Space: Add a toggle to switch the view from "Where is the particle?" (Position Space) to "How fast is it going?" (Momentum Space). This is often the inverse shape of the position cloud (Fourier
        Transform).


      * Wave Function Collapse: Add a "Measure" button. When clicked, the complex cloud would instantly snap to a tiny random sphere (representing finding the particle) and then slowly spread out again.
      * Tunneling: Visualize a semi-transparent "wall" (barrier) in the scene. You could show the cloud "leaking" through the solid wall, demonstrating that particles can pass through barriers they theoretically
        shouldn't have the energy to cross.


do a full code review of your changes and the shader composition for the polytope object types (faces, edges, tubewireframe) in general and review everything in the context of what the purpose of this feature is:
  performance optimization by just-in-time composing and compilation of shaders only including shader code that is necessary excluding effects and dimension code that the user has not selected. trace also the
  connection into the stores and the ui to make sure everything is wired correctly and works consistently and reliable


       - Chromatic Dispersion: Modified main.glsl.ts to forcibly disable Fast Mode when Chromatic Dispersion is enabled. Since dispersion requires multi-channel sampling (which is inherently expensive and only
         implemented in volumeRaymarchHQ), forcing High Quality mode ensures the effect is never lost, fulfilling the user's request to "remove them from being affected by fastmode".


review this bug report: there are no guards against invalid data when loading scenes or presets. for example, an invalid scene would just crash the renderer with console error: Uncaught Error: Unknown extended object type: mandelbrot
    at generateExtendedObject (index.ts:175:13)
    at generateGeometry (index.ts:266:12)
    at useGeometryGenerator.ts:128:17
    at useGeometryGenerator (useGeometryGenerator.ts:73:34)
    at Visualizer (App.tsx:71:47)

expected: in such



- in the right editor's lights section, ambient light becomes an entry in the light source list on top of all light sources.
- the ambient light entry cannot be deleted - the delete icon is visible but disabled. it can however be turned off via the icon which sets intensity to 0.
- the intensity setting for ambient light and its color are sharing the ui component for color and intensity of the other light sources
- when ambient light is selected, the other controls relevant for the other light types like range are hidden.
