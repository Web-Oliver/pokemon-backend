// Sales controller for managing sold items and sales analytics
import salesDataService from '@/Application/UseCases/Analytics/salesDataService.js';
import salesAnalyticsService from '@/Application/UseCases/Analytics/salesAnalyticsService.js';
import { asyncHandler, ValidationError   } from '@/Presentation/Middleware/errorHandler.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
import ValidatorFactory from '@/Application/Validators/ValidatorFactory.js';
const { SalesValidators, SalesErrorHandlers, SalesSuccessLoggers } = ValidatorFactory.salesUtils;

const getSales = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_SALES_DATA', 'Fetching sales data', { query: req.query });

  const { category, startDate, endDate } = req.query;

  // Use centralized validation
  SalesValidators.validateGetSalesParams({ category, startDate, endDate });

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);

    // Use centralized success logging
    SalesSuccessLoggers.logGetSalesSuccess({ category, startDate, endDate }, salesData);

    res.status(200).json({
      success: true,
      count: salesData.length,
      data: salesData,
    });
  } catch (error) {
    // Use centralized error handling
    SalesErrorHandlers.handleGetSalesError(error, { category, startDate, endDate });
  }
});

const getSalesSummary = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_SALES_SUMMARY', 'Calculating sales summary', { query: req.query });

  const { category, startDate, endDate } = req.query;

  // Use centralized validation
  SalesValidators.validateGetSalesSummaryParams({ category, startDate, endDate });

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);
    const summary = salesAnalyticsService.calculateSalesSummary(salesData);

    // Use centralized success logging
    SalesSuccessLoggers.logGetSalesSummarySuccess({ category, startDate, endDate }, {
      salesDataCount: salesData.length,
      totalSales: summary.totalSales,
      totalValue: summary.totalValue,
      averageValue: summary.averageValue
    });

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    // Use centralized error handling
    SalesErrorHandlers.handleGetSalesSummaryError(error, { category, startDate, endDate });
  }
});

const getSalesGraphData = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_SALES_GRAPH_DATA', 'Generating sales graph data', { query: req.query });

  const { category, startDate, endDate } = req.query;

  // Use centralized validation
  SalesValidators.validateGetSalesGraphDataParams({ category, startDate, endDate });

  try {
    const filter = salesDataService.buildDateFilter(startDate, endDate);
    const salesData = await salesDataService.fetchSalesData(filter, category);
    const graphData = salesAnalyticsService.generateGraphData(salesData);

    // Use centralized success logging
    SalesSuccessLoggers.logGetSalesGraphDataSuccess({ category, startDate, endDate }, {
      salesDataCount: salesData.length,
      graphData
    });

    res.status(200).json(graphData);
  } catch (error) {
    // Use centralized error handling
    SalesErrorHandlers.handleGetSalesGraphDataError(error, { category, startDate, endDate });
  }
});

export {
  getSales,
  getSalesSummary,
  getSalesGraphData
};
export default getSales;;
