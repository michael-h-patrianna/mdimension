import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LightingControls } from '@/components/sidebar/Lights/LightingControls';
import { useVisualStore } from '@/stores/visualStore';

describe('LightingControls Regression Tests', () => {
  beforeEach(() => {
    useVisualStore.getState().reset();
  });

  it('should not crash when switching from "surface" to "wireframe" (reducing hooks called if not fixed)', () => {
    // Start with surface (hooks are called)
    useVisualStore.getState().setShaderType('surface');
    
    const { rerender } = render(<LightingControls />);
    expect(screen.getByText('Light On')).toBeInTheDocument();

    // Switch to wireframe (hooks should still be called, but return null)
    act(() => {
        useVisualStore.getState().setShaderType('wireframe');
    });
    
    // Force re-render if store update doesn't trigger it automatically (it should, but strictly speaking)
    rerender(<LightingControls />);
    
    // Should be empty but NOT crash
    expect(screen.queryByText('Light On')).not.toBeInTheDocument();
  });

  it('should not crash when switching from "wireframe" to "surface" (increasing hooks called if not fixed)', () => {
    // Start with wireframe
    useVisualStore.getState().setShaderType('wireframe');
    
    const { rerender } = render(<LightingControls />);
    expect(screen.queryByText('Light On')).not.toBeInTheDocument();

    // Switch to surface
    act(() => {
        useVisualStore.getState().setShaderType('surface');
    });
    
    rerender(<LightingControls />);
    
    // Should now be visible
    expect(screen.getByText('Light On')).toBeInTheDocument();
  });
});
