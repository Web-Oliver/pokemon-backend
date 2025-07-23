# Pokemon Collection MongoDB Backup System

This directory contains scripts for backing up and restoring the Pokemon Collection MongoDB database, specifically designed for the **psagradedcards**, **rawcards**, and **sealedproducts** collections.

## Files Overview

- `backup-mongodb.sh` - Main backup script
- `restore-mongodb.sh` - Main restore script  
- `schedule-backups.sh` - Automated backup scheduler
- `README-BACKUPS.md` - This documentation file

## Quick Start

### 1. Setup Backup System

```bash
# Make scripts executable
chmod +x backup-mongodb.sh restore-mongodb.sh schedule-backups.sh

# Run initial backup
./backup-mongodb.sh

# Setup automated backups (run as root)
sudo ./schedule-backups.sh
```

### 2. Basic Backup Operations

```bash
# Manual backup
./backup-mongodb.sh

# List available backups
./restore-mongodb.sh --list

# Restore from latest backup
./restore-mongodb.sh /opt/backup/mongodb/20231201_120000_pokemon_collection_backup.tar.gz
```

## Detailed Usage

### Backup Script (`backup-mongodb.sh`)

Creates comprehensive backups of the Pokemon Collection database.

**Features:**
- Full database backup using `mongodump`
- Individual collection backups for critical collections
- Automatic compression (tar.gz)
- Retention policy (30 days by default)
- Detailed logging and reporting
- Connection testing

**Collections Backed Up:**
- `psagradedcards` - PSA graded Pokemon cards
- `rawcards` - Raw/ungraded Pokemon cards
- `sealedproducts` - Sealed Pokemon products
- `cards` - Card definitions
- `sets` - Pokemon set information
- `cardmarketreferenceproducts` - Market reference data
- `auctions` - Auction data

**Output:**
- Compressed archive: `YYYYMMDD_HHMMSS_pokemon_collection_backup.tar.gz`
- Log file: `backup_YYYYMMDD_HHMMSS.log`
- Report file: `YYYYMMDD_HHMMSS_report.txt`

### Restore Script (`restore-mongodb.sh`)

Restores data from backup archives or directories.

**Usage Examples:**

```bash
# List available backups
./restore-mongodb.sh --list

# Full restore from archive
./restore-mongodb.sh /path/to/backup.tar.gz

# Restore specific collection
./restore-mongodb.sh -c psagradedcards /path/to/backup.tar.gz

# Restore with drop (replaces existing data)
./restore-mongodb.sh --drop /path/to/backup.tar.gz

# Dry run (show what would be restored)
./restore-mongodb.sh --dry-run /path/to/backup.tar.gz

# Restore from directory
./restore-mongodb.sh /opt/backup/mongodb/20231201_120000/
```

**Options:**
- `-c, --collection NAME` - Restore only specific collection
- `-d, --drop` - Drop existing collections before restore
- `-n, --dry-run` - Show what would be restored
- `--list` - List available backups
- `-h, --help` - Show help

### Scheduler Script (`schedule-backups.sh`)

Interactive script to set up automated backups.

**Features:**
- Daily backup (2:00 AM)
- Weekly backup (Sunday 3:00 AM)  
- Hourly backup
- Custom cron schedule
- Systemd service alternative
- Easy removal of schedules

**Usage:**
```bash
# Must run as root
sudo ./schedule-backups.sh
```

## Configuration

### MongoDB Connection

Edit the scripts to modify connection settings:

```bash
# In backup-mongodb.sh and restore-mongodb.sh
MONGO_HOST="localhost"
MONGO_PORT="27017" 
DB_NAME="pokemon-collection"
```

### Backup Directory

Default backup location: `/opt/backup/mongodb`

To change, edit:
```bash
BACKUP_DIR="/your/custom/path"
```

### Retention Policy

Default: 30 days. To change, edit in `backup-mongodb.sh`:
```bash
RETENTION_DAYS=30
```

