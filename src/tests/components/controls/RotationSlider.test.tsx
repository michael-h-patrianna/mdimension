import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RotationSlider } from '@/components/controls/RotationSlider';

describe('RotationSlider', () => {
  it('should render with plane label', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <RotationSlider
        plane="XY"
        value={0}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    expect(screen.getByText('XY')).toBeInTheDocument();
  });

  it('should display degrees value', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    // π/2 radians = 90 degrees
    render(
      <RotationSlider
        plane="XY"
        value={Math.PI / 2}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    expect(screen.getByText('90°')).toBeInTheDocument();
  });

  it('should display rounded degrees', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    // 1.5 radians ≈ 85.94 degrees, should round to 86
    render(
      <RotationSlider
        plane="XY"
        value={1.5}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    expect(screen.getByText('86°')).toBeInTheDocument();
  });

  it('should render slider input with correct value', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <RotationSlider
        plane="XY"
        value={Math.PI / 2}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('90');
  });

  it('should call onChange with radians when slider value changes', async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    const { rerender } = render(
      <RotationSlider
        plane="XY"
        value={0}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    // Simulate changing the slider value to 45 degrees
    const angleRadians = Math.PI / 4;
    rerender(
      <RotationSlider
        plane="XY"
        value={angleRadians}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    // Check that the slider shows the correct degree value
    expect(screen.getByText('45°')).toBeInTheDocument();
  });

  it('should call onReset when double-clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <RotationSlider
        plane="XY"
        value={Math.PI / 4}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    const slider = screen.getByRole('slider');
    await user.dblClick(slider);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('should render with different badge colors', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    const { rerender } = render(
      <RotationSlider
        plane="XY"
        value={0}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    let badge = screen.getByText('XY');
    expect(badge).toHaveClass('bg-blue-500');

    rerender(
      <RotationSlider
        plane="XW"
        value={0}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="purple"
      />
    );

    badge = screen.getByText('XW');
    expect(badge).toHaveClass('bg-purple-500');

    rerender(
      <RotationSlider
        plane="XV"
        value={0}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="orange"
      />
    );

    badge = screen.getByText('XV');
    expect(badge).toHaveClass('bg-orange-500');

    rerender(
      <RotationSlider
        plane="XU"
        value={0}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="green"
      />
    );

    badge = screen.getByText('XU');
    expect(badge).toHaveClass('bg-green-500');
  });

  it('should handle zero value', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <RotationSlider
        plane="XY"
        value={0}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    expect(screen.getByText('0°')).toBeInTheDocument();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('0');
  });

  it('should handle maximum value (360 degrees)', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    // 2π radians = 360 degrees
    render(
      <RotationSlider
        plane="XY"
        value={2 * Math.PI}
        onChange={onChange}
        onReset={onReset}
        axisBadgeColor="blue"
      />
    );

    expect(screen.getByText('360°')).toBeInTheDocument();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('360');
  });
});
