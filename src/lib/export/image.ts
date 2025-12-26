/**
 * Image Export Utilities
 * Exports Three.js canvas to PNG images
 */

import { useMsgBoxStore } from '@/stores/msgBoxStore';

export interface ExportOptions {
  /** Filename without extension */
  filename?: string;
  /** Whether to use transparent background */
  transparent?: boolean;
  /** Resolution scale factor (1 = current size, 2 = 2x) */
  scale?: number;
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  filename: 'ndimensional-export',
  transparent: false,
  scale: 1,
};

/**
 * Exports a canvas element to a PNG file and triggers download
 *
 * @param canvas - The canvas element to export
 * @param options - Export options
 * @throws {Error} If document.body is not available (SSR/non-browser context)
 */
export function exportCanvasToPNG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.scale !== 1 || opts.transparent) {
    console.warn('Export options "scale" and "transparent" are not currently supported in this implementation.');
  }

  // Validate we're in a browser context with document.body
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Export requires browser context with document.body');
  }

  // Get the data URL from canvas (can throw if canvas is tainted)
  const dataUrl = canvas.toDataURL('image/png');

  // Create download link
  const link = document.createElement('a');
  link.download = `${opts.filename}.png`;
  link.href = dataUrl;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Import the store (circular dependency avoided by using useScreenshotStore.getState())
import { useScreenshotStore } from '@/stores/screenshotStore';

/**
 * Finds the Three.js canvas in the document
 *
 * @returns The canvas element or null if not found
 */
export function findThreeCanvas(): HTMLCanvasElement | null {
  // The 'main-webgl-canvas' ID is on the R3F wrapper div, so we need to find the canvas inside it
  const wrapper = document.getElementById('main-webgl-canvas');
  if (!wrapper) return null;

  if (wrapper instanceof HTMLCanvasElement) {
    return wrapper;
  }

  return wrapper.querySelector('canvas');
}

/**
 * Captures the current Three.js scene and opens the preview modal
 *
 * @param options - Export options (filename ignored in favor of modal flow)
 * @param _options
 * @returns True if capture was successful
 */
export function exportSceneToPNG(_options: ExportOptions = {}): boolean {
  const canvas = findThreeCanvas();

  if (!canvas) {
    console.error('No canvas found for export');
    useMsgBoxStore.getState().showMsgBox('Export Error', 'Could not find the rendering canvas. Please ensure the scene is visible.', 'error');
    return false;
  }

  try {
    // We strictly need to preserveDrawingBuffer: true or capture synchronously after render
    // `toDataURL` is synchronous and blocks the main thread, which is fine for a screenshot
    const dataUrl = canvas.toDataURL('image/png');

    // Open the modal with the captured image
    useScreenshotStore.getState().openModal(dataUrl);

    return true;
  } catch (error) {
    // Handle specific error cases with helpful messages
    let errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof DOMException && error.name === 'SecurityError') {
      errorMsg = 'Canvas is tainted by cross-origin content (CORS). External textures or images were used without proper permissions.';
      console.error('Export failed: ' + errorMsg);
    } else {
      console.error('Export failed:', error);
    }

    useMsgBoxStore.getState().showMsgBox('Export Failed', errorMsg, 'error');
    return false;
  }
}


/**
 * Generates a timestamp-based filename
 *
 * @param prefix - Filename prefix
 * @returns Filename with timestamp
 */
export function generateTimestampFilename(prefix: string = 'ndimensional'): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${timestamp}`;
}
