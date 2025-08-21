/**
 * OCR Label Processing Controller
 *
 * Single Responsibility: PSA label processing, batch operations, and image handling
 * Handles bulk processing, image serving, and PSA label management operations
 */

import { asyncHandler   } from '@/Infrastructure/Utilities/errorHandler.js';
import ocrMatchingService from '@/Application/UseCases/Matching/UnifiedOcrMatchingService.js';
import PsaLabel from '@/Domain/Entities/PsaLabel.js';
import path from 'path';
import fs from 'fs';
// Comprehensive debugging utility
const debugLog = (context, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [OCR-LABEL-${context}] ${message}`;

  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

/**
 * POST /api/ocr/process-all-psa-labels
 * Run OCR matching on all PSA labels from database
 */
const processAllPsaLabels = asyncHandler(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    reprocessAll = false,
    onlyUnprocessed = true
  } = req.query;

  debugLog('PROCESS_ALL_START', 'Starting batch PSA label processing', {
    limit: parseInt(limit),
    offset: parseInt(offset),
    reprocessAll,
    onlyUnprocessed
  });

  try {
    // Build query filters
    const query = {};

    if (onlyUnprocessed && !reprocessAll) {
      // Only process labels that haven't been matched yet
      query.$or = [
        { 'psaData.matchingResults': { $exists: false } },
        { 'psaData.matchingResults': null },
        { 'psaData.matchingResults': [] }
      ];
    }

    // Get PSA labels to process
    const psaLabels = await PsaLabel.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    if (psaLabels.length === 0) {
      return res.json({
        success: true,
        message: 'No PSA labels found to process',
        data: {
          processed: 0,
          total: 0,
          results: []
        }
      });
    }

    debugLog('PROCESS_ALL_LABELS', `Processing ${psaLabels.length} PSA labels`);

    const results = [];
    let processedCount = 0;
    let errorCount = 0;

    // Process each PSA label
    for (const psaLabel of psaLabels) {
      try {
        if (!psaLabel.ocrText || psaLabel.ocrText.trim().length === 0) {
          results.push({
            psaLabelId: psaLabel._id,
            status: 'skipped',
            reason: 'No OCR text available',
            matches: []
          });
          continue;
        }

        debugLog('PROCESSING_LABEL', `Processing PSA label: ${psaLabel._id}`);

        // Run OCR matching on the label text
        const matchingResult = await ocrMatchingService.matchOcrText(psaLabel.ocrText, {
          limit: 10,
          threshold: 0.1
        });

        // Update PSA label with matching results
        await PsaLabel.findByIdAndUpdate(psaLabel._id, {
          $set: {
            'psaData.matchingResults': matchingResult.matches || [],
            'psaData.extractedData': matchingResult.extractedData,
            'psaData.confidence': matchingResult.confidence,
            'psaData.setRecommendations': matchingResult.setRecommendations || [],
            'psaData.processedAt': new Date(),
            'psaData.strategies': matchingResult.strategies,
            'psaData.totalCandidates': matchingResult.totalCandidates,
            status: matchingResult.matches?.length > 0 ? 'matched' : 'no_matches'
          }
        });

        results.push({
          psaLabelId: psaLabel._id,
          status: 'processed',
          matchCount: matchingResult.matches?.length || 0,
          confidence: matchingResult.confidence,
          extractedData: matchingResult.extractedData,
          topMatch: matchingResult.matches?.[0] || null,
          matches: matchingResult.matches || []
        });

        processedCount++;

      } catch (error) {
        errorCount++;
        debugLog('PROCESSING_ERROR', `Error processing PSA label ${psaLabel._id}`, {
          error: error.message
        });

        results.push({
          psaLabelId: psaLabel._id,
          status: 'error',
          error: error.message,
          matches: []
        });

        // Update label with error status
        await PsaLabel.findByIdAndUpdate(psaLabel._id, {
          $set: {
            'psaData.processingError': error.message,
            'psaData.processedAt': new Date(),
            status: 'processing_error'
          }
        });
      }
    }

    debugLog('PROCESS_ALL_COMPLETE', 'Batch processing completed', {
      total: psaLabels.length,
      processed: processedCount,
      errors: errorCount
    });

    res.json({
      success: true,
      data: {
        processed: processedCount,
        errors: errorCount,
        total: psaLabels.length,
        results,
        summary: {
          successfulMatches: results.filter(r => r.status === 'processed' && r.matchCount > 0).length,
          noMatches: results.filter(r => r.status === 'processed' && r.matchCount === 0).length,
          processingErrors: errorCount,
          skipped: results.filter(r => r.status === 'skipped').length
        }
      },
      meta: {
        query: { limit, offset, reprocessAll, onlyUnprocessed },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    debugLog('PROCESS_ALL_ERROR', 'Batch processing failed', { error: error.message });
    throw error;
  }
});

/**
 * POST /api/ocr/find-psa-image
 * Find PSA label image by OCR text similarity
 */
const findPsaImageByOcr = asyncHandler(async (req, res) => {
  const { ocrText, similarityThreshold = 0.7 } = req.body;

  if (!ocrText || typeof ocrText !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'OCR text is required and must be a string'
    });
  }

  debugLog('FIND_IMAGE_START', 'Finding PSA image by OCR similarity', {
    ocrTextLength: ocrText.length,
    threshold: similarityThreshold
  });

  try {
    // Get all PSA labels with OCR text
    const psaLabels = await PsaLabel.find({
      ocrText: { $exists: true, $ne: null, $ne: '' },
      labelImage: { $exists: true, $ne: null, $ne: '' }
    })
    .select('ocrText labelImage certificationNumber psaData createdAt')
    .lean();

    debugLog('FIND_IMAGE_SEARCH', `Searching through ${psaLabels.length} PSA labels`);

    // Calculate similarity scores
    const similarities = psaLabels.map(label => {
      const similarity = calculateTextSimilarity(ocrText, label.ocrText);

      return {
        psaLabelId: label._id,
        similarity,
        labelImage: label.labelImage,
        certificationNumber: label.certificationNumber,
        ocrText: label.ocrText,
        createdAt: label.createdAt
      };
    });

    // Filter by threshold and sort by similarity
    const matches = similarities
      .filter(s => s.similarity >= similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    debugLog('FIND_IMAGE_RESULTS', 'Image search completed', {
      totalLabels: psaLabels.length,
      matchesFound: matches.length,
      topSimilarity: matches[0]?.similarity || 0
    });

    res.json({
      success: true,
      data: {
        matches,
        searchCriteria: {
          ocrText: `${ocrText.substring(0, 100)}...`,
          similarityThreshold,
          searchedLabels: psaLabels.length
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    debugLog('FIND_IMAGE_ERROR', 'Image search failed', { error: error.message });
    throw error;
  }
});

/**
 * GET /api/ocr/psa-label/:id/image
 * Serve full card image for PSA label
 */
const getPsaLabelImage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  debugLog('GET_IMAGE_START', 'Serving PSA label image', { id });

  try {
    const psaLabel = await PsaLabel.findById(id).select('labelImage').lean();

    if (!psaLabel) {
      return res.status(404).json({
        success: false,
        error: 'PSA label not found'
      });
    }

    if (!psaLabel.labelImage) {
      return res.status(404).json({
        success: false,
        error: 'No image associated with this PSA label'
      });
    }

    // Construct the full path to the image
    const imagePath = path.join(__dirname, '../../images/psa-labels', psaLabel.labelImage);

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      debugLog('GET_IMAGE_ERROR', 'Image file not found', { imagePath });
      return res.status(404).json({
        success: false,
        error: 'Image file not found on server'
      });
    }

    // Get file stats for headers
    const stats = fs.statSync(imagePath);
    const ext = path.extname(psaLabel.labelImage).toLowerCase();

    // Set appropriate content type
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    const contentType = contentTypes[ext] || 'image/jpeg';

    // Set headers
    res.set({
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      'Last-Modified': stats.mtime.toUTCString()
    });

    debugLog('GET_IMAGE_SUCCESS', 'Image served successfully', {
      id,
      imagePath: psaLabel.labelImage,
      contentType,
      size: stats.size
    });

    // Stream the image
    const imageStream = fs.createReadStream(imagePath);

    imageStream.pipe(res);

  } catch (error) {
    debugLog('GET_IMAGE_ERROR', 'Failed to serve image', {
      error: error.message,
      id
    });

    res.status(500).json({
      success: false,
      error: `Failed to serve image: ${error.message}`
    });
  }
});

/**
 * GET /api/ocr/psa-labels
 * Get all PSA labels for management interface
 */
const getAllPsaLabels = asyncHandler(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    status,
    hasMatches,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  debugLog('GET_ALL_LABELS_START', 'Retrieving PSA labels', {
    limit: parseInt(limit),
    offset: parseInt(offset),
    status,
    hasMatches,
    sortBy,
    sortOrder
  });

  try {
    // Build query filters
    const query = {};

    if (status) {
      query.status = status;
    }

    if (hasMatches !== undefined) {
      if (hasMatches === 'true') {
        query['psaData.matchingResults.0'] = { $exists: true };
      } else {
        query.$or = [
          { 'psaData.matchingResults': { $exists: false } },
          { 'psaData.matchingResults': [] }
        ];
      }
    }

    // Build sort object
    const sort = {};

    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get total count for pagination
    const totalCount = await PsaLabel.countDocuments(query);

    // Get PSA labels
    const psaLabels = await PsaLabel.find(query)
      .sort(sort)
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .select('ocrText labelImage certificationNumber psaData status createdAt')
      .lean();

    // Process labels for response
    const processedLabels = psaLabels.map(label => ({
      _id: label._id,
      ocrText: label.ocrText?.substring(0, 200) + (label.ocrText?.length > 200 ? '...' : ''),
      labelImage: label.labelImage,
      certificationNumber: label.certificationNumber,
      status: label.status,
      createdAt: label.createdAt,
      hasMatches: label.psaData?.matchingResults?.length > 0,
      matchCount: label.psaData?.matchingResults?.length || 0,
      confidence: label.psaData?.confidence || 0,
      approved: label.psaData?.approved || false,
      topMatch: label.psaData?.matchingResults?.[0] || null
    }));

    debugLog('GET_ALL_LABELS_SUCCESS', 'PSA labels retrieved', {
      totalCount,
      returned: processedLabels.length
    });

    res.json({
      success: true,
      data: {
        labels: processedLabels,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        }
      },
      meta: {
        query: { status, hasMatches, sortBy, sortOrder },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    debugLog('GET_ALL_LABELS_ERROR', 'Failed to retrieve PSA labels', {
      error: error.message
    });
    throw error;
  }
});

/**
 * Helper function to calculate text similarity using Levenshtein distance
 */
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const str1 = text1.toLowerCase().trim();
  const str2 = text2.toLowerCase().trim();

  if (str1 === str2) return 1.0;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // Calculate Levenshtein distance
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);

  return (maxLength - distance) / maxLength;
}

export {
  processAllPsaLabels,
  findPsaImageByOcr,
  getPsaLabelImage,
  getAllPsaLabels
};
export default processAllPsaLabels;;
