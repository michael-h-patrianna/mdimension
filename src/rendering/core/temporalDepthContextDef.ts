/**
 * Temporal Depth React Context
 *
 * Isolated React Context for Fast Refresh compatibility.
 *
 * @module rendering/core/temporalDepthContextDef
 */

import { createContext } from 'react'

import type { TemporalDepthState } from './TemporalDepthState'

/**
 * React Context for temporal depth state.
 * Internal - use useTemporalDepth hook to access.
 */
export const TemporalDepthContext = createContext<TemporalDepthState | null>(null)
