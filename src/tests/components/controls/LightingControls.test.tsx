import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LightingControls } from '@/components/controls/LightingControls';
import { useVisualStore } from '@/stores/visualStore';

describe('LightingControls', () => {
  beforeEach(() => {
    // Reset store before each test
    useVisualStore.getState().reset();
  });

  describe('rendering based on shader type', () => {
    it('should render when surface shader is selected', () => {
      useVisualStore.getState().setShaderType('surface');
      render(<LightingControls />);
      expect(screen.getByText('Light On')).toBeInTheDocument();
    });

    it('should not render for wireframe shader', () => {
      useVisualStore.getState().setShaderType('wireframe');
      const { container } = render(<LightingControls />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('light toggle', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
    });

    it('should render light toggle button', () => {
      render(<LightingControls />);
      expect(screen.getByText('Light On')).toBeInTheDocument();
    });

    it('should toggle light on/off', async () => {
      const user = userEvent.setup();
      render(<LightingControls />);

      const toggleButton = screen.getByText('Light On');
      expect(useVisualStore.getState().lightEnabled).toBe(true);

      await user.click(toggleButton);
      expect(useVisualStore.getState().lightEnabled).toBe(false);

      await user.click(toggleButton);
      expect(useVisualStore.getState().lightEnabled).toBe(true);
    });

    it('should have correct aria-pressed state when enabled', () => {
      useVisualStore.getState().setLightEnabled(true);
      render(<LightingControls />);

      const toggleButton = screen.getByRole('button', { name: 'Light On', pressed: true });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should have correct aria-pressed state when disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      render(<LightingControls />);

      const toggleButton = screen.getByRole('button', { name: 'Light On', pressed: false });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('light color picker', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
      useVisualStore.getState().setLightEnabled(true);
    });

    it('should render color picker when light enabled', () => {
      render(<LightingControls />);
      expect(screen.getByText('Light Color')).toBeInTheDocument();
    });

    it('should not render color picker when light disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      render(<LightingControls />);
      expect(screen.queryByText('Light Color')).not.toBeInTheDocument();
    });

    it('should display current color value', () => {
      useVisualStore.getState().setLightColor('#FF0000');
      render(<LightingControls />);
      expect(screen.getByText('#FF0000')).toBeInTheDocument();
    });

    it('should update color when changed', () => {
      render(<LightingControls />);
      const colorInputs = document.querySelectorAll('input[type="color"]');
      const colorInput = colorInputs[0] as HTMLInputElement;

      fireEvent.change(colorInput, { target: { value: '#00FF00' } });
      expect(useVisualStore.getState().lightColor.toUpperCase()).toBe('#00FF00');
    });
  });

  describe('angle sliders', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
      useVisualStore.getState().setLightEnabled(true);
    });

    it('should render horizontal angle slider when light enabled', () => {
      render(<LightingControls />);
      expect(screen.getByText('Horizontal Angle')).toBeInTheDocument();
    });

    it('should render vertical angle slider when light enabled', () => {
      render(<LightingControls />);
      expect(screen.getByText('Vertical Angle')).toBeInTheDocument();
    });

    it('should not render angle sliders when light disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      render(<LightingControls />);
      expect(screen.queryByText('Horizontal Angle')).not.toBeInTheDocument();
      expect(screen.queryByText('Vertical Angle')).not.toBeInTheDocument();
    });

    it('should update horizontal angle', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Horizontal Angle') as HTMLInputElement;

      fireEvent.change(slider, { target: { value: '180' } });
      expect(useVisualStore.getState().lightHorizontalAngle).toBe(180);
    });

    it('should update vertical angle', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Vertical Angle') as HTMLInputElement;

      fireEvent.change(slider, { target: { value: '45' } });
      expect(useVisualStore.getState().lightVerticalAngle).toBe(45);
    });

    it('should have correct horizontal angle range', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Horizontal Angle') as HTMLInputElement;

      expect(slider.min).toBe('0');
      expect(slider.max).toBe('360');
      expect(slider.step).toBe('1');
    });

    it('should have correct vertical angle range', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Vertical Angle') as HTMLInputElement;

      expect(slider.min).toBe('-90');
      expect(slider.max).toBe('90');
      expect(slider.step).toBe('1');
    });
  });

  describe('ambient intensity slider', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
    });

    it('should always render ambient intensity slider', () => {
      render(<LightingControls />);
      expect(screen.getByText('Ambient Intensity')).toBeInTheDocument();
    });

    it('should render ambient intensity even when light disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      render(<LightingControls />);
      expect(screen.getByText('Ambient Intensity')).toBeInTheDocument();
    });

    it('should update ambient intensity', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Ambient Intensity') as HTMLInputElement;

      fireEvent.change(slider, { target: { value: '0.5' } });
      expect(useVisualStore.getState().ambientIntensity).toBe(0.5);
    });

    it('should have correct ambient intensity range', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Ambient Intensity') as HTMLInputElement;

      expect(slider.min).toBe('0');
      expect(slider.max).toBe('1');
      expect(slider.step).toBe('0.1');
    });
  });

  describe('specular controls', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
      useVisualStore.getState().setLightEnabled(true);
    });

    it('should render specular intensity slider when light enabled', () => {
      render(<LightingControls />);
      expect(screen.getByText('Specular Intensity')).toBeInTheDocument();
    });

    it('should render specular power slider when light enabled', () => {
      render(<LightingControls />);
      expect(screen.getByText('Specular Power')).toBeInTheDocument();
    });

    it('should not render specular controls when light disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      render(<LightingControls />);
      expect(screen.queryByText('Specular Intensity')).not.toBeInTheDocument();
      expect(screen.queryByText('Specular Power')).not.toBeInTheDocument();
    });

    it('should update specular intensity', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Specular Intensity') as HTMLInputElement;

      fireEvent.change(slider, { target: { value: '1.5' } });
      expect(useVisualStore.getState().specularIntensity).toBe(1.5);
    });

    it('should update specular power', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Specular Power') as HTMLInputElement;

      fireEvent.change(slider, { target: { value: '64' } });
      expect(useVisualStore.getState().specularPower).toBe(64);
    });

    it('should have correct specular intensity range', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Specular Intensity') as HTMLInputElement;

      expect(slider.min).toBe('0');
      expect(slider.max).toBe('2');
      expect(slider.step).toBe('0.1');
    });

    it('should have correct specular power range', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Specular Power') as HTMLInputElement;

      expect(slider.min).toBe('1');
      expect(slider.max).toBe('128');
      expect(slider.step).toBe('1');
    });
  });

  describe('light indicator toggle', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
      useVisualStore.getState().setLightEnabled(true);
    });

    it('should render light indicator toggle when light enabled', () => {
      render(<LightingControls />);
      expect(screen.getByText('Show Light Indicator')).toBeInTheDocument();
    });

    it('should not render light indicator toggle when light disabled', () => {
      useVisualStore.getState().setLightEnabled(false);
      render(<LightingControls />);
      expect(screen.queryByText('Show Light Indicator')).not.toBeInTheDocument();
    });

    it('should toggle light indicator', async () => {
      const user = userEvent.setup();
      render(<LightingControls />);

      const toggleButton = screen.getByText('Show Light Indicator');
      expect(useVisualStore.getState().showLightIndicator).toBe(false);

      await user.click(toggleButton);
      expect(useVisualStore.getState().showLightIndicator).toBe(true);

      await user.click(toggleButton);
      expect(useVisualStore.getState().showLightIndicator).toBe(false);
    });

    it('should have correct aria-pressed state when enabled', () => {
      useVisualStore.getState().setShowLightIndicator(true);
      render(<LightingControls />);

      const toggleButton = screen.getByRole('button', { name: 'Show Light Indicator', pressed: true });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should have correct aria-pressed state when disabled', () => {
      useVisualStore.getState().setShowLightIndicator(false);
      render(<LightingControls />);

      const toggleButton = screen.getByRole('button', { name: 'Show Light Indicator', pressed: false });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
    });

    it('should accept and apply custom className', () => {
      const { container } = render(<LightingControls className="custom-class" />);
      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });

    it('should apply default empty className when not provided', () => {
      const { container } = render(<LightingControls />);
      const wrapper = container.querySelector('.space-y-4');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
