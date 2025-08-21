/**
 * Progress reporting utility to eliminate duplication across processing utilities
 * Follows DRY principles by centralizing progress reporting patterns
 */
class ProgressReporter {
  constructor(taskName = 'Processing', totalItems = 0) {
    this.taskName = taskName;
    this.totalItems = totalItems;
    this.processedItems = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.startTime = Date.now();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Update progress counters
   * @param {string} status - 'success', 'error', or 'skipped'
   * @param {string} message - Optional message for errors/warnings
   */
  updateProgress(status = 'success', message = null) {
    this.processedItems++;

    switch (status) {
      case 'success':
        this.successCount++;
        break;
      case 'error':
        this.errorCount++;
        if (message) this.errors.push(message);
        break;
      case 'skipped':
        this.skippedCount++;
        break;
    }

    // Log progress every 10% or every 100 items
    const shouldLog = this.processedItems % Math.max(1, Math.floor(this.totalItems / 10)) === 0 ||
                      this.processedItems % 100 === 0;

    if (shouldLog || this.processedItems === this.totalItems) {
      this.logProgress();
    }
  }

  /**
   * Log current progress
   */
  logProgress() {
    const percentage = this.totalItems > 0
      ? Math.round((this.processedItems / this.totalItems) * 100)
      : 0;

    const elapsed = Date.now() - this.startTime;
    const itemsPerSecond = elapsed > 0
      ? Math.round((this.processedItems / elapsed) * 1000)
      : 0;

    console.log(`   ${this.taskName}: ${this.processedItems}/${this.totalItems} (${percentage}%) - ${itemsPerSecond} items/sec`);
  }

  /**
   * Add a warning message
   * @param {string} message - Warning message
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Get formatted summary report
   * @returns {string} Summary report
   */
  getSummary() {
    const elapsed = Date.now() - this.startTime;
    const duration = this.formatDuration(elapsed);

    let summary = `\n📊 ${this.taskName} Summary:\n`;

    summary += `   Total Processed: ${this.processedItems}\n`;
    summary += `   ✅ Successful: ${this.successCount}\n`;

    if (this.errorCount > 0) {
      summary += `   ❌ Errors: ${this.errorCount}\n`;
    }

    if (this.skippedCount > 0) {
      summary += `   ⏭️  Skipped: ${this.skippedCount}\n`;
    }

    summary += `   ⏱️  Duration: ${duration}\n`;

    if (this.warnings.length > 0) {
      summary += `\n⚠️  Warnings (${this.warnings.length}):\n`;
      this.warnings.slice(0, 5).forEach(warning => {
        summary += `   - ${warning}\n`;
      });
      if (this.warnings.length > 5) {
        summary += `   ... and ${this.warnings.length - 5} more warnings\n`;
      }
    }

    if (this.errors.length > 0) {
      summary += `\n❌ Errors (${this.errors.length}):\n`;
      this.errors.slice(0, 5).forEach(error => {
        summary += `   - ${error}\n`;
      });
      if (this.errors.length > 5) {
        summary += `   ... and ${this.errors.length - 5} more errors\n`;
      }
    }

    return summary;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.log(this.getSummary());
  }

  /**
   * Format duration in human-readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
      return `${seconds}s`;

  }

  /**
   * Get success rate as percentage
   * @returns {number} Success rate percentage
   */
  getSuccessRate() {
    return this.processedItems > 0
      ? Math.round((this.successCount / this.processedItems) * 100)
      : 0;
  }

  /**
   * Check if processing completed successfully
   * @returns {boolean} True if no errors occurred
   */
  isSuccess() {
    return this.errorCount === 0;
  }

  /**
   * Get processing statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      taskName: this.taskName,
      totalItems: this.totalItems,
      processedItems: this.processedItems,
      successCount: this.successCount,
      errorCount: this.errorCount,
      skippedCount: this.skippedCount,
      duration: Date.now() - this.startTime,
      successRate: this.getSuccessRate(),
      warningCount: this.warnings.length,
      isSuccess: this.isSuccess()
    };
  }

  /**
   * Reset all counters and timers
   */
  reset() {
    this.processedItems = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.startTime = Date.now();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Set total items for progress calculation
   * @param {number} total - Total number of items to process
   */
  setTotal(total) {
    this.totalItems = total;
  }
}

export default ProgressReporter;
