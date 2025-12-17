/**
 * Tests for ZoomDrawer component
 *
 * Tests zoom animation and autopilot controls:
 * - Core zoom settings
 * - Animation mode selection
 * - Autopilot strategy selection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomDrawer } from '@/components/layout/TimelineControls/ZoomDrawer';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('ZoomDrawer', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    useGeometryStore.getState().setDimension(4);
    useGeometryStore.getState().setObjectType('mandelbulb');
  });

  it('should render core zoom controls', () => {
    render(<ZoomDrawer />);
    expect(screen.getByText('Zoom')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-panel-core')).toBeInTheDocument();
  });

  it('should toggle zoom enabled', () => {
    render(<ZoomDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle zoom$/i });
    expect(useExtendedObjectStore.getState().mandelbulb.zoomEnabled).toBe(false);

    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().mandelbulb.zoomEnabled).toBe(true);
  });

  it('should show animation and autopilot sections when zoom enabled', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    render(<ZoomDrawer />);
    expect(screen.getByTestId('zoom-panel-animation')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-panel-autopilot')).toBeInTheDocument();
  });

  it('should hide animation and autopilot sections when zoom disabled', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(false);
    render(<ZoomDrawer />);
    expect(screen.queryByTestId('zoom-panel-animation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('zoom-panel-autopilot')).not.toBeInTheDocument();
  });

  it('should toggle zoom animation', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    render(<ZoomDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle zoom animation/i });
    expect(useExtendedObjectStore.getState().mandelbulb.zoomAnimationEnabled).toBe(false);

    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().mandelbulb.zoomAnimationEnabled).toBe(true);
  });

  it('should toggle autopilot', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    render(<ZoomDrawer />);

    const toggleBtn = screen.getByRole('button', { name: /toggle autopilot/i });
    expect(useExtendedObjectStore.getState().mandelbulb.autopilotEnabled).toBe(false);

    fireEvent.click(toggleBtn);
    expect(useExtendedObjectStore.getState().mandelbulb.autopilotEnabled).toBe(true);
  });

  it('should render animation mode buttons', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    render(<ZoomDrawer />);
    expect(screen.getByRole('button', { name: /continuous zoom/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /target zoom/i })).toBeInTheDocument();
  });

  it('should render autopilot strategy buttons when autopilot enabled', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    useExtendedObjectStore.getState().setMandelbulbAutopilotEnabled(true);
    render(<ZoomDrawer />);

    expect(screen.getByRole('button', { name: /select center-ray lock strategy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select interest score strategy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select boundary target strategy/i })).toBeInTheDocument();
  });

  it('should change animation mode to target', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    render(<ZoomDrawer />);

    expect(useExtendedObjectStore.getState().mandelbulb.zoomAnimationMode).toBe('continuous');

    const targetBtn = screen.getByRole('button', { name: /target zoom/i });
    fireEvent.click(targetBtn);
    expect(useExtendedObjectStore.getState().mandelbulb.zoomAnimationMode).toBe('target');
  });

  it('should change autopilot strategy', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    useExtendedObjectStore.getState().setMandelbulbAutopilotEnabled(true);
    render(<ZoomDrawer />);

    expect(useExtendedObjectStore.getState().mandelbulb.autopilotStrategy).toBe('centerRayLock');

    const interestBtn = screen.getByRole('button', { name: /select interest score strategy/i });
    fireEvent.click(interestBtn);
    expect(useExtendedObjectStore.getState().mandelbulb.autopilotStrategy).toBe('interestScore');
  });

  it('should render zoom level slider', () => {
    render(<ZoomDrawer />);
    expect(screen.getByLabelText(/zoom level/i)).toBeInTheDocument();
  });

  it('should render zoom speed slider', () => {
    render(<ZoomDrawer />);
    expect(screen.getByLabelText(/zoom speed/i)).toBeInTheDocument();
  });

  it('should have reset button', () => {
    render(<ZoomDrawer />);
    expect(screen.getByRole('button', { name: /reset zoom/i })).toBeInTheDocument();
  });

  it('should reset zoom settings', () => {
    useExtendedObjectStore.getState().setMandelbulbZoomEnabled(true);
    useExtendedObjectStore.getState().setMandelbulbZoom(100);
    useExtendedObjectStore.getState().setMandelbulbAutopilotEnabled(true);

    render(<ZoomDrawer />);

    const resetBtn = screen.getByRole('button', { name: /reset zoom/i });
    fireEvent.click(resetBtn);

    const state = useExtendedObjectStore.getState().mandelbulb;
    expect(state.zoomEnabled).toBe(false);
    expect(state.zoom).toBe(1.0);
    expect(state.autopilotEnabled).toBe(false);
  });
});
