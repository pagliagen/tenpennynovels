/**
 * Image processing service - Sharp-based resize, conversion, thumbnails
 */
import sharp from 'sharp';
import { generateFileHash, generateFilename } from '../utils/hash';

const IMAGE_MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH || '1920', 10);
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY || '85', 10);
const THUMBNAIL_SIZE = parseInt(process.env.THUMBNAIL_SIZE || '300', 10);
const THUMBNAIL_QUALITY = parseInt(process.env.THUMBNAIL_QUALITY || '80', 10);

export interface ProcessedImage {
  buffer: Buffer;
  filename: string;
  hash: string;
}

export interface ProcessingResult {
  success: boolean;
  main?: ProcessedImage;
  thumbnail?: ProcessedImage;
  error?: string;
}

/**
 * Process uploaded image:
 * 1. Resize to max width (maintain aspect ratio)
 * 2. Convert to WebP
 * 3. Generate thumbnail (square crop)
 */
export async function processImage(
  inputBuffer: Buffer,
  type: string
): Promise<ProcessingResult> {
  try {
    // Generate hash from original buffer (before processing)
    const hash = generateFileHash(inputBuffer);

    // Process main image
    const mainBuffer = await sharp(inputBuffer)
      .resize(IMAGE_MAX_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true // Don't upscale small images
      })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();

    // Process thumbnail (square crop from center)
    const thumbnailBuffer = await sharp(inputBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    return {
      success: true,
      main: {
        buffer: mainBuffer,
        filename: generateFilename(type, hash, 'webp'),
        hash
      },
      thumbnail: {
        buffer: thumbnailBuffer,
        filename: generateFilename('thumb', hash, 'webp'),
        hash
      }
    };
  } catch (error) {
    console.error('Image processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error'
    };
  }
}

/**
 * Get image metadata (width, height, format)
 */
export async function getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
  return sharp(buffer).metadata();
}

/**
 * Validate image can be processed
 */
export async function validateImage(buffer: Buffer): Promise<{ valid: boolean; error?: string }> {
  try {
    const metadata = await sharp(buffer).metadata();

    // Check if it's actually an image
    if (!metadata.format) {
      return { valid: false, error: 'Not a valid image file' };
    }

    // Check dimensions (prevent tiny or huge images)
    if (metadata.width && metadata.width < 100) {
      return { valid: false, error: 'Image too small (min 100px width)' };
    }

    if (metadata.width && metadata.width > 10000) {
      return { valid: false, error: 'Image too large (max 10000px width)' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid image file'
    };
  }
}
