import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleGroup } from '@/components/ui/ToggleGroup';

describe('ToggleGroup', () => {
  const options = [
    { value: 'perspective', label: 'Perspective' },
    { value: 'orthographic', label: 'Orthographic' },
  ];

  it('renders all options', () => {
    render(<ToggleGroup options={options} value="perspective" onChange={() => {}} />);
    
    expect(screen.getByText('Perspective')).toBeInTheDocument();
    expect(screen.getByText('Orthographic')).toBeInTheDocument();
  });

  it('marks selected option as checked', () => {
    render(<ToggleGroup options={options} value="perspective" onChange={() => {}} />);
    
    const perspectiveButton = screen.getByRole('radio', { name: /perspective/i });
    const orthographicButton = screen.getByRole('radio', { name: /orthographic/i });
    
    expect(perspectiveButton).toBeChecked();
    expect(orthographicButton).not.toBeChecked();
  });

  it('applies selected styles to active option', () => {
    render(<ToggleGroup options={options} value="perspective" onChange={() => {}} />);
    
    const perspectiveButton = screen.getByRole('radio', { name: /perspective/i });
    // Updated expectation to match current style
    expect(perspectiveButton).toHaveClass('text-accent');
  });

  it('calls onChange when option is clicked', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    
    render(<ToggleGroup options={options} value="perspective" onChange={handleChange} />);
    
    await user.click(screen.getByText('Orthographic'));
    expect(handleChange).toHaveBeenCalledWith('orthographic');
  });

  it('does not call onChange when disabled', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    
    render(
      <ToggleGroup 
        options={options} 
        value="perspective" 
        onChange={handleChange} 
        disabled={true} 
      />
    );
    
    await user.click(screen.getByText('Orthographic'));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <ToggleGroup 
        options={options} 
        value="perspective" 
        onChange={() => {}} 
        disabled={true} 
      />
    );
    
    const buttons = screen.getAllByRole('radio');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <ToggleGroup 
        options={options} 
        value="perspective" 
        onChange={() => {}} 
        className="custom-class" 
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has radiogroup role with aria-label', () => {
    render(
      <ToggleGroup 
        options={options} 
        value="perspective" 
        onChange={() => {}} 
        ariaLabel="Projection type" 
      />
    );
    
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-label', 'Projection type');
  });
});