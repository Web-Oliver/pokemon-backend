/**
 * Automatic Backup Service for Pokemon Collection
 * 
 * Implements comprehensive backup system following CLAUDE.md SOLID principles.
 * Uses Context7 MCP MongoDB and node-cron documentation for robust scheduling.
 * 
 * Features:
 * - Automatic scheduled backups of all collection data
 * - Manual backup triggers
 * - Collection-specific backup strategies  
 * - Backup retention management
 * - MongoDB mongodump integration
 * - Comprehensive error handling and monitoring
 */

const cron = require('node-cron');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Logger = require('../utils/Logger');

// Import models for collection verification
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');
const SetModel = require('../models/Set');
const Card = require('../models/Card');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');

/**
 * Backup Service Configuration
 * Following SOLID Single Responsibility Principle
 */
const BACKUP_CONFIG = {
  // Backup directories
  baseDir: path.join(process.cwd(), 'backups'),
  tempDir: path.join(process.cwd(), 'backups', 'temp'),
  archiveDir: path.join(process.cwd(), 'backups', 'archive'),
  
  // Collection categories for strategic backup
  collections: {
    // Personal collection data (most critical)
    personal: ['psagradedcards', 'rawcards', 'sealedproducts'],
    // Reference data (important but less frequently changed)
    reference: ['sets', 'cards', 'cardmarketreferenceproducts'],
    // System data (backup for completeness)
    system: ['auctions', 'dbaselections']
  },
  
  // Backup schedules (cron format)
  schedules: {
    // Daily backup of personal collection data at 2 AM
    daily: '0 2 * * *',
    // Weekly full backup on Sunday at 1 AM  
    weekly: '0 1 * * 0',
    // Monthly archive backup on 1st at midnight
    monthly: '0 0 1 * *'
  },
  
  // Retention policies
  retention: {
    daily: 7,    // Keep 7 daily backups
    weekly: 4,   // Keep 4 weekly backups  
    monthly: 12, // Keep 12 monthly backups
    archive: 24  // Keep 24 monthly archives
  },
  
  // MongoDB connection
  dbName: process.env.MONGO_DB_NAME || 'pokemon_collection',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017'
};

