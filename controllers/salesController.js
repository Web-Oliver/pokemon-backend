// Sales controller for managing sold items and sales analytics
const salesDataService = require('../services/salesDataService');
const salesAnalyticsService = require('../services/salesAnalyticsService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const Logger = require('../utils/Logger');
const ValidatorFactory = require('../utils/ValidatorFactory');
const { validateDateRange } = require('../utils/dateValidationHelpers');

const getSales = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_SALES_DATA', 'Fetching sales data', { query: req.query });
  
  const { category, startDate, endDate } = req.query;

  // Validate query parameters
  const validationErrors = [];
  
  if (category) {
    try {
      ValidatorFactory.enum(category, ['all', 'sealedProducts', 'psaGradedCards', 'rawCards'], 'category');
    } catch (error) {
      validationErrors.push('category must be one of: all, sealedProducts, psaGradedCards, rawCards');
    }
  }
  
  // Use consolidated date validation
  const dateValidation = validateDateRange(startDate, endDate, { context: 'SALES_QUERY_VALIDATION' });

  if (!dateValidation.isValid) {
    validationErrors.push(...dateValidation.errors);
  }
  
  if (validationErrors.length > 0) {
    const error = new ValidationError(`Validation failed: ${validationErrors.join(', ')}`);

    Logger.operationError('SALES_QUERY_VALIDATION_FAILED', 'Sales query validation failed', error, {
      validationErrors,
      providedQuery: req.query
    });
    throw error;
  }

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);

    Logger.operationSuccess('GET_SALES_DATA', 'Successfully fetched sales data', {
      category: category || 'all',
      startDate,
      endDate,
      resultsCount: salesData.length,
      hasDateFilter: Boolean(startDate || endDate)
    });
    
    res.status(200).json({
      success: true,
      count: salesData.length,
      data: salesData,
    });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      Logger.operationError('SALES_DATA_FETCH_VALIDATION_ERROR', 'Sales data fetch validation error', error, {
        category,
        startDate,
        endDate
      });
      throw new ValidationError(error.message);
    }
    Logger.operationError('SALES_DATA_FETCH_FAILED', 'Failed to fetch sales data', error, {
      category,
      startDate,
      endDate
    });
    throw error;
  }
});

const getSalesSummary = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_SALES_SUMMARY', 'Calculating sales summary', { query: req.query });
  
  const { category, startDate, endDate } = req.query;

  // Validate query parameters using ValidatorFactory
  const validationErrors = [];
  
  if (category) {
    try {
      ValidatorFactory.enum(category, ['all', 'sealedProducts', 'psaGradedCards', 'rawCards'], 'category');
    } catch (error) {
      validationErrors.push('category must be one of: all, sealedProducts, psaGradedCards, rawCards');
    }
  }
  
  if (startDate) {
    try {
      ValidatorFactory.date(startDate, 'startDate');
    } catch (error) {
      validationErrors.push('startDate must be a valid date');
    }
  }
  
  if (endDate) {
    try {
      ValidatorFactory.date(endDate, 'endDate');
    } catch (error) {
      validationErrors.push('endDate must be a valid date');
    }
  }
  
  if (validationErrors.length > 0) {
    const error = new ValidationError(`Validation failed: ${validationErrors.join(', ')}`);

    Logger.operationError('SALES_SUMMARY_VALIDATION_FAILED', 'Sales summary query validation failed', error, {
      validationErrors,
      providedQuery: req.query
    });
    throw error;
  }

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);
    const summary = salesAnalyticsService.calculateSalesSummary(salesData);

    Logger.operationSuccess('GET_SALES_SUMMARY', 'Successfully calculated sales summary', {
      category: category || 'all',
      startDate,
      endDate,
      salesDataCount: salesData.length,
      summaryMetrics: {
        totalSales: summary.totalSales || 0,
        totalValue: summary.totalValue || 0,
        averageValue: summary.averageValue || 0
      }
    });
    
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      Logger.operationError('SALES_SUMMARY_VALIDATION_ERROR', 'Sales summary validation error', error, {
        category,
        startDate,
        endDate
      });
      throw new ValidationError(error.message);
    }
    Logger.operationError('SALES_SUMMARY_CALCULATION_FAILED', 'Failed to calculate sales summary', error, {
      category,
      startDate,
      endDate
    });
    throw error;
  }
});

const getSalesGraphData = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_SALES_GRAPH_DATA', 'Generating sales graph data', { query: req.query });
  
  const { category, startDate, endDate } = req.query;

  // Validate query parameters using ValidatorFactory
  const validationErrors = [];
  
  if (category) {
    try {
      ValidatorFactory.enum(category, ['all', 'sealedProducts', 'psaGradedCards', 'rawCards'], 'category');
    } catch (error) {
      validationErrors.push('category must be one of: all, sealedProducts, psaGradedCards, rawCards');
    }
  }
  
  if (startDate) {
    try {
      ValidatorFactory.date(startDate, 'startDate');
    } catch (error) {
      validationErrors.push('startDate must be a valid date');
    }
  }
  
  if (endDate) {
    try {
      ValidatorFactory.date(endDate, 'endDate');
    } catch (error) {
      validationErrors.push('endDate must be a valid date');
    }
  }
  
  if (validationErrors.length > 0) {
    const error = new ValidationError(`Validation failed: ${validationErrors.join(', ')}`);

    Logger.operationError('SALES_GRAPH_VALIDATION_FAILED', 'Sales graph query validation failed', error, {
      validationErrors,
      providedQuery: req.query
    });
    throw error;
  }

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);
    const graphData = salesAnalyticsService.generateGraphData(salesData);

    Logger.operationSuccess('GET_SALES_GRAPH_DATA', 'Successfully generated sales graph data', {
      category: category || 'all',
      startDate,
      endDate,
      salesDataCount: salesData.length,
      graphDataPoints: Array.isArray(graphData) ? graphData.length : Object.keys(graphData).length
    });
    
    res.status(200).json(graphData);
  } catch (error) {
    if (error.message.includes('Invalid')) {
      Logger.operationError('SALES_GRAPH_VALIDATION_ERROR', 'Sales graph validation error', error, {
        category,
        startDate,
        endDate
      });
      throw new ValidationError(error.message);
    }
    Logger.operationError('SALES_GRAPH_GENERATION_FAILED', 'Failed to generate sales graph data', error, {
      category,
      startDate,
      endDate
    });
    throw error;
  }
});

module.exports = {
  getSales,
  getSalesSummary,
  getSalesGraphData,
};
