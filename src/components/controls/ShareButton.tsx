/**
 * Share Button Component
 * Button for generating and copying a shareable URL
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { generateShareUrl } from '@/lib/url';
import { useGeometryStore } from '@/stores/geometryStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { InputModal } from '@/components/ui/InputModal';

export interface ShareButtonProps {
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ className = '' }) => {
  const [copied, setCopied] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const uniformScale = useTransformStore((state) => state.uniformScale);

  // Visual settings (PRD Story 1 AC6, Story 7 AC7)
  const shaderType = useAppearanceStore((state) => state.shaderType);
  const shaderSettings = useAppearanceStore((state) => state.shaderSettings);
  const edgeColor = useAppearanceStore((state) => state.edgeColor);
  const backgroundColor = useAppearanceStore((state) => state.backgroundColor);
  const bloomEnabled = usePostProcessingStore((state) => state.bloomEnabled);
  const bloomIntensity = usePostProcessingStore((state) => state.bloomIntensity);

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
      setShareUrl(url);
      setFallbackOpen(true);
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

      <InputModal
        isOpen={fallbackOpen}
        onClose={() => setFallbackOpen(false)}
        onConfirm={() => {}} 
        title="Share Link"
        message="Copy this URL to share your scene:"
        initialValue={shareUrl}
        readOnly
        confirmText="Close"
        cancelText="Close"
      />
    </div>
  );
};
