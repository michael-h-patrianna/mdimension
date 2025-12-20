import { useEffect, useState } from 'react'
import { m, AnimatePresence } from 'motion/react'
import { useExportStore, ExportResolution } from '@/stores/exportStore'
import { Icon } from '@/components/ui/Icon'
import { soundManager } from '@/lib/audio/SoundManager'

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
    error,
    reset
  } = useExportStore()

  const [estimatedSize, setEstimatedSize] = useState<string>('0 MB')

  const clampDimension = (val: number) => {
      // 128x128 min, 7680x7680 max (8K), round to even
      let clamped = Math.max(128, Math.min(7680, Math.round(val) || 1920))
      return Math.floor(clamped / 2) * 2
  }

  useEffect(() => {
    // Estimate size: bitrate (Mbps) * duration (s) / 8 = MB
    const sizeMB = (settings.bitrate * settings.duration) / 8
    setEstimatedSize(sizeMB.toFixed(1) + ' MB')
  }, [settings.bitrate, settings.duration])

  const handleClose = () => {
    if (status === 'encoding') {
        return // Prevent closing during encoding to avoid leaks/desync
    }
    if (isExporting && status === 'rendering') {
        if (confirm('Stop recording?')) {
            setIsExporting(false) // This aborts the controller
        } else {
            return
        }
    }
    setModalOpen(false)
    reset()
  }

  const handleExport = () => {
    soundManager.playClick()
    setIsExporting(true)
  }

  const handleDownload = () => {
    if (previewUrl) {
        const link = document.createElement('a')
        link.href = previewUrl
        link.download = `mdimension-${Date.now()}.mp4`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        soundManager.playSuccess()
    }
  }

  if (!isModalOpen) return null

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
              <h2 id="export-modal-title" className="text-xl font-bold flex items-center gap-3">
                <Icon name="image" className="text-accent" />
                Video Export
              </h2>
              <button 
                onClick={handleClose}
                aria-label="Close export modal"
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Icon name="cross" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* STATUS: RENDERING */}
              {status === 'rendering' && (
                <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
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
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-mono font-bold">
                            {Math.round(progress * 100)}%
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold mb-2 animate-pulse">Rendering Frame by Frame...</h3>
                        <p className="text-sm text-text-secondary">Please wait. Do not close this window.</p>
                    </div>
                    <button 
                        onClick={() => setIsExporting(false)}
                        className="px-6 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
              )}

              {/* STATUS: ENCODING */}
              {status === 'encoding' && (
                  <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
                      <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                      <h3 className="text-lg font-bold">Encoding Video...</h3>
                  </div>
              )}

              {/* STATUS: COMPLETED */}
              {status === 'completed' && previewUrl && (
                  <div className="flex flex-col gap-6">
                      <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative group">
                          <video 
                              src={previewUrl} 
                              controls 
                              autoPlay 
                              loop 
                              className="w-full h-full object-contain"
                          />
                      </div>
                      <div className="flex gap-4">
                          <button 
                              onClick={handleDownload}
                              className="flex-1 py-4 bg-accent text-white font-bold rounded-xl hover:bg-accent-hover transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                          >
                              <Icon name="download" />
                              Download Video
                          </button>
                          <button 
                              onClick={() => { reset(); setStatus('idle'); }}
                              className="flex-1 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all"
                          >
                              New Export
                          </button>
                      </div>
                  </div>
              )}

              {/* STATUS: ERROR */}
              {status === 'error' && (
                  <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl flex items-start gap-4">
                      <Icon name="warning" className="text-red-500 shrink-0 mt-1" />
                      <div>
                          <h3 className="text-red-400 font-bold mb-1">Export Failed</h3>
                          <p className="text-red-300/80 text-sm">{error}</p>
                          <button 
                              onClick={() => setStatus('idle')}
                              className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                          >
                              Try Again
                          </button>
                      </div>
                  </div>
              )}

              {/* STATUS: IDLE (SETTINGS) */}
              {status === 'idle' && (
                <div className="space-y-8">
                    
                    {/* Resolution Section */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Resolution</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(['720p', '1080p', '4k', 'custom'] as ExportResolution[]).map(res => (
                                <button
                                    key={res}
                                    onClick={() => updateSettings({ resolution: res })}
                                    className={`
                                        p-3 rounded-xl border transition-all text-sm font-medium
                                        ${settings.resolution === res 
                                            ? 'bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]' 
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-text-secondary'}
                                    `}
                                >
                                    {res === 'custom' ? 'Custom' : res.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        {settings.resolution === 'custom' && (
                            <div className="flex gap-4">
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs text-text-tertiary">Width</label>
                                    <input 
                                        type="number"
                                        min="128" max="7680" step="2"
                                        value={settings.customWidth}
                                        onChange={(e) => updateSettings({ customWidth: clampDimension(Number(e.target.value)) })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-accent outline-none"
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs text-text-tertiary">Height</label>
                                    <input 
                                        type="number"
                                        min="128" max="7680" step="2" 
                                        value={settings.customHeight}
                                        onChange={(e) => updateSettings({ customHeight: clampDimension(Number(e.target.value)) })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-accent outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quality Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Duration */}
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Duration</label>
                                <span className="text-accent font-mono">{settings.duration}s</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" max="30" step="1"
                                value={settings.duration}
                                onChange={(e) => updateSettings({ duration: Number(e.target.value) })}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
                            />
                            <div className="flex justify-between text-xs text-text-tertiary">
                                <span>1s</span>
                                <span>30s</span>
                            </div>
                        </div>

                        {/* FPS */}
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Framerate</label>
                                <span className="text-accent font-mono">{settings.fps} FPS</span>
                            </div>
                            <div className="flex gap-2">
                                {[24, 30, 60].map(fps => (
                                    <button
                                        key={fps}
                                        onClick={() => updateSettings({ fps })}
                                        className={`
                                            flex-1 py-2 rounded-lg border text-xs font-bold
                                            ${settings.fps === fps 
                                                ? 'bg-accent/20 border-accent text-accent' 
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 text-text-secondary'}
                                        `}
                                    >
                                        {fps}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Advanced Settings */}
                    <div className="pt-4 border-t border-white/5 space-y-6">
                        <div className="space-y-4">
                             <div className="flex justify-between">
                                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Bitrate (Quality)</label>
                                <span className="text-accent font-mono">{settings.bitrate} Mbps</span>
                            </div>
                            <input 
                                type="range" 
                                min="2" max="50" step="1"
                                value={settings.bitrate}
                                onChange={(e) => updateSettings({ bitrate: Number(e.target.value) })}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
                            />
                            <div className="flex justify-between text-xs text-text-tertiary">
                                <span>Low (2)</span>
                                <span>High (50)</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm bg-blue-500/5 p-4 rounded-lg border border-blue-500/20">
                            <span className="text-blue-300">Estimated File Size:</span>
                            <span className="font-mono font-bold text-blue-200">{estimatedSize}</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button 
                        onClick={handleExport}
                        className="w-full py-4 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-xl shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Icon name="image" />
                        Start Rendering
                    </button>

                </div>
              )}
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  )
}
