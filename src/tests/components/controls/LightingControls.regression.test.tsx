import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LightingControls } from '@/components/sections/Lights/LightingControls';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { APPEARANCE_INITIAL_STATE } from '@/stores/slices/appearanceSlice';

describe('LightingControls Regression Tests', () => {
  beforeEach(() => {
    useAppearanceStore.setState(APPEARANCE_INITIAL_STATE);
  });

  it('should not crash when switching from "surface" to "wireframe" (reducing hooks called if not fixed)', () => {
    // Start with surface (hooks are called)
    useAppearanceStore.getState().setShaderType('surface');

    const { rerender } = render(<LightingControls />);
    // New UI uses "Show Gizmos" instead of "Light On"
    expect(screen.getByText('Show Gizmos')).toBeInTheDocument();

    // Switch to wireframe (hooks should still be called, but return null)
    act(() => {
        useAppearanceStore.getState().setShaderType('wireframe');
    });

    // Force re-render if store update doesn't trigger it automatically (it should, but strictly speaking)
    rerender(<LightingControls />);

    // Should be empty but NOT crash
    expect(screen.queryByText('Show Gizmos')).not.toBeInTheDocument();
  });

  it('should not crash when switching from "wireframe" to "surface" (increasing hooks called if not fixed)', () => {
    // Start with wireframe
    useAppearanceStore.getState().setShaderType('wireframe');

    const { rerender } = render(<LightingControls />);
    expect(screen.queryByText('Show Gizmos')).not.toBeInTheDocument();

    // Switch to surface
    act(() => {
        useAppearanceStore.getState().setShaderType('surface');
    });

    rerender(<LightingControls />);

    // Should now be visible
    expect(screen.getByText('Show Gizmos')).toBeInTheDocument();
  });
});
