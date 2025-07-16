// Sales controller for managing sold items and sales analytics
const salesDataService = require('../services/salesDataService');
const salesAnalyticsService = require('../services/salesAnalyticsService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

const getSales = asyncHandler(async (req, res) => {
  const { category, startDate, endDate } = req.query;

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);

    res.status(200).json({
      success: true,
      count: salesData.length,
      data: salesData,
    });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

const getSalesSummary = asyncHandler(async (req, res) => {
  const { category, startDate, endDate } = req.query;

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);
    const summary = salesAnalyticsService.calculateSalesSummary(salesData);

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

const getSalesGraphData = asyncHandler(async (req, res) => {
  const { category, startDate, endDate } = req.query;

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);
    const graphData = salesAnalyticsService.generateGraphData(salesData);

    res.status(200).json(graphData);
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

module.exports = {
  getSales,
  getSalesSummary,
  getSalesGraphData,
};
