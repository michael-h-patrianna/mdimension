import { Icon } from '@/components/ui/Icon'
import { soundManager } from '@/lib/audio/SoundManager'
import { ExportMode, ExportResolution, VideoCodec, useExportStore } from '@/stores/exportStore'
import { AnimatePresence, m } from 'motion/react'
import { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { NumberInput } from '../ui/NumberInput'
import { Slider } from '../ui/Slider'
import { ToggleGroup } from '../ui/ToggleGroup'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Tabs } from '../ui/Tabs'

export const ExportModal = () => {
  const {
    isModalOpen,
    setModalOpen,
    isExporting,
    setIsExporting,
    settings,
    updateSettings,
    status,
    setStatus,
    progress,
    previewUrl,
    eta,
    error,
    reset,
    estimatedSizeMB,
    exportTier,
    exportMode,
    exportModeOverride,
    setExportModeOverride,
    browserType,
    completionDetails
  } = useExportStore()

  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic')
  const [dismissedBrowserWarning, setDismissedBrowserWarning] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [supportedCodecs, setSupportedCodecs] = useState<Record<VideoCodec, boolean>>({
      avc: true, hevc: false, vp9: true, av1: false
  })

  // Check Codec support on mount
  useEffect(() => {
    const checkSupport = async () => {
        if (typeof VideoEncoder === 'undefined') {
            setSupportedCodecs({ avc: false, hevc: false, vp9: false, av1: false })
            return
        }

        const check = async (codec: string) => {
            try {
                // Approximate config for 1080p
                const config: VideoEncoderConfig = {
                    codec, width: 1920, height: 1080, bitrate: 4_000_000, framerate: 30
                }
                const support = await VideoEncoder.isConfigSupported(config)
                return !!support.supported
            } catch (e) { return false }
        }

        const [avc, hevc, vp9, av1] = await Promise.all([
            check('avc1.42001E'), // H.264 Main
            check('hvc1.1.6.L120.B0'), // HEVC Main10 (Apple) or Main
            check('vp09.00.10.08'), // VP9 Profile 0
            check('av01.0.05M.08') // AV1 Main
        ])

        const newSupport = { avc, hevc, vp9, av1 }
        setSupportedCodecs(newSupport)

        // Auto-fix invalid selection
        if (!newSupport[settings.codec]) {
            // Fallback: If current format is mp4, try avc. If webm, try vp9.
            if (settings.format === 'mp4') updateSettings({ codec: 'avc' })
            else if (settings.format === 'webm') updateSettings({ codec: 'vp9' })
        }
    }
    checkSupport()
  }, []) // Run once

  const clampDimension = (val: number) => {
      // 128x128 min, 7680x7680 max (8K), round to even
      let clamped = Math.max(128, Math.min(7680, Math.round(val) || 1920))
      return Math.floor(clamped / 2) * 2
  }

  const handleClose = () => {
    if (status === 'encoding') {
        return // Prevent closing during encoding to avoid leaks/desync
    }
    if (isExporting && status === 'rendering') {
        setShowStopConfirm(true)
        return
    }
    closeModal()
  }

  const closeModal = () => {
    setModalOpen(false)
    reset()
    setDismissedBrowserWarning(false)
    setActiveTab('basic')
  }

  const handleConfirmStop = () => {
    setIsExporting(false) // This aborts the controller
    setShowStopConfirm(false)
    closeModal()
  }

  const handleExport = () => {
    soundManager.playClick()
    setIsExporting(true)
  }

  const handleDownload = () => {
    if (previewUrl) {
        const link = document.createElement('a')
        link.href = previewUrl
        const ext = settings.format === 'webm' ? 'webm' : 'mp4'
        link.download = `mdimension-${Date.now()}.${ext}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        soundManager.playSuccess()
    }
  }

  // ToggleGroup options
  const resolutionOptions = ([
    { value: '720p', label: '720P' },
    { value: '1080p', label: '1080P' },
    { value: '4k', label: '4K' },
    { value: 'custom', label: 'Custom' }
  ])

  const formatOptions = ([
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM', disabled: !supportedCodecs.vp9 }
  ])

  const fpsOptions = ([
    { value: '24', label: '24 FPS' },
    { value: '30', label: '30 FPS' },
    { value: '60', label: '60 FPS' }
  ])

  const modeOptions = ([
    { value: 'in-memory', label: 'In-Memory' },
    { value: 'stream', label: 'Stream' },
    { value: 'segmented', label: 'Segmented' }
  ])

  const encodingOptions = ([
    { value: 'prefer-software', label: 'Quality (Software)' },
    { value: 'prefer-hardware', label: 'Speed (Hardware)' },
  ])

  const bitrateModeOptions = ([
    { value: 'constant', label: 'Constant (CBR)' },
    { value: 'variable', label: 'Variable (VBR)' },
  ])

  // Helper for size tier color
  const getTierColor = () => {
    switch (exportTier) {
        case 'large': return 'text-red-400'
        case 'medium': return 'text-amber-400'
        default: return 'text-green-400'
    }
  }

  const getTierBadge = () => {
      switch (exportTier) {
          case 'large': return <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">LARGE</span>
          case 'medium': return <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">MEDIUM</span>
          default: return <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/30">SAFE</span>
      }
  }

  return (
    <>
    <Modal
      isOpen={isModalOpen}
      onClose={handleClose}
      title="Video Export"
      width="max-w-xl"
    >
        <div className="space-y-6">

            {/* STATUS: RENDERING OR PREVIEWING */}
            {(status === 'rendering' || status === 'previewing') && (
                <div className="flex flex-col items-center justify-center py-8 gap-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative w-32 h-32">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="64" cy="64" r="60"
                                className="stroke-white/10 fill-none"
                                strokeWidth="8"
                            />
                            <circle
                                cx="64" cy="64" r="60"
                                className="stroke-accent fill-none transition-all duration-300 ease-linear"
                                strokeWidth="8"
                                strokeDasharray={377}
                                strokeDashoffset={377 * (1 - progress)}
                                style={{ filter: 'drop-shadow(0 0 4px var(--color-accent))' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-mono font-bold tracking-tighter">
                            {Math.round(progress * 100)}%
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold mb-2 animate-pulse text-accent">
                            {status === 'previewing' ? 'Generating Preview...' :
                             exportMode === 'stream' ? 'Streaming to Disk...' :
                             exportMode === 'segmented' ? 'Processing Segments...' :
                             'Rendering Frame by Frame...'}
                        </h3>
                        {eta && status !== 'previewing' && (
                            <p className="text-xs font-mono text-accent/70 mb-1">
                                ETA: {eta}
                            </p>
                        )}
                        <p className="text-sm text-text-secondary">Please wait. Do not close this window.</p>
                    </div>
                    <Button
                        onClick={() => setIsExporting(false)}
                        variant="danger"
                        size="md"
                    >
                        Cancel
                    </Button>
                </div>
            )}

            {/* STATUS: ENCODING */}
            {status === 'encoding' && (
                <div className="flex flex-col items-center justify-center py-12 gap-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Icon name="image" className="text-accent/50 animate-pulse" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-text-primary">Encoding Video...</h3>
                </div>
            )}

            {/* STATUS: COMPLETED */}
            {status === 'completed' && (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                    {/* IN-MEMORY: Preview & Download */}
                    {(!completionDetails || completionDetails?.type === 'in-memory') && previewUrl && (
                        <div className="flex flex-col gap-6">
                            <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative group shadow-2xl">
                                <video
                                    src={previewUrl}
                                    controls
                                    autoPlay
                                    loop
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={handleDownload}
                                    variant="primary"
                                    size="lg"
                                    className="flex-1"
                                    glow
                                >
                                    <Icon name="download" />
                                    Download Video
                                </Button>
                                <Button
                                    onClick={() => { reset(); setStatus('idle'); }}
                                    variant="secondary"
                                    size="lg"
                                    className="flex-1"
                                >
                                    New Export
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STREAM: Success Message (with optional Preview) */}
                    {completionDetails?.type === 'stream' && (
                        <div className="flex flex-col gap-6">
                            {/* Preview Player (if available) */}
                            {previewUrl && (
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative group shadow-2xl">
                                    <video
                                        src={previewUrl}
                                        controls
                                        autoPlay
                                        loop
                                        className="w-full h-full object-contain"
                                    />
                                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white/80 border border-white/10">
                                        PREVIEW (First 3s)
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col items-center justify-center py-4 gap-4 text-center">
                                <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center animate-bounce-short">
                                    <Icon name="check" className="text-green-400 w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-green-400 mb-1">Export Saved!</h3>
                                    <p className="text-text-secondary text-sm max-w-xs mx-auto">
                                        Your video has been streamed directly to your selected file on disk.
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={() => { reset(); setStatus('idle'); }}
                                variant="secondary"
                                size="lg"
                                className="w-full"
                            >
                                New Export
                            </Button>
                        </div>
                    )}

                    {/* SEGMENTED: Instructions */}
                    {completionDetails?.type === 'segmented' && (
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
                                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
                                    <Icon name="download" className="text-amber-400 w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-amber-400 mb-1">Export Complete</h3>
                                    <p className="text-text-secondary">
                                        {completionDetails?.segmentCount} segments have been downloaded.
                                    </p>
                                </div>
                            </div>

                            {/* Merge Instructions */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm">
                                <details className="group">
                                    <summary className="flex items-center gap-2 cursor-pointer font-medium text-text-primary hover:text-accent transition-colors">
                                        <Icon name="chevron-right" className="w-4 h-4 transition-transform group-open:rotate-90" />
                                        Need a single file? Here's how to merge
                                    </summary>
                                    <div className="mt-4 space-y-4 pl-6 border-l-2 border-white/5 ml-2">
                                        <div className="space-y-1">
                                            <p className="text-text-secondary font-bold">1. Create a file list</p>
                                            <p className="text-text-tertiary">Create <code>filelist.txt</code> containing:</p>
                                            <pre className="bg-black/50 p-2 rounded text-xs font-mono text-text-secondary mt-1 block">
                                                file 'mdimension-part1.mp4'{'\n'}
                                                file 'mdimension-part2.mp4'{'\n'}
                                                ...
                                            </pre>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-text-secondary font-bold">2. Run FFmpeg</p>
                                            <div className="flex gap-2 items-stretch h-10">
                                                <code className="bg-black/50 px-3 py-2 rounded text-xs font-mono text-accent flex-1 flex items-center overflow-x-auto whitespace-nowrap">
                                                    ffmpeg -f concat -safe 0 -i filelist.txt -c copy merged.mp4
                                                </code>
                                                <Button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('ffmpeg -f concat -safe 0 -i filelist.txt -c copy merged.mp4')
                                                        soundManager.playClick()
                                                    }}
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-full px-4"
                                                >
                                                    Copy
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            </div>

                            <Button
                                onClick={() => { reset(); setStatus('idle'); }}
                                variant="secondary"
                                size="lg"
                                className="w-full"
                            >
                                New Export
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* STATUS: ERROR */}
            {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        <Icon name="warning" className="text-red-500 w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-red-400 font-bold mb-1 text-lg">Export Failed</h3>
                        <p className="text-red-300/80 text-sm max-w-xs mx-auto">{error}</p>
                    </div>
                    <Button
                        onClick={() => { setIsExporting(false); setStatus('idle'); }}
                        variant="danger"
                        className="mt-2"
                    >
                        Try Again
                    </Button>
                </div>
            )}

            {/* STATUS: IDLE (SETTINGS) */}
            {status === 'idle' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Tabs
                    value={activeTab}
                    onChange={(val) => setActiveTab(val as 'basic' | 'advanced')}
                    fullWidth
                    tabs={[
                        {
                            id: 'basic',
                            label: 'Basic',
                            content: (
                                <div className="space-y-6 pt-6">
                                    {/* Format Section */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Format</label>
                                            {!supportedCodecs.vp9 && (
                                                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    WebM unavailable on this device
                                                </span>
                                            )}
                                        </div>
                                        <ToggleGroup
                                            options={formatOptions}
                                            value={settings.format}
                                            onChange={(val) => {
                                                const fmt = val as ExportFormat
                                                // Reset codec to safe default when changing format
                                                const defaultCodec = fmt === 'mp4' ? 'avc' : 'vp9'
                                                updateSettings({ format: fmt, codec: defaultCodec })
                                            }}
                                        />
                                    </div>

                                    {/* Resolution Section */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Resolution</label>
                                        <ToggleGroup
                                            options={resolutionOptions}
                                            value={settings.resolution}
                                            onChange={(val) => updateSettings({ resolution: val as ExportResolution })}
                                        />

                                        <AnimatePresence>
                                            {settings.resolution === 'custom' && (
                                                <m.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="flex gap-4 pt-2 overflow-hidden"
                                                >
                                                    <div className="space-y-1.5 flex-1">
                                                        <label className="text-[10px] text-text-tertiary uppercase tracking-wide">Width</label>
                                                        <NumberInput
                                                            value={settings.customWidth}
                                                            onChange={(val) => updateSettings({ customWidth: clampDimension(val) })}
                                                            min={128} max={7680} step={2}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 flex-1">
                                                        <label className="text-[10px] text-text-tertiary uppercase tracking-wide">Height</label>
                                                        <NumberInput
                                                            value={settings.customHeight}
                                                            onChange={(val) => updateSettings({ customHeight: clampDimension(val) })}
                                                            min={128} max={7680} step={2}
                                                        />
                                                    </div>
                                                </m.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Quality Controls */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Duration */}
                                        <div className="space-y-1">
                                            <Slider
                                                label="Duration"
                                                value={settings.duration}
                                                onChange={(val) => updateSettings({ duration: val })}
                                                min={1} max={30} step={1}
                                                unit="s"
                                                minLabel="1s"
                                                maxLabel="30s"
                                            />
                                        </div>

                                        {/* FPS */}
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Framerate</label>
                                            <ToggleGroup
                                                options={fpsOptions}
                                                value={settings.fps.toString()}
                                                onChange={(val) => updateSettings({ fps: Number(val) })}
                                            />
                                        </div>
                                    </div>

                                    {/* Warnings Area */}
                                    <div className="space-y-4">
                                        {/* Browser Recommendation */}
                                        <AnimatePresence>
                                            {exportTier === 'large' && browserType === 'standard' && !dismissedBrowserWarning && (
                                                <m.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 relative overflow-hidden"
                                                >
                                                    <div className="flex gap-3">
                                                        <Icon name="info" className="text-blue-400 mt-0.5 shrink-0" />
                                                        <div className="text-xs text-blue-200/90 pr-6">
                                                            <p className="font-bold text-blue-300 mb-1">Browser Recommendation</p>
                                                            For large exports, Chrome or Edge can save directly to disk without memory limits.
                                                        </div>
                                                        <button
                                                            onClick={() => setDismissedBrowserWarning(true)}
                                                            className="absolute top-2 right-2 text-blue-400 hover:text-white"
                                                        >
                                                            <Icon name="cross" className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </m.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Size Warnings */}
                                        <AnimatePresence>
                                            {exportTier !== 'small' && (
                                                <m.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className={`rounded-lg p-3 text-xs border ${
                                                        exportTier === 'large'
                                                            ? 'bg-red-500/10 border-red-500/30 text-red-200'
                                                            : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                                    }`}
                                                >
                                                    {exportTier === 'medium' && "This is a moderately large export. Ensure other tabs are closed for best results."}
                                                    {exportTier === 'large' && exportMode === 'in-memory' && "This export may exceed your browser's memory. Consider using Chrome/Edge for safer disk-based export."}
                                                    {exportTier === 'large' && exportMode === 'stream' && `Large export. Ensure sufficient disk space (~${Math.round(estimatedSizeMB)} MB required).`}
                                                    {exportTier === 'large' && exportMode === 'segmented' && "This export will download as multiple separate files."}
                                                </m.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )
                        },
                        {
                            id: 'advanced',
                            label: 'Advanced',
                            content: (
                                <div className="space-y-6 pt-6">
                                    <div className="space-y-1">
                                        <Slider
                                            label="Bitrate"
                                            value={settings.bitrate}
                                            onChange={(val) => updateSettings({ bitrate: val })}
                                            min={2} max={50} step={1}
                                            unit=" Mbps"
                                        />
                                    </div>

                                    {/* Codec Selection */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Codec</label>
                                        <ToggleGroup
                                            options={[
                                                { value: 'avc', label: 'H.264 (AVC)', disabled: settings.format !== 'mp4' },
                                                { value: 'hevc', label: 'H.265 (HEVC)', disabled: settings.format !== 'mp4' || !supportedCodecs.hevc },
                                                { value: 'vp9', label: 'VP9', disabled: settings.format !== 'webm' },
                                                { value: 'av1', label: 'AV1', disabled: !supportedCodecs.av1 }
                                            ].filter(opt => !opt.disabled || opt.value === settings.codec)}
                                            value={settings.codec}
                                            onChange={(val) => updateSettings({ codec: val as VideoCodec })}
                                        />
                                    </div>

                                    {/* Encoding Options */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Encoding</label>
                                        <ToggleGroup
                                            options={encodingOptions}
                                            value={settings.hardwareAcceleration}
                                            onChange={(val) => updateSettings({ hardwareAcceleration: val as 'no-preference' | 'prefer-hardware' | 'prefer-software' })}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Bitrate Mode</label>
                                        <ToggleGroup
                                            options={bitrateModeOptions}
                                            value={settings.bitrateMode}
                                            onChange={(val) => updateSettings({ bitrateMode: val as 'constant' | 'variable' })}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Export Mode</label>
                                            <span className="text-[10px] text-text-tertiary bg-white/5 px-2 py-0.5 rounded">
                                                {exportModeOverride ? 'Manual' : 'Auto'}
                                            </span>
                                        </div>
                                        <ToggleGroup
                                            options={modeOptions}
                                            value={exportModeOverride || exportMode}
                                            onChange={(val) => setExportModeOverride(val as ExportMode)}
                                        />
                                        {exportModeOverride && (
                                            <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                                <Icon name="warning" className="w-3 h-3" />
                                                Manual mode selection may cause instability.
                                                <button
                                                    onClick={() => setExportModeOverride(null)}
                                                    className="ml-auto underline hover:text-amber-200"
                                                >
                                                    Reset to Auto
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        }
                    ]}
                />

                <div className="space-y-4 pt-4 mt-2 border-t border-white/5">
                    {/* Size Estimate & Tier */}
                    <div className="flex items-center justify-between text-sm bg-white/5 p-4 rounded-lg border border-white/10">
                        <span className="text-text-secondary font-medium">Estimated Size</span>
                        <div className="flex items-center gap-3">
                            {getTierBadge()}
                            <span className={`font-mono font-bold ${getTierColor()}`}>
                                ~{estimatedSizeMB.toFixed(1)} MB
                            </span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <Button
                        onClick={handleExport}
                        variant="primary"
                        size="lg"
                        className="w-full py-4 shadow-lg shadow-accent/10"
                        glow
                    >
                        <Icon name="image" className="w-5 h-5" />
                        {exportMode === 'stream' ? 'Select File & Start' : 'Start Rendering'}
                    </Button>
                </div>
            </div>
            )}
        </div>
    </Modal>
    <ConfirmModal
        isOpen={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        onConfirm={handleConfirmStop}
        title="Stop Recording?"
        message="Are you sure you want to stop the recording? The progress will be lost."
        confirmText="Stop Recording"
        isDestructive
    />
    </>
  )
}
