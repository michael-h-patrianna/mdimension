import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectionTypeToggle } from '@/components/controls/ProjectionTypeToggle';

describe('ProjectionTypeToggle', () => {
  it('should render both projection options', () => {
    const onChange = vi.fn();
    render(<ProjectionTypeToggle value="perspective" onChange={onChange} />);

    expect(screen.getByText('Perspective')).toBeInTheDocument();
    expect(screen.getByText('Orthographic')).toBeInTheDocument();
  });

  it('should highlight selected option (perspective)', () => {
    const onChange = vi.fn();
    render(<ProjectionTypeToggle value="perspective" onChange={onChange} />);

    const perspectiveButton = screen.getByText('Perspective').closest('button');
    const orthographicButton = screen.getByText('Orthographic').closest('button');

    // Perspective should have accent styling (transparent bg with accent text)
    expect(perspectiveButton).toHaveClass('bg-accent/20');
    expect(perspectiveButton).toHaveClass('text-accent');

    // Orthographic should have panel background
    expect(orthographicButton).toHaveClass('bg-panel-border');
    expect(orthographicButton).toHaveClass('text-text-secondary');
  });

  it('should highlight selected option (orthographic)', () => {
    const onChange = vi.fn();
    render(<ProjectionTypeToggle value="orthographic" onChange={onChange} />);

    const perspectiveButton = screen.getByText('Perspective').closest('button');
    const orthographicButton = screen.getByText('Orthographic').closest('button');

    // Orthographic should have accent styling (transparent bg with accent text)
    expect(orthographicButton).toHaveClass('bg-accent/20');
    expect(orthographicButton).toHaveClass('text-accent');

    // Perspective should have panel background
    expect(perspectiveButton).toHaveClass('bg-panel-border');
    expect(perspectiveButton).toHaveClass('text-text-secondary');
  });

  it('should call onChange when perspective is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionTypeToggle value="orthographic" onChange={onChange} />);

    const perspectiveButton = screen.getByText('Perspective');
    await user.click(perspectiveButton);

    expect(onChange).toHaveBeenCalledWith('perspective');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should call onChange when orthographic is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionTypeToggle value="perspective" onChange={onChange} />);

    const orthographicButton = screen.getByText('Orthographic');
    await user.click(orthographicButton);

    expect(onChange).toHaveBeenCalledWith('orthographic');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should have proper aria attributes', () => {
    const onChange = vi.fn();
    render(<ProjectionTypeToggle value="perspective" onChange={onChange} />);

    const perspectiveButton = screen.getByLabelText('Perspective projection');
    const orthographicButton = screen.getByLabelText('Orthographic projection');

    expect(perspectiveButton).toHaveAttribute('aria-pressed', 'true');
    expect(orthographicButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('should allow clicking same option multiple times', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionTypeToggle value="perspective" onChange={onChange} />);

    const perspectiveButton = screen.getByText('Perspective');

    await user.click(perspectiveButton);
    await user.click(perspectiveButton);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith('perspective');
  });
});
