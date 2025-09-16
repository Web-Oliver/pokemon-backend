/**
 * OCR Text Distribution Utility
 *
 * Handles mapping OCR text annotations from stitched images back to individual labels
 * using coordinate-based positioning. Critical component for Pokemon card OCR workflow.
 */

import Logger from '@/system/logging/Logger.js';

export class OcrTextDistributor {

  /**
   * Distribute OCR text annotations to individual labels based on Y coordinates
   * @param {Array} textAnnotations - Google Vision text annotations with bounding boxes
   * @param {Array} labelPositions - Label positions from stitching process
   * @returns {Array} Array of text strings for each label position
   */
  static distributeByActualPositions(textAnnotations, labelPositions) {
    try {
      Logger.operationStart('OCR_TEXT_DISTRIBUTION', 'Distributing text by Y coordinates', {
        annotationCount: textAnnotations?.length || 0,
        labelCount: labelPositions?.length || 0
      });

      // Validate inputs
      if (!textAnnotations || !Array.isArray(textAnnotations) || textAnnotations.length === 0) {
        Logger.warn('OcrTextDistributor', 'No text annotations provided');
        return Array(labelPositions?.length || 0).fill('');
      }

      if (!labelPositions || !Array.isArray(labelPositions) || labelPositions.length === 0) {
        Logger.warn('OcrTextDistributor', 'No label positions provided');
        return [];
      }

      // Initialize distribution array - create array with correct length
      const distribution = Array(labelPositions.length).fill(null).map(() => []);

      // Skip first annotation (full text block) and process individual text segments
      const individualAnnotations = textAnnotations.slice(1);

      Logger.info('OCR_TEXT_DISTRIBUTION', 'Processing individual text annotations', {
        totalAnnotations: textAnnotations.length,
        individualAnnotations: individualAnnotations.length,
        labelPositions: labelPositions.length
      });

      // Process each text annotation
      for (let i = 0; i < individualAnnotations.length; i++) {
        const annotation = individualAnnotations[i];

        if (!annotation.boundingPoly || !annotation.boundingPoly.vertices) {
          Logger.warn('OCR_TEXT_DISTRIBUTION', 'Annotation missing bounding box', {
            annotationIndex: i,
            description: annotation.description?.substring(0, 30)
          });
          continue;
        }

        // Calculate text center Y coordinate
        const textBounds = this.calculateTextBounds(annotation.boundingPoly.vertices);
        const textCenterY = (textBounds.top + textBounds.bottom) / 2;

        // Find matching label position using Y coordinate overlap
        const assignment = this.findBestLabelMatch(textCenterY, textBounds, labelPositions);

        if (assignment.labelIndex !== -1) {
          // Add text to the correct label position
          distribution[assignment.labelIndex].push({
            text: annotation.description,
            confidence: annotation.confidence || 0,
            centerY: textCenterY,
            assignmentConfidence: assignment.confidence,
            boundingBox: annotation.boundingPoly
          });

          Logger.debug('OCR_TEXT_DISTRIBUTION', 'Text assigned to label', {
            text: annotation.description.substring(0, 30),
            textY: textCenterY,
            labelIndex: assignment.labelIndex,
            labelYRange: `${labelPositions[assignment.labelIndex].y}-${labelPositions[assignment.labelIndex].y + labelPositions[assignment.labelIndex].height}`,
            confidence: assignment.confidence
          });
        } else {
          Logger.warn('OCR_TEXT_DISTRIBUTION', 'No label found for text annotation', {
            text: annotation.description.substring(0, 30),
            textY: textCenterY,
            textBounds: textBounds
          });
        }
      }

      // Sort text within each label by Y position (top to bottom)
      distribution.forEach((segments, labelIndex) => {
        segments.sort((a, b) => a.centerY - b.centerY);
      });

      // Convert to text strings
      const textStrings = distribution.map((segments, labelIndex) => {
        const text = segments.map(segment => segment.text).join(' ').trim();

        Logger.debug('OCR_TEXT_DISTRIBUTION', `Label ${labelIndex} text result`, {
          labelIndex,
          segmentCount: segments.length,
          textLength: text.length,
          textPreview: text.substring(0, 50)
        });

        return text;
      });

      Logger.operationSuccess('OCR_TEXT_DISTRIBUTION', 'Text distribution completed', {
        distributedLabels: textStrings.filter(t => t.length > 0).length,
        emptyLabels: textStrings.filter(t => t.length === 0).length,
        totalLabels: textStrings.length
      });

      return textStrings;

    } catch (error) {
      Logger.operationError('OCR_TEXT_DISTRIBUTION', 'Text distribution failed', error);
      throw error;
    }
  }

