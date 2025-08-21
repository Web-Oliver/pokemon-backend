import express from 'express';
import { body, param, query   } from 'express-validator';
import multer from 'multer';
import psaLabelController from '@/Presentation/Controllers/psaLabelController.js';
const router = express.Router();

// Multer configuration for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation middleware
const validateCreatePsaLabel = [
  body('labelImage')
    .notEmpty()
    .withMessage('labelImage path is required'),
  body('ocrText')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('ocrText must be between 1 and 10000 characters'),
  body('ocrConfidence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('ocrConfidence must be between 0 and 1'),
  body('processingTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('processingTime must be a positive integer'),
  body('batchId')
    .optional()
    .isString()
    .withMessage('batchId must be a string'),
  body('batchIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('batchIndex must be a non-negative integer')
];

const validateProcessImage = [
  body('batchId')
    .optional()
    .isString()
    .withMessage('batchId must be a string'),
  body('batchIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('batchIndex must be a non-negative integer')
];

const validateUpdatePsaLabel = [
  body('psaData.certificationNumber')
    .optional()
    .isString()
    .isLength({ min: 8, max: 10 })
    .withMessage('Certification number must be 8-10 characters'),
  body('psaData.grade')
    .optional()
    .isString()
    .isIn(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    .withMessage('Grade must be between 1 and 10'),
  body('psaData.cardName')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Card name must be between 1 and 200 characters'),
  body('psaData.setName')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Set name must be between 1 and 200 characters'),
  body('userVerified')
    .optional()
    .isBoolean()
    .withMessage('userVerified must be a boolean'),
  body('userCorrections')
    .optional()
    .isString()
    .withMessage('userCorrections must be a string')
];

const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid PSA label ID')
];

const validateCertNumber = [
  param('certNumber')
    .isString()
    .isLength({ min: 8, max: 10 })
    .withMessage('Certification number must be 8-10 characters')
];

const validateGrade = [
  param('grade')
    .isString()
    .isIn(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    .withMessage('Grade must be between 1 and 10')
];

const validateSearch = [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['processedAt', 'ocrConfidence', 'matchConfidence', 'psaData.grade'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Routes

/**
 * @route   POST /api/psa-labels
 * @desc    Create a new PSA label from OCR data
 * @access  Public
 */
router.post('/', validateCreatePsaLabel, psaLabelController.createPsaLabel);

/**
 * @route   POST /api/psa-labels/process-image
 * @desc    Process image and create PSA label with OCR
 * @access  Public
 */
router.post('/process-image', upload.single('image'), validateProcessImage, psaLabelController.processImageAndCreateLabel);

/**
 * @route   GET /api/psa-labels
 * @desc    Get all PSA labels with filtering and pagination
 * @access  Public
 */
router.get('/', validatePagination, psaLabelController.getPsaLabels);

/**
 * @route   GET /api/psa-labels/search
 * @desc    Search PSA labels by OCR text
 * @access  Public
 */
router.get('/search', validateSearch, psaLabelController.searchPsaLabels);

/**
 * @route   GET /api/psa-labels/stats
 * @desc    Get OCR processing statistics
 * @access  Public
 */
router.get('/stats', psaLabelController.getOcrStats);

/**
 * @route   GET /api/psa-labels/unmatched
 * @desc    Get unmatched PSA labels
 * @access  Public
 */
router.get('/unmatched', psaLabelController.getUnmatchedPsaLabels);

/**
 * @route   GET /api/psa-labels/batch/:batchId
 * @desc    Get batch PSA labels
 * @access  Public
 */
router.get('/batch/:batchId', psaLabelController.getBatchPsaLabels);

/**
 * @route   GET /api/psa-labels/grade/:grade
 * @desc    Get PSA labels by grade
 * @access  Public
 */
router.get('/grade/:grade', validateGrade, psaLabelController.getPsaLabelsByGrade);

/**
 * @route   GET /api/psa-labels/cert/:certNumber
 * @desc    Get PSA label by certification number
 * @access  Public
 */
router.get('/cert/:certNumber', validateCertNumber, psaLabelController.getPsaLabelByCertNumber);

/**
 * @route   GET /api/psa-labels/:id
 * @desc    Get PSA label by ID
 * @access  Public
 */
router.get('/:id', validateMongoId, psaLabelController.getPsaLabel);

/**
 * @route   PUT /api/psa-labels/:id
 * @desc    Update PSA label
 * @access  Public
 */
router.put('/:id', validateMongoId, validateUpdatePsaLabel, psaLabelController.updatePsaLabel);

/**
 * @route   PATCH /api/psa-labels/:id/verify
 * @desc    Mark PSA label as user verified
 * @access  Public
 */
router.patch('/:id/verify', validateMongoId, psaLabelController.verifyPsaLabel);

/**
 * @route   DELETE /api/psa-labels/:id
 * @desc    Delete PSA label
 * @access  Public
 */
router.delete('/:id', validateMongoId, psaLabelController.deletePsaLabel);

export default router;