class BackupService {
  constructor() {
    this.isInitialized = false;
    this.activeJobs = new Map();
    this.backupHistory = [];
    this.stats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      lastBackup: null,
      lastSuccess: null,
      lastFailure: null
    };
  }

  /**
   * Initialize backup service and create directories
   * Following SOLID Dependency Inversion Principle
   */
  async initialize() {
    const startTime = Date.now();

    Logger.operationStart('BACKUP_SERVICE', 'INITIALIZE', { baseDir: BACKUP_CONFIG.baseDir });

    try {
      // Create backup directories
      await this.ensureDirectories();
      
      // Verify MongoDB connection
      await this.verifyDatabaseConnection();
      
      // Load backup history
      await this.loadBackupHistory();
      
      this.isInitialized = true;
      
      Logger.performance('BackupService.initialize', Date.now() - startTime);
      Logger.operationSuccess('BACKUP_SERVICE', 'INITIALIZE', { 
        initialized: true,
        historyEntries: this.backupHistory.length 
      });
      
      return { success: true, message: 'Backup service initialized' };
    } catch (error) {
      Logger.operationError('BACKUP_SERVICE', 'INITIALIZE', error, { baseDir: BACKUP_CONFIG.baseDir });
      throw new Error(`Backup service initialization failed: ${error.message}`);
    }
  }

  /**
   * Start automatic backup scheduling
   * Uses node-cron for reliable scheduling
   */
  startScheduledBackups() {
    if (!this.isInitialized) {
      throw new Error('Backup service not initialized. Call initialize() first.');
    }

    try {
      // Daily personal collection backup
      const dailyJob = cron.schedule(BACKUP_CONFIG.schedules.daily, async () => {
        await this.performBackup('daily', BACKUP_CONFIG.collections.personal);
      }, {
        scheduled: false,
        timezone: "Europe/Copenhagen"
      });

      // Weekly full backup
      const weeklyJob = cron.schedule(BACKUP_CONFIG.schedules.weekly, async () => {
        await this.performBackup('weekly', [
          ...BACKUP_CONFIG.collections.personal,
          ...BACKUP_CONFIG.collections.reference,
          ...BACKUP_CONFIG.collections.system
        ]);
      }, {
        scheduled: false,
        timezone: "Europe/Copenhagen"
      });

      // Monthly archive backup
      const monthlyJob = cron.schedule(BACKUP_CONFIG.schedules.monthly, async () => {
        await this.performArchiveBackup();
      }, {
        scheduled: false,
        timezone: "Europe/Copenhagen"
      });

      // Start all jobs
      dailyJob.start();
      weeklyJob.start();
      monthlyJob.start();

      // Store job references
      this.activeJobs.set('daily', dailyJob);
      this.activeJobs.set('weekly', weeklyJob);
      this.activeJobs.set('monthly', monthlyJob);

      Logger.operationSuccess('BACKUP_SERVICE', 'START_SCHEDULED_BACKUPS', {
        daily: BACKUP_CONFIG.schedules.daily,
        weekly: BACKUP_CONFIG.schedules.weekly,
        monthly: BACKUP_CONFIG.schedules.monthly,
        activeJobs: this.activeJobs.size
      });

      return {
        success: true,
        message: 'Scheduled backups started',
        schedules: BACKUP_CONFIG.schedules
      };
    } catch (error) {
      Logger.operationError('BACKUP_SERVICE', 'START_SCHEDULED_BACKUPS', error);
      throw error;
    }
  }

  /**
   * Perform backup operation with specified type and collections
   * Following SOLID Open/Closed Principle for extensibility
   */
  async performBackup(backupType = 'manual', collections = null, options = {}) {
    const backupId = this.generateBackupId(backupType);
    const startTime = new Date();
    
    Logger.operationStart('BACKUP_SERVICE', 'PERFORM_BACKUP', {
      backupType,
      backupId,
      collectionsCount: collections?.length || 0
    });
    
    try {
      Logger.service('BackupService', 'performBackup', 'Starting backup', { backupType, backupId });
      this.stats.totalBackups++;

      // Default to all collections if none specified
      if (!collections) {
        collections = [
          ...BACKUP_CONFIG.collections.personal,
          ...BACKUP_CONFIG.collections.reference,
          ...BACKUP_CONFIG.collections.system
        ];
      }

      // Create backup directory
      const backupDir = path.join(BACKUP_CONFIG.baseDir, backupType, backupId);

      await this.ensureDirectory(backupDir);

      // Perform collection counts and verification
      const preBackupStats = await this.getCollectionStats(collections);
      
      // Execute MongoDB backup using mongodump
      const dumpResult = await this.executeMongoDump(backupDir, collections, options);
      
      // Verify backup integrity
      const verificationResult = await this.verifyBackup(backupDir, preBackupStats);
      
      // Create backup metadata
      const metadata = {
        backupId,
        backupType,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        collections,
        stats: preBackupStats,
        verification: verificationResult,
        mongoDumpResult: dumpResult,
        success: true
      };

      // Save metadata
      await this.saveBackupMetadata(backupDir, metadata);
      
      // Update service stats
      this.stats.successfulBackups++;
      this.stats.lastBackup = startTime;
      this.stats.lastSuccess = startTime;
      
      // Add to history
      this.backupHistory.unshift(metadata);
      await this.saveBackupHistory();

      // Clean up old backups based on retention policy
      await this.cleanupOldBackups(backupType);

      Logger.performance('BackupService.performBackup', metadata.duration, {
        backupType,
        collections: collections.length,
        totalDocuments: Object.values(preBackupStats).reduce((sum, stat) => sum + stat.count, 0)
      });
      
      Logger.operationSuccess('BACKUP_SERVICE', 'PERFORM_BACKUP', {
        backupType,
        backupId,
        duration: metadata.duration,
        collections: collections.length,
        totalDocuments: Object.values(preBackupStats).reduce((sum, stat) => sum + stat.count, 0)
      });

      return {
        success: true,
        backupId,
        metadata,
        message: `${backupType} backup completed successfully`
      };

    } catch (error) {
      this.stats.failedBackups++;
      this.stats.lastFailure = new Date();
      
      const errorMetadata = {
        backupId,
        backupType,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        collections,
        error: error.message,
        success: false
      };

      this.backupHistory.unshift(errorMetadata);
      await this.saveBackupHistory();

      Logger.operationError('BACKUP_SERVICE', 'PERFORM_BACKUP', error, {
        backupType,
        backupId,
        duration: errorMetadata.duration
      });

      throw error;
    }
  }

  /**
   * Execute MongoDB mongodump command with selective filtering for reference collections
   * Based on Context7 MCP MongoDB documentation
   */
  async executeMongoDump(backupDir, collections, options = {}) {
    const {dbName} = BACKUP_CONFIG;
    const {mongoUri} = BACKUP_CONFIG;
    
    try {
      const results = [];
      
      // Get referenced IDs for selective backup
      const referencedIds = await this.getReferencedIds();
      
      // Backup each collection individually for better control
      for (const collection of collections) {
        const collectionBackupDir = path.join(backupDir, collection);

        await this.ensureDirectory(collectionBackupDir);
        
        // Build mongodump command - don't add dbName to URI if it's already there
        const baseUri = mongoUri.includes(dbName) ? mongoUri : `${mongoUri}/${dbName}`;
        const mongoDumpCmd = [
          'mongodump',
          `--uri="${baseUri}"`,
          `--collection=${collection}`,
          `--out="${collectionBackupDir}"`,
          '--gzip' // Compress output
        ];

        // Add query filter for reference collections to only backup referenced items
        if (collection === 'cards') {
          if (referencedIds.cardIds.length > 0) {
            // Convert ObjectIds to proper format for mongodump
            const oidArray = referencedIds.cardIds.map(id => ({ "$oid": id.toString() }));
            const queryFilter = JSON.stringify({ _id: { $in: oidArray } });

            mongoDumpCmd.push(`--query='${queryFilter}'`);
            Logger.debug('BackupService', 'Applying filter to cards collection', { 
              cardCount: referencedIds.cardIds.length 
            });
          } else {
            const queryFilter = JSON.stringify({ _id: { $in: [] } });

            mongoDumpCmd.push(`--query='${queryFilter}'`);
          }
        } else if (collection === 'sets') {
          if (referencedIds.setIds.length > 0) {
            // Convert ObjectIds to proper format for mongodump
            const oidArray = referencedIds.setIds.map(id => ({ "$oid": id.toString() }));
            const queryFilter = JSON.stringify({ _id: { $in: oidArray } });

            mongoDumpCmd.push(`--query='${queryFilter}'`);
            Logger.debug('BackupService', 'Applying filter to sets collection', { 
              setCount: referencedIds.setIds.length 
            });
          } else {
            const queryFilter = JSON.stringify({ _id: { $in: [] } });

            mongoDumpCmd.push(`--query='${queryFilter}'`);
          }
        } else if (collection === 'cardmarketreferenceproducts') {
          if (referencedIds.productIds.length > 0) {
            // Convert ObjectIds to proper format for mongodump
            const oidArray = referencedIds.productIds.map(id => ({ "$oid": id.toString() }));
            const queryFilter = JSON.stringify({ _id: { $in: oidArray } });

            mongoDumpCmd.push(`--query='${queryFilter}'`);
            Logger.debug('BackupService', 'Applying filter to cardmarketreferenceproducts collection', { 
              productCount: referencedIds.productIds.length 
            });
          } else {
            const queryFilter = JSON.stringify({ _id: { $in: [] } });

            mongoDumpCmd.push(`--query='${queryFilter}'`);
          }
        }

        const finalCommand = mongoDumpCmd.join(' ');

        Logger.debug('BackupService', 'Executing mongodump for collection', { collection, command: finalCommand });

        // Execute command synchronously for better error handling
        try {
          const output = execSync(finalCommand, { 
            encoding: 'utf8',
            timeout: 300000, // 5 minute timeout
            maxBuffer: 1024 * 1024 * 100 // 100MB buffer
          });
          
          results.push({
            collection,
            success: true,
            output: output.toString(),
            backupPath: collectionBackupDir,
            isFiltered: ['cards', 'sets', 'cardmarketreferenceproducts'].includes(collection)
          });
          
          Logger.debug('BackupService', 'Successfully backed up collection', { 
            collection,
            outputPath: collectionBackupDir,
            filtered: ['cards', 'sets', 'cardmarketreferenceproducts'].includes(collection)
          });
          
        } catch (cmdError) {
          // Get more detailed error information
          const errorDetails = {
            message: cmdError.message,
            code: cmdError.code,
            stderr: cmdError.stderr ? cmdError.stderr.toString() : null,
            stdout: cmdError.stdout ? cmdError.stdout.toString() : null,
            command: finalCommand
          };
          
          results.push({
            collection,
            success: false,
            error: cmdError.message,
            errorDetails,
            backupPath: collectionBackupDir,
            isFiltered: ['cards', 'sets', 'cardmarketreferenceproducts'].includes(collection)
          });
          
          Logger.error('BackupService', 'Failed to backup collection', { collection, ...errorDetails });
        }
      }

      // Check if any backups succeeded
      const successfulBackups = results.filter(r => r.success);

      if (successfulBackups.length === 0) {
        throw new Error('All collection backups failed');
      }

      if (successfulBackups.length < results.length) {
        Logger.warn('BackupService', 'Some collections failed to backup', {
          successful: successfulBackups.length,
          total: results.length,
          failed: results.filter(r => !r.success).map(r => r.collection)
        });
      }

      // Log filtering summary
      const filteredCollections = results.filter(r => r.isFiltered);

      if (filteredCollections.length > 0) {
        Logger.service('BackupService', 'executeMongoDump', 'Applied selective filtering to reference collections', {
          filtered: filteredCollections.map(r => r.collection),
          referencedCardIds: referencedIds.cardIds.length,
          referencedSetIds: referencedIds.setIds.length,
          referencedProductIds: referencedIds.productIds.length
        });
      }

      return {
        results,
        successful: successfulBackups.length,
        total: results.length,
        partialSuccess: successfulBackups.length < results.length,
        filtering: {
          applied: filteredCollections.length > 0,
          collections: filteredCollections.map(r => r.collection),
          referencedIds
        }
      };

    } catch (error) {
      Logger.error('BackupService', 'MongoDB dump execution failed', error);
      throw new Error(`MongoDB backup failed: ${error.message}`);
    }
  }

  /**
   * Get IDs of reference data that has collection items attached
   * Only backup reference data that is actually used in the collection
   */
  async getReferencedIds() {
    try {
      // Get all unique card IDs from PSA and Raw cards
      const [psaCardIds, rawCardIds, sealedProductIds] = await Promise.all([
        PsaGradedCard.distinct('cardId'),
        RawCard.distinct('cardId'), 
        SealedProduct.distinct('productId')
      ]);

      // Combine card IDs from both collections, removing duplicates
      const referencedCardIds = [...psaCardIds, ...rawCardIds]
        .filter((id, index, array) => array.findIndex(item => item.toString() === id.toString()) === index);
      
      // Get set IDs from the referenced cards
      const referencedSetIds = await Card.distinct('setId', { 
        _id: { $in: referencedCardIds } 
      });

      return {
        cardIds: referencedCardIds,
        setIds: referencedSetIds,
        productIds: sealedProductIds
      };
    } catch (error) {
      Logger.error('BackupService', 'Failed to get referenced IDs', error);
      throw error;
    }
  }

  /**
   * Get statistics for collections before backup
   * For reference collections, only count items that have collection items attached
   */
  async getCollectionStats(collections) {
    const stats = {};
    
    // Get referenced IDs for selective backup
    const referencedIds = await this.getReferencedIds();
    
    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        let query = {};
        let count = 0;
        let sampleDoc = null;

        // Apply selective filtering for reference collections
        if (collectionName === 'cards') {
          if (referencedIds.cardIds.length > 0) {
            query = { _id: { $in: referencedIds.cardIds } };
          } else {
            query = { _id: { $in: [] } }; // Empty result when no cards referenced
          }
        } else if (collectionName === 'sets') {
          if (referencedIds.setIds.length > 0) {
            query = { _id: { $in: referencedIds.setIds } };
          } else {
            query = { _id: { $in: [] } }; // Empty result when no sets referenced
          }
        } else if (collectionName === 'cardmarketreferenceproducts') {
          if (referencedIds.productIds.length > 0) {
            query = { _id: { $in: referencedIds.productIds } };
          } else {
            query = { _id: { $in: [] } }; // Empty result when no products referenced
          }
        }

        count = await collection.countDocuments(query);
        if (count > 0) {
          sampleDoc = await collection.findOne(query);
        }
        
        stats[collectionName] = {
          count,
          hasData: count > 0,
          sampleId: sampleDoc ? sampleDoc._id : null,
          isFiltered: Object.keys(query).length > 0,
          filterApplied: query
        };

        Logger.debug('BackupService', 'Collection stats', {
          collectionName,
          count,
          hasData: count > 0,
          isFiltered: Object.keys(query).length > 0
        });

      } catch (error) {
        stats[collectionName] = {
          count: 0,
          hasData: false,
          error: error.message,
          isFiltered: false
        };
      }
    }
    
    return stats;
  }

  /**
   * Verify backup integrity by checking files exist and have content
   */
  async verifyBackup(backupDir, preBackupStats) {
    const verification = {
      success: true,
      checks: [],
      errors: []
    };

    try {
      for (const [collectionName, stats] of Object.entries(preBackupStats)) {
        const collectionBackupDir = path.join(backupDir, collectionName, BACKUP_CONFIG.dbName);
        const bsonFile = path.join(collectionBackupDir, `${collectionName}.bson.gz`);
        const metadataFile = path.join(collectionBackupDir, `${collectionName}.metadata.json.gz`);

        const check = {
          collection: collectionName,
          expectedCount: stats.count,
          bsonExists: false,
          metadataExists: false,
          bsonSize: 0,
          success: false
        };

        // Check if backup files exist
        if (fs.existsSync(bsonFile)) {
          check.bsonExists = true;
          check.bsonSize = fs.statSync(bsonFile).size;
        }

        if (fs.existsSync(metadataFile)) {
          check.metadataExists = true;
        }

        // Verify backup is valid (has data if collection had data)
        if (stats.count > 0) {
          check.success = check.bsonExists && check.bsonSize > 0;
        } else {
          check.success = true; // Empty collections don't need files
        }

        if (!check.success) {
          verification.errors.push(`Collection ${collectionName} backup verification failed`);
          verification.success = false;
        }

        verification.checks.push(check);
      }

    } catch (error) {
      verification.success = false;
      verification.errors.push(`Verification process failed: ${error.message}`);
    }

    return verification;
  }

  /**
   * Perform archive backup with compression and long-term storage
   */
  async performArchiveBackup() {
    try {
      const archiveResult = await this.performBackup('archive', null, { compress: true });
      
      // Move to archive directory with additional compression
      const archiveId = archiveResult.backupId;
      const sourceDir = path.join(BACKUP_CONFIG.baseDir, 'archive', archiveId);
      const archiveFile = path.join(BACKUP_CONFIG.archiveDir, `${archiveId}.tar.gz`);
      
      // Create compressed archive
      const tarCmd = `tar -czf "${archiveFile}" -C "${path.dirname(sourceDir)}" "${path.basename(sourceDir)}"`;

      execSync(tarCmd);
      
      // Verify archive was created
      if (fs.existsSync(archiveFile)) {
        const archiveSize = fs.statSync(archiveFile).size;

        Logger.service('BackupService', 'performArchiveBackup', 'Archive backup created successfully', {
          archiveId,
          archiveFile,
          size: `${Math.round(archiveSize / 1024 / 1024)}MB`
        });
        
        // Remove uncompressed backup directory
        execSync(`rm -rf "${sourceDir}"`);
        
        return {
          ...archiveResult,
          archiveFile,
          archiveSize
        };
      } 
        throw new Error('Archive file was not created');
      
      
    } catch (error) {
      Logger.error('BackupService', 'Archive backup failed', error);
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(backupType) {
    try {
      const backupTypeDir = path.join(BACKUP_CONFIG.baseDir, backupType);

      if (!fs.existsSync(backupTypeDir)) return;

      const retention = BACKUP_CONFIG.retention[backupType] || 7;
      const backupDirs = fs.readdirSync(backupTypeDir)
        .filter(dir => fs.statSync(path.join(backupTypeDir, dir)).isDirectory())
        .sort()
        .reverse(); // Most recent first

      if (backupDirs.length > retention) {
        const toDelete = backupDirs.slice(retention);
        
        for (const dirName of toDelete) {
          const dirPath = path.join(backupTypeDir, dirName);

          execSync(`rm -rf "${dirPath}"`);
          Logger.debug('BackupService', 'Cleaned up old backup', { dirName });
        }
        
        Logger.service('BackupService', 'cleanupOldBackups', 'Cleaned up old backups', {
          count: toDelete.length,
          backupType
        });
      }
      
    } catch (error) {
      Logger.warn('BackupService', 'Backup cleanup failed', { backupType, error: error.message });
    }
  }

  /**
   * Stop all scheduled backup jobs
   */
  stopScheduledBackups() {
    this.activeJobs.forEach((job, name) => {
      job.stop();
      job.destroy();
    });
    this.activeJobs.clear();
    
    Logger.service('BackupService', 'stopScheduledBackups', 'All scheduled backup jobs stopped', {
      stoppedJobs: this.activeJobs.size
    });
    return { success: true, message: 'Scheduled backups stopped' };
  }

  /**
   * Get backup service status and statistics
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeSchedules: Array.from(this.activeJobs.keys()),
      stats: this.stats,
      recentBackups: this.backupHistory.slice(0, 10),
      config: {
        schedules: BACKUP_CONFIG.schedules,
        retention: BACKUP_CONFIG.retention,
        directories: {
          base: BACKUP_CONFIG.baseDir,
          archive: BACKUP_CONFIG.archiveDir
        }
      }
    };
  }

  /**
   * Generate unique backup identifier
   */
  generateBackupId(backupType) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 5);

    return `${backupType}-${timestamp}-${random}`;
  }

  /**
   * Utility methods for directory and file management
   */
  async ensureDirectories() {
    const dirs = [
      BACKUP_CONFIG.baseDir,
      BACKUP_CONFIG.tempDir,
      BACKUP_CONFIG.archiveDir,
      path.join(BACKUP_CONFIG.baseDir, 'daily'),
      path.join(BACKUP_CONFIG.baseDir, 'weekly'),
      path.join(BACKUP_CONFIG.baseDir, 'archive'),
      path.join(BACKUP_CONFIG.baseDir, 'manual')
    ];

    for (const dir of dirs) {
      await this.ensureDirectory(dir);
    }
  }

  async ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async verifyDatabaseConnection() {
    try {
      // Wait for connection if it's still connecting
      if (mongoose.connection.readyState === 2) { // CONNECTING
        Logger.service('BackupService', 'verifyDatabaseConnection', 'Waiting for MongoDB connection');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Database connection timeout'));
          }, 10000); // 10 second timeout
          
          mongoose.connection.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          mongoose.connection.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
      }
      
      const isConnected = mongoose.connection.readyState === 1;

      if (!isConnected) {
        throw new Error(`MongoDB connection not established. State: ${mongoose.connection.readyState}`);
      }
      
      // Test database access
      const testCollection = mongoose.connection.db.collection('sets');
      const count = await testCollection.countDocuments({});
      
      Logger.debug('BackupService', 'Database connection verified', { 
        setsCount: count,
        dbName: mongoose.connection.db.databaseName 
      });
    } catch (error) {
      throw new Error(`Database verification failed: ${error.message}`);
    }
  }

  async saveBackupMetadata(backupDir, metadata) {
    const metadataFile = path.join(backupDir, 'backup-metadata.json');

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  }

  async loadBackupHistory() {
    const historyFile = path.join(BACKUP_CONFIG.baseDir, 'backup-history.json');

    if (fs.existsSync(historyFile)) {
      try {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));

        this.backupHistory = history.slice(0, 100); // Keep last 100 entries
      } catch (error) {
        Logger.warn('BackupService', 'Failed to load backup history', { error: error.message });
        this.backupHistory = [];
      }
    }
  }

  async saveBackupHistory() {
    const historyFile = path.join(BACKUP_CONFIG.baseDir, 'backup-history.json');

    try {
      fs.writeFileSync(historyFile, JSON.stringify(this.backupHistory.slice(0, 100), null, 2));
    } catch (error) {
      Logger.warn('BackupService', 'Failed to save backup history', { error: error.message });
    }
  }

  /**
   * Enhanced logging utility using centralized Logger
   * Provides operation tracking and performance metrics for backup operations
   */
  logBackupOperation(operation, data = {}) {
    Logger.service('BackupService', operation, `Backup operation: ${operation}`, data);
  }
}

// Export singleton instance
const backupService = new BackupService();

module.exports = {
  BackupService,
  backupService,
  BACKUP_CONFIG
};