## Monitoring and Logs

### Log Locations
- Backup logs: `/opt/backup/mongodb/backup_YYYYMMDD_HHMMSS.log`
- Restore logs: `/opt/backup/mongodb/restore_YYYYMMDD_HHMMSS.log`
- Cron logs: `/var/log/pokemon-backup.log`

### Checking Backup Status

```bash
# View recent backups
ls -la /opt/backup/mongodb/*.tar.gz

# Check cron jobs
crontab -l | grep backup

# Check systemd timer (if using systemd)
systemctl status pokemon-backup.timer
```

## Recovery Procedures

### Emergency Recovery

1. **Identify the backup to restore:**
   ```bash
   ./restore-mongodb.sh --list
   ```

2. **Test the restore (dry run):**
   ```bash
   ./restore-mongodb.sh --dry-run /path/to/backup.tar.gz
   ```

3. **Restore specific collection:**
   ```bash
   ./restore-mongodb.sh -c psagradedcards /path/to/backup.tar.gz
   ```

4. **Full restore (destructive):**
   ```bash
   ./restore-mongodb.sh --drop /path/to/backup.tar.gz
   ```

### Partial Recovery

To restore only Pokemon card collections:

```bash
# Restore PSA cards only
./restore-mongodb.sh -c psagradedcards /path/to/backup.tar.gz

# Restore raw cards only  
./restore-mongodb.sh -c rawcards /path/to/backup.tar.gz

# Restore sealed products only
./restore-mongodb.sh -c sealedproducts /path/to/backup.tar.gz
```

## Troubleshooting

### Common Issues

1. **Permission denied:**
   ```bash
   chmod +x *.sh
   sudo chown -R $(whoami) /opt/backup/mongodb
   ```

2. **MongoDB connection failed:**
   - Check if MongoDB is running: `systemctl status mongod`
   - Verify connection settings in scripts
   - Test connection: `mongosh mongodb://localhost:27017/pokemon-collection`

3. **Disk space issues:**
   ```bash
   # Check disk space
   df -h /opt/backup/mongodb
   
   # Clean old backups manually
   find /opt/backup/mongodb -name "*.tar.gz" -mtime +30 -delete
   ```

4. **Backup corruption:**
   ```bash
   # Test archive integrity
   tar -tzf backup.tar.gz > /dev/null && echo "Archive OK" || echo "Archive corrupted"
   ```

### Validation

After restore, validate data:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/pokemon-collection

# Check collection counts
db.psagradedcards.countDocuments({})
db.rawcards.countDocuments({})
db.sealedproducts.countDocuments({})

# Check sample documents
db.psagradedcards.findOne()
db.rawcards.findOne()
db.sealedproducts.findOne()
```

## Security Considerations

- Backup files contain sensitive data - secure storage recommended
- Consider encryption for backups stored off-site
- Regular testing of restore procedures
- Monitor backup logs for failures
- Set up alerts for backup failures

## Performance Notes

- Backups may impact MongoDB performance during execution
- Schedule backups during low-traffic periods
- Consider using MongoDB secondary for backups in production
- Monitor disk I/O during backup operations

## Best Practices

1. **Regular Testing:** Test restore procedures monthly
2. **Multiple Locations:** Store backups in multiple locations
3. **Monitoring:** Set up alerts for backup failures  
4. **Documentation:** Keep restore procedures documented
5. **Automation:** Use the scheduler for consistent backups
6. **Validation:** Always validate restored data

## Support Commands

```bash
# Manual MongoDB operations for troubleshooting
mongodump --db pokemon-collection --out /tmp/manual-backup
mongorestore --db pokemon-collection /tmp/manual-backup/pokemon-collection

# Check MongoDB replication lag (if using replica sets)
mongosh --eval "rs.printSlaveReplicationInfo()"

# Database statistics
mongosh pokemon-collection --eval "db.stats()"
```