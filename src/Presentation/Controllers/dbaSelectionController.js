import { asyncHandler, ValidationError, NotFoundError } from '@/Infrastructure/Utilities/errorHandler.js';
import DbaSelection from '@/Domain/Entities/DbaSelection.js';
import { batchFetchItems, batchValidateItemExistence, itemExists, VALID_ITEM_TYPES   } from '@/Infrastructure/Utilities/ItemBatchFetcher.js';
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
    const expiringSoonDays = parseInt(req.query.days, 10) || 10;

    selections = await DbaSelection.getExpiringSoon(expiringSoonDays);
  } else {
    // Use lean() to get plain JS objects and limit fields
    selections = await DbaSelection.find(query)
      .select('itemId itemType selectedDate isActive notes expiryDate')
      .sort({ selectedDate: -1 })
      .lean()
      .exec();
  }

  // Use centralized batch fetching service
  const { itemsMap } = await batchFetchItems(selections, {
    populate: true,
    lean: true
  });

  // Transform selections with computed fields
  const selectionsWithItems = selections.map(selection => {
    const now = new Date();

    const item = itemsMap[selection.itemType]?.[selection.itemId];
    const itemData = item ? {
      ...item,
      _id: item._id?.toString(),
      id: item._id?.toString(),
      cardId: item.cardId?._id?.toString(),
      productId: item.productId?._id?.toString()
    } : null;

    // Compute days remaining
    const diffTime = selection.expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Compute days selected
    const selectedDiffTime = now.getTime() - selection.selectedDate.getTime();
    const daysSelected = Math.floor(selectedDiffTime / (1000 * 60 * 60 * 24));

    // Convert to plain object with computed fields
    return {
      _id: selection._id?.toString(),
      id: selection._id?.toString(),
      itemId: selection.itemId?.toString(),
      itemType: selection.itemType,
      notes: selection.notes || '',
      isActive: selection.isActive,
      selectedDate: selection.selectedDate,
      expiryDate: selection.expiryDate,
      createdAt: selection.createdAt,
      updatedAt: selection.updatedAt,
      daysRemaining,
      daysSelected,
      item: itemData
    };
  });

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

  // Use batch validation for better performance
  const { validItems, validationErrors } = await batchValidateItemExistence(items);

  const results = [];
  const errors = [...validationErrors];

  for (const item of validItems) {
    const { itemId, itemType } = item;

    try {

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

  if (!VALID_ITEM_TYPES.includes(itemType)) {
    throw new ValidationError(`itemType must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
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

  if (!VALID_ITEM_TYPES.includes(itemType)) {
    throw new ValidationError(`itemType must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
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

export {
  getAllDbaSelections,
  addToDbaSelection,
  removeFromDbaSelection,
  getDbaSelectionByItem,
  updateDbaSelectionNotes,
  getDbaSelectionStats
};
export default getAllDbaSelections;;
