/**
 * Image Export Utilities
 * Exports Three.js canvas to PNG images
 */

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
 */
export function exportCanvasToPNG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get the data URL from canvas
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

/**
 * Finds the Three.js canvas in the document
 *
 * @returns The canvas element or null if not found
 */
export function findThreeCanvas(): HTMLCanvasElement | null {
  // Three.js typically renders to a canvas inside the Canvas component
  const canvas = document.querySelector('canvas');
  return canvas as HTMLCanvasElement | null;
}

/**
 * Exports the current Three.js scene to PNG
 *
 * @param options - Export options
 * @returns True if export was successful, false otherwise
 */
export function exportSceneToPNG(options: ExportOptions = {}): boolean {
  const canvas = findThreeCanvas();

  if (!canvas) {
    console.error('No canvas found for export');
    return false;
  }

  try {
    exportCanvasToPNG(canvas, options);
    return true;
  } catch (error) {
    console.error('Export failed:', error);
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
