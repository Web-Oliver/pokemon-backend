import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ValidationError   } from '@/Presentation/Middleware/errorHandler.js';
import ThumbnailService from '@/Application/Services/Core/thumbnailService.js';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists - STANDARDIZED LOCATION
const uploadsDir = path.join(__dirname, '../../../uploads/collection');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // Use 'image' as consistent fieldname instead of file.fieldname which can be 'images[0]', 'images[1]', etc.
    const fieldname = file.fieldname.startsWith('images') ? 'image' : file.fieldname;

    cb(null, `${fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// File filter to only allow JPEG and PNG images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only JPEG and PNG image files are allowed!'));
};

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit per file (any size as requested)
    files: 10, // Maximum 10 files
    fields: 50, // Maximum 50 fields to handle all file metadata
    fieldSize: 200 * 1024 * 1024, // 200MB field size
    parts: 1000, // Maximum parts in multipart form
  },
  fileFilter,
});

// Controller for handling single file upload
const uploadSingle = upload.single('image');

const uploadImage = (req, res, next) => {
  uploadSingle(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File too large. Maximum size is 200MB.'));
      }
      return next(new ValidationError(err.message));
    } else if (err) {
      return next(new ValidationError(err.message));
    }

    if (!req.file) {
      return next(new ValidationError('No file uploaded'));
    }

    try {
      // Generate thumbnail
      const thumbnailPath = await ThumbnailService.generateThumbnail(
        req.file.path,
        req.file.filename
      );

      // Return the relative path for storing in database
      const relativePath = `/uploads/${req.file.filename}`;

      res.status(200).json({
        status: 'success',
        message: 'Image uploaded successfully',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: relativePath,
          thumbnailPath,
          size: req.file.size,
        },
      });
    } catch (thumbnailError) {
      console.error('[UPLOAD] Thumbnail generation failed:', thumbnailError);

      // Return success even if thumbnail fails
      const relativePath = `/uploads/${req.file.filename}`;

      res.status(200).json({
        status: 'success',
        message: 'Image uploaded successfully (thumbnail generation failed)',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: relativePath,
          thumbnailPath: null,
          size: req.file.size,
        },
      });
    }
  });
};

// Ultra-flexible upload handler that accepts any field name and file count
const uploadFlexible = (req, res, next) => {
  // Use upload.any() to accept any field name
  const uploadAny = upload.any();

  uploadAny(req, res, async (err) => {
    console.log(`[UPLOAD] Received ${req.files ? req.files.length : 0} files`);
    console.log(`[UPLOAD] Request body keys: ${Object.keys(req.body)}`);
    console.log(
      '[UPLOAD] Files:',
      req.files?.map((f) => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        size: f.size,
      })),
    );

    if (err instanceof multer.MulterError) {
      console.log(`[UPLOAD] Multer error: ${err.code} - ${err.message}`);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File too large. Maximum size is 200MB per file.'));
      }
      return next(new ValidationError(err.message));
    } else if (err) {
      console.log('[UPLOAD] Other error:', err);
      return next(new ValidationError(err.message));
    }

    // Check if any files were uploaded
    if (!req.files || req.files.length === 0) {
      console.log('[UPLOAD] No files received');
      return next(new ValidationError('No files uploaded'));
    }

    // Generate thumbnails for all uploaded files
    const uploadedFiles = [];

    for (const file of req.files) {
      try {
        const thumbnailPath = await ThumbnailService.generateThumbnail(
          file.path,
          file.filename
        );

        uploadedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/${file.filename}`,
          thumbnailPath,
          size: file.size,
          fieldname: file.fieldname,
        });
      } catch (thumbnailError) {
        console.error(`[UPLOAD] Thumbnail generation failed for ${file.filename}:`, thumbnailError);

        uploadedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/${file.filename}`,
          thumbnailPath: null,
          size: file.size,
          fieldname: file.fieldname,
        });
      }
    }

    console.log(`[UPLOAD] Sending response with ${uploadedFiles.length} files`);
    console.log(
      '[UPLOAD] Response data:',
      uploadedFiles.map((f) => ({ filename: f.filename, path: f.path, thumbnailPath: f.thumbnailPath })),
    );

    res.status(200).json({
      status: 'success',
      message: `${req.files.length} images uploaded successfully`,
      data: uploadedFiles,
    });
  });
};

// Keep the original for backwards compatibility
const uploadMultiple = upload.array('images', 10); // Max 10 images

const uploadImages = uploadFlexible;

// Controller for cleaning up uploaded images
const cleanupImages = async (req, res, next) => {
  try {
    const { imagePaths } = req.body;

    if (!imagePaths || !Array.isArray(imagePaths)) {
      return res.status(400).json({
        status: 'error',
        message: 'imagePaths array is required',
      });
    }

    // Import models

    const deletedFiles = [];
    const errors = [];
    const skippedFiles = [];

    for (const imagePath of imagePaths) {
      try {
        // Check if image is associated with any product
        const [sealedProductCount, psaCardCount, rawCardCount] = await Promise.all([
          SealedProduct.countDocuments({ images: imagePath }),
          PsaGradedCard.countDocuments({ images: imagePath }),
          RawCard.countDocuments({ images: imagePath }),
        ]);

        const isImageInUse = sealedProductCount > 0 || psaCardCount > 0 || rawCardCount > 0;

        if (isImageInUse) {
          console.log(`[CLEANUP] Skipping file in use: ${imagePath}`);
          skippedFiles.push({
            path: imagePath,
            reason: 'Image is associated with a product',
          });
        } else {
          // Remove leading slash if present to get filename
          const filename = imagePath.startsWith('/uploads/') ? imagePath.replace('/uploads/', '') : imagePath;

          const fullPath = path.join(uploadsDir, filename);

          // Check if file exists before attempting to delete
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            deletedFiles.push(imagePath);
            console.log(`[CLEANUP] Deleted orphaned file: ${fullPath}`);

            // Also delete thumbnail if it exists
            try {
              await ThumbnailService.deleteThumbnail(imagePath);
            } catch (thumbError) {
              console.log(`[CLEANUP] No thumbnail to delete for: ${imagePath}`);
            }
          } else {
            console.log(`[CLEANUP] File not found: ${fullPath}`);
          }
        }
      } catch (error) {
        console.error(`[CLEANUP] Error processing file ${imagePath}:`, error);
        errors.push({ path: imagePath, error: error.message });
      }
    }

    console.log(
      `[CLEANUP] Cleanup completed: ${deletedFiles.length} deleted, ${skippedFiles.length} skipped, ${errors.length} errors`,
    );

    res.status(200).json({
      status: 'success',
      message: `Cleanup completed: ${deletedFiles.length} files deleted, ${skippedFiles.length} files skipped (in use)`,
      data: {
        deleted: deletedFiles,
        skipped: skippedFiles,
        errors,
      },
    });
  } catch (error) {
    console.error('[CLEANUP] Cleanup error:', error);
    next(new ValidationError(`Failed to cleanup images: ${error.message}`));
  }
};

// Controller for cleaning up all orphaned images
const cleanupAllOrphanedImages = async (req, res, next) => {
  try {
    // Import models

    // Get all uploaded files
    const allFiles = fs.readdirSync(uploadsDir);
    const allImagePaths = allFiles.map((filename) => `/uploads/${filename}`);

    console.log(`[CLEANUP ALL] Found ${allImagePaths.length} files in uploads directory`);

    const deletedFiles = [];
    const skippedFiles = [];
    const errors = [];

    for (const imagePath of allImagePaths) {
      try {
        // Check if image is associated with any product
        const [sealedProductCount, psaCardCount, rawCardCount] = await Promise.all([
          SealedProduct.countDocuments({ images: imagePath }),
          PsaGradedCard.countDocuments({ images: imagePath }),
          RawCard.countDocuments({ images: imagePath }),
        ]);

        const isImageInUse = sealedProductCount > 0 || psaCardCount > 0 || rawCardCount > 0;

        if (isImageInUse) {
          console.log(`[CLEANUP ALL] Skipping file in use: ${imagePath}`);
          skippedFiles.push({
            path: imagePath,
            reason: 'Image is associated with a product',
          });
        } else {
          // Skip thumbnail files as they will be handled with their originals
          const filename = imagePath.startsWith('/uploads/') ? imagePath.replace('/uploads/', '') : imagePath;

          if (ThumbnailService.isThumbnail(filename)) {
            console.log(`[CLEANUP ALL] Skipping thumbnail file: ${imagePath}`);
            return;
          }

          const fullPath = path.join(uploadsDir, filename);

          // Check if file exists before attempting to delete
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            deletedFiles.push(imagePath);
            console.log(`[CLEANUP ALL] Deleted orphaned file: ${fullPath}`);

            // Also delete thumbnail if it exists
            try {
              await ThumbnailService.deleteThumbnail(imagePath);
            } catch (thumbError) {
              console.log(`[CLEANUP ALL] No thumbnail to delete for: ${imagePath}`);
            }
          }
        }
      } catch (error) {
        console.error(`[CLEANUP ALL] Error processing file ${imagePath}:`, error);
        errors.push({ path: imagePath, error: error.message });
      }
    }

    console.log(
      `[CLEANUP ALL] Cleanup completed: ${deletedFiles.length} deleted, ${skippedFiles.length} skipped, ${errors.length} errors`,
    );

    res.status(200).json({
      status: 'success',
      message: `Cleanup completed: ${deletedFiles.length} orphaned files deleted, ${skippedFiles.length} files kept (in use)`,
      data: {
        deleted: deletedFiles,
        skipped: skippedFiles,
        errors,
      },
    });
  } catch (error) {
    console.error('[CLEANUP ALL] Cleanup error:', error);
    next(new ValidationError(`Failed to cleanup orphaned images: ${error.message}`));
  }
};

export {
  uploadImage,
  uploadImages,
  cleanupImages,
  cleanupAllOrphanedImages
};
export default uploadImage;;
