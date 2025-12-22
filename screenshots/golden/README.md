# Golden Screenshots

This directory contains baseline screenshots for Playwright visual regression testing.

## Purpose

Golden screenshots serve as reference images to detect unintended visual changes
during development. The test suite compares rendered output against these baselines.

## Golden Set Requirements

| Scene | Effects | Purpose |
|-------|---------|---------|
| `mandelbulb-default.png` | Bloom, SSR | Fractal baseline |
| `blackhole-walls.png` | Bloom, fog | Lensing reference |
| `schroedinger-cloud.png` | Temporal, volumetric | Temporal baseline |
| `quaternion-julia.png` | SSR, shadows | Julia baseline |
| `polytope-tesseract.png` | Shadow maps | Non-raymarch baseline |

## Updating Baselines

To update baselines after intentional visual changes:

```bash
npm run test:playwright -- --update-snapshots
```

## File Naming Convention

- `{object-type}-{variant}.png` - Standard scene captures
- `{object-type}-{effect}-{variant}.png` - Effect-specific captures

## Notes

- All screenshots should be captured at consistent resolution (1920x1080)
- Use consistent camera position/rotation for reproducibility
- Avoid capturing during animations (pause first)
