/**
 * File validation middleware
 * Validates MIME type, size, and extension
 */
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default
const ALLOWED_MIME_TYPES = (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');

// Multer storage configuration (memory storage for processing)
const storage = multer.memoryStorage();

/**
 * File filter - validate MIME type
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
    return;
  }

  // Additional extension validation (prevent MIME spoofing)
  const ext = path.extname(file.originalname).toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  if (!validExtensions.includes(ext)) {
    cb(new Error(`Invalid file extension. Allowed: ${validExtensions.join(', ')}`));
    return;
  }

  cb(null, true);
};

/**
 * Multer upload middleware
 */
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Single file upload
  },
  fileFilter
});

/**
 * Validate upload request body
 */
export function validateUploadRequest(req: Request, res: Response, next: NextFunction): void {
  const { type, entityId } = req.body;

  // Validate type
  const validTypes = ['location', 'item', 'character'];
  if (!type || !validTypes.includes(type)) {
    res.status(400).json({
      success: false,
      error: `Invalid type. Allowed: ${validTypes.join(', ')}`
    });
    return;
  }

  // Validate entityId (MongoDB ObjectId format)
  if (!entityId || !/^[a-f\d]{24}$/i.test(entityId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid entityId. Must be a valid MongoDB ObjectId'
    });
    return;
  }

  // Validate file exists (multer should have attached it)
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
    return;
  }

  next();
}
