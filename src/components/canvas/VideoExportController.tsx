import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useExportStore } from '@/stores/exportStore'
import { VideoRecorder } from '@/lib/export/video'
import { BASE_ROTATION_RATE, useAnimationStore } from '@/stores/animationStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useUIStore } from '@/stores/uiStore'
import { getPlaneMultiplier } from '@/lib/animation/biasCalculation'
import * as THREE from 'three'

export function VideoExportController() {
  const { gl, advance } = useThree()
  const { 
    isExporting, 
    settings, 
    status, 
    setIsExporting, 
    setStatus, 
    setProgress, 
    setPreviewUrl,
    setError 
  } = useExportStore()

  // Refs to keep track of export state across renders without triggering re-renders
  const recorderRef = useRef<VideoRecorder | null>(null)
  const frameIdRef = useRef<number>(0)
  const abortRef = useRef<boolean>(false)
  
  // Store original renderer state to restore on error/completion
  const originalSizeRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const originalPixelRatioRef = useRef<number>(1)

  useEffect(() => {
    // If we just entered exporting state and status is idle, start the process
    if (isExporting && status === 'idle') {
      startExport()
    }
    
    // Cleanup on unmount or if export stops
    if (!isExporting && recorderRef.current) {
      abortRef.current = true
      // We can't immediately dispose if it's running, but the abort flag handles loop exit.
      // The recorder instance will be nullified in finishExport
    }
  }, [isExporting, status])

  const startExport = async () => {
    // Capture original state before any changes
    gl.getSize(originalSizeRef.current)
    originalPixelRatioRef.current = gl.getPixelRatio()

    try {
      setStatus('rendering')
      abortRef.current = false
      frameIdRef.current = 0
      
      const { fps, duration, bitrate, warmupFrames, customWidth, customHeight, resolution } = settings
      
      // Calculate actual dimensions
      let exportWidth = 1920
      let exportHeight = 1080
      
      if (resolution === 'custom') {
          exportWidth = customWidth
          exportHeight = customHeight
      } else if (resolution === '4k') {
          exportWidth = 3840
          exportHeight = 2160
      } else if (resolution === '1080p') {
          exportWidth = 1920
          exportHeight = 1080
      } else if (resolution === '720p') {
          exportWidth = 1280
          exportHeight = 720
      }

      // Ensure even dimensions (required for some codecs)
      exportWidth = Math.floor(exportWidth / 2) * 2
      exportHeight = Math.floor(exportHeight / 2) * 2

      // Resize renderer to export resolution
      gl.setPixelRatio(1) // Force 1:1 for export to avoid huge buffers
      gl.setSize(exportWidth, exportHeight, false) // false = don't update style
      
      // Initialize Recorder
      const canvas = gl.domElement
      const recorder = new VideoRecorder(canvas, {
        width: exportWidth,
        height: exportHeight,
        fps,
        duration,
        bitrate,
        format: settings.format,
        onProgress: (p) => setProgress(p)
      })
      
      recorderRef.current = recorder
      await recorder.initialize()

      const totalFrames = Math.ceil(duration * fps)
      const frameDuration = 1 / fps
      const animatingPlanes = useAnimationStore.getState().animatingPlanes
      const animationBias = useUIStore.getState().animationBias
      
      // Warmup Phase
      for (let i = 0; i < warmupFrames; i++) {
        if (abortRef.current) break
        
        // We use advance() to trigger the full R3F pipeline including PostProcessing
        // We simulate a small time step for temporal stability (e.g. 1/60s)
        const warmupTimestamp = performance.now() + (i * 16.6)
        
        // Note: For temporal clouds/TAA to settle, they often need 'jitter' updates
        // which happen inside the renderer/effects when frame advances.
        advance(warmupTimestamp)
      }

      // Recording Phase
      const startTime = performance.now()
      let currentTime = 0
      
      // We use a "process next chunk" pattern to avoid locking the UI completely
      // rendering 1 frame at a time and using setTimeout(..., 0)
      
      const processFrame = async () => {
        try {
          if (abortRef.current || frameIdRef.current >= totalFrames) {
            finishExport()
            return
          }

          // 1. Update Animation State
          // We manually calculate the delta for this deterministic step
          const deltaTime = frameDuration * 1000 // ms
          
          // This logic mimics useAnimationLoop
          // We can't reuse useAnimationLoop directly because it uses RAF
          if (animatingPlanes.size > 0) {
             const updates = new Map<string, number>()
             // We need to calculate rotation delta based on speed
             const speed = useAnimationStore.getState().speed
             const direction = useAnimationStore.getState().direction
             // rotationDelta = BASE_ROTATION_RATE * speed * direction * deltaTimeSec
             const rotationDelta = BASE_ROTATION_RATE * speed * direction * (deltaTime / 1000)
             
             let planeIndex = 0
             animatingPlanes.forEach((plane) => {
               const currentAngle = useRotationStore.getState().rotations.get(plane) ?? 0
               const multiplier = getPlaneMultiplier(planeIndex, animatingPlanes.size, animationBias)
               const biasedDelta = rotationDelta * multiplier
               let newAngle = currentAngle + biasedDelta
               
               if (!isFinite(newAngle)) newAngle = 0
               newAngle = ((newAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
               
               updates.set(plane, newAngle)
               planeIndex++
             })
             
             useRotationStore.getState().updateRotations(updates)
          }

          // 2. Advance Renderer
          // We must update the clock manually so shaders using 'uTime' or 'time' work correctly
          // R3F's advance() typically takes a timestamp.
          // We fake a timestamp that increments perfectly by 1/fps
          const timestamp = startTime + (frameIdRef.current * frameDuration * 1000)
          
          // Update global uniforms if they exist manually? 
          // R3F handles state.clock if we use advance(timestamp)
          advance(timestamp)
          
          // 3. Capture
          await recorder.captureFrame(currentTime, frameDuration)
          
          currentTime += frameDuration
          frameIdRef.current++
          
          // Yield to main thread to allow UI updates (progress bar)
          setTimeout(processFrame, 0)
        } catch (e) {
          console.error(e)
          setError(e instanceof Error ? e.message : 'Frame capture error')
          setStatus('error')
          // Restore renderer on error
          gl.setSize(originalSizeRef.current.x, originalSizeRef.current.y, false)
          gl.setPixelRatio(originalPixelRatioRef.current)
        }
      }

      processFrame()

    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Unknown export error')
      setStatus('error')
      // Restore renderer size immediately on error
      gl.setSize(originalSizeRef.current.x, originalSizeRef.current.y, false)
      gl.setPixelRatio(originalPixelRatioRef.current)
    }
  }

  const finishExport = async () => {
    try {
      if (abortRef.current) {
        setStatus('idle')
        setIsExporting(false)
        // Restore on abort
        gl.setSize(originalSizeRef.current.x, originalSizeRef.current.y, false)
        gl.setPixelRatio(originalPixelRatioRef.current)
        return
      }

      setStatus('encoding')
      const blob = await recorderRef.current?.finalize()
      if (blob) {
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setProgress(1) // Ensure 100%
        setStatus('completed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Encoding failed')
      setStatus('error')
    } finally {
      // Restore Renderer
      gl.setSize(originalSizeRef.current.x, originalSizeRef.current.y, false)
      gl.setPixelRatio(originalPixelRatioRef.current)
      
      if (recorderRef.current) {
          recorderRef.current.dispose()
          recorderRef.current = null
      }
      
      // Note: We don't set isExporting to false yet, because we want to show the "Completed" modal state
      // The user will close the modal, which triggers reset()
    }
  }

  return null
}
