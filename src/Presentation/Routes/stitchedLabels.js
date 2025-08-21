import express from 'express';
import { body, param, query   } from 'express-validator';
import multer from 'multer';
import stitchedLabelController from '@/Presentation/Controllers/stitchedLabelController.js';
const router = express.Router();

// Multer configuration for multiple image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Maximum 50 files per request
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
const validateCreateStitchedLabel = [
  body('batchId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('batchId must be a string between 1 and 100 characters'),
  body('labelWidth')
    .optional()
    .isInt({ min: 100, max: 1000 })
    .withMessage('labelWidth must be between 100 and 1000 pixels'),
  body('labelHeight')
    .optional()
    .isInt({ min: 100, max: 1500 })
    .withMessage('labelHeight must be between 100 and 1500 pixels'),
  body('spacing')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('spacing must be between 0 and 50 pixels'),
  body('backgroundColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('backgroundColor must be a valid hex color (e.g., #FFFFFF)')
];

const validateUpdateStitchedLabel = [
  body('status')
    .optional()
    .isIn(['created', 'stitched', 'ocr_processed', 'labels_extracted', 'completed', 'failed'])
    .withMessage('Invalid status value'),
  body('userVerified')
    .optional()
    .isBoolean()
    .withMessage('userVerified must be a boolean'),
  body('userNotes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('userNotes must be a string with maximum 1000 characters')
];

const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid stitched label ID')
];

const validateBatchId = [
  param('batchId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid batch ID')
];

const validateStatus = [
  param('status')
    .isIn(['created', 'stitched', 'ocr_processed', 'labels_extracted', 'completed', 'failed'])
    .withMessage('Invalid status value')
];

const validatePosition = [
  param('position')
    .isInt({ min: 0, max: 49 })
    .withMessage('Position must be between 0 and 49')
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
    .isIn(['processedAt', 'createdAt', 'status', 'batchSize', 'processingTime'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Routes

/**
 * @route   POST /api/stitched-labels/create
 * @desc    Create stitched label from multiple images
 * @access  Public
 */
router.post('/create',
  upload.array('images', 50),
  validateCreateStitchedLabel,
  stitchedLabelController.createStitchedLabel
);

/**
 * @route   POST /api/stitched-labels/create-and-process
 * @desc    Create and process stitched label with OCR in one operation
 * @access  Public
 */
router.post('/create-and-process',
  upload.array('images', 50),
  validateCreateStitchedLabel,
  stitchedLabelController.createAndProcessStitchedLabel
);

/**
 * @route   GET /api/stitched-labels
 * @desc    Get all stitched labels with filtering and pagination
 * @access  Public
 */
router.get('/',
  validatePagination,
  stitchedLabelController.getStitchedLabels
);

/**
 * @route   GET /api/stitched-labels/stats
 * @desc    Get processing statistics
 * @access  Public
 */
router.get('/stats', stitchedLabelController.getProcessingStats);

/**
 * @route   GET /api/stitched-labels/cost-savings
 * @desc    Get cost savings report
 * @access  Public
 */
router.get('/cost-savings', stitchedLabelController.getCostSavingsReport);

/**
 * @route   GET /api/stitched-labels/unverified
 * @desc    Get unverified stitched labels
 * @access  Public
 */
router.get('/unverified', stitchedLabelController.getUnverifiedStitchedLabels);

/**
 * @route   GET /api/stitched-labels/batch/:batchId
 * @desc    Get stitched label by batch ID
 * @access  Public
 */
router.get('/batch/:batchId',
  validateBatchId,
  stitchedLabelController.getStitchedLabelByBatch
);

/**
 * @route   GET /api/stitched-labels/status/:status
 * @desc    Get stitched labels by status
 * @access  Public
 */
router.get('/status/:status',
  validateStatus,
  stitchedLabelController.getStitchedLabelsByStatus
);

/**
 * @route   GET /api/stitched-labels/:id
 * @desc    Get stitched label by ID
 * @access  Public
 */
router.get('/:id',
  validateMongoId,
  stitchedLabelController.getStitchedLabel
);

/**
 * @route   POST /api/stitched-labels/:id/process
 * @desc    Process existing stitched label with OCR
 * @access  Public
 */
router.post('/:id/process',
  validateMongoId,
  stitchedLabelController.processStitchedLabel
);

/**
 * @route   GET /api/stitched-labels/:id/labels/:position
 * @desc    Get individual label from stitched label
 * @access  Public
 */
router.get('/:id/labels/:position',
  validateMongoId,
  validatePosition,
  stitchedLabelController.getIndividualLabel
);

/**
 * @route   PUT /api/stitched-labels/:id
 * @desc    Update stitched label
 * @access  Public
 */
router.put('/:id',
  validateMongoId,
  validateUpdateStitchedLabel,
  stitchedLabelController.updateStitchedLabel
);

/**
 * @route   PATCH /api/stitched-labels/:id/verify
 * @desc    Mark stitched label as user verified
 * @access  Public
 */
router.patch('/:id/verify',
  validateMongoId,
  stitchedLabelController.verifyStitchedLabel
);

/**
 * @route   DELETE /api/stitched-labels/:id
 * @desc    Delete stitched label and associated data
 * @access  Public
 */
router.delete('/:id',
  validateMongoId,
  stitchedLabelController.deleteStitchedLabel
);

export default router;
