import Card from '@/Domain/Entities/Card.js';
import { asyncHandler, NotFoundError, ValidationError   } from '@/Presentation/Middleware/errorHandler.js';
import container from '@/Infrastructure/DependencyInjection/index.js';
import BaseController from '../base/BaseController.js';
import { pluginManager   } from '@/Infrastructure/Plugins/PluginManager.js';
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

// Create controller instance
const cardsController = new CardsController();

// Export standard CRUD operations
export const getAll = cardsController.getAll.bind(cardsController);
export const getById = cardsController.getById.bind(cardsController);
export const create = cardsController.create.bind(cardsController);
export const update = cardsController.update.bind(cardsController);
export const deleteCard = cardsController.delete.bind(cardsController);
export const getControllerMetrics = cardsController.getControllerMetrics.bind(cardsController);

// Aliases for different naming conventions
export const createCard = create;
export const updateCard = update;
export const getCardById = getById;
export const getAllCards = getAll;
export const getCardMetrics = getControllerMetrics;

// Export cards by set ID (route parameter)
export const getBySetId = (req, res, next) => {
  req.query.setId = req.params.setId;
  return cardsController.getAll(req, res, next);
};

// Alias for getBySetId
export const getCardsBySetId = getBySetId;

export default cardsController;
