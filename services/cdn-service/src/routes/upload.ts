/**
 * Upload routes
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { uploadMiddleware, validateUploadRequest } from '../middleware/validation';
import { processImage, validateImage } from '../services/processor';
import { saveFile } from '../services/storage';

const router = Router();

/**
 * POST /upload
 * Upload and process image file
 *
 * Body (multipart/form-data):
 * - file: Image file (jpg, png, webp, gif)
 * - type: Entity type (location, item, character)
 * - entityId: MongoDB ObjectId of entity
 *
 * Returns:
 * {
 *   success: true,
 *   urls: {
 *     main: "https://cdn.tenpennynovels.com/locations/{id}/banner-{hash}.webp",
 *     thumbnail: "https://cdn.tenpennynovels.com/locations/{id}/thumb-{hash}.webp"
 *   },
 *   metadata: {
 *     hash: "abc123...",
 *     size: 123456
 *   }
 * }
 */
router.post(
  '/upload',
  authMiddleware,
  uploadMiddleware.single('file'),
  validateUploadRequest,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, entityId } = req.body;
      const file = req.file!; // Validated by middleware

      console.log(`Processing upload: type=${type}, entityId=${entityId}, size=${file.size}`);

      // Validate image can be processed
      const validation = await validateImage(file.buffer);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error || 'Invalid image'
        });
        return;
      }

      // Process image (resize, webp conversion, thumbnail)
      const processingResult = await processImage(file.buffer, type);

      if (!processingResult.success || !processingResult.main || !processingResult.thumbnail) {
        res.status(500).json({
          success: false,
          error: processingResult.error || 'Image processing failed'
        });
        return;
      }

      // Save main image
      const mainResult = await saveFile(
        type,
        entityId,
        processingResult.main.filename,
        processingResult.main.buffer
      );

      if (!mainResult.success) {
        res.status(500).json({
          success: false,
          error: mainResult.error || 'Failed to save main image'
        });
        return;
      }

      // Save thumbnail
      const thumbResult = await saveFile(
        type,
        entityId,
        processingResult.thumbnail.filename,
        processingResult.thumbnail.buffer
      );

      if (!thumbResult.success) {
        res.status(500).json({
          success: false,
          error: thumbResult.error || 'Failed to save thumbnail'
        });
        return;
      }

      // Success response
      res.status(200).json({
        success: true,
        urls: {
          main: mainResult.url,
          thumbnail: thumbResult.url
        },
        metadata: {
          hash: processingResult.main.hash,
          originalSize: file.size,
          processedSize: processingResult.main.buffer.length,
          thumbnailSize: processingResult.thumbnail.buffer.length
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      });
    }
  }
);

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    service: 'cdn-service',
    uptime: process.uptime()
  });
});

export default router;
