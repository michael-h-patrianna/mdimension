import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'
import wasmPack from 'vite-plugin-wasm-pack'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react(),
    wasm(),
    topLevelAwait(),
    wasmPack('./src/wasm/mdimension_core'),
  ],
  esbuild: {
    // Keep component names in dev for better profiler output
    keepNames: mode === 'development',
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@/components': path.resolve(import.meta.dirname, './src/components'),
      '@/lib': path.resolve(import.meta.dirname, './src/lib'),
      '@/hooks': path.resolve(import.meta.dirname, './src/hooks'),
      '@/stores': path.resolve(import.meta.dirname, './src/stores'),
      '@/types': path.resolve(import.meta.dirname, './src/types'),
      '@/utils': path.resolve(import.meta.dirname, './src/utils'),
    },
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  assetsInclude: ['**/*.ktx2'],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          'react-vendor': ['react', 'react-dom'],
          // Three.js core
          'three-core': ['three'],
          // React Three Fiber ecosystem
          'r3f-fiber': ['@react-three/fiber'],
          'r3f-drei': ['@react-three/drei'],
          'r3f-postprocessing': ['@react-three/postprocessing', 'postprocessing'],
          // State management
          zustand: ['zustand'],
          // Animation
          motion: ['motion'],
        },
      },
    },
  },
}))
