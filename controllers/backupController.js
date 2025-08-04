/**
 * Backup Controller
 * 
 * REST API endpoints for Pokemon Collection backup operations.
 * Following CLAUDE.md SOLID principles and error handling patterns.
 * 
 * Endpoints:
 * - GET /api/backup/status - Get backup service status
 * - POST /api/backup/manual - Trigger manual backup
 * - POST /api/backup/start-scheduled - Start automatic backups
 * - POST /api/backup/stop-scheduled - Stop automatic backups
 * - GET /api/backup/history - Get backup history
 * - POST /api/backup/restore - Restore from backup (future implementation)
 */

const { backupService } = require('../services/backupService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

/**
 * Get backup service status and statistics
 * GET /api/backup/status
 */
const getBackupStatus = asyncHandler(async (req, res) => {
  const status = backupService.getStatus();
  
  res.status(200).json({
    success: true,
    message: 'Backup status retrieved successfully',
    data: status
  });
});

/**
 * Initialize backup service
 * POST /api/backup/initialize
 */
const initializeBackupService = asyncHandler(async (req, res) => {
  try {
    const result = await backupService.initialize();
    
    res.status(200).json({
      success: true,
      message: 'Backup service initialized successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initialize backup service',
      error: error.message
    });
  }
});

/**
 * Start scheduled backup jobs
 * POST /api/backup/start-scheduled
 */
const startScheduledBackups = asyncHandler(async (req, res) => {
  try {
    const result = backupService.startScheduledBackups();
    
    res.status(200).json({
      success: true,
      message: 'Scheduled backups started successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start scheduled backups',
      error: error.message
    });
  }
});

/**
 * Stop scheduled backup jobs
 * POST /api/backup/stop-scheduled
 */
const stopScheduledBackups = asyncHandler(async (req, res) => {
  try {
    const result = backupService.stopScheduledBackups();
    
    res.status(200).json({
      success: true,
      message: 'Scheduled backups stopped successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop scheduled backups',
      error: error.message
    });
  }
});

/**
 * Trigger manual backup
 * POST /api/backup/manual
 * 
 * Body:
 * - backupType?: 'manual' | 'full' | 'personal' | 'reference'
 * - collections?: string[] - specific collections to backup
 * - compress?: boolean - whether to compress backup
 */
const triggerManualBackup = asyncHandler(async (req, res) => {
  const { backupType = 'manual', collections, compress = false } = req.body;
  
  // Validate backup type
  const validTypes = ['manual', 'full', 'personal', 'reference'];

  if (!validTypes.includes(backupType)) {
    throw new ValidationError(`Invalid backup type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Determine collections to backup based on type
  let targetCollections = collections;
  
  if (!targetCollections) {
    switch (backupType) {
      case 'personal':
        targetCollections = ['psagradedcards', 'rawcards', 'sealedproducts'];
        break;
      case 'reference':
        targetCollections = ['sets', 'cards', 'setproducts', 'products'];
        break;
      case 'full':
      case 'manual':
      default:
        targetCollections = null; // Will backup all collections
    }
  }

  try {
    // Start backup process (this may take some time)
    const result = await backupService.performBackup(backupType, targetCollections, { compress });
    
    res.status(200).json({
      success: true,
      message: `${backupType} backup completed successfully`,
      data: {
        backupId: result.backupId,
        duration: result.metadata.duration,
        collections: result.metadata.collections,
        totalDocuments: Object.values(result.metadata.stats)
          .reduce((sum, stat) => sum + stat.count, 0),
        verification: result.metadata.verification
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `${backupType} backup failed`,
      error: error.message
    });
  }
});

/**
 * Get backup history
 * GET /api/backup/history?limit=20&type=all
 */
const getBackupHistory = asyncHandler(async (req, res) => {
  const { limit = 20, type = 'all' } = req.query;
  const status = backupService.getStatus();
  
  let history = status.recentBackups || [];
  
  // Filter by backup type if specified
  if (type !== 'all') {
    history = history.filter(backup => backup.backupType === type);
  }
  
  // Limit results
  const limitNum = parseInt(limit, 10);

  if (limitNum > 0) {
    history = history.slice(0, limitNum);
  }
  
  res.status(200).json({
    success: true,
    message: 'Backup history retrieved successfully',
    data: {
      history,
      stats: status.stats,
      total: history.length
    }
  });
});

/**
 * Get detailed backup information by ID
 * GET /api/backup/:backupId
 */
const getBackupDetails = asyncHandler(async (req, res) => {
  const { backupId } = req.params;
  const status = backupService.getStatus();
  
  const backup = status.recentBackups.find(b => b.backupId === backupId);
  
  if (!backup) {
    return res.status(404).json({
      success: false,
      message: 'Backup not found',
      error: `No backup found with ID: ${backupId}`
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Backup details retrieved successfully',
    data: backup
  });
});

/**
 * Test backup system (creates a small test backup)
 * POST /api/backup/test
 */
const testBackupSystem = asyncHandler(async (req, res) => {
  try {
    // Test with just the 'sets' collection for a quick test
    const result = await backupService.performBackup('test', ['sets'], { compress: false });
    
    res.status(200).json({
      success: true,
      message: 'Backup system test completed successfully',
      data: {
        backupId: result.backupId,
        duration: result.metadata.duration,
        collections: result.metadata.collections,
        verification: result.metadata.verification,
        note: 'This was a test backup of the sets collection only'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Backup system test failed',
      error: error.message
    });
  }
});

/**
 * Get backup configuration
 * GET /api/backup/config
 */
const getBackupConfig = asyncHandler(async (req, res) => {
  const { BACKUP_CONFIG } = require('../services/backupService');
  
  // Return configuration without sensitive data
  const publicConfig = {
    schedules: BACKUP_CONFIG.schedules,
    retention: BACKUP_CONFIG.retention,
    collections: BACKUP_CONFIG.collections,
    directories: {
      base: BACKUP_CONFIG.baseDir,
      archive: BACKUP_CONFIG.archiveDir
    }
  };
  
  res.status(200).json({
    success: true,
    message: 'Backup configuration retrieved successfully',
    data: publicConfig
  });
});

/**
 * Health check for backup system
 * GET /api/backup/health
 */
const healthCheck = asyncHandler(async (req, res) => {
  const status = backupService.getStatus();
  const now = new Date();
  
  // Check if service is healthy
  const isHealthy = status.initialized && 
    (status.stats.lastSuccess ? 
      (now - new Date(status.stats.lastSuccess)) < 24 * 60 * 60 * 1000 : // Within 24 hours
      true); // No backups yet is OK for new installations
      
  const healthStatus = {
    healthy: isHealthy,
    initialized: status.initialized,
    activeSchedules: status.activeSchedules.length,
    lastBackup: status.stats.lastBackup,
    lastSuccess: status.stats.lastSuccess,
    lastFailure: status.stats.lastFailure,
    successRate: status.stats.totalBackups > 0 ? 
      Math.round((status.stats.successfulBackups / status.stats.totalBackups) * 100) : 0
  };
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'Backup system is healthy' : 'Backup system has issues',
    data: healthStatus
  });
});

module.exports = {
  getBackupStatus,
  initializeBackupService,
  startScheduledBackups,
  stopScheduledBackups,
  triggerManualBackup,
  getBackupHistory,
  getBackupDetails,
  testBackupSystem,
  getBackupConfig,
  healthCheck
};