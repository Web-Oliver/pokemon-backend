const Logger = require('../utils/Logger');
const {
  auditTrailPlugin,
  rateLimitingPlugin,
  dataValidationPlugin,
  performanceMonitoringPlugin,
  responseCachingPlugin,
  errorRecoveryPlugin
} = require('./controllerPlugins');

/**
 * Plugin Manager
 * 
 * Centralized management system for controller plugins.
 * Provides plugin registration, configuration, and lifecycle management.
 */
class PluginManager {
  constructor() {
    this.availablePlugins = new Map();
    this.pluginConfigurations = new Map();
    this.globalPlugins = new Set();
    this.entityPlugins = new Map();
    
    this.registerBuiltInPlugins();
  }

  /**
   * Register built-in plugins
   */
  registerBuiltInPlugins() {
    this.registerPlugin('auditTrail', auditTrailPlugin, {
      description: 'Tracks all operations for compliance and debugging',
      category: 'monitoring',
      defaultEnabled: false
    });

    this.registerPlugin('rateLimit', rateLimitingPlugin, {
      description: 'Implements rate limiting per IP address',
      category: 'security',
      defaultEnabled: false
    });

    this.registerPlugin('dataValidation', dataValidationPlugin, {
      description: 'Additional data validation and security checks',
      category: 'security',
      defaultEnabled: true
    });

    this.registerPlugin('performanceMonitoring', performanceMonitoringPlugin, {
      description: 'Detailed performance metrics tracking',
      category: 'monitoring',
      defaultEnabled: false
    });

    this.registerPlugin('responseCache', responseCachingPlugin, {
      description: 'Intelligent response caching for read operations',
      category: 'performance',
      defaultEnabled: false
    });

    this.registerPlugin('errorRecovery', errorRecoveryPlugin, {
      description: 'Retry logic and graceful error handling',
      category: 'reliability',
      defaultEnabled: true
    });
  }

  /**
   * Register a new plugin
   * @param {string} name - Plugin name
   * @param {Object} plugin - Plugin implementation
   * @param {Object} metadata - Plugin metadata
   */
  registerPlugin(name, plugin, metadata = {}) {
    this.availablePlugins.set(name, {
      plugin,
      metadata: {
        name,
        description: metadata.description || 'No description provided',
        category: metadata.category || 'general',
        version: metadata.version || '1.0.0',
        author: metadata.author || 'unknown',
        defaultEnabled: metadata.defaultEnabled || false,
        ...metadata
      }
    });

    Logger.debug('PluginManager', `Plugin '${name}' registered`, metadata);
  }

  /**
   * Configure a plugin
   * @param {string} name - Plugin name
   * @param {Object} config - Plugin configuration
   */
  configurePlugin(name, config) {
    if (!this.availablePlugins.has(name)) {
      throw new Error(`Plugin '${name}' not found`);
    }

    this.pluginConfigurations.set(name, config);
    Logger.debug('PluginManager', `Plugin '${name}' configured`, config);
  }

  /**
   * Enable a plugin globally for all controllers
   * @param {string} name - Plugin name
   * @param {Object} config - Optional plugin configuration
   */
  enableGlobalPlugin(name, config = null) {
    if (!this.availablePlugins.has(name)) {
      throw new Error(`Plugin '${name}' not found`);
    }

    this.globalPlugins.add(name);
    
    if (config) {
      this.configurePlugin(name, config);
    }

    Logger.info('PluginManager', `Plugin '${name}' enabled globally`);
  }

  /**
   * Disable a global plugin
   * @param {string} name - Plugin name
   */
  disableGlobalPlugin(name) {
    this.globalPlugins.delete(name);
    Logger.info('PluginManager', `Plugin '${name}' disabled globally`);
  }

  /**
   * Enable a plugin for specific entity types
   * @param {string} name - Plugin name
   * @param {Array<string>} entityTypes - Entity types to enable for
   * @param {Object} config - Optional plugin configuration
   */
  enableEntityPlugin(name, entityTypes, config = null) {
    if (!this.availablePlugins.has(name)) {
      throw new Error(`Plugin '${name}' not found`);
    }

    if (!Array.isArray(entityTypes)) {
      entityTypes = [entityTypes];
    }

    entityTypes.forEach(entityType => {
      if (!this.entityPlugins.has(entityType)) {
        this.entityPlugins.set(entityType, new Set());
      }
      this.entityPlugins.get(entityType).add(name);
    });

    if (config) {
      this.configurePlugin(name, config);
    }

    Logger.info('PluginManager', `Plugin '${name}' enabled for entities: ${entityTypes.join(', ')}`);
  }

