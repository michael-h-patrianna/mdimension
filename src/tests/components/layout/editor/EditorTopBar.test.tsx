import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorTopBar } from '@/components/layout/editor/EditorTopBar';

// Mock dependencies
vi.mock('@/lib/export', () => ({
  exportSceneToPNG: vi.fn(),
  generateTimestampFilename: vi.fn(() => 'test-file'),
}));

vi.mock('@/lib/url', () => ({
  generateShareUrl: vi.fn(() => 'https://example.com/share'),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
  configurable: true,
});

describe('EditorTopBar', () => {
  const defaultProps = {
    showLeftPanel: true,
    setShowLeftPanel: vi.fn(),
    showRightPanel: true,
    toggleRightPanel: vi.fn(),
  };

  it('renders correctly', () => {
    render(<EditorTopBar {...defaultProps} />);
    expect(screen.getByText('MDIMENSION')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('toggles left panel when button is clicked', () => {
    render(<EditorTopBar {...defaultProps} />);
    const toggleButton = screen.getByTitle('Toggle Explorer');
    fireEvent.click(toggleButton);
    expect(defaultProps.setShowLeftPanel).toHaveBeenCalledWith(false);
  });

  it('toggles right panel when button is clicked', () => {
    render(<EditorTopBar {...defaultProps} />);
    const toggleButton = screen.getByTitle('Toggle Inspector');
    fireEvent.click(toggleButton);
    expect(defaultProps.toggleRightPanel).toHaveBeenCalled();
  });

  it('opens File menu and handles Export', async () => {
    render(<EditorTopBar {...defaultProps} />);
    
    // Open File menu
    fireEvent.click(screen.getByText('File'));
    expect(screen.getByText('Export Image (PNG)')).toBeInTheDocument();

    // Click Export
    fireEvent.click(screen.getByText('Export Image (PNG)'));
    
    // Wait for async action
    await new Promise(resolve => setTimeout(resolve, 60));
    
    const { exportSceneToPNG } = await import('@/lib/export');
    expect(exportSceneToPNG).toHaveBeenCalled();
  });

  it('opens View menu and handles Show/Hide Inspector', () => {
    render(<EditorTopBar {...defaultProps} />);
    
    // Open View menu
    fireEvent.click(screen.getByText('View'));
    
    // Check menu items
    const toggleItem = screen.getByText('Hide Inspector');
    expect(toggleItem).toBeInTheDocument();
    
    // Click it
    fireEvent.click(toggleItem);
    expect(defaultProps.toggleRightPanel).toHaveBeenCalled();
  });
});
