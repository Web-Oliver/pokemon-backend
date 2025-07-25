const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const DbaSelection = require('../models/DbaSelection');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');

/**
 * Get all DBA selections with item details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllDbaSelections = asyncHandler(async (req, res) => {
  const { active, expiring } = req.query;
  
  const query = {};
  
  if (active === 'true') {
    query.isActive = true;
    query.expiryDate = { $gt: new Date() };
  } else if (active === 'false') {
    query.$or = [
      { isActive: false },
      { expiryDate: { $lte: new Date() } }
    ];
  }
  
  let selections;
  
  if (expiring === 'true') {
    const expiringSoonDays = parseInt(req.query.days) || 10;

    selections = await DbaSelection.getExpiringSoon(expiringSoonDays);
  } else {
    selections = await DbaSelection.find(query).sort({ selectedDate: -1 });
  }
  
  // Populate with actual item data
  const selectionsWithItems = await Promise.all(selections.map(async (selection) => {
    let item = null;
    
    try {
      switch (selection.itemType) {
        case 'psa':
          item = await PsaGradedCard.findById(selection.itemId).populate('cardId');
          break;
        case 'raw':
          item = await RawCard.findById(selection.itemId).populate('cardId');
          break;
        case 'sealed':
          item = await SealedProduct.findById(selection.itemId).populate('productId');
          break;
      }
    } catch (error) {
      console.warn(`Failed to populate item ${selection.itemId}:`, error.message);
    }
    
    return {
      ...selection.toJSON(),
      item: item || null
    };
  }));
  
  res.status(200).json({
    success: true,
    count: selectionsWithItems.length,
    data: selectionsWithItems
  });
});

/**
 * Add items to DBA selection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addToDbaSelection = asyncHandler(async (req, res) => {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Items array is required and must not be empty');
  }
  
  const results = [];
  const errors = [];
  
  for (const item of items) {
    const { itemId, itemType } = item;
    
    if (!itemId || !itemType) {
      errors.push({ itemId, error: 'itemId and itemType are required' });
      continue;
    }
    
    if (!['psa', 'raw', 'sealed'].includes(itemType)) {
      errors.push({ itemId, error: 'itemType must be psa, raw, or sealed' });
      continue;
    }
    
    try {
      // Check if item exists
      let itemExists = false;

      switch (itemType) {
        case 'psa':
          itemExists = await PsaGradedCard.findById(itemId);
          break;
        case 'raw':
          itemExists = await RawCard.findById(itemId);
          break;
        case 'sealed':
          itemExists = await SealedProduct.findById(itemId);
          break;
      }
      
      if (!itemExists) {
        errors.push({ itemId, error: 'Item not found in collection' });
        continue;
      }
      
      // Check if already selected for DBA
      const existingSelection = await DbaSelection.findOne({ itemId, itemType });
      
      if (existingSelection && existingSelection.isActive) {
        errors.push({ itemId, error: 'Item is already selected for DBA' });
        continue;
      }
      
      // Create or reactivate DBA selection
      let selection;

      if (existingSelection) {
        // Reactivate existing selection
        existingSelection.isActive = true;
        existingSelection.selectedDate = new Date();
        existingSelection.expiryDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        selection = await existingSelection.save();
      } else {
        // Create new selection
        selection = new DbaSelection({
          itemId,
          itemType,
          notes: item.notes || ''
        });
        selection = await selection.save();
      }
      
      results.push(selection);
      
    } catch (error) {
      errors.push({ itemId, error: error.message });
    }
  }
  
  res.status(200).json({
    success: true,
    message: `Added ${results.length} items to DBA selection`,
    data: results,
    errors: errors.length > 0 ? errors : undefined
  });
});

/**
 * Remove items from DBA selection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeFromDbaSelection = asyncHandler(async (req, res) => {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Items array is required and must not be empty');
  }
  
  const results = [];
  const errors = [];
  
  for (const item of items) {
    const { itemId, itemType } = item;
    
    if (!itemId || !itemType) {
      errors.push({ itemId, error: 'itemId and itemType are required' });
      continue;
    }
    
    try {
      const selection = await DbaSelection.findOne({ itemId, itemType });
      
      if (!selection) {
        errors.push({ itemId, error: 'Item not found in DBA selection' });
        continue;
      }
      
      // Deactivate selection
      selection.isActive = false;
      await selection.save();
      
      results.push(selection);
      
    } catch (error) {
      errors.push({ itemId, error: error.message });
    }
  }
  
  res.status(200).json({
    success: true,
    message: `Removed ${results.length} items from DBA selection`,
    data: results,
    errors: errors.length > 0 ? errors : undefined
  });
});

/**
 * Get DBA selection by item
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDbaSelectionByItem = asyncHandler(async (req, res) => {
  const { itemId, itemType } = req.params;
  
  if (!['psa', 'raw', 'sealed'].includes(itemType)) {
    throw new ValidationError('itemType must be psa, raw, or sealed');
  }
  
  const selection = await DbaSelection.findOne({ itemId, itemType });
  
  if (!selection) {
    throw new NotFoundError('DBA selection not found for this item');
  }
  
  res.status(200).json({
    success: true,
    data: selection
  });
});

/**
 * Update DBA selection notes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateDbaSelectionNotes = asyncHandler(async (req, res) => {
  const { itemId, itemType } = req.params;
  const { notes } = req.body;
  
  if (!['psa', 'raw', 'sealed'].includes(itemType)) {
    throw new ValidationError('itemType must be psa, raw, or sealed');
  }
  
  const selection = await DbaSelection.findOne({ itemId, itemType });
  
  if (!selection) {
    throw new NotFoundError('DBA selection not found for this item');
  }
  
  selection.notes = notes || '';
  await selection.save();
  
  res.status(200).json({
    success: true,
    message: 'DBA selection notes updated',
    data: selection
  });
});

/**
 * Get DBA selection statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDbaSelectionStats = asyncHandler(async (req, res) => {
  const [
    totalActive,
    expiringSoon,
    expired,
    byType
  ] = await Promise.all([
    DbaSelection.countDocuments({ isActive: true, expiryDate: { $gt: new Date() } }),
    DbaSelection.countDocuments({ 
      isActive: true, 
      expiryDate: { 
        $gt: new Date(), 
        $lte: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) 
      } 
    }),
    DbaSelection.countDocuments({ 
      $or: [
        { isActive: false },
        { expiryDate: { $lte: new Date() } }
      ]
    }),
    DbaSelection.aggregate([
      { $match: { isActive: true, expiryDate: { $gt: new Date() } } },
      { $group: { _id: '$itemType', count: { $sum: 1 } } }
    ])
  ]);
  
  const stats = {
    totalActive,
    expiringSoon,
    expired,
    byType: {
      psa: 0,
      raw: 0,
      sealed: 0
    }
  };
  
  byType.forEach(item => {
    stats.byType[item._id] = item.count;
  });
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

module.exports = {
  getAllDbaSelections,
  addToDbaSelection,
  removeFromDbaSelection,
  getDbaSelectionByItem,
  updateDbaSelectionNotes,
  getDbaSelectionStats
};