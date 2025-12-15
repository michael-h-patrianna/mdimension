/**
 * Tests for ShareButton component
 */

import { ShareButton } from '@/components/ShareButton';
import { useAnimationStore } from '@/stores/animationStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
});

describe('ShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
    useGeometryStore.getState().reset();
    useRotationStore.getState().resetAllRotations();
    useTransformStore.getState().resetAll();
    useAnimationStore.getState().reset();
  });

  it('should render share button', () => {
    render(<ShareButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Share URL')).toBeInTheDocument();
  });

  it('should copy URL to clipboard on click', async () => {
    render(<ShareButton />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
    });
  });

  it('should show copied message after click', async () => {
    render(<ShareButton />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('should include dimension in URL', async () => {
    useGeometryStore.getState().setDimension(5);
    render(<ShareButton />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
      const url = mockClipboard.writeText.mock.calls[0]?.[0] as string;
      expect(url).toContain('d=5');
    });
  });

  it('should include object type in URL', async () => {
    useGeometryStore.getState().setObjectType('simplex');
    render(<ShareButton />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
      const url = mockClipboard.writeText.mock.calls[0]?.[0] as string;
      expect(url).toContain('t=simplex');
    });
  });

  it('should apply custom className', () => {
    render(<ShareButton className="custom-class" />);
    const container = screen.getByRole('button').parentElement;
    expect(container).toHaveClass('custom-class');
  });
});
