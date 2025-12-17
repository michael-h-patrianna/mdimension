Important: This prompt is a test of your autonomous capabilities.

You cannot break anything. The project in this local folder is backed up and can be restored. You can create, modify, and delete files as necessary to complete the tasks assigned to you. You have full autonomy to make decisions and take actions to achieve the desired outcomes.


Your task:
- Design a best of class video export feature that allows the user record a video of a rendered scene or part of the scene and export
- Supports web api and frame by frame hq

Worflow
1. Review project and rendering pipeline
2. Write the prd with all must haves and nice to have
3. Add all best practices for such a solution from screen recorders
4. Add 20 delight features that will delight the user
5. Add 20 features that gives the user more control and flexibility
6. Add 20 features that make the ui feel like a million bucks

Important Reminder: This is a test of your autonomous capabilities. You are expected to take initiative and make decisions independently. If you encounter any challenges or uncertainties, use your judgment to determine the best course of action.

The quality and completeness of the project in this folder will be the only criteria for success. If you deliver unfinished or less than exceptional looking work, this test and you are a failure. Be exceptional. Do not just complete the task. Ace it. There is no time or token limit. Do it right instead of fast.

Notes:
- for icons you have the whole icomoon icon library at your disposal here: src/assets/icons





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
