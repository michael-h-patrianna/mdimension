import { render, screen } from '@testing-library/react';
import { ExportModal } from '@/components/overlays/ExportModal';
import { useExportStore } from '@/stores/exportStore';
import { vi } from 'vitest';
import React from 'react';

// Mock dependencies
vi.mock('@/components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

vi.mock('@/lib/audio/SoundManager', () => ({
  soundManager: {
    playClick: vi.fn(),
    playSuccess: vi.fn()
  }
}));

vi.mock('@/components/overlays/export/ExportPreview', () => ({
  ExportPreview: () => <div data-testid="export-preview">Preview</div>
}));

vi.mock('@/components/overlays/export/ExportPresets', () => ({
  ExportPresets: () => <div data-testid="export-presets">Presets</div>
}));

vi.mock('@/components/overlays/export/ExportGeneralTab', () => ({
  ExportGeneralTab: () => <div data-testid="export-general">General</div>
}));

vi.mock('@/components/overlays/export/ExportTextTab', () => ({
  ExportTextTab: () => <div data-testid="export-text">Text</div>
}));

vi.mock('@/components/overlays/export/ExportAdvancedTab', () => ({
  ExportAdvancedTab: () => <div data-testid="export-advanced">Advanced</div>
}));

describe('ExportModal', () => {
  beforeEach(() => {
    // Reset store state
    useExportStore.setState({
      isModalOpen: true,
      status: 'idle',
      exportMode: 'video',
      estimatedSizeMB: 10,
      settings: {
        resolution: '1080p',
        fps: 60,
        duration: 10,
        format: 'mp4',
        quality: 'high',
        bitrate: 10
      }
    });
  });

  it('renders the modal when open', () => {
    render(<ExportModal />);
    expect(screen.getByText('Video Export Studio')).toBeInTheDocument();
  });

  it('renders tabs correctly', () => {
    render(<ExportModal />);
    // "Presets" appears in the tab label and the active tab content
    expect(screen.getAllByText('Presets').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('renders the active tab content', () => {
    render(<ExportModal />);
    // Default tab is 'presets'
    expect(screen.getByTestId('export-presets')).toBeInTheDocument();
  });

  it('contains the structural fix for scrolling', () => {
    render(<ExportModal />);
    const wrapper = screen.getByTestId('export-tabs-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('overflow-hidden');
    expect(wrapper).toHaveClass('flex-col');
    // Ensure it does NOT have the old scrolling class
    expect(wrapper).not.toHaveClass('overflow-y-auto');
  });
});
