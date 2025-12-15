import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Knob } from '../../../components/ui/Knob';

describe('Knob', () => {
  it('renders correctly', () => {
    render(<Knob value={50} onChange={() => {}} label="Volume" />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
  });

  it('displays correct aria values', () => {
    render(<Knob value={25} min={0} max={100} onChange={() => {}} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '25');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
  });

  it('calls onChange when using keyboard', () => {
    const handleChange = vi.fn();
    render(<Knob value={50} onChange={handleChange} />);
    const slider = screen.getByRole('slider');
    
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(handleChange).toHaveBeenCalledWith(51);
    
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(handleChange).toHaveBeenCalledWith(49);
  });
});