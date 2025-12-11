import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../../../components/ui/Select';

const mockOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
];

describe('Select', () => {
  it('renders all options', () => {
    render(<Select options={mockOptions} value="option1" onChange={vi.fn()} />);

    const select = screen.getByRole('combobox');
    const options = screen.getAllByRole('option');

    expect(select).toBeInTheDocument();
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Option 1');
    expect(options[1]).toHaveTextContent('Option 2');
    expect(options[2]).toHaveTextContent('Option 3');
  });

  it('displays the correct selected value', () => {
    render(<Select options={mockOptions} value="option2" onChange={vi.fn()} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('option2');
  });

  it('calls onChange when selection changes', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Select options={mockOptions} value="option1" onChange={handleChange} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'option3');

    expect(handleChange).toHaveBeenCalledWith('option3');
  });

  it('renders label when provided', () => {
    render(
      <Select
        label="Choose option"
        options={mockOptions}
        value="option1"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Choose option')).toBeInTheDocument();
  });

  it('disables select when disabled prop is true', () => {
    render(
      <Select
        options={mockOptions}
        value="option1"
        onChange={vi.fn()}
        disabled
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Select
        options={mockOptions}
        value="option1"
        onChange={vi.fn()}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('uses label as aria-label', () => {
    render(
      <Select
        label="Select dimension"
        options={mockOptions}
        value="option1"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Select dimension')).toBeInTheDocument();
  });
});
