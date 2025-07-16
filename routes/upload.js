const express = require('express');
const router = express.Router();
const {
  uploadImage,
  uploadImages,
  cleanupImages,
  cleanupAllOrphanedImages,
} = require('../controllers/uploadController');

// Upload single image
router.post('/image', uploadImage);

// Upload multiple images
router.post('/images', uploadImages);

// Cleanup uploaded images
router.delete('/cleanup', cleanupImages);

// Cleanup all orphaned images
router.delete('/cleanup-all', cleanupAllOrphanedImages);

module.exports = router;
