/**
 * Share Button Component
 * Button for generating and copying a shareable URL
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { generateShareUrl } from '@/lib/url';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';
import { useVisualStore } from '@/stores/visualStore';

export interface ShareButtonProps {
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ className = '' }) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const rotations = useRotationStore((state) => state.rotations);
  const projectionDistance = useProjectionStore((state) => state.distance);
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const isPlaying = useAnimationStore((state) => state.isPlaying);
  const speed = useAnimationStore((state) => state.speed);

  // Visual settings (PRD Story 1 AC6, Story 7 AC7)
  const shaderType = useVisualStore((state) => state.shaderType);
  const shaderSettings = useVisualStore((state) => state.shaderSettings);
  const edgeColor = useVisualStore((state) => state.edgeColor);
  const vertexColor = useVisualStore((state) => state.vertexColor);
  const backgroundColor = useVisualStore((state) => state.backgroundColor);
  const bloomEnabled = useVisualStore((state) => state.bloomEnabled);
  const bloomIntensity = useVisualStore((state) => state.bloomIntensity);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleShare = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const url = generateShareUrl({
      dimension,
      objectType,
      rotationAngles: rotations,
      projectionDistance,
      uniformScale,
      isPlaying,
      speed,
      // Visual settings
      shaderType,
      shaderSettings,
      edgeColor,
      vertexColor,
      backgroundColor,
      bloomEnabled,
      bloomIntensity,
    });

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleShare}
        className="w-full"
      >
        {copied ? 'Copied!' : 'Share URL'}
      </Button>

      {copied && (
        <p className="text-xs text-accent-cyan">Link copied to clipboard</p>
      )}
    </div>
  );
};
