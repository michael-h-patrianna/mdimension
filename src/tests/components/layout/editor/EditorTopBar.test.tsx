import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorTopBar } from '@/components/layout/EditorTopBar';
import { useLayoutStore } from '@/stores/layoutStore'; // Import the actual store

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

// Mock the useLayoutStore
vi.mock('@/stores/layoutStore', () => ({
  useLayoutStore: vi.fn(),
}));

// Mock the DropdownMenu component to directly render its items for testing
vi.mock('@/components/ui/DropdownMenu', () => ({
  DropdownMenu: vi.fn(({ trigger, items }) => (
    <div>
      {trigger}
      {items.map((item: any, index: number) => (
        <button key={index} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  )),
}));

describe('EditorTopBar', () => {
  const mockToggleLeftPanel = vi.fn();
  const mockToggleRightPanel = vi.fn();
  const mockToggleShortcuts = vi.fn();
  const mockToggleCinematicMode = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockToggleLeftPanel.mockClear();
    mockToggleRightPanel.mockClear();
    mockToggleShortcuts.mockClear();
    mockToggleCinematicMode.mockClear();

    // Set up the mock implementation for useLayoutStore to handle selectors
    (useLayoutStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        showLeftPanel: true,
        toggleLeftPanel: () => mockToggleLeftPanel(),
        toggleShortcuts: () => mockToggleShortcuts(),
        showRightPanel: true,
        toggleRightPanel: mockToggleRightPanel,
        isCinematicMode: false,
        toggleCinematicMode: () => mockToggleCinematicMode(),
        setCinematicMode: vi.fn(),
      };
      return selector ? selector(state) : state;
    });
  });

  const defaultProps = {
    showRightPanel: true,
    toggleRightPanel: mockToggleRightPanel, // Pass the mocked function as prop
  };

  it('renders correctly', () => {
    render(<EditorTopBar {...defaultProps} />);
    expect(screen.getAllByText('MDIMENSION')[0]).toBeInTheDocument();
    expect(screen.getByText('FILE')).toBeInTheDocument();
    expect(screen.getByText('VIEW')).toBeInTheDocument();
  });

  it('toggles left panel when button is clicked', () => {
    render(<EditorTopBar {...defaultProps} />);
    const toggleButton = screen.getByTitle('Toggle Explorer');
    fireEvent.click(toggleButton);
    expect(mockToggleLeftPanel).toHaveBeenCalled();
  });

  it('toggles right panel when button is clicked', () => {
    render(<EditorTopBar {...defaultProps} />);
    const toggleButton = screen.getByTitle('Toggle Inspector');
    fireEvent.click(toggleButton);
    expect(mockToggleRightPanel).toHaveBeenCalled();
  });

  it('opens File menu and handles Export', async () => {
    render(<EditorTopBar {...defaultProps} />);
    
    // Open File menu
    fireEvent.click(screen.getByText('FILE'));
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
    expect(mockToggleRightPanel).toHaveBeenCalled();
  });

  it('toggles cinematic mode from View menu', () => {
    render(<EditorTopBar {...defaultProps} />);
    
    // Open View menu
    fireEvent.click(screen.getByText('View'));
    
    // Click Cinematic Mode
    fireEvent.click(screen.getByText('Cinematic Mode'));
    expect(mockToggleCinematicMode).toHaveBeenCalled();
  });

  it('toggles keyboard shortcuts from View menu', () => {
    render(<EditorTopBar {...defaultProps} />);
    
    // Open View menu
    fireEvent.click(screen.getByText('View'));
    
    // Click Keyboard Shortcuts
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));
    expect(mockToggleShortcuts).toHaveBeenCalled();
  });
});
