#!/bin/bash

# MongoDB Backup Script for Pokemon Collection Database
# Created using MongoDB documentation from Context7 MCP
# Backs up psagradedcards, rawcards, and sealedproducts collections

# Configuration
DB_NAME="pokemon-collection"
BACKUP_DIR="$(dirname "$0")/../backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${DATE}"
LOG_FILE="${BACKUP_DIR}/backup_${DATE}.log"

# MongoDB connection settings
MONGO_HOST="localhost"
MONGO_PORT="27017"
MONGO_URI="mongodb://${MONGO_HOST}:${MONGO_PORT}/${DB_NAME}"

# Collections to backup
COLLECTIONS=("psagradedcards" "rawcards" "sealedproducts" "cards" "sets" "cardmarketreferenceproducts" "auctions")

# Retention policy (days)
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

# Warning message
warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_PATH"
    mkdir -p "$BACKUP_PATH" || error_exit "Failed to create backup directory"
    mkdir -p "$BACKUP_DIR" || error_exit "Failed to create base backup directory"
}

# Test MongoDB connection
test_connection() {
    log "Testing MongoDB connection to $MONGO_URI"
    if ! mongosh "$MONGO_URI" --eval "db.runCommand('ping')" --quiet > /dev/null 2>&1; then
        error_exit "Cannot connect to MongoDB at $MONGO_URI"
    fi
    success "MongoDB connection successful"
}

# Backup all collections
backup_collections() {
    log "Starting backup of Pokemon collection database"
    
    # Full database backup
    log "Creating full database backup..."
    if mongodump --uri="$MONGO_URI" --out="$BACKUP_PATH" 2>> "$LOG_FILE"; then
        success "Full database backup completed"
    else
        error_exit "Full database backup failed"
    fi
    
    # Individual collection backups for critical collections
    log "Creating individual collection backups for critical collections..."
    for collection in "${COLLECTIONS[@]}"; do
        log "Backing up collection: $collection"
        
        collection_path="${BACKUP_PATH}/individual/${collection}"
        mkdir -p "$collection_path"
        
        if mongodump \
            --uri="$MONGO_URI" \
            --collection="$collection" \
            --out="$collection_path" 2>> "$LOG_FILE"; then
            success "Collection '$collection' backup completed"
        else
            warning "Collection '$collection' backup failed or collection doesn't exist"
        fi
    done
}

# Create compressed archive
create_archive() {
    log "Creating compressed archive..."
    cd "$BACKUP_DIR" || error_exit "Failed to change to backup directory"
    
    ARCHIVE_NAME="${DATE}_pokemon_collection_backup.tar.gz"
    
    if tar -czf "$ARCHIVE_NAME" "$DATE" 2>> "$LOG_FILE"; then
        success "Archive created: $ARCHIVE_NAME"
        
        # Get archive size
        ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
        log "Archive size: $ARCHIVE_SIZE"
        
        # Remove uncompressed backup directory
        rm -rf "$DATE"
        log "Removed uncompressed backup directory"
    else
        error_exit "Failed to create archive"
    fi
}

# Generate backup report
generate_report() {
    REPORT_FILE="${BACKUP_PATH}_report.txt"
    
    cat > "$REPORT_FILE" << EOF
Pokemon Collection Database Backup Report
==========================================
Date: $(date)
Database: $DB_NAME
MongoDB URI: $MONGO_URI
Backup Path: $BACKUP_PATH
Archive: ${DATE}_pokemon_collection_backup.tar.gz

Collections Backed Up:
EOF
    
    for collection in "${COLLECTIONS[@]}"; do
        echo "- $collection" >> "$REPORT_FILE"
    done
    
    cat >> "$REPORT_FILE" << EOF

Backup Status: SUCCESS
Log File: $LOG_FILE

Note: This backup includes all Pokemon collection data including:
- PSA Graded Cards (psagradedcards)
- Raw Cards (rawcards)  
- Sealed Products (sealedproducts)
- Card Definitions (cards)
- Set Information (sets)
- Market Reference Data (cardmarketreferenceproducts)
- Auction Data (auctions)
EOF
    
    log "Backup report generated: $REPORT_FILE"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -name "*_pokemon_collection_backup.tar.gz" -mtime +$RETENTION_DAYS -delete 2>> "$LOG_FILE"
    find "$BACKUP_DIR" -name "backup_*.log" -mtime +$RETENTION_DAYS -delete 2>> "$LOG_FILE"
    find "$BACKUP_DIR" -name "*_report.txt" -mtime +$RETENTION_DAYS -delete 2>> "$LOG_FILE"
    
    success "Old backup cleanup completed"
}

# Main execution
main() {
    log "=== Pokemon Collection MongoDB Backup Started ==="
    
    create_backup_dir
    test_connection
    backup_collections
    create_archive
    generate_report
    cleanup_old_backups
    
    success "=== Pokemon Collection MongoDB Backup Completed Successfully ==="
    
    # Display summary
    echo ""
    echo "Backup Summary:"
    echo "- Database: $DB_NAME"
    echo "- Collections: ${#COLLECTIONS[@]}"
    echo "- Archive: ${DATE}_pokemon_collection_backup.tar.gz"
    echo "- Location: $BACKUP_DIR"
    echo "- Log: $LOG_FILE"
}

# Run main function
main "$@"