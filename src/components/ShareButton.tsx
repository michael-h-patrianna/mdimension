/**
 * Share Button Component
 * Button for generating and copying a shareable URL
 */

import React, { useState } from 'react';
import { Button } from './ui/Button';
import { generateShareUrl } from '@/lib/url';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';

export interface ShareButtonProps {
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ className = '' }) => {
  const [copied, setCopied] = useState(false);

  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const rotations = useRotationStore((state) => state.rotations);
  const projectionDistance = useProjectionStore((state) => state.distance);
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const isPlaying = useAnimationStore((state) => state.isPlaying);
  const speed = useAnimationStore((state) => state.speed);

  const handleShare = async () => {
    const url = generateShareUrl({
      dimension,
      objectType,
      rotationAngles: rotations,
      projectionDistance,
      uniformScale,
      isPlaying,
      speed,
    });

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
