import { renderHook, act } from '@testing-library/react';
import { useInteractionState } from '@/hooks/useInteractionState';
import { usePerformanceStore } from '@/stores';
import { useThree, useFrame } from '@react-three/fiber';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Vector3, Euler } from 'three';

// Mock R3F
vi.mock('@react-three/fiber', () => ({
  useThree: vi.fn(),
  useFrame: vi.fn(),
}));

// Mock Stores
const setIsInteractingMock = vi.fn();
const resetRefinementMock = vi.fn();
const setCameraTeleportedMock = vi.fn();

// Initial Store State
const initialStoreState = {
    isInteracting: false,
    setIsInteracting: setIsInteractingMock,
    progressiveRefinementEnabled: true,
    resetRefinement: resetRefinementMock,
    cameraTeleported: false,
    setCameraTeleported: setCameraTeleportedMock,
};

describe('useInteractionState', () => {
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;
  let canvasMock: any;
  let cameraMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset store mock
    usePerformanceStore.setState(initialStoreState);

    // Mock DOM elements
    canvasMock = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      style: {},
    };

    // Mock Camera
    cameraMock = {
        position: new Vector3(0, 0, 0),
        rotation: new Euler(0, 0, 0),
    };

    // Mock useThree
    (useThree as any).mockReturnValue({
      camera: cameraMock,
      gl: { domElement: canvasMock },
      size: { width: 100, height: 100 },
    });
  });

  it('should NOT start interaction on simple pointer down', () => {
    const { result } = renderHook(() => useInteractionState());

    const pointerDownHandler = canvasMock.addEventListener.mock.calls.find(
      (call: any) => call[0] === 'pointerdown'
    )[1];

    expect(pointerDownHandler).toBeDefined();

    // Clear initial calls from mount effects
    vi.clearAllMocks();

    // Trigger pointer down
    act(() => {
        pointerDownHandler();
    });

    // Check if store was updated
    expect(setIsInteractingMock).not.toHaveBeenCalled();
    expect(result.current.isInteracting).toBe(false);
  });

  it('should start interaction on pointer move when pointer is down', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useInteractionState());

    const pointerDownHandler = canvasMock.addEventListener.mock.calls.find(
      (call: any) => call[0] === 'pointerdown'
    )[1];
    const pointerMoveHandler = canvasMock.addEventListener.mock.calls.find(
      (call: any) => call[0] === 'pointermove'
    )[1];
    
    // Fast forward past initial transition interaction (600ms + debounce)
    act(() => {
        vi.advanceTimersByTime(1000);
    });

    vi.clearAllMocks();

    // Pointer Down
    act(() => {
        pointerDownHandler();
    });

    // Pointer Move
    act(() => {
        pointerMoveHandler({ buttons: 1 });
    });

    expect(setIsInteractingMock).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });
});
