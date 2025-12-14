# WASD Camera Movement Controls

## Product Overview

This feature adds first-person style camera movement using the WASD keys, allowing users to navigate through 3D space while exploring n-dimensional objects. Movement is relative to the camera's current view direction, providing intuitive navigation similar to video game controls.

**Target Audience:** Existing users of the N-Dimensional Visualizer who want more precise control over camera positioning.

**Core Value Proposition:** Enable intuitive, game-like camera navigation that allows users to explore objects from any angle and distance without relying solely on mouse orbit controls.

---

## User Story 1: Move Camera with WASD Keys

**User story:** As a user, I want to move the camera using WASD keys, so that I can navigate through the 3D space intuitively without using the mouse.

**Acceptance criteria**
1. Pressing W moves the camera forward in the direction it is currently facing
2. Pressing S moves the camera backward (opposite to the direction it is facing)
3. Pressing A strafes the camera to the left (perpendicular to the look direction)
4. Pressing D strafes the camera to the right (perpendicular to the look direction)
5. Movement is relative to the camera's current orientation (look direction), not world axes
6. Movement speed is consistent regardless of camera zoom level
7. Movement is smooth while the key is held down (continuous movement, not single-step)
8. Releasing the key stops the movement immediately
9. Multiple keys can be pressed simultaneously for diagonal movement (e.g., W+A moves forward-left)
10. Camera movement does not affect the object's position or orientation
11. Camera movement works while animation is playing or paused
12. WASD keys do not trigger when typing in input fields

**Test scenarios**

Scenario 1: Move camera forward with W key
- Given the camera is positioned viewing the object from the front
- When the user presses and holds the W key
- Then the camera moves continuously toward the object in the direction it is facing

Scenario 2: Move camera backward with S key
- Given the camera is positioned close to the object
- When the user presses and holds the S key
- Then the camera moves continuously away from the object in the opposite direction of its facing

Scenario 3: Strafe camera left with A key
- Given the camera is viewing the object from the front
- When the user presses and holds the A key
- Then the camera moves continuously to the left while still facing the same direction

Scenario 4: Strafe camera right with D key
- Given the camera is viewing the object from the front
- When the user presses and holds the D key
- Then the camera moves continuously to the right while still facing the same direction

Scenario 5: Diagonal movement with combined keys
- Given the camera is viewing the object
- When the user presses W and A simultaneously
- Then the camera moves diagonally forward and to the left

Scenario 6: Movement respects camera orientation
- Given the camera has been orbited to view the object from above
- When the user presses the W key
- Then the camera moves in the direction it is currently looking (downward toward the object), not along the world Z-axis

Scenario 7: Key release stops movement
- Given the user is holding W and the camera is moving forward
- When the user releases the W key
- Then the camera stops moving immediately

Scenario 8: WASD disabled in input fields
- Given the user is typing in a text input field in the control panel
- When the user types the letter "w"
- Then the camera does not move and the letter appears in the input field

Scenario 9: Movement during animation
- Given the object animation is playing
- When the user presses the W key
- Then the camera moves forward while the animation continues unaffected

---

## User Story 2: Update Keyboard Shortcut for Reverse Animation Direction

**User story:** As a user, I want to press R to reverse the animation direction, so that the keyboard shortcuts are reorganized to accommodate WASD controls.

**Acceptance criteria**
1. Pressing R (without modifier keys) reverses the animation direction
2. The previous D shortcut for reversing animation direction no longer works
3. The R key only reverses direction, it does not toggle play/pause
4. The shortcut works whether animation is playing or paused
5. The keyboard shortcuts panel/help displays R as "Reverse animation direction"
6. The R shortcut does not trigger when typing in input fields

**Test scenarios**

Scenario 1: Reverse animation with R key
- Given the animation is playing in the forward direction
- When the user presses the R key
- Then the animation direction reverses to backward

Scenario 2: D key no longer reverses animation
- Given the animation is playing
- When the user presses the D key
- Then the animation direction does not change (D is now used for camera strafe right)

Scenario 3: Reverse while paused
- Given the animation is paused with direction set to forward
- When the user presses the R key
- Then the animation direction changes to backward (visible when animation is resumed)

Scenario 4: R key in input field
- Given the user is typing in a text input field
- When the user types the letter "r"
- Then the animation direction does not change and the letter appears in the input field

---

## User Story 3: Update Keyboard Shortcut for Reset Rotation

**User story:** As a user, I want to press X to reset all rotations, so that the keyboard shortcuts are reorganized to accommodate the new R shortcut.