  /**
   * Get plugins for a specific entity type
   * @param {string} entityType - Entity type
   * @returns {Array} - Array of plugin objects
   */
  getPluginsForEntity(entityType) {
    const plugins = [];
    
    // Add global plugins
    for (const pluginName of this.globalPlugins) {
      const pluginData = this.availablePlugins.get(pluginName);

      if (pluginData) {
        plugins.push({
          name: pluginName,
          plugin: pluginData.plugin,
          config: this.pluginConfigurations.get(pluginName) || {},
          metadata: pluginData.metadata,
          scope: 'global'
        });
      }
    }

    // Add entity-specific plugins
    const entityPluginNames = this.entityPlugins.get(entityType) || new Set();

    for (const pluginName of entityPluginNames) {
      // Skip if already added as global plugin
      if (this.globalPlugins.has(pluginName)) {
        continue;
      }

      const pluginData = this.availablePlugins.get(pluginName);

      if (pluginData) {
        plugins.push({
          name: pluginName,
          plugin: pluginData.plugin,
          config: this.pluginConfigurations.get(pluginName) || {},
          metadata: pluginData.metadata,
          scope: 'entity'
        });
      }
    }

    return plugins;
  }

  /**
   * Apply plugins to a controller
   * @param {Object} controller - BaseController instance
   * @param {string} entityType - Entity type
   */
  applyPlugins(controller, entityType) {
    const plugins = this.getPluginsForEntity(entityType);
    
    plugins.forEach(({ name, plugin, config, metadata }) => {
      try {
        // Apply configuration to plugin if it supports it
        let configuredPlugin = plugin;

        if (plugin.configure && typeof plugin.configure === 'function') {
          configuredPlugin = plugin.configure(config);
        }

        controller.addPlugin(name, configuredPlugin);
        
        Logger.debug('PluginManager', `Applied plugin '${name}' to ${entityType} controller`, {
          scope: metadata.scope,
          category: metadata.category
        });
      } catch (error) {
        Logger.error('PluginManager', `Failed to apply plugin '${name}' to ${entityType} controller`, error);
      }
    });

    return plugins.length;
  }

  /**
   * Get all available plugins
   * @returns {Array} - Array of plugin metadata
   */
  getAvailablePlugins() {
    return Array.from(this.availablePlugins.values()).map(({ metadata }) => metadata);
  }

  /**
   * Get plugin statistics
   * @returns {Object} - Plugin statistics
   */
  getStats() {
    const pluginsByCategory = {};
    const pluginsByStatus = { enabled: 0, available: 0 };

    for (const { metadata } of this.availablePlugins.values()) {
      if (!pluginsByCategory[metadata.category]) {
        pluginsByCategory[metadata.category] = 0;
      }
      pluginsByCategory[metadata.category]++;
      pluginsByStatus.available++;

      if (this.globalPlugins.has(metadata.name)) {
        pluginsByStatus.enabled++;
      }
    }

    return {
      total: this.availablePlugins.size,
      global: this.globalPlugins.size,
      entitySpecific: Array.from(this.entityPlugins.values()).reduce((sum, set) => sum + set.size, 0),
      byCategory: pluginsByCategory,
      byStatus: pluginsByStatus,
      configured: this.pluginConfigurations.size
    };
  }

  /**
   * Validate plugin compatibility
   * @param {string} pluginName - Plugin name
   * @returns {Object} - Validation result
   */
  validatePlugin(pluginName) {
    const pluginData = this.availablePlugins.get(pluginName);

    if (!pluginData) {
      return { valid: false, error: 'Plugin not found' };
    }

    const { plugin } = pluginData;
    const issues = [];

    // Check required hook methods
    const validHooks = ['beforeOperation', 'afterOperation', 'onError', 'beforeResponse'];
    const pluginHooks = Object.keys(plugin).filter(key => typeof plugin[key] === 'function');
    
    if (pluginHooks.length === 0) {
      issues.push('Plugin has no hook methods');
    }

    const invalidHooks = pluginHooks.filter(hook => !validHooks.includes(hook) && hook !== 'configure');

    if (invalidHooks.length > 0) {
      issues.push(`Invalid hook methods: ${invalidHooks.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      hooks: pluginHooks,
      metadata: pluginData.metadata
    };
  }

  /**
   * Remove a plugin
   * @param {string} name - Plugin name
   */
  removePlugin(name) {
    this.availablePlugins.delete(name);
    this.pluginConfigurations.delete(name);
    this.globalPlugins.delete(name);
    
    // Remove from entity-specific plugins
    for (const [entityType, plugins] of this.entityPlugins) {
      plugins.delete(name);
      if (plugins.size === 0) {
        this.entityPlugins.delete(entityType);
      }
    }

    Logger.info('PluginManager', `Plugin '${name}' removed`);
  }

  /**
   * Reset plugin manager to default state
   */
  reset() {
    this.availablePlugins.clear();
    this.pluginConfigurations.clear();
    this.globalPlugins.clear();
    this.entityPlugins.clear();
    
    this.registerBuiltInPlugins();
    Logger.info('PluginManager', 'Plugin manager reset to default state');
  }
}

// Create and export singleton instance
const pluginManager = new PluginManager();

module.exports = {
  PluginManager,
  pluginManager
};