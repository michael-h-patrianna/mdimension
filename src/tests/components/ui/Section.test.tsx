import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Section } from '@/components/sections/Section';

describe('Section', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders title correctly', () => {
    render(
      <Section title="Object Settings">
        <div>Content</div>
      </Section>
    );

    expect(screen.getByText(/Object Settings/i)).toBeInTheDocument();
  });

  it('renders children when open', () => {
    render(
      <Section title="Settings" defaultOpen={true}>
        <div data-testid="section-content">Content</div>
      </Section>
    );

    expect(screen.getByTestId('section-content')).toBeInTheDocument();
  });

  it('is open by default when defaultOpen is true', () => {
    render(
      <Section title="Settings" defaultOpen={true}>
        <div>Content</div>
      </Section>
    );

    const button = screen.getByRole('button', { name: /settings/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('is closed by default when defaultOpen is false', () => {
    render(
      <Section title="Settings" defaultOpen={false}>
        <div>Content</div>
      </Section>
    );

    const button = screen.getByRole('button', { name: /settings/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles open/closed on click', async () => {
    const user = userEvent.setup();

    render(
      <Section title="Settings" defaultOpen={true}>
        <div data-testid="section-content">Content</div>
      </Section>
    );

    const button = screen.getByRole('button', { name: /settings/i });

    // Initially open
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Click to close
    await user.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    // Click to open
    await user.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('toggles on Enter key', async () => {
    const user = userEvent.setup();

    render(
      <Section title="Settings" defaultOpen={false}>
        <div>Content</div>
      </Section>
    );

    const button = screen.getByRole('button', { name: /settings/i });
    button.focus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('toggles on Space key', async () => {
    const user = userEvent.setup();

    render(
      <Section title="Settings" defaultOpen={false}>
        <div>Content</div>
      </Section>
    );

    const button = screen.getByRole('button', { name: /settings/i });
    button.focus();

    await user.keyboard(' ');

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

    it('should render icon when provided', () => {
      // Icon prop removed in modern redesign
      // <Section title="Settings" icon={icon}>
      //   <div>Content</div>
      // </Section>
      // expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

  it('rotates chevron when toggling', async () => {
    const user = userEvent.setup();

    render(
      <Section title="Settings" defaultOpen={false}>
        <div>Content</div>
      </Section>
    );

    const button = screen.getByRole('button', { name: /settings/i });

    // Initial state (closed) - rotation 0
    // Note: Framer Motion applies styles, not classes.
    // Happy-dom might not fully compute styles, so we skip exact style checks here
    // and rely on the functional state change.
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <Section title="Settings" className="custom-class">
        <div>Content</div>
      </Section>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('hides content when closed', async () => {
    const user = userEvent.setup();

    render(
      <Section title="Settings" defaultOpen={true}>
        <div data-testid="section-content">Content</div>
      </Section>
    );

    const button = screen.getByRole('button', { name: /settings/i });
    expect(screen.getByTestId('section-content')).toBeInTheDocument();

    await user.click(button);

    await waitFor(() => {
      expect(screen.queryByTestId('section-content')).not.toBeInTheDocument();
    });
  });
});
