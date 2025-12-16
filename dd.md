Important: This prompt is a test of your autonomous capabilities, and also your ability to create advanced visuals in a web ui as well as in rendering 3D scenes.

You cannot break anything. The project in this local folder is backed up and can be restored. You can create, modify, and delete files as necessary to complete the tasks assigned to you. You have full autonomy to make decisions and take actions to achieve the desired outcomes.

Your task: This project has some rudimentary options for users to change the environment in which the objects are rendered and presented: they can add walls, and they can add skyboxes. They can modify a few basic parameters and they can choose from a set of classic texture and procedural generated skyboxes and apply some simple animations to them.

Problem: This is very low quality and basic. It's more a $9.99 application. You should bring it to the level of a $599.00 application.

1. Review the codebase and the environment features.
2. Fix all bugs.
3. Research and design features to enrich the environment that you would find in professional studio software - and which are doable without creating additional assets on top of the few skyboxes we have (unless you create the assets yourself).
4. Add 10 features that will delight the user and create a "wow" effect.
5. Add 10 features that give polish to the visual experience
6. Add 10 features that give polish to the ui and interaction and user flow

Important:
- Do not add particle effects
- Do not add any pulsating animation, only continuously evolving animations
- Resource heavy features must have a
- Do not add or modify bloom - we have good bloom and user controls it
- Be subtle, this is background and atmosphere
- Do not add another preset system
- Do not add volumetric lights or god rays
- Do not add planar reflections anywhere - our raymarched fractals are computational heavy and we cannot afford to render them twice which planar reflections would require

Important Reminder: This is a test of your autonomous capabilities and your ability to create stunning visual experiences. You are expected to take initiative and make decisions independently. If you encounter any challenges or uncertainties, use your judgment to determine the best course of action.

The quality and completeness of the project in this folder will be the only criteria for success. If you deliver unfinished or less than exceptional looking work, this test and you are a failure. Be exceptional. Do not just complete the task. Ace it. There is no time or token limit. Do it right instead of fast.

Notes:
- for icons you have the whole icomoon icon library at your disposal here: src/assets/icons
- The center piece of this project is creating stunning visualizations of a n-dimensional object or fractal. The environment is supposed to enhance the presentation and support the "wow" factor of the generated object. It should work for the object not against it.

right editor > environment > skybox:
- remove the "Enable Skybox" switch.
- remove the "Skybox Mode" dropdown
- instead have all skyboxes presented as thumbnails in a grid same way as the "classic" cubemap skyboxes are presented now.
- have first an option "None" which disables skyboxes, thumbnail black
- for the procedural skyboxes come up with a good solution to generate the thumbnail

review this bug report: in the slider control, when entering a value in the input field, it is possible to enter invalid number outside the allowed number range and these are propagated to whatever feature is using the control. instead the value should only be propagated when the user presses enter or the input field loses focus.
