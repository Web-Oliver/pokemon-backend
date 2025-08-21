/**
 * Backup Routes
 *
 * RESTful API routes for Pokemon Collection backup operations.
 * Following CLAUDE.md routing conventions and middleware patterns.
 */

import express from 'express';
const router = express.Router();

// Import backup controller
import { getBackupStatus,
  initializeBackupService,
  startScheduledBackups,
  stopScheduledBackups,
  triggerManualBackup,
  getBackupHistory,
  getBackupDetails,
  testBackupSystem,
  getBackupConfig,
  healthCheck
  } from '@/Presentation/Controllers/backupController.js';
// Import middleware (if authentication is needed)
// const { authenticate, authorize  } = await import('@/middleware/auth.js');
/**
 * @route   GET /api/backup/health
 * @desc    Health check for backup system
 * @access  Public (or Protected based on requirements)
 */
router.get('/health', healthCheck);

/**
 * @route   GET /api/backup/status
 * @desc    Get backup service status and statistics
 * @access  Protected
 */
router.get('/status', getBackupStatus);

/**
 * @route   GET /api/backup/config
 * @desc    Get backup configuration
 * @access  Protected
 */
router.get('/config', getBackupConfig);

/**
 * @route   POST /api/backup/initialize
 * @desc    Initialize backup service
 * @access  Protected
 */
router.post('/initialize', initializeBackupService);

/**
 * @route   POST /api/backup/start-scheduled
 * @desc    Start automatic scheduled backups
 * @access  Protected
 */
router.post('/start-scheduled', startScheduledBackups);

/**
 * @route   POST /api/backup/stop-scheduled
 * @desc    Stop automatic scheduled backups
 * @access  Protected
 */
router.post('/stop-scheduled', stopScheduledBackups);

/**
 * @route   POST /api/backup/manual
 * @desc    Trigger manual backup
 * @access  Protected
 * @body    { backupType?, collections?, compress? }
 */
router.post('/manual', triggerManualBackup);

/**
 * @route   POST /api/backup/test
 * @desc    Test backup system with a small backup
 * @access  Protected
 */
router.post('/test', testBackupSystem);

/**
 * @route   GET /api/backup/history
 * @desc    Get backup history
 * @access  Protected
 * @query   { limit?, type? }
 */
router.get('/history', getBackupHistory);

/**
 * @route   GET /api/backup/:backupId
 * @desc    Get detailed backup information by ID
 * @access  Protected
 */
router.get('/:backupId', getBackupDetails);

// Error handling middleware for backup routes
router.use((error, req, res, next) => {
  console.error('Backup Route Error:', error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Backup operation failed',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

export default router;
