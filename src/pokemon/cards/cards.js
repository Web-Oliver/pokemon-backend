import express from 'express';
const router = express.Router();
import { getAllCards,
  getCardById,
  createCard,
  updateCard,
  deleteCard,
  getCardMetrics
  } from '@/pokemon/cards/cardsController.js';
import { cachePresets } from '@/system/middleware/cachePresets.js';
// Card routes - READ-ONLY reference data
router.get('/', cachePresets.cardData, getAllCards);
router.get('/metrics', cachePresets.cardMetrics, getCardMetrics);
router.get('/:id', cachePresets.cardDetails, getCardById);

// ENHANCED ROUTES REMOVED - Over-engineered duplication
// Frontend should use standard routes: GET /cards, GET /cards/:id, GET /cards/metrics
// Removed to maintain DRY principles and avoid redundancy

// CRUD operations removed - cards are reference data, not collection items

export default router;
