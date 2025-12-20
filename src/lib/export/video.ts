import { 
  Output, 
  Mp4OutputFormat, 
  BufferTarget, 
  CanvasSource, 
  VideoEncodingConfig 
} from 'mediabunny'

export interface VideoExportOptions {
  width: number
  height: number
  fps: number
  duration: number
  bitrate: number
  format: 'mp4' | 'webm' // Currently we focus on mp4/avc
  onProgress?: (progress: number) => void
}

export class VideoRecorder {
  private output: Output | null = null
  private target: BufferTarget | null = null
  private source: CanvasSource | null = null
  private canvas: HTMLCanvasElement
  private options: VideoExportOptions
  private isRecording: boolean = false

  constructor(canvas: HTMLCanvasElement, options: VideoExportOptions) {
    this.canvas = canvas
    this.options = options
  }

  async initialize() {
    // 1. Setup Target
    this.target = new BufferTarget()

    // 2. Setup Output Format
    const format = new Mp4OutputFormat()

    // 3. Create Output
    this.output = new Output({
      format,
      target: this.target
    })

    // 4. Configure Encoder
    const config: VideoEncodingConfig = {
      codec: 'avc', // H.264
      bitrate: this.options.bitrate * 1_000_000, // Convert Mbps to bps
    }

    // 5. Create Source
    // CanvasSource(canvas, config)
    this.source = new CanvasSource(this.canvas, config)

    // 6. Add Track
    this.output.addVideoTrack(this.source, {
        frameRate: this.options.fps
    })

    // 7. Start the output - REQUIRED before adding frames
    await this.output.start()

    this.isRecording = true
  }

  /**
   * Captures the current state of the canvas as a frame
   * @param timestamp Current timestamp in seconds
   * @param duration Duration of this frame in seconds (1/fps)
   */
  async captureFrame(timestamp: number, duration: number) {
    if (!this.source || !this.isRecording) {
      throw new Error('Recorder not initialized or not recording')
    }

    await this.source.add(timestamp, duration)
    
    if (this.options.onProgress) {
        const totalDuration = this.options.duration
        // Use a small epsilon to avoid 100% before finalized
        const progress = Math.min((timestamp / totalDuration), 0.99)
        this.options.onProgress(progress)
    }
  }

  async finalize(): Promise<Blob> {
    if (!this.output || !this.target) {
        throw new Error('Recorder not initialized')
    }

    this.isRecording = false
    
    // Finalize the output (writes atoms/headers)
    await this.output.finalize()
    
    // Get the buffer
    const buffer = this.target.buffer
    
    if (!buffer) {
        throw new Error('Buffer is empty after finalization')
    }
    
    // Create Blob
    return new Blob([buffer], { type: 'video/mp4' })
  }

  dispose() {
    this.isRecording = false
    this.source = null
    this.output = null
    this.target = null
  }
}
