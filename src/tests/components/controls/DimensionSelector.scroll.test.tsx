
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DimensionSelector } from '@/components/controls/DimensionSelector';
import { useGeometryStore } from '@/stores/geometryStore';

// Helper to mock element properties for the duration of the test
function mockLayout(scrollWidth: number, clientWidth: number, scrollLeft: number) {
  // We mock the specific getters on HTMLElement.prototype
  // We store the original descriptors to restore them later
  return {
    scrollWidth: vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth),
    clientWidth: vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth),
    scrollLeft: vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'get').mockReturnValue(scrollLeft),
  };
}

describe('DimensionSelector Scroll Logic', () => {
  beforeEach(() => {
    useGeometryStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show right arrow when content overflows and we are at the start', () => {
    // Mock overflow: content 500px, view 200px, start at 0
    mockLayout(500, 200, 0);

    render(<DimensionSelector />);
    
    // Should show right arrow
    expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
    // Should not show left arrow
    expect(screen.queryByLabelText('Scroll left')).not.toBeInTheDocument();
  });

  it('should show left arrow when scrolled to the end', () => {
    // Mock overflow: content 500px, view 200px, scrolled to end (300)
    // Tolerance in code is -1, so 299+ should hide right? 
    // Logic: setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    // 300 + 200 < 500 is false. So Right arrow hidden.
    // Left arrow: 300 > 0 is true.
    mockLayout(500, 200, 300);

    render(<DimensionSelector />);

    expect(screen.getByLabelText('Scroll left')).toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll right')).not.toBeInTheDocument();
  });

  it('should show both arrows when in the middle', () => {
    // Middle: 150
    mockLayout(500, 200, 150);

    render(<DimensionSelector />);

    expect(screen.getByLabelText('Scroll left')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
  });

  it('should show no arrows when content fits', () => {
    // Fits: content 200px, view 200px
    mockLayout(200, 200, 0);

    render(<DimensionSelector />);

    expect(screen.queryByLabelText('Scroll left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll right')).not.toBeInTheDocument();
  });
});
