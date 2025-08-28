import express from 'express';
const router = express.Router();
import { getAllDbaSelections,
  addToDbaSelection,
  removeFromDbaSelection,
  getDbaSelectionByItem,
  updateDbaSelectionNotes,
  getDbaSelectionStats
  } from '@/marketplace/dba/dbaSelectionController.js';
import { cachePresets } from '@/system/middleware/cachePresets.js';
/**
 * @route   GET /api/dba-selection
 * @desc    Get all DBA selections with optional filtering
 * @access  Public
 * @query   {boolean} active - Filter by active status (true/false)
 * @query   {boolean} expiring - Show only items expiring soon (true/false)
 * @query   {number} days - Days threshold for expiring soon (default: 10)
 */
router.get('/', cachePresets.dbaSelection, getAllDbaSelections);

/**
 * @route   POST /api/dba-selection
 * @desc    Add items to DBA selection
 * @access  Public
 * @body    {Array} items - Array of {itemId, itemType, notes?}
 */
router.post('/', addToDbaSelection);

/**
 * @route   DELETE /api/dba-selection
 * @desc    Remove items from DBA selection
 * @access  Public
 * @body    {Array} items - Array of {itemId, itemType}
 */
router.delete('/', removeFromDbaSelection);

/**
 * @route   GET /api/dba-selection/stats
 * @desc    Get DBA selection statistics
 * @access  Public
 */
router.get('/stats', cachePresets.dbaSelection, getDbaSelectionStats);

/**
 * @route   GET /api/dba-selection/:itemType/:itemId
 * @desc    Get DBA selection for specific item
 * @access  Public
 * @param   {string} itemType - Type of item (psa, raw, sealed)
 * @param   {string} itemId - Item ID
 */
router.get('/:itemType/:itemId', cachePresets.dbaSelection, getDbaSelectionByItem);

/**
 * @route   PUT /api/dba-selection/:itemType/:itemId/notes
 * @desc    Update DBA selection notes
 * @access  Public
 * @param   {string} itemType - Type of item (psa, raw, sealed)
 * @param   {string} itemId - Item ID
 * @body    {string} notes - Notes to update
 */
router.put('/:itemType/:itemId/notes', updateDbaSelectionNotes);

export default router;
