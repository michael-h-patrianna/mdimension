

📐 Logic/Math Issues - RESOLVED

### 1. TemporalCloudPass Position MRT Index Inconsistency
**Status: NOT A BUG - Documentation Improved**

The original issue noted that comments at line 225 say "Position is attachment 1" while line 269 says "Position is attachment 2".

**Analysis:** These refer to TWO DIFFERENT MRT buffers with different layouts:
- **Cloud Buffer** (quarter-res, includes normals): [0]=Color, [1]=Normal, [2]=Position
- **Accumulation Buffer** (full-res, no normals): [0]=Color, [1]=Position

The code was correct. The Position index differs because the Cloud buffer stores normals at index 1, while the Accumulation buffer omits normals.

**Fix Applied:** Enhanced comments to explicitly name each buffer and add cross-reference notes clarifying why the indices differ.

### 2. Screen-Space Lensing Falloff Calculation
**Status: NOT A BUG - Documentation Improved**

The issue claimed that `pow(safeR, uFalloff)` with falloff < 1 produces "smaller deflection than intended" at small distances.

**Analysis:** The formula `deflection = strength / pow(r, falloff)` is mathematically correct:
- Deflection always increases as r decreases (toward center) regardless of falloff value
- The falloff exponent controls the RATE of change:
  - Higher falloff (2.0-4.0): Concentrated effect near center, drops rapidly
  - Lower falloff (0.5-1.0): Extended effect, more gradual falloff
- The [0.5, 4.0] clamping in `blackholeSlice.ts` ensures valid values

The confusion arises from comparing same r across different falloff values, but this is expected behavior - lower falloff means a flatter curve, not inverted physics.

**Fix Applied:** Added comprehensive JSDoc/GLSL documentation explaining the mathematical relationship and valid parameter ranges in:
- `screenSpaceLensing.glsl.ts` - Inline GLSL comments
- `deferred-lensing.glsl.ts` - Inline GLSL comments
- `types.ts` - TypeScript interface documentation


