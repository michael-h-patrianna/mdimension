import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Slider } from '../../../components/ui/Slider'

describe('Slider', () => {
  it('exposes slider semantics and calls onChange with numeric values', () => {
    const onChange = vi.fn()

    render(<Slider label="Scale" value={5} min={0} max={10} onChange={onChange} />)

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-label', 'Scale')
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '10')
    expect(slider).toHaveValue('5')

    fireEvent.change(slider, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('is disabled when disabled=true', () => {
    render(<Slider label="Scale" value={5} min={0} max={10} onChange={vi.fn()} disabled />)
    expect(screen.getByRole('slider')).toBeDisabled()
  })
})
