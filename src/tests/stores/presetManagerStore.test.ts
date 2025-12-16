import { describe, it, expect, beforeEach } from 'vitest';
import { usePresetManagerStore } from '@/stores/presetManagerStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useAnimationStore } from '@/stores/animationStore';

describe('presetManagerStore', () => {
  beforeEach(() => {
    usePresetManagerStore.setState({ savedStyles: [], savedScenes: [] });
    useAppearanceStore.setState({ edgeColor: '#ffffff' }); // Reset defaults
    useAnimationStore.getState().reset();
  });

  it('should save and load a style', () => {
    // Setup initial state
    useAppearanceStore.setState({ edgeColor: '#ff0000' });
    
    // Save style
    usePresetManagerStore.getState().saveStyle('Red Edge');
    
    // Check it's saved
    const savedStyles = usePresetManagerStore.getState().savedStyles;
    expect(savedStyles).toHaveLength(1);
    const firstStyle = savedStyles[0];
    expect(firstStyle).toBeDefined();
    expect(firstStyle?.name).toBe('Red Edge');
    expect(firstStyle?.data.appearance.edgeColor).toBe('#ff0000');

    // Change state
    useAppearanceStore.setState({ edgeColor: '#00ff00' });

    // Load style
    usePresetManagerStore.getState().loadStyle(firstStyle!.id);
    
    // Check it's restored
    expect(useAppearanceStore.getState().edgeColor).toBe('#ff0000');
  });

  it('should save and load a scene with animation', () => {
     // Setup animation state
     const animStore = useAnimationStore.getState();
     animStore.setSpeed(2.0);
     
     // Save scene
     usePresetManagerStore.getState().saveScene('Fast Scene');
     
     // Check saved
     const savedScenes = usePresetManagerStore.getState().savedScenes;
     expect(savedScenes).toHaveLength(1);
     const firstScene = savedScenes[0];
     expect(firstScene).toBeDefined();
     expect(firstScene?.data.animation.speed).toBe(2.0);

     // Check Set -> Array conversion
     expect(Array.isArray(firstScene?.data.animation.animatingPlanes)).toBe(true);

     // Change state
     animStore.setSpeed(0.5);

     // Load scene
     usePresetManagerStore.getState().loadScene(firstScene!.id);
     
     // Check restored
     expect(useAnimationStore.getState().speed).toBe(2.0);
     expect(useAnimationStore.getState().animatingPlanes).toBeInstanceOf(Set);
  });

  it('should import and export styles', () => {
    const mockStyle = {
      id: 'test-id',
      name: 'Imported Style',
      timestamp: 123,
      data: { appearance: { edgeColor: '#0000ff' } } // simplified
    };
    
    const json = JSON.stringify([mockStyle]);
    
    const result = usePresetManagerStore.getState().importStyles(json);
    expect(result).toBe(true);
    
    const savedStyles = usePresetManagerStore.getState().savedStyles;
    expect(savedStyles).toHaveLength(1);
    expect(savedStyles[0]?.name).toBe('Imported Style');
    
    const exported = usePresetManagerStore.getState().exportStyles();
    expect(JSON.parse(exported)).toHaveLength(1);
  });
});
