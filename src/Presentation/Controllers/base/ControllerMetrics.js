/**
 * Controller Metrics Manager
 * 
 * Single Responsibility: Manages controller operation metrics and performance tracking
 * Extracted from BaseController to follow SRP principle
 */

class ControllerMetrics {
  constructor() {
    this.metrics = {
      operations: new Map(),
      errors: new Map(),
      responseTime: new Map(),
    };
  }

  /**
   * Update operation metrics
   * @param {string} operation - Operation name
   * @param {string} status - Operation status ('success' or 'error')
   * @param {number} duration - Operation duration in ms
   */
  updateMetrics(operation, status, duration) {
    if (!this.metrics.operations.has(operation)) {
      this.metrics.operations.set(operation, { success: 0, error: 0 });
    }

    this.metrics.operations.get(operation)[status]++;

    if (!this.metrics.responseTime.has(operation)) {
      this.metrics.responseTime.set(operation, []);
    }

    const times = this.metrics.responseTime.get(operation);
    times.push(duration);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * Get metrics for a specific operation
   * @param {string} operation - Operation name
   * @returns {Object} - Operation metrics
   */
  getOperationMetrics(operation) {
    const ops = this.metrics.operations.get(operation) || { success: 0, error: 0 };
    const times = this.metrics.responseTime.get(operation) || [];

    const avgResponseTime = times.length > 0
      ? Math.round(times.reduce((sum, time) => sum + time, 0) / times.length)
      : 0;

    return {
      totalOperations: ops.success + ops.error,
      successRate: ops.success + ops.error > 0
        ? Math.round((ops.success / (ops.success + ops.error)) * 100)
        : 100,
      averageResponseTime: avgResponseTime
    };
  }

  /**
   * Get all controller metrics
   * @param {string} entityName - Entity name for context
   * @param {Array<string>} pluginNames - Plugin names for context
   * @returns {Object} - Complete metrics object
   */
  getAllMetrics(entityName, pluginNames = []) {
    const allMetrics = {};

    for (const [operation, stats] of this.metrics.operations) {
      allMetrics[operation] = this.getOperationMetrics(operation);
    }

    return {
      entityType: entityName,
      operations: allMetrics,
      plugins: pluginNames,
      totalPlugins: pluginNames.length
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      operations: new Map(),
      errors: new Map(),
      responseTime: new Map(),
    };
  }

  /**
   * Get operation statistics
   * @returns {Object} Overall statistics
   */
  getStatistics() {
    let totalOps = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let totalMeasurements = 0;

    for (const [operation, stats] of this.metrics.operations) {
      totalOps += stats.success + stats.error;
      totalErrors += stats.error;
      
      const times = this.metrics.responseTime.get(operation) || [];
      totalResponseTime += times.reduce((sum, time) => sum + time, 0);
      totalMeasurements += times.length;
    }

    return {
      totalOperations: totalOps,
      totalErrors: totalErrors,
      overallSuccessRate: totalOps > 0 ? Math.round(((totalOps - totalErrors) / totalOps) * 100) : 100,
      averageResponseTime: totalMeasurements > 0 ? Math.round(totalResponseTime / totalMeasurements) : 0
    };
  }
}

export default ControllerMetrics;