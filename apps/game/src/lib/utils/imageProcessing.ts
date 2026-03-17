/**
 * imageProcessing.ts - Canvas-based image cropping utilities
 */

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a cropped image blob from source image and crop coordinates
 *
 * @param imageSrc - Data URL or blob URL of the source image
 * @param croppedAreaPixels - Pixel coordinates of the crop area from react-easy-crop
 * @param targetSize - Target output size in pixels (default: 1024 for 1024x1024)
 * @returns Promise that resolves to JPEG blob
 */
export async function getCroppedImage(
  imageSrc: string,
  croppedAreaPixels: Area,
  targetSize: number = 1024
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      try {
        // Pre-process very large images to avoid OOM
        const maxSourceSize = 4096;
        let sourceWidth = image.naturalWidth;
        let sourceHeight = image.naturalHeight;
        let scaleFactor = 1;

        if (sourceWidth > maxSourceSize || sourceHeight > maxSourceSize) {
          scaleFactor = Math.min(maxSourceSize / sourceWidth, maxSourceSize / sourceHeight);
          sourceWidth = Math.floor(sourceWidth * scaleFactor);
          sourceHeight = Math.floor(sourceHeight * scaleFactor);
        }

        // Create canvas at target resolution
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas 2D context not supported'));
          return;
        }

        canvas.width = targetSize;
        canvas.height = targetSize;

        // Scale crop coordinates if image was pre-processed
        const scaledCrop = {
          x: croppedAreaPixels.x * scaleFactor,
          y: croppedAreaPixels.y * scaleFactor,
          width: croppedAreaPixels.width * scaleFactor,
          height: croppedAreaPixels.height * scaleFactor,
        };

        // Draw cropped and resized image
        ctx.drawImage(
          image,
          scaledCrop.x,
          scaledCrop.y,
          scaledCrop.width,
          scaledCrop.height,
          0,
          0,
          targetSize,
          targetSize
        );

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to blob conversion failed'));
            }
          },
          'image/jpeg',
          0.9 // Quality: 90%
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Image processing failed'));
      }
    };

    image.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image
    image.src = imageSrc;
  });
}

/**
 * Converts a File object to a data URL
 *
 * @param file - File object to convert
 * @returns Promise that resolves to data URL string
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader result is not a string'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}
