import PsaLabel from '@/Domain/Entities/PsaLabel.js';
import googleVisionService from '@/Infrastructure/ExternalServices/Google/googleVisionService.js';
import UnifiedPsaMatchingService from '@/Application/UseCases/Matching/UnifiedPsaMatchingService.js';
import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import Logger from '@/Infrastructure/Utilities/Logger.js';
class PsaLabelService {
  /**
   * Create a new PSA label record
   */
  async createPsaLabel(labelData) {
    try {
      // Generate image hash if not provided
      if (!labelData.imageHash && labelData.labelImage) {
        labelData.imageHash = await this.generateImageHash(labelData.labelImage);
      }

      // Comprehensive duplicate validation
      if (labelData.imageHash) {
        const validation = await this.validateImageHash(labelData.imageHash);

        if (validation.exists) {
          Logger.info('PsaLabelService', `Duplicate image detected: ${validation.reason} (${validation.source})`);
          if (validation.source === 'psalabels') {
            return validation.document; // Return existing PSA label
          }
            throw new Error(`Image already processed in ${validation.source}: ${validation.reason}`);

        }
      }

      // Create new PSA label
      const psaLabel = new PsaLabel(labelData);

      await psaLabel.save();

      Logger.info('PsaLabelService', `PSA label created: ${psaLabel._id}`);
      return psaLabel;

    } catch (error) {
      Logger.error('PsaLabelService', 'Error creating PSA label:', error);
      throw error;
    }
  }

  /**
   * Process image through OCR and create PSA label
   */
  async processImageAndCreateLabel(image, options = {}) {
    try {
      Logger.info('PsaLabelService', 'Processing image for PSA label OCR');

      const startTime = Date.now();

      // Generate image hash for deduplication
      const imageBuffer = image.buffer || image;
      const imageHash = this.generateBufferHash(imageBuffer);

      // Check if already processed
      const existing = await PsaLabel.findByImageHash(imageHash);

      if (existing) {
        Logger.info('PsaLabelService', `PSA label already processed: ${existing._id}`);
        return existing;
      }

      // Save image file
      const imagePath = await this.saveImageFile(imageBuffer, image.originalname || 'psa_label.jpg');

      // Process with Google Vision API
      const ocrResult = await googleVisionService.extractText(imageBuffer, {
        languageHints: ['en'],
        features: {
          textDetection: true,
          documentTextDetection: false
        }
      });

      const processingTime = Date.now() - startTime;

      // Parse PSA data from OCR text
      const psaData = await this.parsePsaData(ocrResult.text);

      // Try to match card
      let matchedCard = null;
      let matchConfidence = 0;
      let matchingAlgorithm = null;

      if (psaData.cardName && psaData.setName) {
        try {
          const matchResult = await UnifiedPsaMatchingService.matchPsaLabel(ocrResult.text);

          if (matchResult && matchResult.matches && matchResult.matches.length > 0) {
            const bestMatch = matchResult.matches[0];

            matchedCard = bestMatch.card._id;
            matchConfidence = bestMatch.confidence;
            matchingAlgorithm = 'smart-psa';
          }
        } catch (matchError) {
          Logger.warn('PsaLabelService', 'Error matching PSA label:', matchError);
        }
      }

      // Assess OCR quality
      const ocrQuality = this.assessOcrQuality(ocrResult);

      // Create PSA label record
      const psaLabelData = {
        labelImage: imagePath,
        imageHash,
        originalFileName: image.originalname,
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        textAnnotations: ocrResult.textAnnotations || [],
        processingTime,
        psaData,
        matchedCard,
        matchConfidence,
        matchingAlgorithm,
        ocrQuality,
        batchId: options.batchId,
        batchIndex: options.batchIndex
      };

      const psaLabel = await this.createPsaLabel(psaLabelData);

      Logger.info('PsaLabelService', `PSA label processed successfully: ${psaLabel._id}`);
      return psaLabel;

    } catch (error) {
      Logger.error('PsaLabelService', 'Error processing image and creating PSA label:', error);
      throw error;
    }
  }

  /**
   * Get PSA label by ID
   */
  async getPsaLabelById(id) {
    try {
      const psaLabel = await PsaLabel.findById(id).populate('matchedCard');

      return psaLabel;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error getting PSA label by ID:', error);
      throw error;
    }
  }

  /**
   * Get PSA labels with filtering and pagination
   */
  async getPsaLabels(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'processedAt',
        sortOrder = 'desc',
        search
      } = options;

