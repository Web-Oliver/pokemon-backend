#!/bin/bash

# MongoDB Restore Script for Pokemon Collection Database
# Created using MongoDB documentation from Context7 MCP
# Restores psagradedcards, rawcards, and sealedproducts collections

# Configuration
DB_NAME="pokemon-collection"
BACKUP_DIR="$(dirname "$0")/../backups"
RESTORE_LOG="$(dirname "$0")/../backups/restore_$(date +%Y%m%d_%H%M%S).log"

# MongoDB connection settings
MONGO_HOST="localhost"
MONGO_PORT="27017"
MONGO_URI="mongodb://${MONGO_HOST}:${MONGO_PORT}/${DB_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$RESTORE_LOG"
}

# Error handling
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$RESTORE_LOG"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a "$RESTORE_LOG"
}

# Warning message
warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$RESTORE_LOG"
}

# Info message
info() {
    echo -e "${BLUE}INFO: $1${NC}" | tee -a "$RESTORE_LOG"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS] <backup_file_or_directory>"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -c, --collection NAME   Restore only specific collection"
    echo "  -d, --drop              Drop existing collections before restore"
    echo "  -n, --dry-run           Show what would be restored without doing it"
    echo "  --list                  List available backups"
    echo ""
    echo "Examples:"
    echo "  $0 /opt/backup/mongodb/20231201_120000_pokemon_collection_backup.tar.gz"
    echo "  $0 -c psagradedcards /opt/backup/mongodb/backup_folder"
    echo "  $0 --drop /opt/backup/mongodb/latest_backup"
    echo "  $0 --list"
    exit 1
}

