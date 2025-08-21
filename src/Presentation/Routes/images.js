/**
 * Image Serving API Routes
 * Serves PSA label images and other uploaded images through API endpoints
 */

import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
const router = express.Router();

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
      path.join(__dirname, '../uploads/full-images', filename),
      path.join(__dirname, '../uploads/extracted-labels', filename),
      path.join(__dirname, '../uploads', filename)
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

    const imagePath = path.join(__dirname, '../public/uploads', filename);

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
      basePath = path.join(__dirname, '../uploads/full-images');
    } else if (type === 'collection') {
      basePath = path.join(__dirname, '../public/uploads');
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

export default router;
