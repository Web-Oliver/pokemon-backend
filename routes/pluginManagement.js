const express = require('express');
const { pluginManager } = require('../plugins/PluginManager');

const router = express.Router();

// Get all available plugins
router.get('/plugins', (req, res) => {
  try {
    const plugins = pluginManager.getAvailablePlugins();
    const stats = pluginManager.getStats();
    
    res.json({
      success: true,
      data: {
        plugins,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get plugin statistics
router.get('/plugins/stats', (req, res) => {
  try {
    const stats = pluginManager.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enable a plugin globally
router.post('/plugins/:name/enable', (req, res) => {
  try {
    const { name } = req.params;
    const { config } = req.body;
    
    pluginManager.enableGlobalPlugin(name, config);
    
    res.json({
      success: true,
      data: {
        message: `Plugin '${name}' enabled globally`,
        plugin: name,
        scope: 'global'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Disable a global plugin
router.post('/plugins/:name/disable', (req, res) => {
  try {
    const { name } = req.params;
    
    pluginManager.disableGlobalPlugin(name);
    
    res.json({
      success: true,
      data: {
        message: `Plugin '${name}' disabled globally`,
        plugin: name
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Enable plugin for specific entities
router.post('/plugins/:name/enable-entity', (req, res) => {
  try {
    const { name } = req.params;
    const { entityTypes, config } = req.body;
    
    if (!entityTypes || !Array.isArray(entityTypes)) {
      return res.status(400).json({
        success: false,
        error: 'entityTypes array is required'
      });
    }
    
    pluginManager.enableEntityPlugin(name, entityTypes, config);
    
    res.json({
      success: true,
      data: {
        message: `Plugin '${name}' enabled for entities: ${entityTypes.join(', ')}`,
        plugin: name,
        entityTypes,
        scope: 'entity'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Configure a plugin
router.put('/plugins/:name/config', (req, res) => {
  try {
    const { name } = req.params;
    const { config } = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'config object is required'
      });
    }
    
    pluginManager.configurePlugin(name, config);
    
    res.json({
      success: true,
      data: {
        message: `Plugin '${name}' configured`,
        plugin: name,
        config
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Validate a plugin
router.get('/plugins/:name/validate', (req, res) => {
  try {
    const { name } = req.params;
    const validation = pluginManager.validatePlugin(name);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get plugins for a specific entity
router.get('/entities/:entityType/plugins', (req, res) => {
  try {
    const { entityType } = req.params;
    const plugins = pluginManager.getPluginsForEntity(entityType);
    
    res.json({
      success: true,
      data: {
        entityType,
        plugins: plugins.map(p => ({
          name: p.name,
          metadata: p.metadata,
          config: p.config,
          scope: p.scope
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset plugin manager
router.post('/plugins/reset', (req, res) => {
  try {
    pluginManager.reset();
    
    res.json({
      success: true,
      data: {
        message: 'Plugin manager reset to default state'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;