/**
 * OCR Text Matching Controller
 *
 * Single Responsibility: OCR text matching and search operations
 * Handles text analysis, card matching, and search functionality
 */

import { asyncHandler   } from '@/Presentation/Middleware/errorHandler.js';
import OcrServiceInitializer from '@/Application/UseCases/OcrServiceInitializer.js';
import DebugLogger from '@/Infrastructure/Utilities/DebugLogger.js';
import SearchService from '@/Application/Services/Search/SearchService.js';
const searchService = new SearchService();

// Use extracted debug logger
const debugLog = DebugLogger.createScopedLogger('OCR-TEXT');

/**
 * POST /api/ocr/match
 * Match OCR text against card database with confidence scores
 */
const matchOcrText = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { ocrText, options = {} } = req.body;

  debugLog('MATCH_START', 'Starting OCR text matching', {
    ocrTextLength: ocrText?.length,
    ocrTextPreview: `${ocrText?.substring(0, 50)}...`,
    options
  });

  if (!ocrText || typeof ocrText !== 'string') {
    debugLog('MATCH_ERROR', 'Invalid OCR text provided', { ocrText: typeof ocrText });
    return res.status(400).json({
      success: false,
      error: 'OCR text is required and must be a string'
    });
  }

  try {
    debugLog('MATCH_SERVICE', 'Calling OCR matching service', {
      textLength: ocrText.length,
      options
    });

    const service = await OcrServiceInitializer.getOcrService('TextMatchingController');
    const result = await service.matchOcrText(ocrText, options);

    debugLog('MATCH_SUCCESS', 'OCR matching completed', {
      success: result.success,
      matchCount: result.matches?.length || 0,
      confidence: result.confidence,
      strategies: result.strategies,
      processingTime: Date.now() - startTime
    });

    res.json({
      success: result.success,
      data: {
        matches: result.matches,
        setRecommendations: result.setRecommendations || [], // Always include set recommendations from hierarchical search
        extractedData: result.extractedData,
        confidence: result.confidence,
        ocrText: result.ocrText,
        strategies: result.strategies,
        totalCandidates: result.totalCandidates,
        // Add debug information for troubleshooting
        debug: {
          hierarchicalSearchEnabled: true,
          setRecommendationsCount: result.setRecommendations?.length || 0,
          matchesWithSetNames: result.matches?.filter(m => m.setName && m.setName !== 'Unknown Set').length || 0,
          matchesTotal: result.matches?.length || 0
        }
      },
      error: result.error,
      meta: {
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLog('MATCH_ERROR', 'OCR matching failed', {
      error: error.message,
      stack: error.stack,
      processingTime: Date.now() - startTime
    });
    throw error;
  }
});

/**
 * POST /api/ocr/batch-match
 * Match multiple OCR texts in a single request
 */
const batchMatchOcrText = asyncHandler(async (req, res) => {
  const { ocrTexts, options = {} } = req.body;

  if (!Array.isArray(ocrTexts)) {
    return res.status(400).json({
      success: false,
      error: 'ocrTexts must be an array of strings'
    });
  }

  debugLog('BATCH_MATCH_START', 'Starting batch OCR text matching', {
    textCount: ocrTexts.length,
    options
  });

  const results = [];

  for (let i = 0; i < ocrTexts.length; i++) {
    const ocrText = ocrTexts[i];

    if (typeof ocrText === 'string' && ocrText.trim()) {
      try {
        const service = await OcrServiceInitializer.getOcrService('TextMatchingController');
    const result = await service.matchOcrText(ocrText, options);

        results.push({
          index: i,
          ocrText,
          ...result
        });
      } catch (error) {
        results.push({
          index: i,
          ocrText,
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        index: i,
        ocrText,
        success: false,
        error: `Invalid OCR text at index ${i}`
      });
    }
  }

  debugLog('BATCH_MATCH_SUCCESS', 'Batch OCR matching completed', {
    totalProcessed: results.length,
    successfulMatches: results.filter(r => r.success).length
  });

  res.json({
    success: true,
    data: {
      results,
      totalProcessed: results.length,
      successfulMatches: results.filter(r => r.success && r.matches?.length > 0).length
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/ocr/search/sets
 * Hierarchical set search for manual correction workflow
 */
const searchSets = asyncHandler(async (req, res) => {
  const { query = '', limit = 20 } = req.query;

  debugLog('SEARCH_SETS_START', 'Starting set search', { query, limit });

  try {
    await searchService.initializeIndexes();
    const sets = await searchService.searchSets(query, {}, { limit: parseInt(limit) });

    debugLog('SEARCH_SETS_SUCCESS', 'Set search completed', {
      resultCount: sets.length,
      query
    });

    res.json({
      success: true,
      data: {
        sets: sets.map(set => ({
          _id: set._id,
          setName: set.setName,
          year: set.year,
          seriesName: set.seriesName,
          abbreviation: set.abbreviation,
          cardCount: set.cardCount
        }))
      },
      meta: {
        query,
        resultCount: sets.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLog('SEARCH_SETS_ERROR', 'Set search failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: `Failed to search sets: ${error.message}`
    });
  }
});

/**
 * GET /api/ocr/search/cards
 * Hierarchical card search with set filtering
 */
const searchCards = asyncHandler(async (req, res) => {
  const { query = '', setId, setName, limit = 20 } = req.query;

  debugLog('SEARCH_CARDS_START', 'Starting card search', {
    query, setId, setName, limit
  });

  try {
    await searchService.initialize();

    // Build filters for set-specific search
    const filters = {};

    if (setId) filters.setId = setId;
    if (setName) filters.setName = setName;

    const cards = await searchService.searchCards(query, filters, { limit: parseInt(limit) });

    debugLog('SEARCH_CARDS_SUCCESS', 'Card search completed', {
      resultCount: cards.length,
      query,
      filters
    });

    res.json({
      success: true,
      data: {
        cards: cards.map(card => ({
          _id: card._id,
          cardName: card.cardName,
          cardNumber: card.cardNumber,
          setName: card.setName || card.setId?.setName,
          year: card.year || card.setId?.year,
          rarity: card.rarity,
          variety: card.variety,
          imageUrl: card.imageUrl
        }))
      },
      meta: {
        query,
        filters,
        resultCount: cards.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLog('SEARCH_CARDS_ERROR', 'Card search failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: `Failed to search cards: ${error.message}`
    });
  }
});

/**
 * POST /api/ocr/edit-extract
 * Manual correction of extracted data
 */
const editExtractedData = asyncHandler(async (req, res) => {
  const { psaLabelId, extractedData } = req.body;

  if (!psaLabelId || !extractedData) {
    return res.status(400).json({
      success: false,
      error: 'PSA label ID and extracted data are required'
    });
  }

  debugLog('EDIT_EXTRACT_START', 'Starting manual data correction', {
    psaLabelId,
    extractedData
  });

  try {
    // Update PSA label with corrected extracted data
    const PsaLabel = (await import('@/Domain/Entities/PsaLabel.js')).default;
    const updatedLabel = await PsaLabel.findByIdAndUpdate(
      psaLabelId,
      {
        $set: {
          'psaData.extractedData': extractedData,
          'psaData.manuallyEdited': true,
          'psaData.editedAt': new Date()
        }
      },
      { new: true }
    );

    if (!updatedLabel) {
      return res.status(404).json({
        success: false,
        error: 'PSA label not found'
      });
    }

    // Re-run matching with corrected data
    const mockOcrText = `${extractedData.pokemonName || ''} ${extractedData.cardNumber || ''} ${extractedData.setName || ''}`.trim();
    const service = await OcrServiceInitializer.getOcrService('TextMatchingController');
    const rematchResult = await service.matchOcrText(mockOcrText, { limit: 10 });

    debugLog('EDIT_EXTRACT_SUCCESS', 'Manual data correction completed', {
      psaLabelId,
      rematchResults: rematchResult.matches?.length || 0
    });

    res.json({
      success: true,
      data: {
        updatedLabel: updatedLabel.psaData,
        newMatches: rematchResult.matches || [],
        confidence: rematchResult.confidence
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLog('EDIT_EXTRACT_ERROR', 'Manual data correction failed', {
      error: error.message,
      psaLabelId
    });
    throw error;
  }
});

/**
 * GET /api/ocr/matching-stats
 * OCR matching statistics and performance metrics
 */
const getMatchingStats = asyncHandler(async (req, res) => {
  debugLog('STATS_START', 'Retrieving matching statistics');

  try {
    // Get service statistics from unified service
    const service = await OcrServiceInitializer.getOcrService('TextMatchingController');
    const serviceStats = await service.getServiceStats();

    // Get basic PSA label statistics
    const PsaLabel = (await import('@/Domain/Entities/PsaLabel.js')).default;
    const totalLabels = await PsaLabel.countDocuments();
    const processedLabels = await PsaLabel.countDocuments({
      'psaData.matchingResults': { $exists: true, $ne: null }
    });

    const stats = {
      totalLabels,
      processedLabels,
      processingRate: totalLabels > 0 ? (processedLabels / totalLabels * 100).toFixed(1) : 0,
      serviceStats,
      lastUpdated: new Date().toISOString()
    };

    debugLog('STATS_SUCCESS', 'Statistics retrieved', stats);

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLog('STATS_ERROR', 'Failed to retrieve statistics', { error: error.message });
    throw error;
  }
});

export {
  matchOcrText,
  batchMatchOcrText,
  searchSets,
  searchCards,
  editExtractedData,
  getMatchingStats
};
export default matchOcrText;;
