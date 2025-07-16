const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

const uploadController = require('../../controllers/uploadController');
const { errorHandler } = require('../../middleware/errorHandler');

describe('Upload Controller', () => {
  let app;

  before(() => {
    app = express();
    app.use(express.json());

    app.post('/upload/single', uploadController.uploadImage);
    app.post('/upload/multiple', uploadController.uploadImages);

    // Add error handling middleware
    app.use(errorHandler);
  });

  describe('POST /upload/single', () => {
    it('should return 400 when no file is uploaded', async () => {
      const res = await request(app)
        .post('/upload/single');

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal('No file uploaded');
    });

    it('should return 400 for invalid file type', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/test.txt');

      // Create a test text file if it doesn't exist
      if (!fs.existsSync(path.dirname(testFilePath))) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
      }
      fs.writeFileSync(testFilePath, 'test content');

      const res = await request(app)
        .post('/upload/single')
        .attach('image', testFilePath);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('Only image files are allowed');

      // Clean up
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });
  });

  describe('POST /upload/multiple', () => {
    it('should return 400 when no files are uploaded', async () => {
      const res = await request(app)
        .post('/upload/multiple');

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal('No files uploaded');
    });

    it('should return 400 for invalid file types', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/test.txt');

      // Create a test text file if it doesn't exist
      if (!fs.existsSync(path.dirname(testFilePath))) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
      }
      fs.writeFileSync(testFilePath, 'test content');

      const res = await request(app)
        .post('/upload/multiple')
        .attach('images', testFilePath);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('Only image files are allowed');

      // Clean up
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });
  });
});