      let query = PsaLabel.find(filters);

      // Add text search if provided
      if (search) {
        query = query.where({ $text: { $search: search } });
      }

      // Apply sorting
      const sortObj = {};

      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      query = query.sort(sortObj);

      // Apply pagination
      const skip = (page - 1) * limit;

      query = query.skip(skip).limit(limit);

      // Populate references
      query = query.populate('matchedCard');

      const labels = await query.exec();
      const totalCount = await PsaLabel.countDocuments(filters);

      return {
        labels,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      };

    } catch (error) {
      Logger.error('PsaLabelService', 'Error getting PSA labels:', error);
      throw error;
    }
  }

  /**
   * Search PSA labels by text
   */
  async searchPsaLabels(query, limit = 20) {
    try {
      const results = await PsaLabel.searchOcrText(query, limit);

      return results;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error searching PSA labels:', error);
      throw error;
    }
  }

  /**
   * Get PSA label by certification number
   */
  async getPsaLabelByCertNumber(certNumber) {
    try {
      const psaLabel = await PsaLabel.findByCertNumber(certNumber).populate('matchedCard');

      return psaLabel;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error getting PSA label by cert number:', error);
      throw error;
    }
  }

  /**
   * Update PSA label
   */
  async updatePsaLabel(id, updates) {
    try {
      const psaLabel = await PsaLabel.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('matchedCard');

      return psaLabel;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error updating PSA label:', error);
      throw error;
    }
  }

  /**
   * Verify PSA label (mark as user verified)
   */
  async verifyPsaLabel(id, corrections = null) {
    try {
      const updates = {
        userVerified: true,
        updatedAt: new Date()
      };

      if (corrections) {
        updates.userCorrections = corrections;
      }

      const psaLabel = await PsaLabel.findByIdAndUpdate(
        id,
        updates,
        { new: true }
      ).populate('matchedCard');

      return psaLabel;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error verifying PSA label:', error);
      throw error;
    }
  }

  /**
   * Get batch PSA labels
   */
  async getBatchPsaLabels(batchId) {
    try {
      const psaLabels = await PsaLabel.getBatchLabels(batchId);

      return psaLabels;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error getting batch PSA labels:', error);
      throw error;
    }
  }

  /**
   * Get unmatched PSA labels
   */
  async getUnmatchedPsaLabels(limit = 50) {
    try {
      const psaLabels = await PsaLabel.findUnmatched(limit);

      return psaLabels;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error getting unmatched PSA labels:', error);
      throw error;
    }
  }

  /**
   * Get PSA labels by grade
   */
  async getPsaLabelsByGrade(grade, limit = 50) {
    try {
      const psaLabels = await PsaLabel.findByGrade(grade, limit);

      return psaLabels;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error getting PSA labels by grade:', error);
      throw error;
    }
  }

  /**
   * Delete PSA label
   */
  async deletePsaLabel(id) {
    try {
      const psaLabel = await PsaLabel.findByIdAndDelete(id);

      // Optionally delete the associated image file
      if (psaLabel && psaLabel.labelImage) {
        try {
          await fs.unlink(psaLabel.labelImage);
          Logger.info('PsaLabelService', `Deleted image file: ${psaLabel.labelImage}`);
        } catch (fileError) {
          Logger.warn('PsaLabelService', `Could not delete image file: ${psaLabel.labelImage}`, fileError);
        }
      }

      return psaLabel;
    } catch (error) {
      Logger.error('PsaLabelService', 'Error deleting PSA label:', error);
      throw error;
    }
  }

  /**
   * Batch update PSA labels with OCR data and parsed information
   */
  async batchUpdatePsaLabels(updates) {
    try {
      Logger.info('PsaLabelService', `Starting batch update of ${updates.length} PSA labels`);

      const updatePromises = updates.map(async (update) => {
        const { psaLabelId, ocrText, ocrConfidence, psaData, textAnnotations } = update;

        try {
          const updateData = {
            ocrText,
            ocrConfidence: ocrConfidence || 0.85,
            psaData: psaData || {},
            textAnnotations: textAnnotations || [],
            ocrProvider: 'google-vision',
            processingTime: Date.now(),
            updatedAt: new Date(),
            // Extract only year and cert to root level - everything else stays dynamic in psaData
            year: psaData?.year || null,
            certificationNumber: psaData?.certificationNumber || null
          };

          const updatedLabel = await PsaLabel.findByIdAndUpdate(
            psaLabelId,
            updateData,
            { new: true, runValidators: true }
          );

          if (!updatedLabel) {
            throw new Error(`PSA label not found: ${psaLabelId}`);
          }

          Logger.info('PsaLabelService', `Updated PSA label ${psaLabelId} with OCR data`);
          return { success: true, psaLabelId, updatedLabel };

        } catch (error) {
          Logger.error('PsaLabelService', `Error updating PSA label ${psaLabelId}:`, error);
          return { success: false, psaLabelId, error: error.message };
        }
      });

      const results = await Promise.all(updatePromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      Logger.info('PsaLabelService', `Batch update completed: ${successful.length} successful, ${failed.length} failed`);

      return {
        totalRequested: updates.length,
        successful: successful.length,
        failed: failed.length,
        results
      };

    } catch (error) {
      Logger.error('PsaLabelService', 'Error in batch PSA labels update:', error);
      throw error;
    }
  }

  /**
   * Create multiple PSA labels from image data (before stitching)
   */
  async createBatchPsaLabels(imageDataList) {
    try {
      Logger.info('PsaLabelService', `Creating batch of ${imageDataList.length} PSA labels`);

      const createPromises = imageDataList.map(async (imageData, index) => {
        try {
          // Check for duplicate hash
          const existingLabel = await PsaLabel.findByImageHash(imageData.imageHash);

          if (existingLabel) {
            Logger.info('PsaLabelService', `Skipping duplicate PSA label with hash: ${imageData.imageHash.substring(0, 8)}...`);
            return { success: true, duplicate: true, psaLabelId: existingLabel._id, index };
          }

          // Create new PSA label
          const psaLabel = new PsaLabel({
            labelImage: imageData.imagePath,
            imageHash: imageData.imageHash,
            originalFileName: imageData.originalFileName,
            batchId: imageData.batchId,
            batchIndex: index,
            processedAt: new Date()
            // Note: ocrText will be populated later after stitching OCR
          });

          await psaLabel.save();

          Logger.info('PsaLabelService', `Created PSA label ${psaLabel._id} for batch index ${index}`);
          return { success: true, duplicate: false, psaLabelId: psaLabel._id, index };

        } catch (error) {
          Logger.error('PsaLabelService', `Error creating PSA label at index ${index}:`, error);
          return { success: false, index, error: error.message };
        }
      });

      const results = await Promise.all(createPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      Logger.info('PsaLabelService', `Batch creation completed: ${successful.length} successful, ${failed.length} failed`);

      return {
        totalRequested: imageDataList.length,
        successful: successful.length,
        failed: failed.length,
        results,
        psaLabelIds: successful.map(r => r.psaLabelId)
      };

    } catch (error) {
      Logger.error('PsaLabelService', 'Error in batch PSA labels creation:', error);
      throw error;
    }
  }

  /**
   * Update multiple PSA labels with parsed OCR segments
   */
  async updateBatchWithOcrSegments(psaLabelIds, ocrSegments) {
    try {
      Logger.info('PsaLabelService', `Updating ${psaLabelIds.length} PSA labels with OCR segments`);

      if (psaLabelIds.length !== ocrSegments.length) {
        Logger.warn('PsaLabelService', `Mismatch: ${psaLabelIds.length} PSA labels vs ${ocrSegments.length} OCR segments`);
      }

      const updates = psaLabelIds.map((psaLabelId, index) => {
        const segment = ocrSegments[index];

        if (!segment) {
          return {
            psaLabelId,
            ocrText: '',
            ocrConfidence: 0,
            psaData: {},
            textAnnotations: []
          };
        }

        // Parse PSA data from the OCR segment
        const psaData = this.parsePsaDataFromOcrText(segment.rawText || segment.text || '');

        return {
          psaLabelId,
          ocrText: segment.rawText || segment.text || '',
          ocrConfidence: segment.confidence || 0,
          psaData,
          textAnnotations: segment.textAnnotations || []
        };
      });

      // Use existing batch update method
      return await this.batchUpdatePsaLabels(updates);

    } catch (error) {
      Logger.error('PsaLabelService', 'Error updating batch with OCR segments:', error);
      throw error;
    }
  }

  /**
   * DYNAMIC PSA PARSING: Year -> Dynamic Fields -> Cert
   * EXACTLY as you specified: Find year first, cert at end, everything else dynamic
   */
  parsePsaDataFromOcrText(ocrText) {
    if (!ocrText || ocrText.trim().length === 0) {
      return {};
    }

    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const psaData = {
      dynamicFields: {} // Initialize nested object for dynamic fields
    };

    // STEP 1: Find YEAR (1996-2030) - ALWAYS FIRST
    let yearFound = false;

    for (const line of lines) {
      const yearMatch = line.match(/\b(199[6-9]|20[0-2][0-9]|2030)\b/);

      if (yearMatch && !yearFound) {
        psaData.year = parseInt(yearMatch[1]);
        yearFound = true;
        break;
      }
    }

    // STEP 2: Find CERTIFICATION NUMBER (6+ digits) - ALWAYS LAST
    let certNumber = null;

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const certMatch = line.match(/\b(\d{6,})\b/);

      if (certMatch) {
        certNumber = certMatch[1];
        psaData.certificationNumber = certNumber;
        break;
      }
    }

    // STEP 3: DYNAMIC FIELDS - Everything between year and cert + anything after cert that's NOT a year
    let textFieldIndex = 1;
    let foundYear = false;
    let foundCert = false;

    for (const line of lines) {
      // Skip year line
      if (!foundYear && (/\b(199[6-9]|20[0-2][0-9]|2030)\b/).test(line)) {
        foundYear = true;
        continue;
      }

      // Skip cert line but mark that we found it
      if ((/\b\d{6,}\b/).test(line) && line.includes(certNumber)) {
        foundCert = true;
        continue;
      }

      // Skip empty lines
      if (!line.trim()) continue;

      // DYNAMIC FIELD: Save as text1, text2, text3, etc. in dynamicFields object
      if (foundYear) {
        // If we've found cert and this line has a year, STOP (next PSA label)
        if (foundCert && (/\b(199[6-9]|20[0-2][0-9]|2030)\b/).test(line)) {
          break;
        }

        psaData.dynamicFields[`text${textFieldIndex}`] = line.trim();
        textFieldIndex++;
      }
    }

    // Count total text fields (excluding year and cert)
    psaData.totalTextFields = textFieldIndex - 1;

    return psaData;
  }

  /**
   * Get OCR processing statistics
   */
  async getOcrStats() {
    try {
      const stats = await PsaLabel.aggregate([
        {
          $group: {
            _id: null,
            totalLabels: { $sum: 1 },
            avgConfidence: { $avg: '$ocrConfidence' },
            avgProcessingTime: { $avg: '$processingTime' },
            matchedCount: {
              $sum: { $cond: [{ $ifNull: ['$matchedCard', false] }, 1, 0] }
            },
            verifiedCount: { $sum: { $cond: ['$userVerified', 1, 0] } },
            gradeDistribution: {
              $push: '$psaData.grade'
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalLabels: 1,
            avgConfidence: { $round: ['$avgConfidence', 3] },
            avgProcessingTime: { $round: ['$avgProcessingTime', 0] },
            matchedCount: 1,
            verifiedCount: 1,
            matchRate: {
              $round: [
                { $multiply: [{ $divide: ['$matchedCount', '$totalLabels'] }, 100] },
                1
              ]
            },
            verificationRate: {
              $round: [
                { $multiply: [{ $divide: ['$verifiedCount', '$totalLabels'] }, 100] },
                1
              ]
            }
          }
        }
      ]);

      // Get grade distribution
      const gradeStats = await PsaLabel.aggregate([
        {
          $group: {
            _id: '$psaData.grade',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      return {
        ...stats[0] || {},
        gradeDistribution: gradeStats
      };

    } catch (error) {
      Logger.error('PsaLabelService', 'Error getting OCR stats:', error);
      throw error;
    }
  }

  /**
   * Generate image hash from file path
   */
  async generateImageHash(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);

      return this.generateBufferHash(imageBuffer);
    } catch (error) {
      Logger.error('PsaLabelService', 'Error generating image hash:', error);
      throw error;
    }
  }

  /**
   * Generate hash from buffer
   */
  generateBufferHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Save image file to disk
   */
  async saveImageFile(imageBuffer, originalName) {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'psa-labels');

      await fs.mkdir(uploadsDir, { recursive: true });

      const timestamp = Date.now();
      const ext = path.extname(originalName) || '.jpg';
      const filename = `psa_label_${timestamp}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      await fs.writeFile(filePath, imageBuffer);

      Logger.info('PsaLabelService', `Image saved: ${filePath}`);
      return filePath;

    } catch (error) {
      Logger.error('PsaLabelService', 'Error saving image file:', error);
      throw error;
    }
  }

  /**
   * Parse PSA-specific data from OCR text
   */
  async parsePsaData(ocrText) {
    try {
      const psaData = {
        certificationNumber: null,
        grade: null,
        cardName: null,
        setName: null,
        cardNumber: null,
        year: null,
        variety: null
      };

      // Extract certification number (typically 8-10 digits)
      const certMatch = ocrText.match(/\b(\d{8,10})\b/);

      if (certMatch) {
        psaData.certificationNumber = certMatch[1];
      }

      // Extract grade (typically "MINT 9", "GEM MINT 10", etc.)
      const gradeMatch = ocrText.match(/(?:MINT|GEM MINT|NM-MT|EX-MT|EX|VG-EX|VG|GOOD|PR)\s*(\d+)/i);

      if (gradeMatch) {
        psaData.grade = gradeMatch[1];
      } else {
        // Look for just numbers that might be grades
        const numberMatch = ocrText.match(/\b(10|9|8|7|6|5|4|3|2|1)\b/);

        if (numberMatch) {
          psaData.grade = numberMatch[1];
        }
      }

      // Extract year (4 digits)
      const yearMatch = ocrText.match(/\b(19\d{2}|20\d{2})\b/);

      if (yearMatch) {
        psaData.year = yearMatch[1];
      }

      // Use smart matching to extract other fields
      const smartMatch = await UnifiedPsaMatchingService.extractPsaFields(ocrText);

      if (smartMatch) {
        psaData.cardName = smartMatch.cardName || psaData.cardName;
        psaData.setName = smartMatch.setName || psaData.setName;
        psaData.cardNumber = smartMatch.cardNumber || psaData.cardNumber;
        psaData.variety = smartMatch.variety || psaData.variety;
      }

      return psaData;

    } catch (error) {
      Logger.error('PsaLabelService', 'Error parsing PSA data:', error);
      return {};
    }
  }

  /**
   * Assess OCR quality
   */
  assessOcrQuality(ocrResult) {
    const quality = {
      score: ocrResult.confidence || 0,
      issues: [],
      recommendations: []
    };

    // Check text length
    if (!ocrResult.text || ocrResult.text.length < 10) {
      quality.issues.push('very_short_text');
      quality.recommendations.push('Check image quality and lighting');
    }

    // Check confidence
    if (ocrResult.confidence < 0.5) {
      quality.issues.push('low_confidence');
      quality.recommendations.push('Improve image contrast and resolution');
    }

    // Check for common OCR issues
    if (ocrResult.text.includes('???') || ocrResult.text.includes('□')) {
      quality.issues.push('unrecognized_characters');
      quality.recommendations.push('Ensure text is clearly visible and not obscured');
    }

    return quality;
  }

  /**
   * Comprehensive hash validation across PSA labels and stitched labels
   * Prevents duplicate processing by checking both collections
   */
  async validateImageHash(imageHash) {
    try {
      Logger.info('PsaLabelService', `Validating image hash: ${imageHash.substring(0, 8)}...`);

      // Check PSA labels collection first
      const existingPsaLabel = await PsaLabel.findByImageHash(imageHash);

      if (existingPsaLabel) {
        Logger.info('PsaLabelService', `Hash found in PSA labels: ${existingPsaLabel._id}`);
        return {
          exists: true,
          source: 'psalabels',
          document: existingPsaLabel,
          reason: 'Image already processed as individual PSA label'
        };
      }

      // Check stitched labels collection (images could be part of a previous batch)
      const StitchedLabel = (await import('@/Domain/Entities/StitchedLabel.js')).default;
      const existingStitchedLabel = await StitchedLabel.findOne({
        imageHashes: { $in: [imageHash] }
      });

      if (existingStitchedLabel) {
        Logger.info('PsaLabelService', `Hash found in stitched labels: ${existingStitchedLabel._id}`);
        return {
          exists: true,
          source: 'stitchedlabels',
          document: existingStitchedLabel,
          reason: 'Image already processed as part of stitched batch'
        };
      }

      // Hash is new - safe to process
      Logger.info('PsaLabelService', 'Hash validation passed - image is new');
      return {
        exists: false,
        source: null,
        document: null,
        reason: 'Image hash not found in database'
      };

    } catch (error) {
      Logger.error('PsaLabelService', 'Error during hash validation:', error);
      // Fail safe - assume exists to prevent potential duplicates
      return {
        exists: true,
        source: 'error',
        document: null,
        reason: `Validation error: ${error.message}`
      };
    }
  }
}

export default new PsaLabelService();
