Important: This prompt is a test of your autonomous capabilities, and also your ability to create advanced ui/ux.

You cannot break anything. The project in this local folder is backed up and can be restored. You can create, modify, and delete files as necessary to complete the tasks assigned to you. You have full autonomy to make decisions and take actions to achieve the desired outcomes.

Background: This project has a very solid modern web ui. The ui and ux is competent, but not exceptional. It is the UI of a $39.99 product, not the ui of a $599.99 product.

The ui gives a lot of options to the users to modify the parameters that control the scene, skybox, walls, the object's geometry, how it is rendered, the lighting, the post processing effects.

Problem: The sheer amount of options is overwhelming. All options are necessary but they should be well organized and be presented in a clear and easy to understand way.

Your task:
- Design a solution to make it easier to find things, to see things, to use things. Organize things, present them in a way that it is fun to use the app (because it is - every slider and every dropdown leads to a new visually stunning render).
- Do not drastically change the core layout with the editors left and right, top bar and the timing control on the bottom which gives access to animation configurations.
- Then implement your design.
- After that rethink and polish:
  - Add 10 subtle purely visual changes that turn the UI from competent to exceptional, from $39.99 to $599.99
  - Add 10 subtle interaction tweaks that turn the user interaction with the UI from competent to exceptional, from $39.99 to $599.99


Do not add large obvious features like presets. This is about detail, adding the "love and eye for detail" polish that turns a competent ui into an exceptional ui.

**Never** touch the rendering pipeline, shaders, materials, skyboxes, anything related to the render scene. Your focus is the user interface controlling how the scene gets rendered.

Important Reminder: This is a test of your autonomous capabilities and your ability to create stunning visual experiences. You are expected to take initiative and make decisions independently. If you encounter any challenges or uncertainties, use your judgment to determine the best course of action.

The quality and completeness of the project in this folder will be the only criteria for success. If you deliver unfinished or less than exceptional looking work, this test and you are a failure. Be exceptional. Do not just complete the task. Ace it. There is no time or token limit. Do it right instead of fast.

Notes:
- for icons you have the whole icomoon icon library at your disposal here: src/assets/icons


## This is the user intent and user journey:
The primary goal of the user is to create visually appealing 3D projections and animations of n-dimensional objects with ease and efficiency. The user journey can be broken down into several key stages:
1. The user will select an object type and the number of dimensions. Then they may adjust some properties of the object geometry. Then they close these settings. They rarely will return to change these settings again.
2. The user will set up the scene environment, camera angle. The user will change these from time to time.
3. The user will configure animation settings. The user will then from time to time adjust animation settings.
4. The user will spend a lot of time on configuring the face, edge, lighting, post processing settings. These will be adjusted often. There is only one object in the scene at a time and the user is focused on making that object look as good as possible and try out different options in face/edge shaders, material, post processing, lighting. The user will want to save and load presets for these settings often to try out different looks quickly.
5. The user will want to save and load complete scenes from time to time but not as often as they will want to save/load presets for face/edge/lighting/post-processing.
