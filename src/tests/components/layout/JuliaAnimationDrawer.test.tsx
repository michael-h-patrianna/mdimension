/**
 * Tests for JuliaAnimationDrawer component
 *
 * The drawer is currently empty as animations have been removed.
 * Tests verify the empty placeholder state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JuliaAnimationDrawer } from '@/components/layout/TimelineControls/JuliaAnimationDrawer';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

describe('JuliaAnimationDrawer', () => {
  beforeEach(() => {
    // Reset stores before each test
    useExtendedObjectStore.getState().reset();
    useGeometryStore.getState().reset();
    useGeometryStore.getState().setDimension(3);
    useGeometryStore.getState().setObjectType('quaternion-julia');
  });

  it('should render the drawer container', () => {
    render(<JuliaAnimationDrawer />);
    expect(screen.getByTestId('julia-animation-drawer')).toBeInTheDocument();
  });

  it('should show empty state message', () => {
    render(<JuliaAnimationDrawer />);
    expect(screen.getByText('No animations configured')).toBeInTheDocument();
  });

  it('should render for 3D dimension', () => {
    useGeometryStore.getState().setDimension(3);
    render(<JuliaAnimationDrawer />);
    expect(screen.getByTestId('julia-animation-drawer')).toBeInTheDocument();
  });

  it('should render for 4D dimension', () => {
    useGeometryStore.getState().setDimension(4);
    render(<JuliaAnimationDrawer />);
    expect(screen.getByTestId('julia-animation-drawer')).toBeInTheDocument();
  });

  it('should render for higher dimensions', () => {
    useGeometryStore.getState().setDimension(5);
    render(<JuliaAnimationDrawer />);
    expect(screen.getByTestId('julia-animation-drawer')).toBeInTheDocument();
  });
});
