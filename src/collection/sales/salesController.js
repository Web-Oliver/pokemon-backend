// Sales controller for managing sold items and sales analytics
import {buildDateFilter, fetchSalesData} from '@/collection/sales/salesDataService.js';
import {calculateSalesSummary, generateGraphData} from '@/collection/sales/salesAnalyticsService.js';
import {asyncHandler} from '@/system/middleware/CentralizedErrorHandler.js';
import Logger from '@/system/logging/Logger.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';

const getSales = asyncHandler(async (req, res) => {
    const {
        validators: SalesValidators,
        errorHandlers: SalesErrorHandlers,
        successLoggers: SalesSuccessLoggers
    } = ValidatorFactory.salesUtils;
    Logger.operationStart('GET_SALES_DATA', 'Fetching sales data', {query: req.query});

    const {category, startDate, endDate} = req.query;

    // Use centralized validation
    SalesValidators.validateGetSalesParams({category, startDate, endDate});

    try {
        const filter = buildDateFilter(startDate, endDate);
        const salesData = await fetchSalesData(filter, category);

        // Use centralized success logging
        SalesSuccessLoggers.logGetSalesSuccess({category, startDate, endDate}, salesData);

        res.status(200).json({
            success: true,
            count: salesData.length,
            data: salesData
        });
    } catch (error) {
        // Use centralized error handling
        SalesErrorHandlers.handleGetSalesError(error, {category, startDate, endDate});
    }
});

const getSalesSummary = asyncHandler(async (req, res) => {
    const {
        validators: SalesValidators,
        errorHandlers: SalesErrorHandlers,
        successLoggers: SalesSuccessLoggers
    } = ValidatorFactory.salesUtils;
    Logger.operationStart('GET_SALES_SUMMARY', 'Calculating sales summary', {query: req.query});

    const {category, startDate, endDate} = req.query;

    // Use centralized validation
    SalesValidators.validateGetSalesParams({category, startDate, endDate});

    try {
        const filter = buildDateFilter(startDate, endDate);
        const salesData = await fetchSalesData(filter, category);
        const summary = calculateSalesSummary(salesData);

        // Use centralized success logging
        SalesSuccessLoggers.logGetSalesSummarySuccess({category, startDate, endDate}, {
            salesDataCount: salesData.length,
            totalSales: summary.totalSales,
            totalValue: summary.totalValue,
            averageValue: summary.averageValue
        });

        res.status(200).json({success: true, data: summary});
    } catch (error) {
        // Use centralized error handling
        SalesErrorHandlers.handleGetSalesSummaryError(error, {category, startDate, endDate});
    }
});

const getSalesGraphData = asyncHandler(async (req, res) => {
    const {
        validators: SalesValidators,
        errorHandlers: SalesErrorHandlers,
        successLoggers: SalesSuccessLoggers
    } = ValidatorFactory.salesUtils;
    Logger.operationStart('GET_SALES_GRAPH_DATA', 'Generating sales graph data', {query: req.query});

    const {category, startDate, endDate} = req.query;

    // Use centralized validation
    SalesValidators.validateGetSalesParams({category, startDate, endDate});

    try {
        const filter = buildDateFilter(startDate, endDate);
        const salesData = await fetchSalesData(filter, category);
        const graphData = generateGraphData(salesData);

        // Use centralized success logging
        SalesSuccessLoggers.logGetSalesGraphDataSuccess({category, startDate, endDate}, {
            salesDataCount: salesData.length,
            graphData
        });

        res.status(200).json(graphData);
    } catch (error) {
        // Use centralized error handling
        SalesErrorHandlers.handleGetSalesGraphDataError(error, {category, startDate, endDate});
    }
});

export {
    getSales,
    getSalesSummary,
    getSalesGraphData
};
export default getSales;

