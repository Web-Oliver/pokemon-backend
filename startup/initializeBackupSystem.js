/**
 * Backup System Startup Initialization
 * 
 * Automatically initializes and starts the backup system when the server starts.
 * Following CLAUDE.md principles for robust error handling and logging.
 */

const { backupService } = require('../services/backupService');

/**
 * Initialize backup system on server startup
 */
async function initializeBackupSystem() {
  console.log('🔄 Initializing automatic backup system...');
  
  try {
    // Wait a bit more for database to be fully ready
    console.log('⏳ Waiting for database connection to stabilize...');
    await new Promise(resolve => {
      setTimeout(resolve, 2000);
    });
    
    // Initialize backup service
    await backupService.initialize();
    console.log('✅ Backup service initialized successfully');
    
    // Start scheduled backups
    const result = backupService.startScheduledBackups();

    console.log('✅ Scheduled backups started');
    console.log('📅 Backup Schedules:');
    console.log('   - Daily (Personal collections): 2:00 AM');
    console.log('   - Weekly (Full backup): Sunday 1:00 AM');  
    console.log('   - Monthly (Archive): 1st of month 12:00 AM');
    
    // Log backup configuration
    const status = backupService.getStatus();

    console.log('📊 Backup System Ready:');
    console.log(`   - Backup directory: ${status.config.directories.base}`);
    console.log(`   - Archive directory: ${status.config.directories.archive}`);
    console.log(`   - Active schedules: ${status.activeSchedules.length}`);
    
    return {
      success: true,
      message: 'Backup system initialized and started successfully'
    };
    
  } catch (error) {
    console.error('❌ Failed to initialize backup system:', error.message);
    console.error('⚠️ Server will continue without automatic backups');
    console.error('💡 You can manually initialize backups via API: POST /api/backup/initialize');
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Graceful shutdown handler for backup system
 */
function shutdownBackupSystem() {
  console.log('🔄 Shutting down backup system...');
  
  try {
    backupService.stopScheduledBackups();
    console.log('✅ Backup system shutdown complete');
  } catch (error) {
    console.error('❌ Error during backup system shutdown:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  shutdownBackupSystem();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdownBackupSystem();
  process.exit(0);
});

module.exports = {
  initializeBackupSystem,
  shutdownBackupSystem
};