/**
 * Controller Plugin Manager
 * 
 * Single Responsibility: Manages controller plugins and hooks
 * Extracted from BaseController to follow SRP principle
 */

import Logger from '@/Infrastructure/Utilities/Logger.js';

class ControllerPluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map(['beforeOperation', 'afterOperation', 'onError', 'beforeResponse'].map(hook => [hook, []]));
  }

  /**
   * Add a plugin to the controller
   * @param {string} name - Plugin name
   * @param {Object} plugin - Plugin object with hook handlers
   */
  addPlugin(name, plugin) {
    this.plugins.set(name, plugin);

    // Register plugin hooks
    Object.keys(plugin).forEach(hookName => {
      if (this.hooks.has(hookName)) {
        this.hooks.get(hookName).push({
          pluginName: name,
          handler: plugin[hookName]
        });
      }
    });

    Logger.debug('ControllerPluginManager', `Plugin '${name}' added`);
  }

  /**
   * Remove a plugin from the controller
   * @param {string} name - Plugin name
   */
  removePlugin(name) {
    if (this.plugins.has(name)) {
      // Remove plugin hooks
      this.hooks.forEach((handlers, hookName) => {
        this.hooks.set(hookName, handlers.filter(h => h.pluginName !== name));
      });

      this.plugins.delete(name);
      Logger.debug('ControllerPluginManager', `Plugin '${name}' removed`);
    }
  }

  /**
   * Execute hooks for a specific event
   * @param {string} hookName - Hook name
   * @param {string} operation - Operation name
   * @param {*} data - Hook data
   * @param {Object} context - Operation context
   */
  async executeHooks(hookName, operation, data, context = {}) {
    const handlers = this.hooks.get(hookName) || [];

    for (const { pluginName, handler } of handlers) {
      try {
        const result = await handler(operation, data, context);

        if (hookName === 'beforeResponse' && result !== undefined) {
          data = result;
        }
      } catch (error) {
        Logger.error('ControllerPluginManager', `Plugin '${pluginName}' hook '${hookName}' failed`, error);
      }
    }

    return data;
  }

  /**
   * Get list of registered plugin names
   * @returns {Array<string>} Plugin names
   */
  getPluginNames() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if a plugin is registered
   * @param {string} name - Plugin name
   * @returns {boolean} True if plugin is registered
   */
  hasPlugin(name) {
    return this.plugins.has(name);
  }

  /**
   * Get plugin count
   * @returns {number} Number of registered plugins
   */
  getPluginCount() {
    return this.plugins.size;
  }
}

export default ControllerPluginManager;