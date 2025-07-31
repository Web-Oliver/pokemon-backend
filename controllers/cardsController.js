const Card = require('../models/Card');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const container = require('../container');
const BaseController = require('./base/BaseController');
const { pluginManager } = require('../plugins/PluginManager');

// Cards Controller using BaseController with plugins
class CardsController extends BaseController {
  constructor() {
    super('cardRepository', {
      entityName: 'Card',
      pluralName: 'cards',
      includeMarkAsSold: false,
      enableCaching: true,
      enablePlugins: true,
      enableMetrics: true,
      filterableFields: ['setId', 'cardName', 'baseName', 'pokemonNumber', 'year']
    });

    // Apply plugins specific to cards
    pluginManager.applyPlugins(this, 'Card');

    // Add custom card-specific plugin
    this.addPlugin('cardSpecificEnhancements', {
      beforeOperation: async (operation, data, context) => {
        // Add card-specific validation or processing
        if (operation === 'create' && data.pokemonNumber) {
          // Validate Pokemon number format
          if (!/^\d+$/.test(data.pokemonNumber)) {
            const error = new Error('Pokemon number must be numeric');

            error.statusCode = 400;
            throw error;
          }
        }
      },
      
      beforeResponse: (operation, data, context) => {
        // Add card-specific metadata
        if (data.data && Array.isArray(data.data)) {
          data.meta = {
            ...data.meta,
            cardCount: data.data.length,
            hasSetInfo: data.data.some(card => card.setId),
            searchEnhanced: true
          };
        }
        return data;
      }
    });
  }


  // Get controller metrics
  getControllerMetrics = asyncHandler(async (req, res) => {
    const metrics = this.getMetrics();
    
    res.status(200).json({
      success: true,
      data: metrics
    });
  });
}

// Create controller instance
const cardsController = new CardsController();

module.exports = {
  getAllCards: cardsController.getAll,
  getCardById: cardsController.getById,
  createCard: cardsController.create,
  updateCard: cardsController.update,
  deleteCard: cardsController.delete,
  getCardMetrics: cardsController.getControllerMetrics,
  getCardsBySetId: async (req, res, next) => {
    req.query.setId = req.params.setId;
    return cardsController.getAll(req, res, next);
  }
};