import express from 'express';
const router = express.Router();
import { getAllSets, getSetById, getSetsWithPagination   } from '@/Presentation/Controllers/entities/setsController.js';
import { getCardsBySetId   } from '@/Presentation/Controllers/core/cardsController.js';
import { cachePresets } from '@/Presentation/Middleware/cachePresets.js';
// Set routes - using proper cache middleware
router.get('/', cachePresets.setData, getSetsWithPagination);
router.get('/:setId/cards', cachePresets.setCards, getCardsBySetId);
router.get('/:id', cachePresets.setDetails, getSetById);

export default router;