# List available backups
list_backups() {
    info "Available backups in $BACKUP_DIR:"
    echo ""
    
    if ls "$BACKUP_DIR"/*_pokemon_collection_backup.tar.gz 1> /dev/null 2>&1; then
        for backup in "$BACKUP_DIR"/*_pokemon_collection_backup.tar.gz; do
            if [ -f "$backup" ]; then
                filename=$(basename "$backup")
                size=$(du -h "$backup" | cut -f1)
                date_created=$(stat -c %y "$backup" | cut -d' ' -f1,2 | cut -d'.' -f1)
                echo "- $filename (Size: $size, Created: $date_created)"
            fi
        done
    else
        warning "No backup archives found in $BACKUP_DIR"
    fi
    
    echo ""
    if ls "$BACKUP_DIR"/[0-9]*_[0-9]* 1> /dev/null 2>&1; then
        info "Available backup directories:"
        for backup_dir in "$BACKUP_DIR"/[0-9]*_[0-9]*; do
            if [ -d "$backup_dir" ]; then
                dirname=$(basename "$backup_dir")
                size=$(du -sh "$backup_dir" | cut -f1)
                echo "- $dirname (Size: $size)"
            fi
        done
    fi
}

# Test MongoDB connection
test_connection() {
    log "Testing MongoDB connection to $MONGO_URI"
    if ! mongosh "$MONGO_URI" --eval "db.runCommand('ping')" --quiet > /dev/null 2>&1; then
        error_exit "Cannot connect to MongoDB at $MONGO_URI"
    fi
    success "MongoDB connection successful"
}

# Extract archive if needed
extract_backup() {
    local backup_source="$1"
    
    if [[ "$backup_source" == *.tar.gz ]] || [[ "$backup_source" == *.tgz ]]; then
        log "Extracting backup archive: $backup_source"
        
        if [ ! -f "$backup_source" ]; then
            error_exit "Backup file not found: $backup_source"
        fi
        
        # Create temporary extraction directory
        TEMP_EXTRACT_DIR=$(mktemp -d)
        cd "$TEMP_EXTRACT_DIR" || error_exit "Failed to change to temp directory"
        
        if tar -xzf "$backup_source" 2>> "$RESTORE_LOG"; then
            success "Archive extracted successfully"
            
            # Find the backup directory (should be the only directory)
            BACKUP_DATA_DIR=$(find . -maxdepth 1 -type d ! -name "." | head -1)
            if [ -z "$BACKUP_DATA_DIR" ]; then
                error_exit "No backup directory found in archive"
            fi
            
            BACKUP_DATA_DIR="$TEMP_EXTRACT_DIR/$BACKUP_DATA_DIR"
        else
            error_exit "Failed to extract archive"
        fi
    else
        # Assume it's already a directory
        if [ ! -d "$backup_source" ]; then
            error_exit "Backup directory not found: $backup_source"
        fi
        BACKUP_DATA_DIR="$backup_source"
    fi
    
    log "Using backup data directory: $BACKUP_DATA_DIR"
}

# Get collection info from backup
get_backup_info() {
    local backup_dir="$1"
    
    info "Analyzing backup contents..."
    
    # Check if it's a full database backup
    if [ -d "$backup_dir/$DB_NAME" ]; then
        COLLECTIONS_IN_BACKUP=($(ls "$backup_dir/$DB_NAME" | grep -E '\.bson$' | sed 's/\.bson$//' | sort))
    else
        # Check for individual collection backups
        COLLECTIONS_IN_BACKUP=($(find "$backup_dir" -name "*.bson" -exec basename {} \; | sed 's/\.bson$//' | sort | uniq))
    fi
    
    if [ ${#COLLECTIONS_IN_BACKUP[@]} -eq 0 ]; then
        error_exit "No collections found in backup"
    fi
    
    info "Collections found in backup: ${COLLECTIONS_IN_BACKUP[*]}"
}

# Restore collections
restore_collections() {
    local backup_dir="$1"
    local specific_collection="$2"
    local drop_collections="$3"
    local dry_run="$4"
    
    log "Starting restore operation..."
    
    if [ "$dry_run" = true ]; then
        info "DRY RUN MODE - No actual restore will be performed"
    fi
    
    # Prepare restore path
    local restore_path
    if [ -d "$backup_dir/$DB_NAME" ]; then
        restore_path="$backup_dir"
    else
        restore_path="$backup_dir"
    fi
    
    # Build mongorestore command
    local restore_cmd="mongorestore"
    restore_cmd="$restore_cmd --uri=$MONGO_URI"
    
    if [ "$drop_collections" = true ]; then
        restore_cmd="$restore_cmd --drop"
        warning "Will drop existing collections before restore"
    fi
    
    if [ -n "$specific_collection" ]; then
        restore_cmd="$restore_cmd --collection=$specific_collection"
        info "Restoring only collection: $specific_collection"
    fi
    
    restore_cmd="$restore_cmd $restore_path"
    
    log "Restore command: $restore_cmd"
    
    if [ "$dry_run" = true ]; then
        info "Would execute: $restore_cmd"
        return 0
    fi
    
    # Execute restore
    if eval "$restore_cmd" 2>> "$RESTORE_LOG"; then
        success "Restore completed successfully"
    else
        error_exit "Restore operation failed"
    fi
}

# Verify restore
verify_restore() {
    local specific_collection="$1"
    
    log "Verifying restore..."
    
    if [ -n "$specific_collection" ]; then
        # Verify specific collection
        local count=$(mongosh "$MONGO_URI" --eval "db.$specific_collection.countDocuments({})" --quiet 2>/dev/null)
        if [ "$count" -gt 0 ] 2>/dev/null; then
            success "Collection '$specific_collection' verified: $count documents"
        else
            warning "Collection '$specific_collection' verification failed or empty"
        fi
    else
        # Verify all Pokemon collections
        local pokemon_collections=("psagradedcards" "rawcards" "sealedproducts" "cards" "sets")
        
        for collection in "${pokemon_collections[@]}"; do
            local count=$(mongosh "$MONGO_URI" --eval "db.$collection.countDocuments({})" --quiet 2>/dev/null)
            if [ "$count" -gt 0 ] 2>/dev/null; then
                success "Collection '$collection' verified: $count documents"
            else
                info "Collection '$collection': No documents or doesn't exist"
            fi
        done
    fi
}

# Main execution
main() {
    local backup_source=""
    local specific_collection=""
    local drop_collections=false
    local dry_run=false
    local list_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -c|--collection)
                specific_collection="$2"
                shift 2
                ;;
            -d|--drop)
                drop_collections=true
                shift
                ;;
            -n|--dry-run)
                dry_run=true
                shift
                ;;
            --list)
                list_only=true
                shift
                ;;
            -*)
                error_exit "Unknown option: $1"
                ;;
            *)
                backup_source="$1"
                shift
                ;;
        esac
    done
    
    log "=== Pokemon Collection MongoDB Restore Started ==="
    
    if [ "$list_only" = true ]; then
        list_backups
        exit 0
    fi
    
    if [ -z "$backup_source" ]; then
        error_exit "No backup source specified. Use --help for usage information."
    fi
    
    test_connection
    extract_backup "$backup_source"
    get_backup_info "$BACKUP_DATA_DIR"
    restore_collections "$BACKUP_DATA_DIR" "$specific_collection" "$drop_collections" "$dry_run"
    
    if [ "$dry_run" = false ]; then
        verify_restore "$specific_collection"
    fi
    
    # Cleanup temporary directory
    if [ -n "$TEMP_EXTRACT_DIR" ] && [ -d "$TEMP_EXTRACT_DIR" ]; then
        rm -rf "$TEMP_EXTRACT_DIR"
        log "Cleaned up temporary files"
    fi
    
    success "=== Pokemon Collection MongoDB Restore Completed ==="
    
    # Display summary
    echo ""
    echo "Restore Summary:"
    echo "- Database: $DB_NAME"
    echo "- Source: $backup_source"
    echo "- Collections in backup: ${#COLLECTIONS_IN_BACKUP[@]}"
    if [ -n "$specific_collection" ]; then
        echo "- Restored collection: $specific_collection"
    fi
    echo "- Log: $RESTORE_LOG"
}

# Run main function
main "$@"