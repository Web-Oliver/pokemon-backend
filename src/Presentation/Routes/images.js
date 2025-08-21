/**
 * Image Serving API Routes
 * Serves PSA label images and other uploaded images through API endpoints
 */

import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// ADD EXPLICIT LOGGING FOR ALL REQUESTS TO /api/images
router.use((req, res, next) => {
  console.log(`[IMAGES ROUTE DEBUG] ${req.method} ${req.path} - Request received at ${new Date().toISOString()}`);
  console.log(`[IMAGES ROUTE DEBUG] Full URL: ${req.originalUrl}`);
  console.log(`[IMAGES ROUTE DEBUG] Method: ${req.method}`);
  if (req.method === 'DELETE') {
    console.log(`[IMAGES ROUTE DEBUG] !!!! DELETE REQUEST REACHED IMAGES ROUTER !!!!`);
  }
  next();
});

/**
 * Serve PSA label images from uploads directory
 * GET /api/images/psa-labels/:filename
 */
router.get('/psa-labels/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Try different possible paths for PSA label images
    const possiblePaths = [
      path.join(__dirname, '../../../uploads/ocr/full-images', filename),
      path.join(__dirname, '../../../uploads/ocr/extracted-labels', filename),
      path.join(__dirname, '../../../uploads', filename)
    ];

    let imagePath = null;

    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        imagePath = testPath;
        break;
      } catch (err) {
        // Continue to next path
        continue;
      }
    }

    if (!imagePath) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set cache headers for better performance
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the file
    const fileBuffer = await fs.readFile(imagePath);

    res.send(fileBuffer);

  } catch (error) {
    console.error('Error serving PSA label image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

/**
 * Serve collection item images from public/uploads directory
 * GET /api/images/collection/:filename
 */
router.get('/collection/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const imagePath = path.join(__dirname, '../../../uploads/collection', filename);

    try {
      await fs.access(imagePath);
    } catch (err) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set cache headers for better performance
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the file
    const fileBuffer = await fs.readFile(imagePath);

    res.send(fileBuffer);

  } catch (error) {
    console.error('Error serving collection image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

/**
 * Serve collection images directly from /uploads/ path
 * GET /api/images/uploads/:filename
 */
router.get('/uploads/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const imagePath = path.join(__dirname, '../../../uploads/collection', filename);

    try {
      await fs.access(imagePath);
    } catch (err) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set cache headers for better performance
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the file
    const fileBuffer = await fs.readFile(imagePath);

    res.send(fileBuffer);

  } catch (error) {
    console.error('Error serving uploads image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

/**
 * Get image info/metadata
 * GET /api/images/info/:type/:filename
 */
router.get('/info/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;

    // Security: prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    let basePath;

    if (type === 'psa-labels') {
      basePath = path.join(__dirname, '../../../uploads/ocr/full-images');
    } else if (type === 'collection') {
      basePath = path.join(__dirname, '../../../uploads/collection');
    } else {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    const imagePath = path.join(basePath, filename);

    try {
      const stats = await fs.stat(imagePath);
      const ext = path.extname(filename).toLowerCase();

      res.json({
        filename,
        type,
        size: stats.size,
        modified: stats.mtime,
        extension: ext,
        url: `/api/images/${type}/${filename}`
      });
    } catch (err) {
      return res.status(404).json({ error: 'Image not found' });
    }

  } catch (error) {
    console.error('Error getting image info:', error);
    res.status(500).json({ error: 'Failed to get image info' });
  }
});

/**
 * Delete an image file from the filesystem
 * DELETE /api/images/delete/:filename
 */
router.delete('/delete/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    console.log(`[IMAGE DELETE] Attempting to delete: ${filename}`);

    // Try different possible paths where the image might be stored
    const possiblePaths = [
      path.join(__dirname, '../../../uploads/collection', filename),
      path.join(__dirname, '../../../uploads/ocr/full-images', filename),
      path.join(__dirname, '../../../uploads/ocr/extracted-labels', filename),
      path.join(__dirname, '../../../uploads', filename)
    ];

    let deletedPath = null;

    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        await fs.unlink(testPath);
        deletedPath = testPath;
        console.log(`[IMAGE DELETE] Successfully deleted: ${testPath}`);
        break;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`[IMAGE DELETE] Error accessing ${testPath}:`, err);
        }
        // Continue to next path if file not found
        continue;
      }
    }

    if (!deletedPath) {
      console.log(`[IMAGE DELETE] Image not found: ${filename}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Image deleted successfully',
      filename: filename,
      path: deletedPath
    });

  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
