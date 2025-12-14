import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ControlPanel } from '../../../components/ui/ControlPanel'
import { useLayoutStore } from '../../../stores/layoutStore'

describe('ControlPanel', () => {
  // Reset store before each test
  beforeEach(() => {
    useLayoutStore.getState().setCollapsed(false)
  })

  it('renders children correctly', () => {
    render(
      <ControlPanel>
        <div data-testid="panel-content">Panel content</div>
      </ControlPanel>
    )

    expect(screen.getByTestId('panel-content')).toBeInTheDocument()
  })

  it('renders with default title', () => {
    render(
      <ControlPanel>
        <div>Content</div>
      </ControlPanel>
    )

    expect(screen.getByText('CONTROLS')).toBeInTheDocument()
  })

  it('renders with custom title', () => {
    render(
      <ControlPanel title="Custom Controls">
        <div>Content</div>
      </ControlPanel>
    )

    expect(screen.getByText('Custom Controls')).toBeInTheDocument()
  })

  it('is expanded by default', () => {
    render(
      <ControlPanel>
        <div data-testid="panel-content">Content</div>
      </ControlPanel>
    )

    const button = screen.getByRole('button', { name: /collapse control panel/i })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('control-panel-content')).not.toHaveClass('invisible')
  })

  it('is collapsed when store isCollapsed is true', () => {
    useLayoutStore.getState().setCollapsed(true)

    render(
      <ControlPanel>
        <div data-testid="panel-content">Content</div>
      </ControlPanel>
    )

    const button = screen.getByRole('button', { name: /expand control panel/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('control-panel-content')).toHaveClass('invisible', 'opacity-0')
  })

  it('toggles collapsed state on button click', async () => {
    const user = userEvent.setup()

    render(
      <ControlPanel>
        <div data-testid="panel-content">Content</div>
      </ControlPanel>
    )

    // Initially expanded
    expect(screen.getByTestId('control-panel-content')).not.toHaveClass('invisible')

    // Click to collapse
    const collapseButton = screen.getByRole('button', { name: /collapse control panel/i })
    await user.click(collapseButton)

    await waitFor(() => {
      expect(screen.getByTestId('control-panel-content')).toHaveClass('invisible')
      expect(screen.getByRole('button', { name: /expand control panel/i })).toBeInTheDocument()
    })

    // Click to expand
    const expandButton = screen.getByRole('button', { name: /expand control panel/i })
    await user.click(expandButton)

    await waitFor(() => {
      expect(screen.getByTestId('control-panel-content')).not.toHaveClass('invisible')
    })
  })

  it('toggles on Enter key', async () => {
    const user = userEvent.setup()

    render(
      <ControlPanel>
        <div data-testid="panel-content">Content</div>
      </ControlPanel>
    )

    const button = screen.getByRole('button', { name: /collapse control panel/i })
    button.focus()

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByTestId('control-panel-content')).toHaveClass('invisible')
    })
  })

  it('toggles on Space key', async () => {
    const user = userEvent.setup()

    render(
      <ControlPanel>
        <div data-testid="panel-content">Content</div>
      </ControlPanel>
    )

    const button = screen.getByRole('button', { name: /collapse control panel/i })
    button.focus()

    await user.keyboard(' ')

    await waitFor(() => {
      expect(screen.getByTestId('control-panel-content')).toHaveClass('invisible')
    })
  })

  it('hides title when collapsed', async () => {
    const user = userEvent.setup()

    render(
      <ControlPanel title="My Controls">
        <div>Content</div>
      </ControlPanel>
    )

    expect(screen.getByText('My Controls')).toBeVisible()

    const button = screen.getByRole('button', { name: /collapse control panel/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.queryByText('My Controls')).not.toBeInTheDocument()
    })
  })

  it('changes width when collapsed', async () => {
    const user = userEvent.setup()

    render(
      <ControlPanel>
        <div>Content</div>
      </ControlPanel>
    )

    const container = screen.getByTestId('control-panel-container')
    expect(container).not.toHaveClass('w-14')

    const button = screen.getByRole('button', { name: /collapse control panel/i })
    await user.click(button)

    await waitFor(() => {
      expect(container).toHaveClass('w-14')
    })
  })

  it('rotates arrow icon when toggling', async () => {
    const user = userEvent.setup()

    render(
      <ControlPanel>
        <div>Content</div>
      </ControlPanel>
    )

    const button = screen.getByRole('button', { name: /collapse control panel/i })
    const arrow = button.querySelector('svg')

    expect(arrow).toHaveClass('rotate-0')

    await user.click(button)

    await waitFor(() => {
      expect(arrow).toHaveClass('rotate-180')
    })
  })

  it('applies custom className', () => {
    const { container } = render(
      <ControlPanel className="custom-class">
        <div>Content</div>
      </ControlPanel>
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('has proper ARIA label', () => {
    render(
      <ControlPanel>
        <div>Content</div>
      </ControlPanel>
    )

    expect(screen.getByRole('complementary', { name: /control panel/i })).toBeInTheDocument()
  })
})
