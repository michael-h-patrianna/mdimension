import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectionControls } from '@/components/controls/ProjectionControls';
import { useProjectionStore } from '@/stores/projectionStore';

describe('ProjectionControls', () => {
  beforeEach(() => {
    // Reset store before each test
    useProjectionStore.getState().resetToDefaults();
  });

  describe('rendering', () => {
    it('should render projection type toggle', () => {
      render(<ProjectionControls />);
      expect(screen.getByText('Perspective')).toBeInTheDocument();
      expect(screen.getByText('Orthographic')).toBeInTheDocument();
    });

    it('should render info text for perspective', () => {
      render(<ProjectionControls />);
      expect(screen.getByText(/vanishing point effect/i)).toBeInTheDocument();
    });
  });

  describe('perspective mode', () => {
    it('should display perspective info text', () => {
      useProjectionStore.getState().setType('perspective');
      render(<ProjectionControls />);

      expect(screen.getByText(/Perspective:/)).toBeInTheDocument();
      expect(screen.getByText(/vanishing point effect/i)).toBeInTheDocument();
    });
  });

  describe('orthographic mode', () => {
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
  });
});
