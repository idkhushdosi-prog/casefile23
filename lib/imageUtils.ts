import { sha256Hex } from '@/lib/crypto';

export interface ProcessedImageResult {
  file: Blob;
  previewDataUrl: string;
  width: number;
  height: number;
  isLowRes: boolean;
  sha256: string;
  mimeType: string;
  ext: string;
}

/**
 * Strips all EXIF metadata (including GPS coordinates) by redrawing the image onto
 * an HTML Canvas at full original dimensions (respecting browser EXIF orientation
 * via createImageBitmap({ imageOrientation: 'from-image' }) or Image decode),
 * while generating a lightweight thumbnail preview for the UI.
 */
export async function stripExifAndMeasure(
  input: Blob | File,
  options?: { grayscaleContrast?: boolean }
): Promise<ProcessedImageResult> {
  const url = URL.createObjectURL(input);
  try {
    let width = 0;
    let height = 0;
    let drawSource: CanvasImageSource;
    let cleanupBitmap: (() => void) | null = null;

    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(input, {
          imageOrientation: 'from-image',
        });
        width = bitmap.width;
        height = bitmap.height;
        drawSource = bitmap;
        cleanupBitmap = () => bitmap.close();
      } catch {
        const img = await loadHtmlImage(url);
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        drawSource = img;
      }
    } else {
      const img = await loadHtmlImage(url);
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      drawSource = img;
    }

    // Full-resolution canvas to strip EXIF GPS/camera metadata without downsizing
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize canvas context for EXIF stripping.');
    }

    if (options?.grayscaleContrast) {
      ctx.filter = 'grayscale(100%) contrast(130%) brightness(98%)';
    }
    ctx.drawImage(drawSource, 0, 0, width, height);
    if (cleanupBitmap) cleanupBitmap();

    const targetMime =
      input.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = targetMime === 'image/jpeg' ? 0.95 : undefined;

    const cleanBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to export clean image blob.'));
        },
        targetMime,
        quality
      );
    });

    // Small preview thumbnail (max 420px) for fast UI display
    const previewMax = 420;
    const scale = Math.min(1, previewMax / Math.max(width, height));
    const pCanvas = document.createElement('canvas');
    pCanvas.width = Math.max(1, Math.round(width * scale));
    pCanvas.height = Math.max(1, Math.round(height * scale));
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      pCtx.drawImage(canvas, 0, 0, pCanvas.width, pCanvas.height);
    }
    const previewDataUrl = pCanvas.toDataURL('image/jpeg', 0.78);

    const buf = await cleanBlob.arrayBuffer();
    const sha256 = await sha256Hex(buf);
    const shortSide = Math.min(width, height);

    return {
      file: cleanBlob,
      previewDataUrl,
      width,
      height,
      isLowRes: shortSide < 1000,
      sha256,
      mimeType: targetMime,
      ext: targetMime === 'image/png' ? 'png' : 'jpg',
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to decode image file.'));
    img.src = src;
  });
}
