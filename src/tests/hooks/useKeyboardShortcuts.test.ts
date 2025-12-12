/**
 * Tests for useKeyboardShortcuts hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, getShortcutLabel, SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useAnimationStore } from '@/stores/animationStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    useAnimationStore.getState().reset();
    useGeometryStore.getState().reset();
    useRotationStore.getState().resetAllRotations();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register event listener when enabled', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useKeyboardShortcuts({ enabled: true }));
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should not register event listener when disabled', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useKeyboardShortcuts({ enabled: false }));
    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardShortcuts({ enabled: true }));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should toggle play on space key', () => {
    renderHook(() => useKeyboardShortcuts({ enabled: true }));
    const initialState = useAnimationStore.getState().isPlaying;

    const event = new KeyboardEvent('keydown', { key: ' ' });
    window.dispatchEvent(event);

    expect(useAnimationStore.getState().isPlaying).toBe(!initialState);
  });

  it('should increase dimension on arrow up', () => {
    useGeometryStore.getState().setDimension(4);
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    window.dispatchEvent(event);

    expect(useGeometryStore.getState().dimension).toBe(5);
  });

  it('should not increase dimension beyond MAX_DIMENSION (11)', () => {
    useGeometryStore.getState().setDimension(11);
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    window.dispatchEvent(event);

    expect(useGeometryStore.getState().dimension).toBe(11);
  });

  it('should decrease dimension on arrow down', () => {
    useGeometryStore.getState().setDimension(4);
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    window.dispatchEvent(event);

    expect(useGeometryStore.getState().dimension).toBe(3);
  });

  it('should not decrease dimension below 3', () => {
    useGeometryStore.getState().setDimension(3);
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    window.dispatchEvent(event);

    expect(useGeometryStore.getState().dimension).toBe(3);
  });

  it('should select hypercube on key 1', () => {
    useGeometryStore.getState().setObjectType('simplex');
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: '1' });
    window.dispatchEvent(event);

    expect(useGeometryStore.getState().objectType).toBe('hypercube');
  });

  it('should select simplex on key 2', () => {
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: '2' });
    window.dispatchEvent(event);

    expect(useGeometryStore.getState().objectType).toBe('simplex');
  });

  it('should select cross-polytope on key 3', () => {
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: '3' });
    window.dispatchEvent(event);

    expect(useGeometryStore.getState().objectType).toBe('cross-polytope');
  });

  it('should increase speed on + key', () => {
    useAnimationStore.getState().setSpeed(1);
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: '+' });
    window.dispatchEvent(event);

    expect(useAnimationStore.getState().speed).toBe(1.25);
  });

  it('should decrease speed on - key', () => {
    useAnimationStore.getState().setSpeed(1);
    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: '-' });
    window.dispatchEvent(event);

    expect(useAnimationStore.getState().speed).toBe(0.75);
  });

  it('should reverse animation direction on r key', () => {
    renderHook(() => useKeyboardShortcuts({ enabled: true }));
    const initialDirection = useAnimationStore.getState().direction;

    const event = new KeyboardEvent('keydown', { key: 'r' });
    window.dispatchEvent(event);

    expect(useAnimationStore.getState().direction).toBe(-initialDirection);
  });

  it('should reset rotations on x key', () => {
    useRotationStore.getState().setRotation('XY', 1.5);
    expect(useRotationStore.getState().rotations.get('XY')).toBe(1.5);

    renderHook(() => useKeyboardShortcuts({ enabled: true }));

    const event = new KeyboardEvent('keydown', { key: 'x' });
    window.dispatchEvent(event);

    // After reset, rotation should be cleared (map is empty or angle is 0)
    const angle = useRotationStore.getState().rotations.get('XY');
    expect(angle === undefined || angle === 0).toBe(true);
  });

  it('should not reverse direction on d key (now used for camera movement)', () => {
    renderHook(() => useKeyboardShortcuts({ enabled: true }));
    const initialDirection = useAnimationStore.getState().direction;

    const event = new KeyboardEvent('keydown', { key: 'd' });
    window.dispatchEvent(event);

    // D key no longer affects animation direction (handled by useCameraMovement)
    expect(useAnimationStore.getState().direction).toBe(initialDirection);
  });

  it('should not trigger shortcuts in input fields', () => {
    renderHook(() => useKeyboardShortcuts({ enabled: true }));
    const initialState = useAnimationStore.getState().isPlaying;

    // Create a mock input element as the event target
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(useAnimationStore.getState().isPlaying).toBe(initialState);
    document.body.removeChild(input);
  });
});

describe('getShortcutLabel', () => {
  it('should format simple key', () => {
    expect(getShortcutLabel({ key: 'r', description: '' })).toBe('r');
  });

  it('should format space key', () => {
    expect(getShortcutLabel({ key: ' ', description: '' })).toBe('Space');
  });

  it('should format arrow keys', () => {
    expect(getShortcutLabel({ key: 'ArrowUp', description: '' })).toBe('↑');
    expect(getShortcutLabel({ key: 'ArrowDown', description: '' })).toBe('↓');
  });

  it('should format ctrl + key', () => {
    expect(getShortcutLabel({ key: 's', ctrl: true, description: '' })).toBe('Ctrl + s');
  });

  it('should format shift + key', () => {
    expect(getShortcutLabel({ key: 'a', shift: true, description: '' })).toBe('Shift + a');
  });

  it('should format alt + key', () => {
    expect(getShortcutLabel({ key: 'a', alt: true, description: '' })).toBe('Alt + a');
  });

  it('should format multiple modifiers', () => {
    expect(getShortcutLabel({ key: 's', ctrl: true, shift: true, description: '' })).toBe('Ctrl + Shift + s');
  });
});

describe('SHORTCUTS', () => {
  it('should have all required shortcuts defined', () => {
    expect(SHORTCUTS.length).toBeGreaterThan(0);

    SHORTCUTS.forEach((shortcut) => {
      expect(shortcut.key).toBeDefined();
      expect(shortcut.description).toBeDefined();
    });
  });

  it('should have space shortcut for play/pause', () => {
    const spaceShortcut = SHORTCUTS.find((s) => s.key === ' ');
    expect(spaceShortcut).toBeDefined();
    expect(spaceShortcut?.description).toContain('Play');
  });

  it('should have arrow shortcuts for dimension', () => {
    const upShortcut = SHORTCUTS.find((s) => s.key === 'ArrowUp');
    const downShortcut = SHORTCUTS.find((s) => s.key === 'ArrowDown');
    expect(upShortcut).toBeDefined();
    expect(downShortcut).toBeDefined();
  });

  it('should have WASD shortcuts for camera movement', () => {
    const wShortcut = SHORTCUTS.find((s) => s.key === 'w' && !s.shift);
    const aShortcut = SHORTCUTS.find((s) => s.key === 'a' && !s.shift);
    const sShortcut = SHORTCUTS.find((s) => s.key === 's' && !s.ctrl && !s.shift);
    const dShortcut = SHORTCUTS.find((s) => s.key === 'd' && !s.shift);

    expect(wShortcut).toBeDefined();
    expect(wShortcut?.description).toContain('forward');
    expect(aShortcut).toBeDefined();
    expect(aShortcut?.description).toContain('left');
    expect(sShortcut).toBeDefined();
    expect(sShortcut?.description).toContain('backward');
    expect(dShortcut).toBeDefined();
    expect(dShortcut?.description).toContain('right');
  });

  it('should have Shift+WASD shortcuts for camera rotation', () => {
    const wShiftShortcut = SHORTCUTS.find((s) => s.key === 'w' && s.shift);
    const aShiftShortcut = SHORTCUTS.find((s) => s.key === 'a' && s.shift);
    const sShiftShortcut = SHORTCUTS.find((s) => s.key === 's' && s.shift);
    const dShiftShortcut = SHORTCUTS.find((s) => s.key === 'd' && s.shift);

    expect(wShiftShortcut).toBeDefined();
    expect(wShiftShortcut?.description).toContain('Rotate');
    expect(aShiftShortcut).toBeDefined();
    expect(aShiftShortcut?.description).toContain('Rotate');
    expect(sShiftShortcut).toBeDefined();
    expect(sShiftShortcut?.description).toContain('Rotate');
    expect(dShiftShortcut).toBeDefined();
    expect(dShiftShortcut?.description).toContain('Rotate');
  });

  it('should have 0 and Shift+0 shortcuts for camera origin', () => {
    const moveToOrigin = SHORTCUTS.find((s) => s.key === '0' && !s.shift);
    const lookAtOrigin = SHORTCUTS.find((s) => s.key === '0' && s.shift);

    expect(moveToOrigin).toBeDefined();
    expect(moveToOrigin?.description).toContain('origin');
    expect(lookAtOrigin).toBeDefined();
    expect(lookAtOrigin?.description).toContain('origin');
  });

  it('should have r shortcut for reverse animation direction', () => {
    const rShortcut = SHORTCUTS.find((s) => s.key === 'r');
    expect(rShortcut).toBeDefined();
    expect(rShortcut?.description).toContain('Reverse');
  });

  it('should have x shortcut for reset rotation', () => {
    const xShortcut = SHORTCUTS.find((s) => s.key === 'x');
    expect(xShortcut).toBeDefined();
    expect(xShortcut?.description).toContain('Reset');
  });
});
