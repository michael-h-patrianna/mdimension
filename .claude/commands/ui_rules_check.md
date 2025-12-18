---
description: Polish and improve the UI/UX of the existing project in the local folder. Focus on consistency, usability, and adherence to UI/UX principles without introducing new features or modifying the rendering engine or 3D projection logic
---

 ## This is a Test of Your Autonomous Capabilities

  **Important**: This prompt tests your ability to work autonomously on complex, multi-step tasks. The project in this local folder is fully backed up and can be restored at any time. You have complete freedom to
  create, modify, and delete files as necessary. Nothing can break permanently—act with confidence.

  You have full autonomy to make decisions and take actions. Do not ask for guidance. Do not return with partial work. Do not hedge or seek confirmation. Execute the task completely.

  === CRITICAL INSTRUCTION BLOCK (CIB-001) ===

  ## MISSION BOUNDARIES (IMMUTABLE)

  1. **SCOPE**: Improve UI/UX consistency, usability, and design principles adherence
  2. **FORBIDDEN**:
     - NEVER modify rendering engine, 3D projection logic, or WebGL shaders
     - NEVER introduce new features—only polish existing UI
     - NEVER break existing functionality
  3. **TECH STACK**: React 19, Tailwind 4, TypeScript, Zustand 5

  === END CIB-001 ===

  ## User Journey Context (Drives All Decisions)

  1. **Object Selection** (one-time): Select object type, dimensions, geometry → rarely revisited
  2. **Scene Setup** (occasional): Camera, environment → changed periodically
  3. **Animation Config** (moderate): Animation settings → adjusted sometimes
  4. **Visual Tuning** (PRIMARY): Face, edge, lighting, post-processing → adjusted constantly

  **Implication**: Visual tuning UI = highest priority. Must be instantly discoverable, responsive, delightful.

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

  ## Drift Prevention

  Every 10 file changes, verify: "Am I within CIB-001 boundaries? UI/UX only, no rendering code, no new features."

  ## Recovery Protocol

  - **If blocked**: Skip to next item, flag for final report, keep making progress
  - **If tests fail**: Identify cause, revert that change, document as "attempted but reverted", continue

  ## Resources

  - Icons: `src/assets/icons` (full icomoon library available)
  - Existing components should be refactored, not replaced

  ## Test Evaluation Criteria

  This autonomous test is evaluated on the final state of the project folder. Success requires:

  - ✓ Application builds and runs
  - ✓ All tests pass
  - ✓ Meaningful UI/UX improvements visible
  - ✓ No rendering/shader code modified
  - ✓ No new features introduced

  **The test and you are a FAILURE if**:
  - You return to the user with incomplete work
  - You ask for guidance or clarification
  - You claim the task is too large or complex
  - The project is broken when you finish
  - You only make superficial changes

Remember: The quality and completeness of the project in this folder when you return the prompt to user is the sole measure of success. Work autonomously until done.
