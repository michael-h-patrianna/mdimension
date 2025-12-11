import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectionControls } from '@/components/controls/ProjectionControls';
import { useProjectionStore } from '@/stores/projectionStore';

describe('ProjectionControls', () => {
  beforeEach(() => {
    // Reset store before each test
    useProjectionStore.getState().resetToDefaults();
  });

  describe('rendering', () => {
    it('should render section header', () => {
      render(<ProjectionControls />);
      expect(screen.getByText('Projection Settings')).toBeInTheDocument();
    });

    it('should render reset button', () => {
      render(<ProjectionControls />);
      expect(screen.getByLabelText('Reset to defaults')).toBeInTheDocument();
    });

    it('should render projection type toggle', () => {
      render(<ProjectionControls />);
      expect(screen.getByText('Perspective')).toBeInTheDocument();
      expect(screen.getByText('Orthographic')).toBeInTheDocument();
    });

    it('should render FOV slider', () => {
      render(<ProjectionControls />);
      expect(screen.getByText('Field of View')).toBeInTheDocument();
      expect(screen.getByLabelText('Field of view')).toBeInTheDocument();
    });

    it('should render info text for perspective', () => {
      render(<ProjectionControls />);
      expect(screen.getByText(/vanishing point effect/i)).toBeInTheDocument();
    });
  });

  describe('perspective mode', () => {
    it('should show distance slider in perspective mode', () => {
      useProjectionStore.getState().setType('perspective');
      render(<ProjectionControls />);

      expect(screen.getByText('Projection Distance')).toBeInTheDocument();
      expect(screen.getByLabelText('Projection distance')).toBeInTheDocument();
    });

    it('should display current distance value', () => {
      useProjectionStore.getState().setType('perspective');
      useProjectionStore.getState().setDistance(6.5);
      render(<ProjectionControls />);

      expect(screen.getByText('6.5')).toBeInTheDocument();
    });

    it('should display perspective info text', () => {
      useProjectionStore.getState().setType('perspective');
      render(<ProjectionControls />);

      expect(screen.getByText(/Perspective:/)).toBeInTheDocument();
      expect(screen.getByText(/vanishing point effect/i)).toBeInTheDocument();
    });
  });

  describe('orthographic mode', () => {
    it('should NOT show distance slider in orthographic mode', () => {
      useProjectionStore.getState().setType('orthographic');
      render(<ProjectionControls />);

      expect(screen.queryByText('Projection Distance')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Projection distance')).not.toBeInTheDocument();
    });

    it('should display orthographic info text', () => {
      useProjectionStore.getState().setType('orthographic');
      render(<ProjectionControls />);

      expect(screen.getByText(/Orthographic:/)).toBeInTheDocument();
      expect(screen.getByText(/No foreshortening/i)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should toggle between perspective and orthographic', async () => {
      const user = userEvent.setup();
      render(<ProjectionControls />);

      expect(useProjectionStore.getState().type).toBe('perspective');

      const orthographicButton = screen.getByText('Orthographic');
      await user.click(orthographicButton);

      expect(useProjectionStore.getState().type).toBe('orthographic');

      const perspectiveButton = screen.getByText('Perspective');
      await user.click(perspectiveButton);

      expect(useProjectionStore.getState().type).toBe('perspective');
    });

    it('should update distance slider', () => {
      useProjectionStore.getState().setType('perspective');
      render(<ProjectionControls />);

      const slider = screen.getByLabelText('Projection distance') as HTMLInputElement;

      // For range inputs, use fireEvent.change
      fireEvent.change(slider, { target: { value: '7.5' } });

      expect(useProjectionStore.getState().distance).toBe(7.5);
    });

    it('should update FOV slider', () => {
      render(<ProjectionControls />);

      const slider = screen.getByLabelText('Field of view') as HTMLInputElement;

      // For range inputs, use fireEvent.change
      fireEvent.change(slider, { target: { value: '90' } });

      expect(useProjectionStore.getState().fov).toBe(90);
    });

    it('should reset all values when reset button clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectionControls />);

      // Change values
      useProjectionStore.getState().setType('orthographic');
      useProjectionStore.getState().setDistance(8.0);
      useProjectionStore.getState().setFov(90);

      const resetButton = screen.getByLabelText('Reset to defaults');
      await user.click(resetButton);

      expect(useProjectionStore.getState().type).toBe('perspective');
      expect(useProjectionStore.getState().distance).toBe(4.0);
      expect(useProjectionStore.getState().fov).toBe(60);
    });
  });

  describe('FOV display', () => {
    it('should display current FOV value with degree symbol', () => {
      useProjectionStore.getState().setFov(45);
      render(<ProjectionControls />);

      expect(screen.getByText('45°')).toBeInTheDocument();
    });

    it('should update FOV display when value changes', () => {
      const { rerender } = render(<ProjectionControls />);
      expect(screen.getByText('60°')).toBeInTheDocument();

      useProjectionStore.getState().setFov(90);
      rerender(<ProjectionControls />);

      expect(screen.getByText('90°')).toBeInTheDocument();
    });
  });

  describe('slider ranges', () => {
    it('should have correct distance slider range', () => {
      useProjectionStore.getState().setType('perspective');
      render(<ProjectionControls />);

      const slider = screen.getByLabelText('Projection distance') as HTMLInputElement;

      expect(slider.min).toBe('2.0');
      expect(slider.max).toBe('10.0');
      expect(slider.step).toBe('0.1');
    });

    it('should have correct FOV slider range', () => {
      render(<ProjectionControls />);

      const slider = screen.getByLabelText('Field of view') as HTMLInputElement;

      expect(slider.min).toBe('30');
      expect(slider.max).toBe('120');
      expect(slider.step).toBe('1');
    });
  });
});