  /**
   * Calculate bounding rectangle from vertices
   * @param {Array} vertices - Array of {x, y} coordinates
   * @returns {Object} Normalized bounding rectangle
   */
  static calculateTextBounds(vertices) {
    const xCoords = vertices.map(v => v.x || 0);
    const yCoords = vertices.map(v => v.y || 0);

    return {
      left: Math.min(...xCoords),
      right: Math.max(...xCoords),
      top: Math.min(...yCoords),
      bottom: Math.max(...yCoords),
      width: Math.max(...xCoords) - Math.min(...xCoords),
      height: Math.max(...yCoords) - Math.min(...yCoords)
    };
  }

  /**
   * Find best matching label for text based on Y coordinate overlap
   * @param {number} textCenterY - Y coordinate of text center
   * @param {Object} textBounds - Text bounding rectangle
   * @param {Array} labelPositions - Label positions array
   * @returns {Object} Best assignment with confidence score
   */
  static findBestLabelMatch(textCenterY, textBounds, labelPositions) {
    const TOLERANCE = 10; // 10px tolerance for boundary detection
    let bestMatch = { labelIndex: -1, confidence: 0, overlapPercentage: 0 };

    for (let i = 0; i < labelPositions.length; i++) {
      const position = labelPositions[i];

      // Calculate label boundaries with tolerance
      const labelTop = position.y - TOLERANCE;
      const labelBottom = position.y + position.height + TOLERANCE;

      // Check for Y coordinate overlap
      const overlapTop = Math.max(textBounds.top, labelTop);
      const overlapBottom = Math.min(textBounds.bottom, labelBottom);
      const overlapHeight = Math.max(0, overlapBottom - overlapTop);

      const textHeight = textBounds.bottom - textBounds.top;
      const overlapPercentage = textHeight > 0 ? overlapHeight / textHeight : 0;

      // Calculate distance from text center to label center
      const labelCenterY = position.y + (position.height / 2);
      const distanceFromCenter = Math.abs(textCenterY - labelCenterY);
      const normalizedDistance = distanceFromCenter / (position.height / 2);

      // Calculate assignment confidence
      const confidence = this.calculateAssignmentConfidence(overlapPercentage, normalizedDistance);

      // Update best match if this is better
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          labelIndex: i,
          confidence: confidence,
          overlapPercentage: overlapPercentage,
          distanceFromCenter: distanceFromCenter,
          labelPosition: position
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate confidence score for text-to-label assignment
   * @param {number} overlapPercentage - 0.0 to 1.0+ (overlap percentage)
   * @param {number} normalizedDistance - 0.0 to 1.0+ (distance from center)
   * @returns {number} Confidence score 0.0 to 1.0
   */
  static calculateAssignmentConfidence(overlapPercentage, normalizedDistance) {
    // Weighted scoring system
    const overlapWeight = 0.7;
    const distanceWeight = 0.3;

    // Overlap score (higher overlap = better)
    const overlapScore = Math.min(1.0, overlapPercentage);

    // Distance score (closer to center = better)
    const distanceScore = Math.max(0.0, 1.0 - normalizedDistance);

    // Combined confidence score
    const confidence = (overlapScore * overlapWeight) + (distanceScore * distanceWeight);

    return Math.max(0.0, Math.min(1.0, confidence));
  }

  /**
   * Get distribution quality metrics
   * @param {Array} distributionResults - Results from distributeByActualPositions
   * @param {Array} originalAnnotations - Original OCR annotations
   * @returns {Object} Quality metrics
   */
  static getDistributionQualityMetrics(distributionResults, originalAnnotations) {
    const totalAnnotations = originalAnnotations.length - 1; // Exclude full text block
    const distributedText = distributionResults.filter(text => text.length > 0);
    const emptyLabels = distributionResults.filter(text => text.length === 0);

    return {
      totalLabels: distributionResults.length,
      labelsWithText: distributedText.length,
      emptyLabels: emptyLabels.length,
      distributionRate: distributedText.length / distributionResults.length,
      averageTextLength: distributedText.reduce((sum, text) => sum + text.length, 0) / Math.max(1, distributedText.length),
      totalCharacters: distributionResults.reduce((sum, text) => sum + text.length, 0)
    };
  }
}

export default OcrTextDistributor;