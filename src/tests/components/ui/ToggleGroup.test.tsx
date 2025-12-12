import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleGroup } from '../../../components/ui/ToggleGroup';

const mockOptions = [
  { value: 'orthographic', label: 'Orthographic' },
  { value: 'perspective', label: 'Perspective' },
  { value: 'stereographic', label: 'Stereographic' },
];

describe('ToggleGroup', () => {
  it('renders all options', () => {
    render(
      <ToggleGroup
        options={mockOptions}
        value="orthographic"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('radio', { name: /orthographic/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /perspective/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /stereographic/i })).toBeInTheDocument();
  });

  it('marks selected option as checked', () => {
    render(
      <ToggleGroup
        options={mockOptions}
        value="perspective"
        onChange={vi.fn()}
      />
    );

    const perspectiveButton = screen.getByRole('radio', { name: /perspective/i });
    expect(perspectiveButton).toHaveAttribute('aria-checked', 'true');

    const orthographicButton = screen.getByRole('radio', { name: /orthographic/i });
    expect(orthographicButton).toHaveAttribute('aria-checked', 'false');
  });

  it('applies selected styles to active option', () => {
    render(
      <ToggleGroup
        options={mockOptions}
        value="perspective"
        onChange={vi.fn()}
      />
    );

    const perspectiveButton = screen.getByRole('radio', { name: /perspective/i });
    expect(perspectiveButton).toHaveClass('bg-accent', 'text-app-bg');
  });

  it('calls onChange when option is clicked', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ToggleGroup
        options={mockOptions}
        value="orthographic"
        onChange={handleChange}
      />
    );

    const perspectiveButton = screen.getByRole('radio', { name: /perspective/i });
    await user.click(perspectiveButton);

    expect(handleChange).toHaveBeenCalledWith('perspective');
  });

  it('does not call onChange when disabled', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ToggleGroup
        options={mockOptions}
        value="orthographic"
        onChange={handleChange}
        disabled
      />
    );

    const perspectiveButton = screen.getByRole('radio', { name: /perspective/i });
    await user.click(perspectiveButton);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <ToggleGroup
        options={mockOptions}
        value="orthographic"
        onChange={vi.fn()}
        disabled
      />
    );

    mockOptions.forEach((option) => {
      const button = screen.getByRole('radio', { name: new RegExp(option.label, 'i') });
      expect(button).toBeDisabled();
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <ToggleGroup
        options={mockOptions}
        value="orthographic"
        onChange={vi.fn()}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has radiogroup role with aria-label', () => {
    render(
      <ToggleGroup
        options={mockOptions}
        value="orthographic"
        onChange={vi.fn()}
        ariaLabel="Projection type"
      />
    );

    expect(screen.getByRole('radiogroup', { name: /projection type/i })).toBeInTheDocument();
  });
});
