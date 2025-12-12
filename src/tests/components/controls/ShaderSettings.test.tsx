/**
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShaderSettings } from '@/components/controls/ShaderSettings';
import { useVisualStore } from '@/stores/visualStore';

// Mock the store
vi.mock('@/stores/visualStore', () => ({
  useVisualStore: vi.fn(),
  DEFAULT_SURFACE_SETTINGS: { faceOpacity: 0.8, specularIntensity: 1, specularPower: 32, fresnelEnabled: true },
}));

describe('ShaderSettings', () => {
  const setFaceColorMock = vi.fn();
  const setSurfaceSettingsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useVisualStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        facesVisible: true,
        faceColor: '#123456',
        shaderSettings: {
          surface: { faceOpacity: 0.5, fresnelEnabled: false },
        },
        setFaceColor: setFaceColorMock,
        setSurfaceSettings: setSurfaceSettingsMock,
      };
      return selector(state);
    });
  });

  describe('when faces are visible', () => {
    it('renders surface color picker', () => {
      render(<ShaderSettings />);

      // Check for "Surface Color" label
      expect(screen.getByText('Surface Color')).toBeInTheDocument();

      // Check for color input with correct value
      const colorInput = screen.getByDisplayValue('#123456');
      expect(colorInput).toBeInTheDocument();
      expect(colorInput).toHaveAttribute('type', 'color');
    });

    it('renders face opacity slider', () => {
      render(<ShaderSettings />);

      expect(screen.getByText('Face Opacity')).toBeInTheDocument();
    });

    it('renders fresnel rim toggle', () => {
      render(<ShaderSettings />);

      expect(screen.getByText('Fresnel Rim')).toBeInTheDocument();
    });

    it('renders lighting configuration hint', () => {
      render(<ShaderSettings />);

      expect(screen.getByText(/Configure lighting in the Lighting section/)).toBeInTheDocument();
    });

    it('updates face color when picker value changes', () => {
      render(<ShaderSettings />);

      const colorInput = screen.getByDisplayValue('#123456');
      fireEvent.change(colorInput, { target: { value: '#abcdef' } });

      expect(setFaceColorMock).toHaveBeenCalledWith('#abcdef');
    });

    it('toggles fresnel rim when clicked', () => {
      render(<ShaderSettings />);

      const fresnelButton = screen.getByText('Fresnel Rim');
      fireEvent.click(fresnelButton);

      expect(setSurfaceSettingsMock).toHaveBeenCalledWith({ fresnelEnabled: true });
    });

    it('applies custom className', () => {
      const { container } = render(<ShaderSettings className="custom-class" />);

      const controlsDiv = container.querySelector('.custom-class');
      expect(controlsDiv).toBeInTheDocument();
    });
  });

  describe('when faces are not visible', () => {
    beforeEach(() => {
      (useVisualStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
        const state = {
          facesVisible: false,
          faceColor: '#123456',
          shaderSettings: {
            surface: { faceOpacity: 0.5, fresnelEnabled: false },
          },
          setFaceColor: setFaceColorMock,
          setSurfaceSettings: setSurfaceSettingsMock,
        };
        return selector(state);
      });
    });

    it('renders nothing', () => {
      const { container } = render(<ShaderSettings />);

      expect(container.firstChild).toBeNull();
    });

    it('does not render surface color picker', () => {
      render(<ShaderSettings />);

      expect(screen.queryByText('Surface Color')).not.toBeInTheDocument();
    });

    it('does not render face opacity slider', () => {
      render(<ShaderSettings />);

      expect(screen.queryByText('Face Opacity')).not.toBeInTheDocument();
    });

    it('does not render fresnel rim toggle', () => {
      render(<ShaderSettings />);

      expect(screen.queryByText('Fresnel Rim')).not.toBeInTheDocument();
    });
  });
});
