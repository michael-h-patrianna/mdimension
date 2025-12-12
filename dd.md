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
PNG export exports an empty image



Review this bug report:
With cross section active + "animate slice" active + "show original" hidden, when the "Slice W Position" value/slider hits its minimum or maximum then two visual bugs are shortly showing:
1. the surface plane will jump in the y position
2. the original shape of the object will shortly appear while the cross section disappears




Soft Fill (good for hyppercubes)
- Vertices: off
- Edges: on
- Faces: on
- Face opacity: 0.3
- Surface color: #33cc9e
- Fresnel Rim: off
- Bloom: on
- Bloom intensity: 1.6
- Bloom threshold: 0
- Bloom soft knee: 0
- Bloom radius: 1.65
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
