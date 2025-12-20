# Video Export

The Video Export feature allows users to render high-quality MP4 videos of their n-dimensional visualizations directly from the browser.

## Features

- **High Performance**: Uses WebCodecs and `mediabunny` for fast, hardware-accelerated encoding.
- **Deterministic Rendering**: Bypasses the real-time clock to ensure perfect 60 FPS (or 30/24) smoothness regardless of device performance.
- **Custom Resolutions**: Support for 720p, 1080p, 4K, and custom dimensions.
- **Warmup Frames**: Automatically simulates physics/effects before recording to ensure temporal effects (like clouds) are stable.
- **Cinematic UI**: Glassmorphism design with sound effects and detailed progress feedback.

## Architecture

- **`ExportStore`**: Manages the global export state (settings, progress, status).
- **`VideoExportController`**: A headless R3F component that takes control of the render loop when exporting. It manually advances the simulation time and captures frames.
- **`VideoRecorder`**: A utility class wrapping `mediabunny` to handle the complexity of the WebCodecs API and MP4 muxing.

## Usage

1. Open the "File" menu in the top bar.
2. Select "Export Video (MP4)".
3. Or use the shortcut `Cmd+Shift+E`.
4. Adjust settings (Resolution, FPS, Duration, Quality).
5. Click "Start Rendering".
6. Wait for the render to complete and download the result.
