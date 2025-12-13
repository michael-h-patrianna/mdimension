import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../../../components/ui/Switch';

describe('Switch', () => {
  it('renders correctly', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} label="Toggle me" />);
    expect(screen.getByText('Toggle me')).toBeInTheDocument();
  });

  it('calls onCheckedChange when clicked', async () => {
    const handleCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onCheckedChange={handleCheckedChange} />);

    await user.click(screen.getByRole('switch'));
    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it('displays checked state correctly', () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeChecked();
  });

  it('displays unchecked state correctly', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).not.toBeChecked();
  });

  it('is disabled when disabled prop is true', async () => {
    const handleCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onCheckedChange={handleCheckedChange} disabled />);
    
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeDisabled();
    
    await user.click(switchElement);
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} className="custom-class" data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveClass('custom-class');
  });
});
