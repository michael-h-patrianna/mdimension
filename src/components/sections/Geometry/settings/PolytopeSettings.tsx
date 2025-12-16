import { Slider } from '@/components/ui/Slider';
import {
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_POLYTOPE_SCALES,
} from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

/**
 * Polytope settings controls.
 *
 * Provides scale control for standard polytopes (hypercube, simplex, cross-polytope).
 * This brings polytopes into alignment with extended objects by providing
 * a unified configuration interface.
 */
export function PolytopeSettings() {
  const objectType = useGeometryStore((state) => state.objectType);
  const config = useExtendedObjectStore((state) => state.polytope);
  const setScale = useExtendedObjectStore((state) => state.setPolytopeScale);

  // Get display name for the polytope type
  const typeNames: Record<string, string> = {
    'hypercube': 'Hypercube',
    'simplex': 'Simplex',
    'cross-polytope': 'Cross-Polytope',
  };
  const typeName = typeNames[objectType] ?? 'Polytope';

  // Get type-specific default scale
  const defaultScale = DEFAULT_POLYTOPE_SCALES[objectType] ?? DEFAULT_POLYTOPE_CONFIG.scale;

  // Simplex needs a larger range due to its default of 4.0
  const maxScale = objectType === 'simplex' ? 8.0 : 5.0;

  return (
    <div className="space-y-4" data-testid="polytope-settings">
      {/* Scale slider with type-specific range */}
      <Slider
        label={`${typeName} Scale`}
        min={0.5}
        max={maxScale}
        step={0.1}
        value={config.scale}
        onChange={setScale}
        onReset={() => setScale(defaultScale)}
        showValue
        data-testid="polytope-scale"
      />
      <p className="text-xs text-text-secondary">
        Vertices in [-scale, scale] per axis.
      </p>
    </div>
  );
}
