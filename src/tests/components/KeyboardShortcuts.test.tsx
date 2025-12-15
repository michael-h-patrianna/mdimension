/**
 * Tests for KeyboardShortcuts component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcuts } from '@/components/sections/Shortcuts/KeyboardShortcuts';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

describe('KeyboardShortcuts', () => {
  it('should render keyboard shortcuts', () => {
    render(<KeyboardShortcuts />);
    // Should display some shortcut descriptions (camera movement)
    expect(screen.getByText(/Move camera forward/i)).toBeInTheDocument();
  });

  it('should display all shortcuts', () => {
    render(<KeyboardShortcuts />);
    SHORTCUTS.forEach((shortcut) => {
      expect(screen.getByText(shortcut.description)).toBeInTheDocument();
    });
  });

  it('should display keyboard keys', () => {
    render(<KeyboardShortcuts />);
    // Should have kbd elements for keys
    const kbdElements = document.querySelectorAll('kbd');
    expect(kbdElements.length).toBe(SHORTCUTS.length);
  });

  it('should apply custom className', () => {
    const { container } = render(<KeyboardShortcuts className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should display arrow key labels', () => {
    render(<KeyboardShortcuts />);
    expect(screen.getByText('↑')).toBeInTheDocument();
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('should display Ctrl modifier', () => {
    render(<KeyboardShortcuts />);
    expect(screen.getByText(/Ctrl/)).toBeInTheDocument();
  });
});
