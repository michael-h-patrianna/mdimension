---
description: Polish and improve the UI/UX of the existing project in the local folder. Focus on consistency, usability, and adherence to UI/UX principles without introducing new features or modifying the rendering engine or 3D projection logic
---

## Test your autonomous capabilities
Important: This prompt is a test of your autonomous capabilities and UI design capabilities. The project in this local folder is backed up and can be restored if needed. You can create, modify, and delete files as necessary to complete the tasks assigned to you. You have full autonomy to make decisions and take actions to achieve the desired outcomes.


## Task Instructions
Techstack: React 19, TailWind 4, TypeScript, Zustand 5

This project has an advanced UI but it lacks consistency and adherence to UI/UX principles. Your task is to improve the UI/UX of the project by refactoring the existing UI components, improving layout and navigation, and ensuring a cohesive and user-friendly experience throughout the application.

## Steps to follow
Follow these phases to complete the task. Adhere to the steps in each phase carefully. Do not skip any steps.

### Phase 1: Analysis
1. Review the project files in the local folder to understand the current state of the project.
2. Identify and analyze the existing UI/UX design patterns used in the project.

### Phase 2: Identification
Review the project and identify any issues or areas for improvement in the following categories:

1. Use the **feature value matrix**: Understand what the user needs. What will dissatisfy them if it's missing or broken? What will delight them? What will wow the user?
2. Use **User Journey Mapping** and **Critical path analysis** and **Flow Modeling**: Think not just in features but in user flows and journey:
  - Which paths in the ui are the most important to the user?
  - Which flows must be flawless and easily accessible?
  - Primary flows: 80% of user value. Must be discoverable instantly.Usually 1–2 clicks.
  - Secondary flows: Useful but contextual. Can live behind tabs, drawers, right-clicks.
  - Tertiary flows: Rare, advanced, or destructive. Hidden behind settings, confirmations, or “Advanced…”.
3. Optimize for **performance**: A fast, responsive UI is crucial for a positive user experience. Minimize load times and ensure smooth interactions. Minimize jank and lag. Minimize layout shifts. Minimize reflows and repaints.
4. The **Aesthetic-Usability Effect**: Users often perceive aesthetically pleasing design as more usable. Enhance visual appeal to improve perceived usability.
5. Apply the **redundancy principle**: Presenting the same information twice in different forms can be harmful if both are equally clear.
6. Everything you do should have a purpose. If it doesn't add value, remove it. Don't add "fluff" or "eye candy" that doesn't serve a purpose. From Cognitive Load Theory: Every visual element competes for attention
7. The **Hick’s Law**: The time it takes to make a decision increases with the number and complexity of choices. Simplify choices for the user.
8. The **Fitts’s Law**: The time to acquire a target is a function of the distance to and size of the target. Make important interaction elements larger and closer.
9. The **Jakob’s Law**: Users spend most of their time on other sites. They prefer your site to work the same way as all the other sites they already know. Follow common conventions.
10. The **Miller’s Law**: The average person can only keep 7 (plus or minus 2) items in their working memory. Chunk information to reduce cognitive load.
11. The **Pareto Principle**: 80% of the effects come from 20% of the causes. Focus on the most impactful changes.
12. The **Peak-End Rule**: People judge an experience largely based on how they felt at its peak and at its end. Make the most important interactions memorable and satisfying.
13. The **Serial Position Effect**: Users have a propensity to best remember the first and last items in a series. Prioritize important information at the beginning and end of lists or sequences.
14. The **Von Restorff Effect**: When multiple similar objects are present, the one that differs from the rest is most likely to be remembered. Use contrast to highlight important elements.
15. **Be Consistent**: Ensure that similar elements look and behave in similar ways throughout the application.
16. **Give Feedback**: Provide clear feedback for user actions to confirm that their inputs have been received and processed.
17. Accessibility: Ensure that the application is usable by people with a wide range of abilities and disabilities. Follow WCAG guidelines for color contrast, keyboard navigation, and screen reader compatibility. Keep in mind users with color blindness, low vision, and other visual impairments.

### Phase 3: Implementation
1. Implement the necessary changes to improve the UI/UX based on your analysis. This may include:
   - Refactoring existing UI components for consistency and usability.
   - Improving layout and navigation for better user flow.
   - Enhancing visual design elements such as colors, typography, spacing, and iconography.
   - Standardizing interaction patterns and behaviors.
   - Enhancing accessibility features.
   - Standardizing the usage of sound effects for user interactions.
2. Identify Tailwind 3 or earlier classes and refactor them to Tailwind 4 equivalents.
3. Identify React 18 or earlier code patterns and refactor them to React 19 equivalents.

### Phase 4: Review
1. Conduct a thorough review of the changes made to ensure they align with UI/UX principles and improve the overall user experience.
2. Test the application to ensure that all UI components function correctly and that there are no regressions or new issues introduced.

## Constraints
1. Do not introduce any new features. Focus solely on improving the existing UI/UX. Polish and refine what is already there.
2. Under no circumstances should you touch the rendering engine or 3D projection logic. Your changes should be limited to the UI/UX aspects of the project.

## Important Reminder: This is a test of your autonomous capabilities
This is an autonomous task. You are expected to take initiative and make decisions independently. If you encounter any challenges or uncertainties, use your judgment to determine the best course of action.

The state of the project will be monitored, and you will be evaluated based on the effectiveness of your improvements and your ability to work autonomously. If you return to user with an incomplete task or ask for guidance, it will be considered a failure to meet the autonomous requirements of this assignment. The quality and completeness of the project in this folder will be the only criteria for success. If the task is incomplete or the project in this folder is broken, you have failed the test of your autonomous capabilities.

## Notes
- for icons you have the whole icomoon icon library at your disposal here: src/assets/icons
- Techstack: React 19, TailWind 4, TypeScript, Zustand 5

## This is the user intent and user journey:
The primary goal of the user is to create visually appealing 3D projections and animations of n-dimensional objects with ease and efficiency. The user journey can be broken down into several key stages:
1. The user will select an object type and the number of dimensions. Then they may adjust some properties of the object geometry. Then they close these settings. They rarely will return to change these settings again.
2. The user will set up the scene environment, camera angle. The user will change these from time to time.
3. The user will configure animation settings. The user will then from time to time adjust animation settings.
4. The user will spend a lot of time on configuring the face, edge, lighting, post processing settings. These will be adjusted often. There is only one object in the scene at a time and the user is focused on making that object look as good as possible and try out different options in face/edge shaders, material, post processing, lighting.
---
