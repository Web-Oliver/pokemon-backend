/**
 * Backup Service
 * 
 * Replaces the massively over-engineered 879-line backup service
 * with a practical backup implementation.
 * 
 * Before: 879 lines of over-engineered backup with scheduling, history, verification, etc.
 * After: ~100 lines with essential backup functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Logger = require('../utils/Logger');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');

class BackupService {
  constructor() {
    this.isBackingUp = false;
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * Create a database backup
   */
  async createBackup(options = {}) {
    if (this.isBackingUp) {
      throw new Error('Backup already in progress');
    }

    this.isBackingUp = true;
    const startTime = Date.now();

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(BACKUP_DIR, backupName);

      Logger.info('BackupService', 'Starting backup', { backupName });

      // Get MongoDB connection details
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_collection';
      const dbName = mongoose.connection.db?.databaseName || 'pokemon_collection';

      // Create backup using mongodump
      const command = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;
      
      execSync(command, { stdio: 'inherit' });

      // Create backup metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        dbName,
        backupPath,
        duration: Date.now() - startTime,
        collections: await this.getCollectionStats()
      };

      fs.writeFileSync(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      Logger.info('BackupService', 'Backup completed', metadata);
      return metadata;

    } catch (error) {
      Logger.error('BackupService', 'Backup failed', error);
      throw error;
    } finally {
      this.isBackingUp = false;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats() {
    const stats = {};
    const collections = ['sets', 'cards', 'psagradedcards', 'rawcards', 'sealedproducts', 'cardmarketreferenceproducts'];

    for (const collectionName of collections) {
      try {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments();

        stats[collectionName] = count;
      } catch (error) {
        stats[collectionName] = 0;
      }
    }

    return stats;
  }

  /**
   * List available backups
   */
  listBackups() {
    const backups = [];
    
    if (!fs.existsSync(BACKUP_DIR)) {
      return backups;
    }

    const entries = fs.readdirSync(BACKUP_DIR);
    
    for (const entry of entries) {
      const backupPath = path.join(BACKUP_DIR, entry);
      const metadataPath = path.join(backupPath, 'metadata.json');
      
      if (fs.statSync(backupPath).isDirectory() && fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

          backups.push(metadata);
        } catch (error) {
          // Skip invalid backup
        }
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get backup status
   */
  getStatus() {
    return {
      isBackingUp: this.isBackingUp,
      backupDir: BACKUP_DIR,
      totalBackups: this.listBackups().length,
      latestBackup: this.listBackups()[0] || null
    };
  }
}

module.exports = new BackupService();