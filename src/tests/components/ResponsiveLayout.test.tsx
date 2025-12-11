/**
 * Tests for ResponsiveLayout component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';

// Mock matchMedia
const createMockMatchMedia = (width: number) => {
  return (query: string): MediaQueryList => {
    const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
    const minWidth = minWidthMatch?.[1] ? parseInt(minWidthMatch[1], 10) : 0;

    return {
      matches: width >= minWidth,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
  };
};

describe('ResponsiveLayout', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('should render canvas and controls', () => {
    window.matchMedia = createMockMatchMedia(1200);

    render(
      <ResponsiveLayout
        canvas={<div data-testid="canvas">Canvas</div>}
        controls={<div data-testid="controls">Controls</div>}
      />
    );

    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  it('should render header when provided', () => {
    window.matchMedia = createMockMatchMedia(1200);

    render(
      <ResponsiveLayout
        canvas={<div>Canvas</div>}
        controls={<div>Controls</div>}
        header={<h1>App Title</h1>}
      />
    );

    expect(screen.getByText('App Title')).toBeInTheDocument();
  });

  describe('mobile layout', () => {
    beforeEach(() => {
      // Mobile: below 768px
      window.matchMedia = createMockMatchMedia(375);
    });

    it('should show toggle button', () => {
      render(
        <ResponsiveLayout
          canvas={<div>Canvas</div>}
          controls={<div>Controls</div>}
          header={<h1>Title</h1>}
        />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should toggle controls visibility', () => {
      render(
        <ResponsiveLayout
          canvas={<div>Canvas</div>}
          controls={<div data-testid="controls">Controls</div>}
          header={<h1>Title</h1>}
        />
      );

      const button = screen.getByRole('button');

      // Initially controls are hidden on mobile
      fireEvent.click(button);
      expect(screen.getByTestId('controls')).toBeInTheDocument();
    });
  });

  describe('tablet layout', () => {
    beforeEach(() => {
      // Tablet: 768px - 1023px (md but not lg)
      window.matchMedia = createMockMatchMedia(800);
    });

    it('should show collapsible side panel', () => {
      render(
        <ResponsiveLayout
          canvas={<div>Canvas</div>}
          controls={<div data-testid="controls">Controls</div>}
          header={<h1>Title</h1>}
        />
      );

      expect(screen.getByTestId('controls')).toBeInTheDocument();
    });

    it('should have collapse button', () => {
      render(
        <ResponsiveLayout
          canvas={<div>Canvas</div>}
          controls={<div>Controls</div>}
          header={<h1>Title</h1>}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('desktop layout', () => {
    beforeEach(() => {
      // Desktop: 1024px and above (lg)
      window.matchMedia = createMockMatchMedia(1200);
    });

    it('should show full side panel', () => {
      render(
        <ResponsiveLayout
          canvas={<div data-testid="canvas">Canvas</div>}
          controls={<div data-testid="controls">Controls</div>}
        />
      );

      expect(screen.getByTestId('canvas')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
    });

    it('should not show toggle button', () => {
      render(
        <ResponsiveLayout
          canvas={<div>Canvas</div>}
          controls={<div>Controls</div>}
          header={<h1>Title</h1>}
        />
      );

      // Desktop layout doesn't have a toggle button
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBe(0);
    });
  });
});
