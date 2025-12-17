/**
 * Rendering effects module
 *
 * Contains post-processing effects and feedback systems
 * for enhanced fractal rendering.
 */
export { ZoomProbePass, type ProbeResult, type ProbeSize } from './ZoomProbePass'
export {
  ZoomAutopilot,
  DEFAULT_AUTOPILOT_CONFIG,
  type AutopilotStrategy,
  type InterestMetric,
  type CenterRayLockConfig,
  type InterestScoreConfig,
  type BoundaryTargetConfig,
  type AutopilotConfig,
  type AutopilotResult,
} from './ZoomAutopilot'
