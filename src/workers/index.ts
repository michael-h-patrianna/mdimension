/**
 * Worker types and utilities export.
 *
 * @module workers
 */

export type {
  // Request types
  WorkerRequest,
  GenerateWythoffRequest,
  ComputeFacesRequest,
  CancelRequest,
  // Response types
  WorkerResponse,
  ResultResponse,
  ProgressResponse,
  ErrorResponse,
  CancelledResponse,
  // Other types
  GenerationStage,
  TransferableFaceData,
} from './types'

export {
  // Type guards
  isGenerateWythoffRequest,
  isComputeFacesRequest,
  isCancelRequest,
  isResultResponse,
  isProgressResponse,
  isErrorResponse,
} from './types'
