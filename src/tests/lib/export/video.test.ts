/**
 * Tests for video export utilities (VideoRecorder)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VideoRecorder } from '@/lib/export/video'

// Mock mediabunny - it uses WebCodecs which aren't available in test environment
vi.mock('mediabunny', () => {
  const mockBuffer = new ArrayBuffer(1024)

  class MockBufferTarget {
    buffer = mockBuffer
  }

  class MockStreamTarget {}

  class MockMp4OutputFormat {}

  class MockOutput {
    private started = false
    // @ts-expect-error - Used for internal state tracking in some tests potentially, but linter complains
    private finalized = false

    addVideoTrack = vi.fn()

    start = vi.fn().mockImplementation(async () => {
      this.started = true
    })

    finalize = vi.fn().mockImplementation(async () => {
      if (!this.started) throw new Error('Output not started')
      this.finalized = true
    })
  }

  class MockCanvasSource {
    private initialized = false

    constructor(_canvas: HTMLCanvasElement, _config: unknown) {
      this.initialized = true
    }

    add = vi.fn().mockImplementation(async (_timestamp: number, _duration: number) => {
      if (!this.initialized) throw new Error('Source not initialized')
    })
  }

  return {
    BufferTarget: MockBufferTarget,
    StreamTarget: MockStreamTarget,
    Mp4OutputFormat: MockMp4OutputFormat,
    Output: MockOutput,
    CanvasSource: MockCanvasSource,
    VideoEncodingConfig: {},
  }
})

describe('VideoRecorder', () => {
  let canvas: HTMLCanvasElement
  let recorder: VideoRecorder

  const defaultOptions = {
    width: 1920,
    height: 1080,
    fps: 60,
    duration: 5,
    bitrate: 12,
    format: 'mp4' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1080
    recorder = new VideoRecorder(canvas, defaultOptions)
  })

  describe('constructor', () => {
    it('should create recorder with canvas and options', () => {
      expect(recorder).toBeInstanceOf(VideoRecorder)
    })
  })

  describe('initialize', () => {
    it('should initialize recorder successfully', async () => {
      await expect(recorder.initialize()).resolves.not.toThrow()
    })

    it('should set isRecording to true after initialize', async () => {
      await recorder.initialize()
      // Verify by trying to capture a frame (would throw if not recording)
      await expect(recorder.captureFrame(0, 1 / 60)).resolves.not.toThrow()
    })
  })

  describe('captureFrame', () => {
    it('should throw when called before initialize', async () => {
      await expect(recorder.captureFrame(0, 1 / 60)).rejects.toThrow(
        'Recorder not initialized or not recording'
      )
    })

    it('should capture frame with correct timestamp and duration', async () => {
      await recorder.initialize()
      await expect(recorder.captureFrame(0, 1 / 60)).resolves.not.toThrow()
      await expect(recorder.captureFrame(1 / 60, 1 / 60)).resolves.not.toThrow()
    })

    it('should call progress callback during capture', async () => {
      const onProgress = vi.fn()
      const recorderWithProgress = new VideoRecorder(canvas, {
        ...defaultOptions,
        onProgress,
      })

      await recorderWithProgress.initialize()
      await recorderWithProgress.captureFrame(2.5, 1 / 60) // 2.5s of 5s = 50%

      expect(onProgress).toHaveBeenCalled()
      const progressValue = onProgress.mock.calls[0]![0]
      expect(progressValue).toBeCloseTo(0.5, 1)
    })

    it('should cap progress at 0.99 during capture', async () => {
      const onProgress = vi.fn()
      const recorderWithProgress = new VideoRecorder(canvas, {
        ...defaultOptions,
        onProgress,
      })

      await recorderWithProgress.initialize()
      await recorderWithProgress.captureFrame(5, 1 / 60) // 5s of 5s = 100%

      expect(onProgress).toHaveBeenCalled()
      const progressValue = onProgress.mock.calls[0]![0]
      expect(progressValue).toBeLessThanOrEqual(0.99)
    })
  })

  describe('finalize', () => {
    it('should throw when called before initialize', async () => {
      await expect(recorder.finalize()).rejects.toThrow('Recorder not initialized')
    })

    it('should return blob after finalize', async () => {
      await recorder.initialize()
      await recorder.captureFrame(0, 1 / 60)
      const blob = await recorder.finalize()

      expect(blob).toBeInstanceOf(Blob)
      expect(blob).not.toBeNull()
      if (blob) {
        expect(blob.type).toBe('video/mp4')
      }
    })

    it('should set isRecording to false after finalize', async () => {
      await recorder.initialize()
      await recorder.captureFrame(0, 1 / 60)
      await recorder.finalize()

      // Trying to capture after finalize should fail
      await expect(recorder.captureFrame(1 / 60, 1 / 60)).rejects.toThrow(
        'Recorder not initialized or not recording'
      )
    })
  })

  describe('dispose', () => {
    it('should clean up resources', async () => {
      await recorder.initialize()
      recorder.dispose()

      // After dispose, capture should fail
      await expect(recorder.captureFrame(0, 1 / 60)).rejects.toThrow(
        'Recorder not initialized or not recording'
      )
    })

    it('should be safe to call multiple times', () => {
      expect(() => {
        recorder.dispose()
        recorder.dispose()
      }).not.toThrow()
    })

    it('should be safe to call before initialize', () => {
      expect(() => recorder.dispose()).not.toThrow()
    })
  })

  describe('options validation', () => {
    it('should handle different FPS values', async () => {
      const recorder24fps = new VideoRecorder(canvas, { ...defaultOptions, fps: 24 })
      await expect(recorder24fps.initialize()).resolves.not.toThrow()
    })

    it('should handle different resolutions', async () => {
      const recorder4k = new VideoRecorder(canvas, {
        ...defaultOptions,
        width: 3840,
        height: 2160,
      })
      await expect(recorder4k.initialize()).resolves.not.toThrow()
    })

    it('should handle different bitrates', async () => {
      const recorderHighBitrate = new VideoRecorder(canvas, {
        ...defaultOptions,
        bitrate: 50,
      })
      await expect(recorderHighBitrate.initialize()).resolves.not.toThrow()
    })
  })
})
