import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from '../../../components/ui/Slider';

describe('Slider', () => {
  it('renders with label', () => {
    render(
      <Slider
        label="Rotation"
        value={45}
        min={0}
        max={360}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Rotation')).toBeInTheDocument();
  });

  it('displays current value', () => {
    render(
      <Slider
        label="Scale"
        value={1.5}
        min={0}
        max={5}
        step={0.1}
        onChange={vi.fn()}
      />
    );

    // With step=0.1, decimals should be 1 (from Math.ceil(-Math.log10(0.1)))
    // so value is formatted as '1.5' not '1.50'
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
  });

  // Unit is only displayed in min/max labels, not next to the value
  // it('displays unit when provided', () => { ... });

  it('displays min and max labels', () => {
    render(
      <Slider
        label="Scale"
        value={2}
        min={1}
        max={10}
        unit="x"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('1x')).toBeInTheDocument();
    expect(screen.getByText('10x')).toBeInTheDocument();
  });

  it('calls onChange with correct value', async () => {
    const handleChange = vi.fn();

    render(
      <Slider
        label="Scale"
        value={5}
        min={0}
        max={10}
        onChange={handleChange}
      />
    );

    const slider = screen.getByRole('slider') as HTMLInputElement;

    // Simulate changing the value
    fireEvent.change(slider, { target: { value: '7' } });

    expect(handleChange).toHaveBeenCalledWith(7);
  });

  it('does not show value when showValue is false', () => {
    render(
      <Slider
        label="Scale"
        value={5}
        min={0}
        max={10}
        showValue={false}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('disables slider when disabled prop is true', () => {
    render(
      <Slider
        label="Scale"
        value={5}
        min={0}
        max={10}
        onChange={vi.fn()}
        disabled
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
  });

  it('has correct ARIA attributes', () => {
    render(
      <Slider
        label="Rotation"
        value={180}
        min={0}
        max={360}
        onChange={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', 'Rotation');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '360');
    expect(slider).toHaveAttribute('aria-valuenow', '180');
  });
});
