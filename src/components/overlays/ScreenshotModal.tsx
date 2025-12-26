import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { soundManager } from '@/lib/audio/SoundManager';
import { useScreenshotStore } from '@/stores/screenshotStore';
import { useState } from 'react';
import { ImageCropper } from './ImageCropper';

export const ScreenshotModal = () => {
  const { isOpen, imageSrc, crop, closeModal, reset, setCrop } = useScreenshotStore();
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !imageSrc) return null;

  /**
   * Generate the final cropped image as a Blob.
   * Falls back to full image if crop is null or invalid.
   * @returns Promise resolving to the image blob or null on failure
   */
  const generateOutput = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Determine crop area - use full image if crop is invalid
        const useCrop = crop && crop.width > 0 && crop.height > 0;

        if (useCrop) {
          canvas.width = crop.width;
          canvas.height = crop.height;
          ctx.drawImage(
            img,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height
          );
        } else {
          // Fallback: use full image
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
        }

        canvas.toBlob((blob) => resolve(blob), 'image/png');
      };

      img.onerror = () => {
        console.error('Failed to load image for export');
        resolve(null);
      };

      img.src = imageSrc;
    });
  };

  const handleCopy = async () => {
    try {
      const blob = await generateOutput();
      if (!blob) throw new Error('Failed to process image');

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      addToast('Copied screenshot to clipboard!', 'success');
      soundManager.playSuccess();
      closeModal();
      setTimeout(reset, 300);
    } catch (err) {
      console.error(err);
      addToast('Failed to copy. ' + (err instanceof Error ? err.message : ''), 'error');
    }
  };

  /**
   * Download the image using a universal approach that works in ALL browsers.
   * Uses the standard download link method which is supported everywhere.
   */
  const handleDownload = async () => {
    setIsSaving(true);
    try {
      const blob = await generateOutput();
      if (!blob) throw new Error('Failed to process image');

      const filename = `mdimension-${Date.now()}.png`;

      // Universal download method that works in ALL browsers
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup after a short delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      addToast('Screenshot downloaded!', 'success');
      soundManager.playSuccess();
      closeModal();
      setTimeout(reset, 300);
    } catch (err) {
      console.error(err);
      addToast('Failed to save image.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Screenshot Preview"
      width="max-w-5xl"
      data-testid="screenshot-modal"
    >
      <div className="flex flex-col gap-4 h-[70vh]" data-testid="screenshot-modal-content">
        {/* Editor Area */}
        <div className="flex-1 relative rounded-lg overflow-hidden bg-black border border-white/10">
          <ImageCropper imageSrc={imageSrc} onCropChange={setCrop} />
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-text-tertiary" data-testid="crop-dimensions">
            Drag corners to crop. Click and drag box to move.
            {crop && crop.width > 0 && crop.height > 0 && (
              <span className="ml-2 font-mono text-text-secondary" data-testid="crop-size-display">
                {crop.width} &times; {crop.height} px
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleCopy}
              size="lg"
              data-testid="screenshot-copy-button"
            >
              <Icon name="copy" className="mr-2" />
              Copy to Clipboard
            </Button>
            <Button
              variant="primary"
              onClick={handleDownload}
              loading={isSaving}
              size="lg"
              glow
              data-testid="screenshot-save-button"
            >
              <Icon name="download" className="mr-2" />
              Save Image
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
