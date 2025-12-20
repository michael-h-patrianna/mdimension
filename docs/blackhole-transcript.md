This is Sagittarius 8, the black hole in
0:02
the center of the Milky Way, simulated
0:04
in C++ using OpenGL. You've probably
0:06
heard of black holes being crazy objects
0:08
with gravity so strong that not even
0:10
light can escape. But no matter how
0:11
crazy you believe these objects are, you
0:13
are wrong. And in this video, I hope to
0:15
show you firsthand by using real physics
0:16
equations to simulate the effects of
0:18
black holes in space. So, let's start
0:20
off with the plan. Simulating a black
0:22
hole unsurprisingly has multiple parts
0:24
to it. Firstly, black holes have the
0:26
ability to curve light around them,
0:27
creating these super cool effects that
0:29
we'll be diving deep into later. To
0:30
simulate this, I need to create a ray
0:32
tracing engine. Similar to our own eyes,
0:33
a ray tracing engine creates images
0:35
using light rays. But instead of
0:37
absorbing light like our eyes, it shoots
0:39
out rays from the screen and calculates
0:40
the path they take to their origin. For
0:42
the black hole, we can use physics
0:44
equations to alter the path of these
0:46
rays based on the pull of the black
0:47
hole. If this sounds confusing, no
0:49
problem. Let's start with a 2D model. I
0:51
begin by initializing OpenGL in an
0:52
engine strct and running a window in the
0:54
main loop.
0:56
First, I'll create two strcts for the
0:58
black hole and the light rays. A strruct
0:59
is a simple way of creating your own
1:01
data type that can store its own
1:02
variables and functions. The black hole
1:04
will have a position vector, a mass, and
1:06
the event horizon. The event horizon is
1:08
the distance at which not even light can
1:10
escape a black hole. We can calculate it
1:12
using the short sealed radius formula.
1:13
And in our simulation, it will act as
1:15
the radius. Keep this formula in mind
1:16
though because it comes up again later.
1:18
Now to draw the black hole, here's some
1:19
déja vu. Because OpenGL doesn't have a
1:21
default circle function, we have to
1:23
create our own. So let's create a simple
1:24
draw circle function in the black hole
1:26
strct. By iterating over the radiance of
1:28
the circle, we can get the sign and
1:29
cosine values for each angle and
1:31
multiply them by the radius to get a
1:33
perfect circle. Then using the position
1:35
values, we can offset the center to get
1:36
full control over the black hole's
1:38
position. Pretty simple. Now moving on
1:40
to the racer. For now, we'll just add an
1:42
X and Y component. In a simple draw
1:44
function, we'll draw a point using their
1:46
X and Y chords. Then we'll create a step
1:48
function that takes the velocity of
1:49
light 299792458
1:51
m/s in a given direction and moves the
1:53
light forward in small increments. Now
1:55
let's initialize a ray in the main loop
1:57
and run the simulation. This is nice,
1:59
but I kind of want to see the path of
2:01
the light as it moves forward. Let's add
2:02
a trail vector to track the ray's
2:04
previous positions. Each update will
2:05
push the new X and Y coordinates to the
2:07
trail and then blend it so that the
2:08
trail is brightest at the tip and fades
2:10
out near the end. Now in the main loop,
2:11
we can initialize a cluster of rays in a
2:13
line and run the simulation. Isn't that
2:16
neat? But obviously if this was a real
2:18
black hole, the light rays wouldn't be
2:19
so chill going right through it. So now
2:21
let's actually implement the physics to
2:22
alter the path of the rays. Firstly,
2:24
we'll be using polar coordinates instead
2:26
of normal x and y. Polar coordinates are
2:28
centered to the black hole. R is the
2:30
distance of the black hole to the ray
2:31
and pi is the angle from the x-axis.
2:33
Here's a grid to help you visualize the
2:35
two coordinates. Since our black hole is
2:37
at 0 0, r can be calculated using the
2:39
simple distance equation. But for all
2:41
the pro programmers out there, we can
2:43
use the hypotenuse function that does
2:44
the same thing. Then pi can be
2:46
calculated using the a tan function that
2:48
takes in the x and y and outputs the
2:49
angle. Step one complete. Pretty easy.
2:51
Now quickly using our new polar
2:53
coordinates, let's add an if statement
2:54
to stop the rays from flying right
2:56
through the black hole. If r is less
2:57
than the sword shield radius, the point
2:59
of no return, we can just skip stepping
3:01
the ray. Let's test it out real quickly.
3:02
And
3:04
perfect. So far so good. Now we have to
3:06
take a bit of a step back because
3:08
there's some pretty intense math and
3:09
physics that need to be explained. Okay,
3:11
so you've probably heard that the
3:12
universe is made of this thing called
3:14
spacetime. and that big masses like
3:15
stars or black holes can warp spaceime,
3:18
something we call gravity. This
3:19
curvature does something very
3:21
interesting to the geometry of space.
3:23
Think of a plane flying around Earth.
3:24
Planes always take the shortest path to
3:26
their destination. But on a flat map,
3:28
this path looks curved. This is the
3:29
definition of a geodessic, the shortest
3:31
path in a curved space. So that weird
3:33
curved flight path, it's actually the
3:35
straightest possible path if you take
3:36
into account Earth's curvature. The same
3:38
goes for spacetime. All matter,
3:40
including light, follows the geodessic
3:42
path unless something is pushing on it.
3:43
Right now, you're experiencing the
3:45
ground pushing up on you, so you're not
3:46
following the natural geodessic path
3:48
towards Earth's center. This is
3:49
intrinsically why you feel your own
3:51
weight. Our goal now is to have our rays
3:52
follow a geodessic, the shortest path
3:54
through a curved space-time grid. This
3:56
doesn't just mean apply gravity. It
3:57
means calculate the shape of space-time
3:59
itself. Because light is the fastest
4:00
thing in our universe, it goes on a path
4:02
that nothing else can go on because we
4:04
experience the time dimension while
4:05
light doesn't. So, we need to find the
4:07
special path called the null gio. The
4:09
tool physics gives us for this is the
4:11
Einstein field equation. It's a law that
4:12
connects mass and energy with the
4:14
geometry of spacetime. But this doesn't
4:15
give us a direct answer. To get actual
4:17
paths, we need to solve it under
4:19
specific conditions. Which, by the way,
4:21
is like the hardest thing to do in all
4:22
of physics. That's why in 1915, Carl
4:25
Schwarzfield looked at this equation and
4:26
thought, what if we took everything out
4:28
of the universe and just left a still
4:30
spherical mass? That would leave the
4:32
entire right side of the equation to
4:33
zero. Solving for this, he created the
4:35
Schwarz shield metric that is even able
4:36
to predict the curvature around a
4:38
non-spinning black hole. And it's what
4:39
we'll be using in our simulation. That's
4:41
a lot of physics talk. So hopefully you
4:43
have a clear idea of what we are trying
4:44
to do here. Find the shortest path on a
4:46
curved grid. So let's create a geodessic
4:48
function outside of our strus that takes
4:50
in the ray and the event horizon. In our
4:52
ray truck, we'll add the dr and dpi
4:54
parameters. These will act as our
4:56
velocities for our polar positions. Now
4:58
we need to figure out how fast those
5:00
change. What is the acceleration of the
5:02
direction of light? Key point, not
5:03
speed, direction. The equation that will
5:05
help us find the rate of change of the
5:07
direction. Well, we have to calculate it
5:09
ourselves from the geodessic equation.
5:11
This is the geodessic equation. It helps
5:13
us find the straightest possible path in
5:15
a curved spaceime. We could literally
5:16
use this equation to find the shortest
5:18
path for a plane around the globe. This
5:20
xu variable refers to any of the
5:22
coordinates t, r or pi that we'll plug
5:24
in one at a time to get our equation
5:25
for. This value here is the aphen
5:27
parameter. It's an arbitrary step size
5:29
that we use to move forward in our
5:30
simulation. Bringing it together, this
5:32
entire part of the equation just means
5:33
the acceleration of one of the
5:35
coordinates r or pi. So let's start by
5:36
filling in xu for our pi coordinate. The
5:39
coordinate we're trying to find the
5:40
acceleration for. Now here comes the
5:41
tricky looking part. The crystal symbols
5:43
written like an upside down L. These are
5:45
what actually encode the curvature of
5:46
spacetime caused by the black hole. The
5:48
rest of the right hand side of the
5:50
equation are just the velocity of
5:51
components we already have dr and d pi.
5:53
So to find the second derivative of pi
5:55
or how the angular velocity changes, we
5:57
use this specific crystal symbol.
5:59
Simplifying it down we get 1 / r.
6:01
Plugging this into the geodistic
6:03
equation, we get the second derivative
6:04
of pi is equal to 2 / r * dr r * d
6:08
p. And it's the same line of steps
6:10
for our r coordinate. We plug in the
6:11
relevant crystal symbol and simplify.
6:13
And we end up with the second derivative
6:14
of r being c^² * the sorial radius / 2 r
6:18
2 + r * d 2. These are the two
6:22
final equations that give us our
6:23
acceleration values for r and pi. So now
6:25
we can just enter these equations into
6:27
the geodessic function. More than having
6:28
a complete understanding on how these
6:30
calculations work and all, it's
6:31
important that you understand the higher
6:33
level of what they mean. This one is
6:34
just finding out how fast our ray moves
6:36
closer to the black hole. And this one
6:37
is finding out how fast the angle
6:39
changes relative to the black hole. And
6:40
just understanding that these equations
6:42
are calculating the shortest possible
6:43
path on a curved space-time grid like
6:45
the plane on the earth. That's all we
6:47
really need to know. Now, in our step
6:48
function, we can use our geodistic
6:50
function to define the acceleration
6:51
values for r and pi. These second
6:53
derivative values will update our first
6:55
derivatives dr and d pi which will
6:57
directly update our r and pi position
6:59
values. Then we can translate these back
7:01
into normal cartisian coordinates and
7:03
push them back in our trail. Now let's
7:04
initialize the rays again and run the
7:06
simulation.
7:10
Isn't that neat? We can now clearly see
7:12
the light being curved here by the black
7:14
hole and even some rays spiraling in. I
7:16
was even able to initialize a ray that
7:18
completed three complete orbits before
7:20
flying off.
7:26
Hi there.
7:27
But I'm noticing a few funny little
7:29
errors here. This light ray took a giant
7:31
step directly into the black hole. And
7:33
the path of the lay seems a bit too
7:34
straight for my liking. After some
7:36
research, I found out that the problem
7:37
stems from our step function. We're
7:39
using something called the user's
7:40
method, taking our acceleration and
7:42
applying it to our velocities and
7:43
position directly. But this is like
7:45
driving high speed on a curved road in
7:47
pitch dark. We're making sharp steps
7:48
forward since we don't have context on
7:50
what's coming next. The solution is
7:52
something called Runga Cuda 4 or RK4.
7:55
What RK4 does is it doesn't just take
7:56
one step forward. It takes four steps
7:58
forward all in one go. And then based on
8:00
those four steps, it has a much more
8:01
educated guess on what the accurate
8:03
position of the light would be. So let's
8:04
create an RK4 function underneath the
8:06
geodessic function. Essentially, we'll
8:08
be running the geodessic equation four
8:10
times. And each time we'll be creating a
8:11
new ray based on the new position. And
8:13
at the end, we'll average out the four
8:14
states using the special RK4 formula to
8:16
get the most accurate path of the light.
8:18
And that should be it.
8:21
As you can see, we see much more
8:22
realistic curves and no rigid steps
8:24
compared to the old uler method. This is
8:26
about as accurate as our 2D ray
8:28
simulation can really get. Really
8:30
quickly, I had the idea to add two black
8:31
holes, meaning two entire polar
8:33
coordinates. And here is what that
8:35
looked like. Pretty neat.
8:38
So with our 2D demonstration complete
8:40
and hopefully your understanding of
8:41
black holes expanded, let's move on to
8:43
the 3D version. Other than adding a
8:45
zcoordinate or a theta value to all our
8:47
objects, there's a small problem with
8:49
moving into 3D. You see, to run a 800 by
8:52
600 pixel simulation, that's 480,000
8:56
rays per frame. And each of those rays
8:58
go through four different evaluations in
9:00
Runga Cuda in tiny small steps. In
9:02
experimentation, I found that in order
9:03
to render the black hole in frame, our
9:05
lights would have to complete at least
9:06
10 to 20,000 steps forward. All that
9:09
becomes a very heavy load on my core
9:11
CPU. But we'll worry about performance
9:13
later. Let's just get a working rate
9:14
tracer going. I'll skip the boring
9:16
parts, but essentially I set up a quad
9:17
texture. A quad texture is like a
9:19
picture that will display our screen
9:20
based on a list of pixels that we give
9:22
it. All we need now is a list of pixel,
9:24
and our screen will be whatever pixel
9:25
values are on that list. So, if we have
9:27
the first half of the pixels set to red,
9:29
our screen will be half red. Isn't that
9:31
neat? Now, in the Y loop, we can run an
9:33
800 by 600 array of rays. And if they do
9:36
intercept the black hole, we can set
9:37
their corresponding index values in the
9:39
pixels list to red. But these rays need
9:41
some initial values. So, let's create a
9:43
camera with an orbital navigation system
9:46
just like in Blender and shoot the rays
9:47
out given in FOV. Then, in a for loop of
9:50
20,000, we'll run the RK4 steps and
9:52
update the rays. So, with our 800x 600x
9:55
20,000x fourstep procedure complete,
9:58
it's time to test whether my CPU can
10:00
actually handle all that.
10:03
Well, that one is expected. Like I
10:05
mentioned, there's no way my CPU could
10:06
reasonably do that many calculations
10:08
with a good frame rate. In fact, I set
10:10
up a clock to calculate my frame rate,
10:12
and I got some pretty scary numbers. But
10:14
I could see my simulation was definitely
10:15
working. When I added a boolean value to
10:17
disable curving the light, the
10:18
simulation ran fine. However, the second
10:20
I turned it on, it went ice cold. And
10:22
that's where we had to switch from my
10:24
CPU to my GPU. While CPUs are like
10:27
Michelin star restaurants that can make
10:28
multiple types of food with unique
10:30
recipes. GPUs are like McDonald's.
10:33
There's no fancy business at McDonald's.
10:34
It's just fast reliable burgers over and
10:37
over. And it's perfect for doing the
10:38
repetitive calculations for our light
10:40
rays in parallel. To run my simulation
10:42
using my GPU, I create a new script in
10:44
GPU language called geodessic.com. This
10:47
script will run super fast and then
10:49
return back all the values of the rays
10:50
to my main script that's powered by my
10:52
CPU. We're going to transfer the race,
10:54
the geodessic and rk4 equations and then
10:56
run a 20,000step loop in geodessic.com.
10:59
If the ray intercepts a black hole, it's
11:00
set to red and breaks. Otherwise, we run
11:02
the rk4 function and update the
11:04
position. And then once the loop is
11:05
done, we'll return the final color.
11:10
Okay, this is definitely better than
11:12
what we had before, but I'm going to
11:13
reduce my screen resolution from 800 by
11:16
600 down to 400 by300 just to make it a
11:18
little bit faster. This feels much
11:20
better, and the simulation seems to be
11:21
working well.
11:23
But now is the moment we've all been
11:25
waiting for. I want to see the halos
11:26
around the black hole. I want to see how
11:28
black holes warp objects around them.
11:29
So, let's add an objects list to our
11:31
simulation. In geodex.com, we're going
11:33
to create a simple disc around the black
11:34
hole along with an object checker to
11:36
detect when the ray intersects with the
11:38
objects. So, let's see the final
11:40
product.
11:41
[Music]
11:50
While I show you guys more of these
11:51
images, I just want to mention my
11:53
dearest thank you to all of you that
11:54
watched, liked, subscribed, and
11:55
commented on my last video. If you
11:57
haven't already, may I just allow your
11:58
mouse to follow its naturalistic path
12:00
towards that beautiful subscribe button.
12:02
It would really mean a lot. To learn
12:03
coding and create cool projects like
12:05
this, I recommend signing up for
12:06
codecfters.io io linked in my
12:08
description. It's free and a perfect
12:09
place to learn low-level skills like
12:11
this. I truly appreciate you all. I
12:13
reply to basically every comment on my
12:15
videos, so you can contact me via the
12:16
comment section below or you can follow
12:18
me on Twitter and Instagram as well for
12:20
DMs and updates on my project. And from
12:22
the deepest point of my heart, I thank
12:24
you very much for watching. Love you
12:25
guys.
12:27
Uh-huh.
