/**
 * Temporal Depth Module
 *
 * Barrel file exporting all temporal depth related functionality.
 * Import from this file for most use cases.
 *
 * @module rendering/core/temporalDepth
 */

// State class and types
export { TemporalDepthState, invalidateAllTemporalDepth } from './TemporalDepthState'
export type { TemporalDepthUniforms } from './TemporalDepthState'

// React hooks
export { useTemporalDepth, useTemporalDepthOptional } from './useTemporalDepth'

// React Provider
export { TemporalDepthProvider } from './TemporalDepthContext'
export type { TemporalDepthProviderProps } from './TemporalDepthContext'
