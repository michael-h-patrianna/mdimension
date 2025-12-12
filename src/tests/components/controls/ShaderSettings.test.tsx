import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShaderSettings } from '@/components/controls/ShaderSettings';
import { useVisualStore } from '@/stores/visualStore';

// Mock the store
vi.mock('@/stores/visualStore', () => ({
  useVisualStore: vi.fn(),
  DEFAULT_DUAL_OUTLINE_SETTINGS: { gap: 2, innerColor: '#fff', outerColor: '#000' },
  DEFAULT_SURFACE_SETTINGS: { faceOpacity: 0.8, specularIntensity: 1, specularPower: 32, fresnelEnabled: true },
}));

describe('ShaderSettings', () => {
  const setFaceColorMock = vi.fn();
  const setSurfaceSettingsMock = vi.fn();
  const setDualOutlineSettingsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useVisualStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        shaderType: 'surface',
        faceColor: '#123456',
        shaderSettings: {
          surface: { faceOpacity: 0.5, fresnelEnabled: false },
          dualOutline: { innerColor: '#ffffff', outerColor: '#000000', gap: 2 },
        },
        setFaceColor: setFaceColorMock,
        setSurfaceSettings: setSurfaceSettingsMock,
        setDualOutlineSettings: setDualOutlineSettingsMock,
      };
      return selector(state);
    });
  });

  it('renders surface color picker when shader type is surface', () => {
    render(<ShaderSettings />);
    
    // Check for "Surface Color" label
    expect(screen.getByText('Surface Color')).toBeInTheDocument();
    
    // Check for color input with correct value
    const colorInput = screen.getByDisplayValue('#123456');
    expect(colorInput).toBeInTheDocument();
    expect(colorInput).toHaveAttribute('type', 'color');
  });

  it('updates face color when picker value changes', () => {
    render(<ShaderSettings />);
    
    const colorInput = screen.getByDisplayValue('#123456');
    fireEvent.change(colorInput, { target: { value: '#abcdef' } });
    
    expect(setFaceColorMock).toHaveBeenCalledWith('#abcdef');
  });

  it('does not render surface color picker when shader type is not surface', () => {
    (useVisualStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        shaderType: 'dualOutline',
        faceColor: '#123456',
        shaderSettings: {
          surface: { faceOpacity: 0.5, fresnelEnabled: false },
          dualOutline: { innerColor: '#ffffff', outerColor: '#000000', gap: 2 },
        },
        setFaceColor: setFaceColorMock,
        setSurfaceSettings: setSurfaceSettingsMock,
        setDualOutlineSettings: setDualOutlineSettingsMock,
      };
      return selector(state);
    });

    render(<ShaderSettings />);
    
    expect(screen.queryByText('Surface Color')).not.toBeInTheDocument();
  });
});
