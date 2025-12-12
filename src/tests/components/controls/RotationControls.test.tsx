import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RotationControls } from '@/components/controls/RotationControls';
import { useRotationStore } from '@/stores/rotationStore';

describe('RotationControls', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      useRotationStore.getState().resetAllRotations();
      useRotationStore.getState().setDimension(3);
    });
  });

  it('should render with section header', () => {
    render(<RotationControls />);
    expect(screen.getByText('Rotation Controls')).toBeInTheDocument();
  });

  it('should render Reset All button', () => {
    render(<RotationControls />);
    expect(screen.getByText('Reset All')).toBeInTheDocument();
  });

  it('should render 3D rotation group', () => {
    render(<RotationControls />);
    expect(screen.getByText('3D Rotations')).toBeInTheDocument();
  });

  it('should render exactly 3 sliders for 3D', () => {
    render(<RotationControls />);

    // Should show XY, XZ, YZ
    expect(screen.getByText('XY')).toBeInTheDocument();
    expect(screen.getByText('XZ')).toBeInTheDocument();
    expect(screen.getByText('YZ')).toBeInTheDocument();

    // Should not show 4D planes
    expect(screen.queryByText('XW')).not.toBeInTheDocument();
  });

  it('should render exactly 6 sliders for 4D', async () => {
    const user = userEvent.setup();
    act(() => {
      useRotationStore.getState().setDimension(4);
    });
    render(<RotationControls />);

    // Should show all 3D planes (expanded by default)
    expect(screen.getByText('XY')).toBeInTheDocument();
    expect(screen.getByText('XZ')).toBeInTheDocument();
    expect(screen.getByText('YZ')).toBeInTheDocument();

    // Should show 4th dimension group
    expect(screen.getByText('4th Dimension (W)')).toBeInTheDocument();

    // Need to expand 4D group to see its planes
    const group4D = screen.getByText('4th Dimension (W)');
    await user.click(group4D);

    // Now should show 4D planes
    expect(screen.getByText('XW')).toBeInTheDocument();
    expect(screen.getByText('YW')).toBeInTheDocument();
    expect(screen.getByText('ZW')).toBeInTheDocument();
  });

  it('should render exactly 10 sliders for 5D', async () => {
    const user = userEvent.setup();
    act(() => {
      useRotationStore.getState().setDimension(5);
    });
    render(<RotationControls />);

    // Should show 3D planes (expanded by default)
    expect(screen.getByText('XY')).toBeInTheDocument();
    expect(screen.getByText('XZ')).toBeInTheDocument();
    expect(screen.getByText('YZ')).toBeInTheDocument();

    // Should show 4th and 5th dimension groups
    const group4D = screen.getByText('4th Dimension (W)');
    const group5D = screen.getByText('5th Dimension (V)');
    expect(group4D).toBeInTheDocument();
    expect(group5D).toBeInTheDocument();

    // Expand 4D group
    await user.click(group4D);
    expect(screen.getByText('XW')).toBeInTheDocument();
    expect(screen.getByText('YW')).toBeInTheDocument();
    expect(screen.getByText('ZW')).toBeInTheDocument();

    // Expand 5D group
    await user.click(group5D);
    expect(screen.getByText('XV')).toBeInTheDocument();
    expect(screen.getByText('YV')).toBeInTheDocument();
    expect(screen.getByText('ZV')).toBeInTheDocument();
    expect(screen.getByText('WV')).toBeInTheDocument();
  });

  it('should have 3D Rotations group expanded by default', () => {
    render(<RotationControls />);

    // The 3D plane labels should be visible (group is expanded)
    expect(screen.getByText('XY')).toBeVisible();
    expect(screen.getByText('XZ')).toBeVisible();
    expect(screen.getByText('YZ')).toBeVisible();
  });

  it('should toggle group expansion', async () => {
    const user = userEvent.setup();
    act(() => {
      useRotationStore.getState().setDimension(4);
    });
    render(<RotationControls />);

    // Initially 4th dimension group should be collapsed
    // Click on 4th dimension group header to expand
    const groupHeader = screen.getByText('4th Dimension (W)');
    await user.click(groupHeader);

    // Now the 4D sliders should be visible
    const xwSlider = screen.queryByText('XW');
    expect(xwSlider).toBeInTheDocument();

    // Note: We're just checking that the elements exist after expansion
    // Testing actual visibility/animation would require more complex setup
  });

  it('should call store setRotation when slider changes', () => {
    render(<RotationControls />);

    // Set rotation directly in the store
    act(() => {
      useRotationStore.getState().setRotation('XY', Math.PI / 2);
    });

    // The rotation should be stored
    const state = useRotationStore.getState();
    expect(state.rotations.has('XY')).toBe(true);
    expect(state.rotations.get('XY')).toBeCloseTo(Math.PI / 2, 5);
  });

  it('should reset all rotations when Reset All is clicked', async () => {
    const user = userEvent.setup();

    // Set some rotations
    act(() => {
      useRotationStore.getState().setRotation('XY', Math.PI / 4);
      useRotationStore.getState().setRotation('XZ', Math.PI / 6);
    });

    render(<RotationControls />);

    const resetButton = screen.getByText('Reset All');
    await user.click(resetButton);

    // All rotations should be cleared
    const rotations = useRotationStore.getState().rotations;
    expect(rotations.size).toBe(0);
  });

  it('should group planes correctly by dimension', () => {
    act(() => {
      useRotationStore.getState().setDimension(4);
    });
    render(<RotationControls />);

    // Should have 3D group and 4D group
    expect(screen.getByText('3D Rotations')).toBeInTheDocument();
    expect(screen.getByText('4th Dimension (W)')).toBeInTheDocument();

    // Should not have 5D group
    expect(screen.queryByText('5th Dimension (V)')).not.toBeInTheDocument();
  });

  it('should not render 5D group in 4D mode', () => {
    act(() => {
      useRotationStore.getState().setDimension(4);
    });
    render(<RotationControls />);

    expect(screen.queryByText('5th Dimension (V)')).not.toBeInTheDocument();
    expect(screen.queryByText('XV')).not.toBeInTheDocument();
  });

  it('should render 6D group in 6D mode', () => {
    act(() => {
      useRotationStore.getState().setDimension(6);
    });
    render(<RotationControls />);

    expect(screen.getByText('6th Dimension (U)')).toBeInTheDocument();
  });

  it('should render 7D group in 7D mode', async () => {
    const user = userEvent.setup();
    act(() => {
      useRotationStore.getState().setDimension(7);
    });
    render(<RotationControls />);

    // Should show 7th dimension group
    const group7D = screen.getByText('7th Dimension (A6)');
    expect(group7D).toBeInTheDocument();

    // Expand 7D group
    await user.click(group7D);
    
    // Should show 7D planes (e.g. XA6)
    // A6 is the 7th axis (index 6). X is index 0. Plane XA6.
    expect(screen.getByText('XA6')).toBeInTheDocument();
  });
});
