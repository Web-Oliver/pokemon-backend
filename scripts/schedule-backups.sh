#!/bin/bash

# MongoDB Backup Scheduler for Pokemon Collection Database
# Sets up automated backups using cron

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-mongodb.sh"
BACKUP_DIR="/opt/backup/mongodb"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Messages
success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

error() {
    echo -e "${RED}ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root to set up system-wide backups"
        exit 1
    fi
}

# Create backup directory and set permissions
setup_directories() {
    info "Setting up backup directories..."
    
    mkdir -p "$BACKUP_DIR"
    chmod 755 "$BACKUP_DIR"
    
    # Make backup script executable
    chmod +x "$BACKUP_SCRIPT"
    
    success "Directories created and permissions set"
}

# Show current cron jobs
show_current_cron() {
    info "Current backup cron jobs:"
    crontab -l 2>/dev/null | grep -E "(backup-mongodb|pokemon.*backup)" || echo "No backup cron jobs found"
}

# Setup different backup schedules
setup_backup_schedule() {
    local schedule_type="$1"
    
    # Remove existing backup cron jobs
    info "Removing existing Pokemon backup cron jobs..."
    (crontab -l 2>/dev/null | grep -v "backup-mongodb" | grep -v "pokemon.*backup") | crontab -
    
    case "$schedule_type" in
        "daily")
            info "Setting up daily backup at 2:00 AM..."
            (crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_SCRIPT >> /var/log/pokemon-backup.log 2>&1") | crontab -
            success "Daily backup scheduled for 2:00 AM"
            ;;
        "weekly")
            info "Setting up weekly backup on Sunday at 3:00 AM..."
            (crontab -l 2>/dev/null; echo "0 3 * * 0 $BACKUP_SCRIPT >> /var/log/pokemon-backup.log 2>&1") | crontab -
            success "Weekly backup scheduled for Sunday 3:00 AM"
            ;;
        "hourly")
            info "Setting up hourly backup at minute 0..."
            (crontab -l 2>/dev/null; echo "0 * * * * $BACKUP_SCRIPT >> /var/log/pokemon-backup.log 2>&1") | crontab -
            success "Hourly backup scheduled"
            ;;
        "custom")
            echo "Enter custom cron schedule (e.g., '0 */6 * * *' for every 6 hours):"
            read -r custom_schedule
            if [ -n "$custom_schedule" ]; then
                (crontab -l 2>/dev/null; echo "$custom_schedule $BACKUP_SCRIPT >> /var/log/pokemon-backup.log 2>&1") | crontab -
                success "Custom backup schedule set: $custom_schedule"
            else
                error "No schedule provided"
                return 1
            fi
            ;;
        *)
            error "Invalid schedule type: $schedule_type"
            return 1
            ;;
    esac
}

# Create systemd service for backup
create_systemd_service() {
    info "Creating systemd service for Pokemon backup..."
    
    cat > /etc/systemd/system/pokemon-backup.service << EOF
[Unit]
Description=Pokemon Collection MongoDB Backup
After=network.target mongod.service

[Service]
Type=oneshot
User=root
ExecStart=$BACKUP_SCRIPT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    cat > /etc/systemd/system/pokemon-backup.timer << EOF
[Unit]
Description=Run Pokemon Collection MongoDB Backup daily
Requires=pokemon-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable pokemon-backup.timer
    systemctl start pokemon-backup.timer
    
    success "Systemd service and timer created"
}

# Show menu
show_menu() {
    echo ""
    echo "Pokemon Collection MongoDB Backup Scheduler"
    echo "==========================================="
    echo ""
    echo "1) Setup daily backup (2:00 AM)"
    echo "2) Setup weekly backup (Sunday 3:00 AM)"
    echo "3) Setup hourly backup"
    echo "4) Setup custom schedule"
    echo "5) Create systemd service (alternative to cron)"
    echo "6) Show current backup schedule"
    echo "7) Remove backup schedule"
    echo "8) Test backup now"
    echo "9) Exit"
    echo ""
}

# Remove backup schedule
remove_schedule() {
    info "Removing backup schedules..."
    
    # Remove cron jobs
    (crontab -l 2>/dev/null | grep -v "backup-mongodb" | grep -v "pokemon.*backup") | crontab -
    
    # Remove systemd service
    if systemctl is-enabled pokemon-backup.timer >/dev/null 2>&1; then
        systemctl stop pokemon-backup.timer
        systemctl disable pokemon-backup.timer
        rm -f /etc/systemd/system/pokemon-backup.service
        rm -f /etc/systemd/system/pokemon-backup.timer
        systemctl daemon-reload
    fi
    
    success "All backup schedules removed"
}

# Test backup
test_backup() {
    info "Running backup test..."
    if [ -x "$BACKUP_SCRIPT" ]; then
        "$BACKUP_SCRIPT"
    else
        error "Backup script not found or not executable: $BACKUP_SCRIPT"
    fi
}

# Main menu loop
main() {
    check_root
    setup_directories
    
    while true; do
        show_menu
        echo -n "Please select an option (1-9): "
        read -r choice
        
        case $choice in
            1)
                setup_backup_schedule "daily"
                ;;
            2)
                setup_backup_schedule "weekly"
                ;;
            3)
                setup_backup_schedule "hourly"
                ;;
            4)
                setup_backup_schedule "custom"
                ;;
            5)
                create_systemd_service
                ;;
            6)
                show_current_cron
                if systemctl is-active pokemon-backup.timer >/dev/null 2>&1; then
                    info "Systemd timer is active"
                    systemctl status pokemon-backup.timer --no-pager -l
                fi
                ;;
            7)
                remove_schedule
                ;;
            8)
                test_backup
                ;;
            9)
                info "Exiting..."
                exit 0
                ;;
            *)
                warning "Invalid option. Please select 1-9."
                ;;
        esac
        
        echo ""
        echo "Press Enter to continue..."
        read -r
    done
}

# Show usage if called with arguments
if [ $# -gt 0 ]; then
    case "$1" in
        "--help"|"-h")
            echo "Usage: $0 [--help]"
            echo ""
            echo "Interactive Pokemon Collection MongoDB backup scheduler"
            echo "Sets up automated backups using cron or systemd"
            echo ""
            echo "Must be run as root."
            exit 0
            ;;
        *)
            error "Unknown argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
fi

# Run main function
main