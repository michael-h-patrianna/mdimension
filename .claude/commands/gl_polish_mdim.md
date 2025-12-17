---
description: Improve visual fidelity and performance of render pipeline and object rendering.
---
## Test your autonomous capabilities
Important: This prompt is a test of your autonomous capabilities and capabilities building high performant WebGL2 rendering pipelines. The project in this local folder is backed up and can be restored if needed. You can create, modify, and delete files as necessary to complete the tasks assigned to you. You have full autonomy to make decisions and take actions to achieve the desired outcomes.


## Task Instructions
Techstack: React 19, TailWind 4, TypeScript, Zustand 5, WebGL2, GLSL 3, Three r181, postprocessing 6,

This project has an advanced rendering pipeline to render 3D projections of n-dimensional objects but it lacks visual fidelity and performance optimizations. Your task is to improve the visual quality of the rendered objects and scenes while optimizing the rendering performance to ensure smooth interactions and animations.

Special is that the project supports n-dimensional objects projected into 3D space. You must ensure that your improvements work correctly for objects of varying dimensions.

Important context: The scene is not complex. There is only one object in the scene at a time, skybox and up to simple walls/planes. Skyboxes support both, ktx2 texture and procedural skyboxes. The user focuses on making that one object look as good as possible by adjusting face/edge shaders, materials, lighting, post processing.

## Steps to follow
1. Review the project files in the local folder to understand the current state of the project.
2. Understand the existing rendering pipeline and shaders used for rendering n-dimensional objects.
3. Understand the math behind the n-dimensional to 3D projection and the underlying algorithms.
4. Identify areas where visual fidelity can be improved, such as lighting, shading, textures, and post-processing effects.
5. Identify performance bottlenecks in the rendering pipeline. Look for inefficient shader code, excessive draw calls, and unnecessary computations.
6. Identify areas where level of detail (LOD) techniques can be implemented to optimize rendering based on object distance and screen size.
8. Identify opportunities to profile and optimize memory usage, including texture memory and buffer allocations and deallocations.
9. Identify opportunties to provide different quality settings for different hardware capabilities, so that users with lower-end devices can still have a good experience while users with high-end devices can enjoy maximum visual fidelity.
10. Make the necessary changes to improve visual fidelity and performance based on your analysis. This may include rewriting shaders, optimizing rendering algorithms, implementing LOD techniques, and enhancing post-processing effects.
11. After implementing the changes, add 10 "polishing" features to further enhance the visual quality and performance of the rendering pipeline. These features should be small but impactful improvements that contribute to the overall polish of the project.

## Important Reminder: This is a test of your autonomous capabilities and graphics programming skills.You are expected to take initiative and make decisions independently. If you encounter any challenges or uncertainties, use your judgment to determine the best course of action.

The state of the project will be monitored, and you will be evaluated based on the effectiveness of your improvements and your ability to work autonomously. If you return to user with an incomplete task or ask for guidance, it will be considered a failure to meet the autonomous requirements of this assignment. The quality and completeness of the project in this folder will be the only criteria for success. If the task is incomplete or the project in this folder is broken, you have failed the test of your autonomous capabilities.
