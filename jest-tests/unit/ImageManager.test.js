const ImageManager = require('../../services/shared/imageManager');
const fs = require('fs').promises;
const path = require('path');

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
  },
}));

// Mock path module
jest.mock('path');

describe('ImageManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup path.join mock to return predictable paths
    path.join.mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('deleteImageFiles', () => {
    test('should delete single image file successfully', async () => {
      const imageUrls = ['/uploads/images/test-image.jpg'];
      const expectedPath = '__dirname/../..//uploads/images/test-image.jpg';

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Starting deletion of',
        1,
        'images'
      );
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Successfully deleted:',
        expectedPath
      );
    });

    test('should delete multiple image files successfully', async () => {
      const imageUrls = [
        '/uploads/images/test-image-1.jpg',
        '/uploads/images/test-image-2.png',
        '/uploads/images/test-image-3.gif',
      ];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledTimes(3);
      expect(fs.unlink).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Starting deletion of',
        3,
        'images'
      );
    });

    test('should handle empty imageUrls array', async () => {
      await ImageManager.deleteImageFiles([]);

      expect(fs.access).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should handle null imageUrls', async () => {
      await ImageManager.deleteImageFiles(null);

      expect(fs.access).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should handle undefined imageUrls', async () => {
      await ImageManager.deleteImageFiles(undefined);

      expect(fs.access).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should skip non-upload URLs', async () => {
      const imageUrls = [
        'https://example.com/external-image.jpg',
        '/static/images/static-image.jpg',
        'data:image/base64,ABC123',
      ];

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Skipping external/invalid URL:',
        'https://example.com/external-image.jpg'
      );
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Skipping external/invalid URL:',
        '/static/images/static-image.jpg'
      );
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Skipping external/invalid URL:',
        'data:image/base64,ABC123'
      );
    });

    test('should handle file not found (ENOENT) gracefully', async () => {
      const imageUrls = ['/uploads/images/missing-image.jpg'];
      const expectedPath = '__dirname/../..//uploads/images/missing-image.jpg';

      const enoentError = new Error('File not found');
      enoentError.code = 'ENOENT';
      fs.access.mockRejectedValue(enoentError);

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] File not found (already deleted):',
        expectedPath
      );
    });

    test('should handle access errors other than ENOENT', async () => {
      const imageUrls = ['/uploads/images/permission-denied.jpg'];
      const expectedPath = '__dirname/../..//uploads/images/permission-denied.jpg';

      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      fs.access.mockRejectedValue(permissionError);

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Failed to delete image:',
        '/uploads/images/permission-denied.jpg',
        permissionError
      );
    });

    test('should handle unlink errors', async () => {
      const imageUrls = ['/uploads/images/locked-file.jpg'];
      const expectedPath = '__dirname/../..//uploads/images/locked-file.jpg';

      const unlinkError = new Error('File is locked');
      fs.access.mockResolvedValue();
      fs.unlink.mockRejectedValue(unlinkError);

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
      expect(console.error).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Failed to delete image:',
        '/uploads/images/locked-file.jpg',
        unlinkError
      );
    });

    test('should continue processing other images after failure', async () => {
      const imageUrls = [
        '/uploads/images/good-image.jpg',
        '/uploads/images/bad-image.jpg',
        '/uploads/images/another-good-image.jpg',
      ];

      const unlinkError = new Error('Cannot delete bad image');

      fs.access.mockResolvedValue();
      fs.unlink
        .mockResolvedValueOnce() // First image succeeds
        .mockRejectedValueOnce(unlinkError) // Second image fails
        .mockResolvedValueOnce(); // Third image succeeds

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledTimes(3);
      expect(fs.unlink).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Successfully deleted:',
        '__dirname/../..//uploads/images/good-image.jpg'
      );
      expect(console.error).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Failed to delete image:',
        '/uploads/images/bad-image.jpg',
        unlinkError
      );
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Successfully deleted:',
        '__dirname/../..//uploads/images/another-good-image.jpg'
      );
    });

    test('should handle mixed valid and invalid URLs', async () => {
      const imageUrls = [
        '/uploads/images/valid-image.jpg',
        'https://external.com/image.jpg',
        '/uploads/images/another-valid.png',
        null,
        '/static/invalid.jpg',
        '/uploads/images/final-valid.gif',
      ];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      // Should only process valid upload URLs (3 out of 6)
      expect(fs.access).toHaveBeenCalledTimes(3);
      expect(fs.unlink).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Starting deletion of',
        6,
        'images'
      );
    });

    test('should handle very long file paths', async () => {
      const longFilename = 'a'.repeat(200) + '.jpg';
      const imageUrls = [`/uploads/images/${longFilename}`];
      const expectedPath = `__dirname/../..//uploads/images/${longFilename}`;

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
    });

    test('should handle special characters in filenames', async () => {
      const specialFilenames = [
        '/uploads/images/image with spaces.jpg',
        '/uploads/images/image-with-dashes.jpg',
        '/uploads/images/image_with_underscores.jpg',
        '/uploads/images/image(1).jpg',
        '/uploads/images/image[copy].jpg',
      ];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(specialFilenames);

      expect(fs.access).toHaveBeenCalledTimes(5);
      expect(fs.unlink).toHaveBeenCalledTimes(5);
    });

    test('should handle empty string URLs', async () => {
      const imageUrls = ['', '/uploads/images/valid.jpg', ''];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      // Should only process the valid URL
      expect(fs.access).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Skipping external/invalid URL:',
        ''
      );
    });

    test('should construct correct file paths', async () => {
      const imageUrls = ['/uploads/images/test.jpg'];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(path.join).toHaveBeenCalledWith(
        '__dirname',
        '..',
        '..',
        '/uploads/images/test.jpg'
      );
    });

    test('should handle various image file extensions', async () => {
      const imageUrls = [
        '/uploads/images/image.jpg',
        '/uploads/images/image.jpeg',
        '/uploads/images/image.png',
        '/uploads/images/image.gif',
        '/uploads/images/image.webp',
        '/uploads/images/image.bmp',
        '/uploads/images/image.svg',
      ];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledTimes(7);
      expect(fs.unlink).toHaveBeenCalledTimes(7);
    });

    test('should handle subdirectories in uploads', async () => {
      const imageUrls = [
        '/uploads/images/2024/01/image1.jpg',
        '/uploads/images/cards/psa/image2.jpg',
        '/uploads/images/products/sealed/image3.jpg',
      ];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(fs.access).toHaveBeenCalledTimes(3);
      expect(fs.unlink).toHaveBeenCalledTimes(3);
      expect(fs.access).toHaveBeenCalledWith(
        '__dirname/../..//uploads/images/2024/01/image1.jpg'
      );
      expect(fs.access).toHaveBeenCalledWith(
        '__dirname/../..//uploads/images/cards/psa/image2.jpg'
      );
      expect(fs.access).toHaveBeenCalledWith(
        '__dirname/../..//uploads/images/products/sealed/image3.jpg'
      );
    });
  });

  describe('Error Recovery', () => {
    test('should not throw errors and continue processing', async () => {
      const imageUrls = [
        '/uploads/images/image1.jpg',
        '/uploads/images/image2.jpg',
      ];

      // First image fails access, second succeeds
      const accessError = new Error('Access denied');
      fs.access
        .mockRejectedValueOnce(accessError)
        .mockResolvedValueOnce();
      fs.unlink.mockResolvedValue();

      // Should not throw despite the error
      await expect(ImageManager.deleteImageFiles(imageUrls)).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Failed to delete image:',
        '/uploads/images/image1.jpg',
        accessError
      );
      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Successfully deleted:',
        '__dirname/../..//uploads/images/image2.jpg'
      );
    });
  });

  describe('Logging Behavior', () => {
    test('should log start of deletion process', async () => {
      const imageUrls = ['/uploads/images/test.jpg'];

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Starting deletion of',
        1,
        'images'
      );
    });

    test('should log each deletion attempt', async () => {
      const imageUrls = ['/uploads/images/test.jpg'];
      const expectedPath = '__dirname/../..//uploads/images/test.jpg';

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Attempting to delete:',
        expectedPath
      );
    });

    test('should log successful deletions', async () => {
      const imageUrls = ['/uploads/images/test.jpg'];
      const expectedPath = '__dirname/../..//uploads/images/test.jpg';

      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      await ImageManager.deleteImageFiles(imageUrls);

      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Successfully deleted:',
        expectedPath
      );
    });

    test('should log skipped external URLs', async () => {
      const imageUrls = ['https://external.com/image.jpg'];

      await ImageManager.deleteImageFiles(imageUrls);

      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Skipping external/invalid URL:',
        'https://external.com/image.jpg'
      );
    });

    test('should log file not found messages', async () => {
      const imageUrls = ['/uploads/images/missing.jpg'];
      const expectedPath = '__dirname/../..//uploads/images/missing.jpg';

      const enoentError = new Error('File not found');
      enoentError.code = 'ENOENT';
      fs.access.mockRejectedValue(enoentError);

      await ImageManager.deleteImageFiles(imageUrls);

      expect(console.log).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] File not found (already deleted):',
        expectedPath
      );
    });

    test('should log errors for failed deletions', async () => {
      const imageUrls = ['/uploads/images/error.jpg'];
      const error = new Error('Deletion failed');

      fs.access.mockRejectedValue(error);

      await ImageManager.deleteImageFiles(imageUrls);

      expect(console.error).toHaveBeenCalledWith(
        '[IMAGE CLEANUP] Failed to delete image:',
        '/uploads/images/error.jpg',
        error
      );
    });
  });
});