use your prd write skill to write the prd for this feature into docs/prd/ :

in /Users/Spare/Documents/code/MultiScoper/src/rendering we have the rendering pipeline for an audio plugin written in c++. it has several shaders and post processing effects.

we want to adapt parts of the rendering pipeline for our project:
- all shaders are available
- bloom post processing effect is available
- additionally we need a shader that fills faces and supports specular
- on top add a light source

the sidebar "Visuals" section is refactored and allows to configure:
- whether to show vertex "balls"
- what shader to user
- whether to use bloom and how strong
- the color or color palette to use
- whether the light source is on and the color of the light source
- settings per shader (e.g. on the surface shader we want to control specular)

uncertaintity which you should research and decide on:
- we want visually stunning visuals but also be able to differentiate the different edges and faces. they cannot be just all be the same flat color
- we want it to look and feel like real physical objects (how to achieve this?)




Review this bug report:
There is a duplicate Face Opacity slider in the Visual sidebar section that does nothing.

Review this bug report:
1. Line Thickness setting in the Visual section does nothing. It should modify the edge thickness on all shaders.

2. Visual section in sidebar, Edge Color does nothing and never changes the edge color in no shader.

Review this bug report:
1. The "grid" plane that marks the x/z plane at y=0 is only visible when you "look" at it from the top but becomes invisible when you move the camera below it to look at its bottom
2. the plan should also have a material so our object can cast shadow and also reflections on it, to have more the look and feel of an actual physical surface
3. the Visuals sidebar section should have a toggle to turn the plan off/on
4. the plane should be on a negative y value to always sit in some distance below the object to give a nice visual effect as if the object was floating above that surface (consider how to deal with situation when the object size increases e.g. through scaling or skewing)

Review this bug report:
PNG export exports an empty image

Review this bug report:
for the surface shader, the Visuals section has no option to set the surface color(s) or texture

Review this bug report:
after some optimizations recently, our shaders or geometry no longer work correctly for more than 4 dimensions:
1. wireframe shader: only vertices are correct, no lines drawn for the higher dimension planes
2. double line shader: will only draw the lines correctly, when first switching to another shader and then back. if changing dimensions while shader is active, console shows: [.WebGL-0x134004a6c00] GL_INVALID_OPERATION: glDrawElementsInstanced: Vertex buffer is not big enough for the draw call.Understand this warning
(index):1 WebGL: too many errors, no more errors will be reported to the console for this context.
3. surface shader: shows faces more or less correctly, but overlays strange black flickering rectangles
