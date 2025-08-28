/**
 * OCR Text Distributor - Centralized OCR Text Processing
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles OCR text distribution and confidence calculation
 * - Open/Closed: Static methods for extension without modification
 * - DRY: Single implementation used across all ICR services
 */

import Logger from '@/system/logging/Logger.js';

export class OcrTextDistributor {

  /**
   * Distribute OCR text annotations by actual label positions
   * @param {Array} textAnnotations - Google Vision text annotations
   * @param {Array} labelPositions - Array of {index, y, height} for each label
   * @returns {Array} Array of text strings for each label
   */
  static distributeByActualPositions(textAnnotations, labelPositions) {
    if (!textAnnotations || !Array.isArray(textAnnotations) || textAnnotations.length === 0) {
      Logger.warn('OcrTextDistributor', 'No text annotations provided for distribution');
      return Array(labelPositions.length).fill('');
    }

    if (!labelPositions || !Array.isArray(labelPositions) || labelPositions.length === 0) {
      Logger.warn('OcrTextDistributor', 'No label positions provided for distribution');
      return [];
    }

    const labelSegments = Array(labelPositions.length).fill(null).map(() => []);

    // Skip the first annotation (full text block) and process individual words/phrases
    const individualAnnotations = textAnnotations.slice(1);

    individualAnnotations.forEach(annotation => {
      if (!annotation.boundingPoly || !annotation.boundingPoly.vertices) {
        return;
      }

      // Calculate center Y position of the text
      const vertices = annotation.boundingPoly.vertices;
      const avgY = vertices.reduce((sum, vertex) => sum + (vertex.y || 0), 0) / vertices.length;

      // Find which label this text belongs to based on actual positions
      let labelIndex = -1;
      for (let i = 0; i < labelPositions.length; i++) {
        const pos = labelPositions[i];
        if (avgY >= pos.y && avgY < pos.y + pos.height) {
          labelIndex = i;
          break;
        }
      }
      
      // If no exact match, find closest label
      if (labelIndex === -1) {
        let minDistance = Infinity;
        for (let i = 0; i < labelPositions.length; i++) {
          const pos = labelPositions[i];
          const labelCenter = pos.y + pos.height / 2;
          const distance = Math.abs(avgY - labelCenter);
          if (distance < minDistance) {
            minDistance = distance;
            labelIndex = i;
          }
        }
      }
      
      labelSegments[labelIndex].push({
        text: annotation.description,
        confidence: annotation.confidence || 0,
        boundingBox: annotation.boundingPoly,
        centerY: avgY
      });
    });

    // Sort text within each label by Y position (top to bottom)
    labelSegments.forEach((segment, index) => {
      if (Array.isArray(segment)) {
        segment.sort((a, b) => a.centerY - b.centerY);
      } else {
        Logger.error('OcrTextDistributor', 'Segment is not an array', { 
          index, 
          segment, 
          labelSegmentsLength: labelSegments.length 
        });
        labelSegments[index] = []; // Fix corrupted segment
      }
    });

    Logger.info('OcrTextDistributor', 'Text distribution completed', {
      totalAnnotations: individualAnnotations.length,
      labelCount: labelPositions.length,
      distributedCounts: labelSegments.map(segment => segment.length)
    });

    // Convert segments to strings for distribution (this was the missing part!)
    const textStrings = labelSegments.map((segment, index) => {
      if (!Array.isArray(segment)) {
        Logger.warn('OcrTextDistributor', 'Non-array segment found, returning empty string', { index, segment });
        return '';
      }
      return segment.map(item => item.text).join(' ').trim();
    });

    Logger.info('OcrTextDistributor', 'String conversion completed', {
      resultLength: textStrings.length,
      expectedLength: labelPositions.length,
      textLengths: textStrings.map(r => r.length)
    });

    return textStrings;
  }

  /**
   * Calculate overall confidence score from text annotations
   * @param {Array} textAnnotations - Google Vision text annotations
   * @returns {number} Average confidence score (0-1)
   */
  static calculateOverallConfidence(textAnnotations) {
    if (!textAnnotations || !Array.isArray(textAnnotations) || textAnnotations.length === 0) {
      return 0;
    }

    // Skip the first annotation (full text block) and process individual words/phrases
    const individualAnnotations = textAnnotations.slice(1);
    
    if (individualAnnotations.length === 0) {
      return 0;
    }

    const totalConfidence = individualAnnotations.reduce((sum, annotation) => {
      return sum + (annotation.confidence || 0);
    }, 0);

    const averageConfidence = totalConfidence / individualAnnotations.length;
    
    // Round to 2 decimal places
    return Math.round(averageConfidence * 100) / 100;
  }

  /**
   * Extract text content from distributed segments
   * @param {Array} labelSegments - Distributed text segments
   * @returns {Array} Array of text strings for each label
   */
  static extractTextFromSegments(labelSegments) {
    if (!labelSegments || !Array.isArray(labelSegments)) {
      return [];
    }

    return labelSegments.map(segment => {
      if (!segment || !Array.isArray(segment)) {
        return '';
      }
      
      return segment
        .map(annotation => annotation.text || '')
        .filter(text => text.trim().length > 0)
        .join(' ');
    });
  }

  /**
   * Get confidence scores for each label segment
   * @param {Array} labelSegments - Distributed text segments
   * @returns {Array} Array of confidence scores for each label
   */
  static getSegmentConfidences(labelSegments) {
    if (!labelSegments || !Array.isArray(labelSegments)) {
      return [];
    }

    return labelSegments.map(segment => {
      if (!segment || !Array.isArray(segment) || segment.length === 0) {
        return 0;
      }

      const totalConfidence = segment.reduce((sum, annotation) => {
        return sum + (annotation.confidence || 0);
      }, 0);

      const averageConfidence = totalConfidence / segment.length;
      return Math.round(averageConfidence * 100) / 100;
    });
  }
}

export default OcrTextDistributor;