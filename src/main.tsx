import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import './index.css'

// Expose stores for e2e testing
import { useGeometryStore } from '@/stores/geometryStore'
import { useUIStore } from '@/stores/uiStore'

if (import.meta.env.DEV) {
  // @ts-ignore
  window.__GEOMETRY_STORE__ = useGeometryStore
  // @ts-ignore
  window.__UI_STORE__ = useUIStore
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
