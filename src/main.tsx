import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize uniform sources for the UniformManager system
// This must be called before any renderers attempt to use UniformManager
import { initUniformSources } from '@/rendering/uniforms/init'
initUniformSources()

// Expose stores for e2e testing
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { usePostProcessingStore } from '@/stores/postProcessingStore'
import { useUIStore } from '@/stores/uiStore'

if (import.meta.env.DEV) {
  // @ts-ignore
  window.__GEOMETRY_STORE__ = useGeometryStore
  // @ts-ignore
  window.__UI_STORE__ = useUIStore
  // @ts-ignore
  window.__ENVIRONMENT_STORE__ = useEnvironmentStore
  // @ts-ignore
  window.__APPEARANCE_STORE__ = useAppearanceStore
  // @ts-ignore
  window.__LAYOUT_STORE__ = useLayoutStore
  // @ts-ignore
  window.__POST_PROCESSING_STORE__ = usePostProcessingStore
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Failed to find the root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
