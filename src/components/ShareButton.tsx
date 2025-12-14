/**
 * Share Button Component
 * Button for generating and copying a shareable URL
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { generateShareUrl } from '@/lib/url';
import { useGeometryStore } from '@/stores/geometryStore';
import { useTransformStore } from '@/stores/transformStore';
import { useVisualStore } from '@/stores/visualStore';

export interface ShareButtonProps {
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ className = '' }) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const uniformScale = useTransformStore((state) => state.uniformScale);

  // Visual settings (PRD Story 1 AC6, Story 7 AC7)
  const shaderType = useVisualStore((state) => state.shaderType);
  const shaderSettings = useVisualStore((state) => state.shaderSettings);
  const edgeColor = useVisualStore((state) => state.edgeColor);
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
      uniformScale,
      // Visual settings
      shaderType,
      shaderSettings,
      edgeColor,
      backgroundColor,
      bloomEnabled,
      bloomIntensity,
    });

    try {
      // Modern Clipboard API (supported by all modern browsers)
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Clipboard API failed (e.g., no permission, insecure context)
      // Log error and provide user feedback
      console.warn('Clipboard API failed:', error);
      // Since Clipboard API has 95%+ support, provide manual copy fallback
      window.prompt('Copy this URL to share:', url);
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
        <p className="text-xs text-accent">Link copied to clipboard</p>
      )}
    </div>
  );
};