**Acceptance criteria**
1. Pressing X (without modifier keys) resets all rotation angles to zero
2. The previous R shortcut for resetting rotation no longer works (R now reverses animation)
3. Resetting rotation does not affect other transformations (scale, translation, shear)
4. Resetting rotation does not affect camera position
5. Resetting rotation does not affect animation play/pause state
6. The keyboard shortcuts panel/help displays X as "Reset rotation"
7. The X shortcut does not trigger when typing in input fields

**Test scenarios**

Scenario 1: Reset rotation with X key
- Given the object has multiple rotation planes set to non-zero angles (e.g., XY=45, XW=90)
- When the user presses the X key
- Then all rotation angles reset to 0 and the object returns to its default orientation

Scenario 2: R key no longer resets rotation
- Given the object has non-zero rotation angles
- When the user presses the R key
- Then the rotation angles are not affected (R now reverses animation direction)

Scenario 3: Reset preserves camera position
- Given the camera has been orbited to a custom position and the object is rotated
- When the user presses the X key
- Then the object rotation resets but the camera remains at its custom position

Scenario 4: Reset preserves other transformations
- Given the object has scale=1.5, shear=0.2, and rotation XY=45
- When the user presses the X key
- Then scale remains 1.5, shear remains 0.2, but rotation XY becomes 0

Scenario 5: Reset while animation is playing
- Given the animation is playing and object has non-zero rotations
- When the user presses the X key
- Then all rotations reset to 0 and the animation continues playing from the reset state

Scenario 6: X key in input field
- Given the user is typing in a text input field
- When the user types the letter "x"
- Then the rotations are not affected and the letter appears in the input field

---

## User Story 4: Display Updated Keyboard Shortcuts Reference

**User story:** As a user, I want to see the updated keyboard shortcuts in the help panel, so that I know the new key mappings for camera movement and other actions.

**Acceptance criteria**
1. The keyboard shortcuts panel shows WASD keys under a "Camera Movement" section
2. W is documented as "Move camera forward"
3. A is documented as "Strafe camera left"
4. S is documented as "Move camera backward"
5. D is documented as "Strafe camera right"
6. R is documented as "Reverse animation direction"
7. X is documented as "Reset rotation"
8. Camera movement shortcuts are grouped together visually
9. The shortcuts panel explains that movement is relative to camera direction
10. The ? key still opens the shortcuts panel

**Test scenarios**

Scenario 1: View WASD shortcuts in help panel
- Given the user presses the ? key to open shortcuts panel
- When the panel displays
- Then WASD keys are shown with their camera movement descriptions

Scenario 2: Camera movement section grouping
- Given the user opens the shortcuts panel
- When viewing the camera movement section
- Then W, A, S, D are grouped together under a "Camera Movement" heading

Scenario 3: Updated R shortcut display
- Given the user opens the shortcuts panel
- When viewing the animation section
- Then R is shown as "Reverse animation direction"

Scenario 4: Updated X shortcut display
- Given the user opens the shortcuts panel
- When viewing the rotation section
- Then X is shown as "Reset rotation"

---

## Specification Summary

**Feature**: WASD Camera Movement Controls
**User Stories (Jira Tickets)**: 4
**Acceptance Criteria**: 34 total
**Test Scenarios**: 20 total

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Move Camera with WASD Keys | User | ~1.5 days | None |
| 2 | Update Shortcut for Reverse Animation | User | ~0.5 days | None |
| 3 | Update Shortcut for Reset Rotation | User | ~0.5 days | None |
| 4 | Display Updated Shortcuts Reference | User | ~0.5 days | Stories 1-3 |

### Coverage
- Happy paths: 10
- Error handling: 0
- Edge cases: 6
- Input field protection: 4
- System behavior: 0

### Placeholders Requiring Confirmation
- None

### Open Questions
- None

### Dependencies Between Stories
- Stories 1, 2, and 3 can be developed independently and in parallel
- Story 4 (shortcuts display) should be completed after Stories 1-3 to show accurate information

### Keyboard Shortcuts Summary (After Implementation)

| Key | Action | Previous Mapping |
|-----|--------|------------------|
| W | Move camera forward | (new) |
| A | Strafe camera left | (new) |
| S | Move camera backward | (new) |
| D | Strafe camera right | Reverse animation |
| R | Reverse animation direction | Reset rotation |
| X | Reset rotation | (new) |
| Space | Play/Pause animation | (unchanged) |
| Arrow Up/Down | Change dimension | (unchanged) |
| 1/2/3 | Select object type | (unchanged) |
| +/- | Adjust animation speed | (unchanged) |
| Ctrl+S | Export PNG | (unchanged) |
| ? | Show shortcuts panel | (unchanged) |

### Ready for Development: YES
