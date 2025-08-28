import Card from '@/pokemon/cards/Card.js';
import { asyncHandler, NotFoundError, ValidationError } from '@/system/middleware/CentralizedErrorHandler.js';
import { container } from '@/system/dependency-injection/ServiceContainer.js';
import BaseController from '@/system/middleware/BaseController.js';
import { pluginManager } from '@/system/plugins/PluginManager.js';
// Cards Controller using BaseController with plugins
class CardsController extends BaseController {
  constructor() {
    super('SearchService', {
      entityName: 'Card',
      pluralName: 'cards',
      includeMarkAsSold: false,
      enableCaching: true,
      enablePlugins: true,
      enableMetrics: true,
      filterableFields: ['setId', 'cardName', 'cardNumber', 'variety', 'uniquePokemonId', 'uniqueSetId']
    });

    // Apply plugins specific to cards
    pluginManager.applyPlugins(this, 'Card');

    // Add custom card-specific plugin
    this.addPlugin('cardSpecificEnhancements', {
      beforeOperation: async (operation, data, context) => {
        // Add card-specific validation or processing
        if (operation === 'create' && data.cardNumber) {
          // Validate card number format
          if (!data.cardNumber.trim()) {
            const error = new Error('Card number cannot be empty');

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

// Lazy controller instance creation
let cardsController = null;

const getController = () => {
  if (!cardsController) {
    cardsController = new CardsController();
  }
  return cardsController;
};

// Export controller methods for route binding with lazy initialization
const getAll = (req, res, next) => getController().getAll(req, res, next);
const getById = (req, res, next) => getController().getById(req, res, next);
const create = (req, res, next) => getController().create(req, res, next);
const update = (req, res, next) => getController().update(req, res, next);
const deleteCard = (req, res, next) => getController().delete(req, res, next);
const getControllerMetrics = (req, res, next) => getController().getControllerMetrics(req, res, next);

// Aliases for different naming conventions
export const createCard = create;
export const updateCard = update;
export const getCardById = getById;
export const getAllCards = getAll;
export const getCardMetrics = getControllerMetrics;

// Export cards by set ID (route parameter)
export const getBySetId = (req, res, next) => {
  req.query.setId = req.params.setId;
  return getController().getAll(req, res, next);
};

// Alias for getBySetId
export const getCardsBySetId = getBySetId;

// Export individual methods for route compatibility
export {
  getAll,
  getById,
  create,
  update,
  deleteCard,
  getControllerMetrics
};

// Export controller instance accessor for advanced usage
export const getCardsController = getController;

// Default export for backward compatibility
export default getAll;
