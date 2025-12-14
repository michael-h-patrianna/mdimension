import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LightingControls } from '@/components/sidebar/Lights/LightingControls';
import { LightList } from '@/components/sidebar/Lights/LightList';
import { LightListItem } from '@/components/sidebar/Lights/LightListItem';
import { LightEditor } from '@/components/sidebar/Lights/LightEditor';
import { Vector3Input } from '@/components/sidebar/Lights/Vector3Input';
import { useVisualStore } from '@/stores/visualStore';
import type { LightSource } from '@/lib/lights/types';

describe('LightingControls', () => {
  beforeEach(() => {
    useVisualStore.getState().reset();
  });

  describe('rendering based on shader type', () => {
    it('should render when surface shader is selected', () => {
      useVisualStore.getState().setShaderType('surface');
      render(<LightingControls />);
      expect(screen.getByText('Show Gizmos')).toBeInTheDocument();
    });

    it('should not render for wireframe shader', () => {
      useVisualStore.getState().setShaderType('wireframe');
      const { container } = render(<LightingControls />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('show gizmos toggle', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
    });

    it('should render show gizmos toggle', () => {
      render(<LightingControls />);
      expect(screen.getByText('Show Gizmos')).toBeInTheDocument();
    });

    it('should toggle gizmos visibility', async () => {
      const user = userEvent.setup();
      render(<LightingControls />);

      const switchInput = screen.getByRole('switch');
      const initialState = useVisualStore.getState().showLightGizmos;

      await user.click(switchInput);
      expect(useVisualStore.getState().showLightGizmos).toBe(!initialState);
    });
  });

  describe('ambient light section', () => {
    beforeEach(() => {
      useVisualStore.getState().setShaderType('surface');
    });

    it('should render ambient light section', () => {
      render(<LightingControls />);
      expect(screen.getByText('Ambient Light')).toBeInTheDocument();
      expect(screen.getByText('Intensity')).toBeInTheDocument();
    });

    it('should update ambient intensity', () => {
      render(<LightingControls />);
      const slider = screen.getByLabelText('Intensity') as HTMLInputElement;

      fireEvent.change(slider, { target: { value: '0.5' } });
      expect(useVisualStore.getState().ambientIntensity).toBe(0.5);
    });

    it('should render ambient color picker', () => {
      render(<LightingControls />);
      expect(screen.getByText('Color')).toBeInTheDocument();
      const colorInput = document.querySelector('input[type="color"]');
      expect(colorInput).toBeInTheDocument();
    });

    it('should update ambient color', () => {
      render(<LightingControls />);
      const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;

      fireEvent.change(colorInput, { target: { value: '#ff0000' } });
      expect(useVisualStore.getState().ambientColor).toBe('#ff0000');
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

    it('should apply default space-y-4 className', () => {
      const { container } = render(<LightingControls />);
      const wrapper = container.querySelector('.space-y-4');
      expect(wrapper).toBeInTheDocument();
    });
  });
});

describe('LightList', () => {
  beforeEach(() => {
    useVisualStore.getState().reset();
    useVisualStore.getState().setShaderType('surface');
  });

  describe('default state', () => {
    it('should show default light from store', () => {
      render(<LightList />);
      // Store starts with 1 default light
      expect(screen.getByText('1 / 4 lights')).toBeInTheDocument();
    });

    it('should display the default light name', () => {
      render(<LightList />);
      // Default light is named "Main Light"
      expect(screen.getByText('Main Light')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      // Remove all lights to test empty state (use while loop to avoid iteration issues)
      while (useVisualStore.getState().lights.length > 0) {
        const firstLight = useVisualStore.getState().lights[0];
        if (firstLight) {
          useVisualStore.getState().removeLight(firstLight.id);
        }
      }
    });

    it('should show empty message when no lights', () => {
      render(<LightList />);
      expect(screen.getByText('No lights. Add one below.')).toBeInTheDocument();
    });

    it('should show light count as 0/4', () => {
      render(<LightList />);
      expect(screen.getByText('0 / 4 lights')).toBeInTheDocument();
    });
  });

  describe('adding lights', () => {
    it('should show add light button', () => {
      render(<LightList />);
      expect(screen.getByText('Add Light')).toBeInTheDocument();
    });

    it('should show dropdown options when add button clicked', async () => {
      const user = userEvent.setup();
      render(<LightList />);

      await user.click(screen.getByText('Add Light'));

      expect(screen.getByText('Point Light')).toBeInTheDocument();
      expect(screen.getByText('Directional Light')).toBeInTheDocument();
      expect(screen.getByText('Spot Light')).toBeInTheDocument();
    });

    it('should add point light when selected', async () => {
      const user = userEvent.setup();
      const initialCount = useVisualStore.getState().lights.length;
      render(<LightList />);

      await user.click(screen.getByText('Add Light'));
      await user.click(screen.getByText('Point Light'));

      expect(useVisualStore.getState().lights.length).toBe(initialCount + 1);
      // Newest light is the last one
      const lights = useVisualStore.getState().lights;
      const newestLight = lights[lights.length - 1];
      expect(newestLight?.type).toBe('point');
    });

    it('should add directional light when selected', async () => {
      const user = userEvent.setup();
      const initialCount = useVisualStore.getState().lights.length;
      render(<LightList />);

      await user.click(screen.getByText('Add Light'));
      await user.click(screen.getByText('Directional Light'));

      expect(useVisualStore.getState().lights.length).toBe(initialCount + 1);
      const lights = useVisualStore.getState().lights;
      const newestLight = lights[lights.length - 1];
      expect(newestLight?.type).toBe('directional');
    });

    it('should add spot light when selected', async () => {
      const user = userEvent.setup();
      const initialCount = useVisualStore.getState().lights.length;
      render(<LightList />);

      await user.click(screen.getByText('Add Light'));
      await user.click(screen.getByText('Spot Light'));

      expect(useVisualStore.getState().lights.length).toBe(initialCount + 1);
      const lights = useVisualStore.getState().lights;
      const newestLight = lights[lights.length - 1];
      expect(newestLight?.type).toBe('spot');
    });

    it('should disable add button when 4 lights exist', () => {
      // Add lights until we have 4 (accounting for default)
      while (useVisualStore.getState().lights.length < 4) {
        useVisualStore.getState().addLight('point');
      }

      render(<LightList />);

      const addButton = screen.getByText('Max 4 lights');
      expect(addButton).toBeInTheDocument();
      expect(addButton.closest('button')).toBeDisabled();
    });
  });

  describe('light count', () => {
    it('should update count when lights added', () => {
      // Start with default light count
      const initialCount = useVisualStore.getState().lights.length;
      useVisualStore.getState().addLight('point');
      useVisualStore.getState().addLight('directional');

      render(<LightList />);
      expect(screen.getByText(`${initialCount + 2} / 4 lights`)).toBeInTheDocument();
    });
  });
});

describe('LightListItem', () => {
  const mockLight: LightSource = {
    id: 'test-light',
    name: 'Test Light',
    type: 'point',
    enabled: true,
    position: [0, 5, 0],
    rotation: [0, 0, 0],
    color: '#FF0000',
    intensity: 1.0,
    coneAngle: 30,
    penumbra: 0.5,
  };

  const mockHandlers = {
    onSelect: () => {},
    onToggle: () => {},
    onRemove: () => {},
  };

  it('should display light name', () => {
    render(
      <LightListItem
        light={mockLight}
        isSelected={false}
        {...mockHandlers}
      />
    );
    expect(screen.getByText('Test Light')).toBeInTheDocument();
  });

  it('should have selected styling when isSelected is true', () => {
    const { container } = render(
      <LightListItem
        light={mockLight}
        isSelected={true}
        {...mockHandlers}
      />
    );
    expect(container.querySelector('.bg-accent\\/20')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', async () => {
    const user = userEvent.setup();
    let selectCalled = false;
    render(
      <LightListItem
        light={mockLight}
        isSelected={false}
        onSelect={() => { selectCalled = true; }}
        onToggle={() => {}}
        onRemove={() => {}}
      />
    );

    await user.click(screen.getByText('Test Light'));
    expect(selectCalled).toBe(true);
  });

  it('should call onToggle when toggle button clicked', async () => {
    const user = userEvent.setup();
    let toggleCalled = false;
    render(
      <LightListItem
        light={mockLight}
        isSelected={false}
        onSelect={() => {}}
        onToggle={() => { toggleCalled = true; }}
        onRemove={() => {}}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /disable light/i });
    await user.click(toggleButton);
    expect(toggleCalled).toBe(true);
  });

  it('should call onRemove when delete button clicked', async () => {
    const user = userEvent.setup();
    let removeCalled = false;
    render(
      <LightListItem
        light={mockLight}
        isSelected={false}
        onSelect={() => {}}
        onToggle={() => {}}
        onRemove={() => { removeCalled = true; }}
      />
    );

    const removeButton = screen.getByRole('button', { name: /remove light/i });
    await user.click(removeButton);
    expect(removeCalled).toBe(true);
  });

  it('should show disabled styling when light is disabled', () => {
    const disabledLight = { ...mockLight, enabled: false };
    render(
      <LightListItem
        light={disabledLight}
        isSelected={false}
        {...mockHandlers}
      />
    );
    // Light name should have text-text-secondary when disabled
    const nameElement = screen.getByText('Test Light');
    expect(nameElement.className).toContain('text-text-secondary');
  });
});

describe('LightEditor', () => {
  beforeEach(() => {
    useVisualStore.getState().reset();
    useVisualStore.getState().setShaderType('surface');
  });

  describe('empty state', () => {
    it('should show placeholder when no light selected', () => {
      render(<LightEditor />);
      expect(screen.getByText('Select a light to edit')).toBeInTheDocument();
    });
  });

  describe('with selected light', () => {
    beforeEach(() => {
      const lightId = useVisualStore.getState().addLight('point');
      if (lightId) {
        useVisualStore.getState().selectLight(lightId);
      }
    });

    it('should display light name input', () => {
      render(<LightEditor />);
      const nameInput = screen.getByLabelText('Light name');
      expect(nameInput).toBeInTheDocument();
    });

    it('should display type selector', () => {
      render(<LightEditor />);
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    it('should display enable toggle', () => {
      render(<LightEditor />);
      expect(screen.getByRole('button', { name: /enable light|disable light/i })).toBeInTheDocument();
    });

    it('should display color picker', () => {
      render(<LightEditor />);
      expect(screen.getByText('Color')).toBeInTheDocument();
    });

    it('should display intensity slider', () => {
      render(<LightEditor />);
      expect(screen.getByText('Intensity')).toBeInTheDocument();
    });

    it('should display position inputs', () => {
      render(<LightEditor />);
      expect(screen.getByText('Position')).toBeInTheDocument();
    });

    it('should display transform mode toggles', () => {
      render(<LightEditor />);
      expect(screen.getByText('Move (W)')).toBeInTheDocument();
      expect(screen.getByText('Rotate (E)')).toBeInTheDocument();
    });

    it('should update light name when changed', async () => {
      const user = userEvent.setup();
      render(<LightEditor />);

      const nameInput = screen.getByLabelText('Light name') as HTMLInputElement;
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      const selectedId = useVisualStore.getState().selectedLightId;
      const light = useVisualStore.getState().lights.find(l => l.id === selectedId);
      expect(light?.name).toBe('New Name');
    });

    it('should toggle light enabled state', async () => {
      const user = userEvent.setup();
      render(<LightEditor />);

      const toggleButton = screen.getByRole('button', { name: /enable light|disable light/i });
      const selectedId = useVisualStore.getState().selectedLightId;
      const initialEnabled = useVisualStore.getState().lights.find(l => l.id === selectedId)?.enabled;

      await user.click(toggleButton);

      const updatedEnabled = useVisualStore.getState().lights.find(l => l.id === selectedId)?.enabled;
      expect(updatedEnabled).toBe(!initialEnabled);
    });

    it('should update intensity when slider changed', () => {
      render(<LightEditor />);
      const slider = screen.getByLabelText('Intensity') as HTMLInputElement;

      fireEvent.change(slider, { target: { value: '2.0' } });

      const selectedId = useVisualStore.getState().selectedLightId;
      const light = useVisualStore.getState().lights.find(l => l.id === selectedId);
      expect(light?.intensity).toBe(2.0);
    });

    it('should switch transform mode to rotate', async () => {
      const user = userEvent.setup();
      render(<LightEditor />);

      await user.click(screen.getByText('Rotate (E)'));
      expect(useVisualStore.getState().transformMode).toBe('rotate');
    });

    it('should switch transform mode to translate', async () => {
      const user = userEvent.setup();
      useVisualStore.getState().setTransformMode('rotate');
      render(<LightEditor />);

      await user.click(screen.getByText('Move (W)'));
      expect(useVisualStore.getState().transformMode).toBe('translate');
    });
  });

  describe('spot light specific controls', () => {
    beforeEach(() => {
      const lightId = useVisualStore.getState().addLight('spot');
      if (lightId) {
        useVisualStore.getState().selectLight(lightId);
      }
    });

    it('should display cone angle slider for spot light', () => {
      render(<LightEditor />);
      expect(screen.getByText('Cone Angle')).toBeInTheDocument();
    });

    it('should display penumbra slider for spot light', () => {
      render(<LightEditor />);
      expect(screen.getByText('Penumbra')).toBeInTheDocument();
    });

    it('should display rotation inputs for spot light', () => {
      render(<LightEditor />);
      expect(screen.getByText('Rotation')).toBeInTheDocument();
    });
  });

  describe('directional light specific controls', () => {
    beforeEach(() => {
      const lightId = useVisualStore.getState().addLight('directional');
      if (lightId) {
        useVisualStore.getState().selectLight(lightId);
      }
    });

    it('should display rotation inputs for directional light', () => {
      render(<LightEditor />);
      expect(screen.getByText('Rotation')).toBeInTheDocument();
    });

    it('should not display cone angle for directional light', () => {
      render(<LightEditor />);
      expect(screen.queryByText('Cone Angle')).not.toBeInTheDocument();
    });
  });

  describe('point light specific controls', () => {
    beforeEach(() => {
      const lightId = useVisualStore.getState().addLight('point');
      if (lightId) {
        useVisualStore.getState().selectLight(lightId);
      }
    });

    it('should not display rotation inputs for point light', () => {
      render(<LightEditor />);
      expect(screen.queryByText('Rotation')).not.toBeInTheDocument();
    });

    it('should not display cone angle for point light', () => {
      render(<LightEditor />);
      expect(screen.queryByText('Cone Angle')).not.toBeInTheDocument();
    });
  });
});

describe('Vector3Input', () => {
  it('should display label', () => {
    render(
      <Vector3Input
        label="Position"
        value={[1, 2, 3]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText('Position')).toBeInTheDocument();
  });

  it('should display X, Y, Z labels', () => {
    render(
      <Vector3Input
        label="Position"
        value={[1, 2, 3]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('should display current values', () => {
    render(
      <Vector3Input
        label="Position"
        value={[1.5, 2.5, 3.5]}
        onChange={() => {}}
      />
    );

    const xInput = screen.getByLabelText('Position X') as HTMLInputElement;
    const yInput = screen.getByLabelText('Position Y') as HTMLInputElement;
    const zInput = screen.getByLabelText('Position Z') as HTMLInputElement;

    expect(xInput.value).toBe('1.5');
    expect(yInput.value).toBe('2.5');
    expect(zInput.value).toBe('3.5');
  });

  it('should call onChange when X value changed', () => {
    let newValue: [number, number, number] | null = null;
    render(
      <Vector3Input
        label="Position"
        value={[1, 2, 3]}
        onChange={(v) => { newValue = v; }}
      />
    );

    const xInput = screen.getByLabelText('Position X');
    fireEvent.change(xInput, { target: { value: '5' } });

    expect(newValue).toEqual([5, 2, 3]);
  });

  it('should apply displayMultiplier', () => {
    const RAD_TO_DEG = 180 / Math.PI;
    render(
      <Vector3Input
        label="Rotation"
        value={[Math.PI / 2, 0, 0]}
        onChange={() => {}}
        displayMultiplier={RAD_TO_DEG}
        unit="deg"
      />
    );

    const xInput = screen.getByLabelText('Rotation X') as HTMLInputElement;
    // PI/2 * (180/PI) = 90
    expect(parseFloat(xInput.value)).toBeCloseTo(90, 0);
  });

  it('should display unit when provided', () => {
    render(
      <Vector3Input
        label="Rotation"
        value={[0, 0, 0]}
        onChange={() => {}}
        unit="deg"
      />
    );
    expect(screen.getByText('(deg)')).toBeInTheDocument();
  });
});
