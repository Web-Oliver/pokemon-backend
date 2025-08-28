import express from 'express';
const router = express.Router();
import { getAllSets, getSetById, getSetsWithPagination } from '@/pokemon/sets/setsController.js';
import { getCardsBySetId } from '@/pokemon/cards/cardsController.js';
import { cachePresets } from '@/system/middleware/cachePresets.js';
// Set routes - using proper cache middleware
router.get('/', cachePresets.setData, getSetsWithPagination);
router.get('/:setId/cards', cachePresets.setCards, getCardsBySetId);
router.get('/:id', cachePresets.setDetails, getSetById);

export default router;
