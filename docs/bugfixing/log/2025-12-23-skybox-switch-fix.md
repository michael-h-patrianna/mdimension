Refactor skybox switch to be more robust.

- [x] Analyze Render Graph and Skybox interactions.
- [x] Identify root cause: Texture Incomplete (mipmap mismatch) and State Corruption (PMREM).
- [x] Fix Skybox.tsx to validate mipmaps.
- [x] Fix CubemapCapturePass.ts to force MRT sync.
- [x] Verify build.
- [x] Commit changes.