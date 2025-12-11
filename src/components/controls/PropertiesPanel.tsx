/**
 * Properties Panel Component
 * Displays information about the current polytope
 */

import React, { useMemo, useState } from 'react';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { generatePolytope, getPolytopeProperties, getAvailableTypes } from '@/lib/geometry';

export interface PropertiesPanelProps {
  className?: string;
}

/** Axis names for each dimension */
const AXIS_NAMES = ['X', 'Y', 'Z', 'W', 'V', 'U'];

/** Dimension names */
const DIMENSION_NAMES: Record<number, string> = {
  3: '3D (Cube)',
  4: '4D (Tesseract)',
  5: '5D (Penteract)',
  6: '6D (Hexeract)',
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  className = '',
}) => {
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const rotations = useRotationStore((state) => state.rotations);

  const [showVertices, setShowVertices] = useState(false);

  // Get type info
  const typeInfo = useMemo(() => {
    const types = getAvailableTypes();
    return types.find((t) => t.type === objectType);
  }, [objectType]);

  // Generate geometry and get properties
  const { geometry, properties } = useMemo(() => {
    const geom = generatePolytope(objectType, dimension);
    const props = getPolytopeProperties(geom);
    return { geometry: geom, properties: props };
  }, [objectType, dimension]);

  // Get active rotations
  const activeRotations = useMemo(() => {
    const active: { plane: string; degrees: number }[] = [];
    for (const [plane, radians] of rotations.entries()) {
      if (Math.abs(radians) > 0.001) {
        active.push({
          plane,
          degrees: Math.round((radians * 180) / Math.PI),
        });
      }
    }
    return active;
  }, [rotations]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Object Info */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Object</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-text-secondary">Type:</span>
          <span className="text-text-primary">{typeInfo?.name ?? objectType}</span>

          <span className="text-text-secondary">Dimension:</span>
          <span className="text-text-primary">{DIMENSION_NAMES[dimension] ?? `${dimension}D`}</span>
        </div>
        <p className="text-xs text-text-secondary italic">
          {typeInfo?.description}
        </p>
      </div>

      {/* Vertex & Edge Counts */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Counts</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-text-secondary">Vertices:</span>
          <span className="text-text-primary">
            {properties.vertexCount}
            <span className="text-xs text-text-secondary ml-1">({properties.vertexFormula})</span>
          </span>

          <span className="text-text-secondary">Edges:</span>
          <span className="text-text-primary">
            {properties.edgeCount}
            <span className="text-xs text-text-secondary ml-1">({properties.edgeFormula})</span>
          </span>

          <span className="text-text-secondary">Rotation planes:</span>
          <span className="text-text-primary">{(dimension * (dimension - 1)) / 2}</span>
        </div>
      </div>

      {/* Active Rotations */}
      {activeRotations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Active Rotations</h3>
          <div className="flex flex-wrap gap-1">
            {activeRotations.map(({ plane, degrees }) => (
              <span
                key={plane}
                className="px-2 py-0.5 text-xs bg-accent-cyan/20 text-accent-cyan rounded"
              >
                {plane}: {degrees}°
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Vertex Coordinates */}
      <div className="space-y-2">
        <button
          onClick={() => setShowVertices(!showVertices)}
          className="flex items-center gap-2 text-sm font-semibold text-text-primary hover:text-accent-cyan transition-colors"
        >
          <span>{showVertices ? '▼' : '▶'}</span>
          <span>Vertex Coordinates ({geometry.vertices.length})</span>
        </button>

        {showVertices && (
          <div className="max-h-48 overflow-y-auto bg-app-bg rounded-md p-2 text-xs font-mono">
            <table className="w-full">
              <thead>
                <tr className="text-text-secondary">
                  <th className="text-left w-8">#</th>
                  {AXIS_NAMES.slice(0, dimension).map((axis) => (
                    <th key={axis} className="text-right px-2">{axis}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {geometry.vertices.map((vertex, i) => (
                  <tr key={i} className="text-text-primary hover:bg-panel-border/50">
                    <td className="text-text-secondary">{i}</td>
                    {vertex.map((coord, j) => (
                      <td key={j} className="text-right px-2">
                        {coord.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
