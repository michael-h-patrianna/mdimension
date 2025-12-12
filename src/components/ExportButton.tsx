/**
 * Export Button Component
 * Button for exporting the visualization as PNG
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { exportSceneToPNG, generateTimestampFilename } from '@/lib/export';

export interface ExportButtonProps {
  className?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  className = '',
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleExport = async () => {
    setIsExporting(true);

    // Small delay to ensure UI updates
    await new Promise((resolve) => setTimeout(resolve, 50));

    const filename = generateTimestampFilename('ndimensional');
    const success = exportSceneToPNG({ filename });

    if (success) {
      setLastExport(filename);
      // Clear the success message after 3 seconds
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setLastExport(null), 3000);
    }

    setIsExporting(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
        className="w-full"
      >
        {isExporting ? 'Exporting...' : '📷 Export PNG'}
      </Button>

      {lastExport && (
        <p className="text-xs text-accent-cyan">
          Saved: {lastExport}.png
        </p>
      )}
    </div>
  );
};
