import { 
  Output, 
  Mp4OutputFormat, 
  WebMOutputFormat,
  BufferTarget, 
  StreamTarget,
  CanvasSource, 
  VideoEncodingConfig 
} from 'mediabunny'

import { VideoCodec } from '@/stores/exportStore'

export interface VideoExportOptions {
  width: number
  height: number
  fps: number
  duration: number
  bitrate: number
  format: 'mp4' | 'webm'
  codec?: VideoCodec
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software'
  bitrateMode?: 'constant' | 'variable'
  onProgress?: (progress: number) => void
  streamHandle?: FileSystemFileHandle // Optional: for Stream-to-File mode
}

/**
 * Handles video recording from a canvas using WebCodecs and MediaBunny.
 * Supports both in-memory buffering and direct-to-disk streaming.
 */
export class VideoRecorder {
  private output: Output | null = null
  private target: BufferTarget | StreamTarget | null = null
  private source: CanvasSource | null = null
  private canvas: HTMLCanvasElement
  private options: VideoExportOptions
  private isRecording: boolean = false

  constructor(canvas: HTMLCanvasElement, options: VideoExportOptions) {
    this.canvas = canvas
    this.options = options
  }

  async initialize() {
    // 1. Setup Target & Format Options
    const format = this.options.format === 'webm' 
      ? new WebMOutputFormat() 
      : new Mp4OutputFormat()

    if (this.options.streamHandle) {
        // Stream Mode
        const writable = await this.options.streamHandle.createWritable()
        this.target = new StreamTarget(writable)
        // Fragmented MP4 is required for streaming to ensure data is readable even if crashed
        // (Note: MediaBunny might default to suitable settings for StreamTarget, checking docs/PRD implies we might need config)
        // For now relying on default behavior of StreamTarget + Mp4OutputFormat
    } else {
        // Memory Mode
        this.target = new BufferTarget()
    }

    // 2. Create Output
    this.output = new Output({
      format,
      target: this.target
    })

    // 3. Configure Encoder with quality-optimized settings
    // These settings prioritize visual quality over encoding speed, critical for
    // smooth gradients and avoiding color banding artifacts in WebGL renders.
    const codec = this.options.codec || (this.options.format === 'webm' ? 'vp9' : 'avc')

    const config: VideoEncodingConfig = {
      codec, 
      bitrate: this.options.bitrate * 1_000_000, // Convert Mbps to bps
      bitrateMode: this.options.bitrateMode || 'constant', // Default to CBR for consistency
      latencyMode: 'quality', // Prioritize visual quality over encoding speed
      keyFrameInterval: this.options.fps * 2, // Keyframe every 2 seconds for good seeking + quality
      hardwareAcceleration: this.options.hardwareAcceleration || 'prefer-software', 
    }

    // 4. Create Source
    this.source = new CanvasSource(this.canvas, config)

    // 5. Add Track
    this.output.addVideoTrack(this.source, {
        frameRate: this.options.fps
    })

    // 6. Start the output
    await this.output.start()

    this.isRecording = true
  }

  /**
   * Captures the current state of the canvas as a frame.
   * @param timestamp - The timestamp of the frame in seconds.
   * @param duration - The duration of the frame in seconds.
   */
  async captureFrame(timestamp: number, duration: number) {
    if (!this.source || !this.isRecording) {
      throw new Error('Recorder not initialized or not recording')
    }

    await this.source.add(timestamp, duration)
    
    if (this.options.onProgress) {
        const totalDuration = this.options.duration
        const progress = Math.min((timestamp / totalDuration), 0.99)
        this.options.onProgress(progress)
    }
  }

  /**
   * Finalizes the recording.
   * Returns a Blob if using BufferTarget, or null if using StreamTarget (data already saved).
   * @returns A promise that resolves with the video Blob or null.
   */
  async finalize(): Promise<Blob | null> {
    if (!this.output || !this.target) {
        throw new Error('Recorder not initialized')
    }

    this.isRecording = false
    
    // Finalize the output (writes atoms/headers)
    await this.output.finalize()
    
    if (this.target instanceof BufferTarget) {
        // Get the buffer
        const buffer = this.target.buffer
        if (!buffer) {
            throw new Error('Buffer is empty after finalization')
        }
        const mimeType = this.options.format === 'webm' ? 'video/webm' : 'video/mp4'
        return new Blob([buffer], { type: mimeType })
    }

    // For StreamTarget, data is already written to disk
    return null
  }

  dispose() {
    this.isRecording = false
    this.source = null
    this.output = null
    this.target = null
  }
}
