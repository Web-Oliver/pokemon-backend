import StitchedLabel from '@/Domain/Entities/StitchedLabel.js';
import PsaLabel from '@/Domain/Entities/PsaLabel.js';
import psaLabelService from './psaLabelService.js';
import googleVisionService from '@/Infrastructure/ExternalServices/Google/googleVisionService.js';
import PsaLabelDetectionService from '@/Application/UseCases/PSA/PsaLabelDetectionService.js';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import Logger from '@/Infrastructure/Utilities/Logger.js';
class StitchedLabelService {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.stitchedLabelsDir = path.join(this.uploadsDir, 'stitched-labels');
    this.fullImagesDir = path.join(this.uploadsDir, 'full-images');
    this.extractedLabelsDir = path.join(this.uploadsDir, 'extracted-labels');
    this.ensureUploadsDirectory();
  }

  async ensureUploadsDirectory() {
    try {
      await fs.mkdir(this.stitchedLabelsDir, { recursive: true });
      await fs.mkdir(this.fullImagesDir, { recursive: true });
      await fs.mkdir(this.extractedLabelsDir, { recursive: true });
    } catch (error) {
      Logger.error('StitchedLabelService', 'Error creating uploads directories:', error);
    }
  }

  /**
   * Create stitched image from multiple PSA label images with label extraction
   * WORKFLOW: images → create PsaLabels → check hashes → stitch → OCR → update PsaLabels
   */
  async createStitchedLabel(images, options = {}) {
    try {
      const startTime = Date.now();
      const batchId = options.batchId || this.generateBatchId();
      const batchSize = Math.min(images.length, 234); // MAX 234 images per batch (coordinate-based OCR limit)

      Logger.info('StitchedLabelService', `Creating stitched label for batch ${batchId} with ${batchSize} images`);

      // STEP 1: Create individual PSA labels BEFORE stitching
      Logger.info('StitchedLabelService', 'Creating individual PsaLabel documents...');
      const psaLabels = [];
      const processedImages = [];

      for (let i = 0; i < batchSize; i++) {
        const image = images[i];
        const imageBuffer = image.buffer || image;

        // Generate unique hash for image
        const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

        // Check if this image hash already exists in PSA labels or stitched labels
        const existingValidation = await this.validateImageHash(imageHash);

        if (existingValidation.exists) {
          Logger.info('StitchedLabelService', `Skipping duplicate image ${i}: hash ${imageHash.substring(0, 8)}... (${existingValidation.source})`);
          continue;
        }

        // Save individual image first
        const imagePath = await this.saveIndividualImage(imageBuffer, batchId, i, image.originalname);

        // Create PsaLabel document (without OCR data initially)
        const psaLabel = new PsaLabel({
          labelImage: imagePath,
          imageHash,
          originalFileName: image.originalname || `image_${i}.jpg`,
          batchId,
          batchIndex: i,
          processedAt: new Date()
        });

        await psaLabel.save();
        psaLabels.push(psaLabel._id); // Store ObjectId reference for StitchedLabel

        // Prepare for stitching
        processedImages.push({
          ...image,
          buffer: imageBuffer,
          psaLabelId: psaLabel._id,
          imageHash,
          extractionInfo: { success: true, note: 'PsaLabel created before stitching' }
        });

        Logger.info('StitchedLabelService', `Created PsaLabel ${psaLabel._id} for image ${i}`);
      }

      if (processedImages.length === 0) {
        throw new Error('No new images to process - all images already exist');
      }

      Logger.info('StitchedLabelService', `Created ${psaLabels.length} individual PsaLabel documents`);

      // STEP 2: Extract PSA labels from card images if needed
      const extractLabelsOnly = options.extractLabelsOnly !== false;
      let processedImageBuffers = [];

      if (extractLabelsOnly) {
        Logger.info('StitchedLabelService', 'Extracting PSA labels from card images...');

        const imageBuffers = processedImages.map(img => img.buffer);
        const extractionResults = await PsaLabelDetectionService.extractMultiplePsaLabels(imageBuffers, {
          cropStrategy: 'color-based',
          enhanceContrast: true,
          edgeEnhancement: true,
          gammaCorrection: true
        });

        // Save extracted labels to extracted-labels folder AND use for stitching
        processedImageBuffers = [];

        for (let i = 0; i < extractionResults.length; i++) {
          const result = extractionResults[i];
          const originalImage = processedImages[i];

          if (result.success) {
            // Save extracted label to extracted-labels folder
            const extractedFilename = `${batchId}_extracted_${i}_${originalImage.originalFileName || 'label.jpg'}`;
            const extractedPath = path.join(this.extractedLabelsDir, extractedFilename);

            await fs.writeFile(extractedPath, result.labelBuffer);

            Logger.info('StitchedLabelService', `Saved extracted label: ${extractedPath}`);
          }

          processedImageBuffers.push({
            ...originalImage,
            buffer: result.labelBuffer,
            originalBuffer: originalImage.buffer,
            extractedPath: result.success ? path.join(this.extractedLabelsDir, `${batchId}_extracted_${i}_${originalImage.originalFileName || 'label.jpg'}`) : null,
            extractionInfo: {
              success: result.success,
              cropRegion: result.cropRegion,
              processingTime: result.processingTime,
              error: result.error
            }
          });
        }

        const successCount = extractionResults.filter(r => r.success).length;

        Logger.info('StitchedLabelService', `Label extraction completed: ${successCount}/${processedImages.length} successful`);
      } else {
        processedImageBuffers = processedImages;
      }

      // STEP 3: Calculate optimal grid dimensions for vertical stacking
      const actualBatchSize = processedImageBuffers.length;
      const gridDimensions = this.calculateGridDimensions(actualBatchSize);
      const { cols: gridColumns, rows: gridRows } = gridDimensions;

      // OPTIMIZED PSA label dimensions for vertical stacking (280x70px - removes white space)
      const labelWidth = options.labelWidth || 280;
      const labelHeight = options.labelHeight || 70;
      const spacing = options.spacing || 0; // 🚀 NO SPACING NEEDED - coordinate-based OCR uses bounding boxes!
      const backgroundColor = options.backgroundColor || '#FFFFFF';

      // Calculate stitched image dimensions for VERTICAL STACK (1 column)
      const totalWidth = labelWidth; // Canvas width = label width (no side spacing)
      const totalHeight = labelHeight * gridRows; // Height = stacked labels (NO SPACING - coordinate-based OCR uses bounding boxes)

      Logger.info('StitchedLabelService', `Grid: ${gridColumns}x${gridRows}, Size: ${totalWidth}x${totalHeight}`);

      // STEP 3: Create individual label data for stitching
      const individualLabels = [];
      const stitchingImages = [];

      for (let i = 0; i < processedImageBuffers.length; i++) {
        const processedImage = processedImageBuffers[i];
        const row = i; // Vertical stack: each label gets its own row
        const col = 0; // Vertical stack: always column 0

        // Calculate position in vertical stitched image with proper spacing for barriers
        const x = 0; // No left margin - labels fill canvas width
        const y = spacing + (row * (labelHeight + spacing)); // Stacked vertically with barrier space

        // Use processed buffer (extracted label or original)
        const imageBuffer = processedImage.buffer;
        const imageHash = this.generateBufferHash(imageBuffer);

        // Resize image to exact dimensions (stretch to fill, no padding)
        const resizedBuffer = await sharp(imageBuffer)
          .resize(labelWidth, labelHeight, { fit: 'fill' })
          .jpeg({ quality: 95 })
          .toBuffer();

        stitchingImages.push({
          buffer: resizedBuffer,
          x, y, width: labelWidth, height: labelHeight
        });

        individualLabels.push({
          labelImage: `temp_${imageHash}.jpg`, // Will be updated with actual path
          imageHash,
          originalFileName: processedImage.originalname || `label_${i}.jpg`,
          position: { x, y, width: labelWidth, height: labelHeight },
          gridPosition: { row, col },
          extractionInfo: processedImage.extractionInfo // Include extraction metadata
        });
      }

      // STEP 4: Create stitched image using Sharp
      const stitchedImageBuffer = await this.createStitchedImage(
        stitchingImages,
        totalWidth,
        totalHeight,
        backgroundColor,
        spacing
      );

      // Save stitched image
      const stitchedImagePath = await this.saveStitchedImage(stitchedImageBuffer, batchId);
      const stitchedImageHash = this.generateBufferHash(stitchedImageBuffer);

      // Create stitched label record with PSA label references
      const stitchedLabelData = {
        stitchedImage: stitchedImagePath,
        stitchedImageHash,
        imageHashes: processedImages.map(img => img.imageHash), // Store individual image hashes for duplicate prevention
        individualLabels,
        psaLabels, // Array of ObjectId references
        stitchingConfig: {
          gridColumns,
          gridRows,
          labelWidth,
          labelHeight,
          spacing,
          backgroundColor,
          totalWidth,
          totalHeight
        },
        batchId,
        batchSize: actualBatchSize, // Use actual batch size after deduplication
        processingTime: Date.now() - startTime,
        status: 'stitched',
        costSavings: this.calculateCostSavings(actualBatchSize),
        labelExtractionEnabled: extractLabelsOnly,
        labelExtractionStats: {
          totalImages: actualBatchSize,
          successfulExtractions: processedImageBuffers.filter(img => img.extractionInfo.success).length,
          failedExtractions: processedImageBuffers.filter(img => !img.extractionInfo.success).length
        }
      };

      // Save stitched label to database
      const stitchedLabel = new StitchedLabel(stitchedLabelData);

      await stitchedLabel.save();

      Logger.info('StitchedLabelService', `Stitched label saved to database: ${stitchedLabel._id}`);

      return stitchedLabel;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error creating stitched label:', error);
      throw error;
    }
  }

  /**
   * Process stitched image with OCR and extract individual labels
   */
  async processStitchedLabelWithOcr(stitchedLabelId) {
    try {
      const startTime = Date.now();
      const stitchedLabel = await StitchedLabel.findById(stitchedLabelId).populate('psaLabels');

      if (!stitchedLabel) {
        throw new Error('Stitched label not found');
      }

      Logger.info('StitchedLabelService', `Processing stitched label ${stitchedLabelId} with OCR`);

      // Update status using updateOne
      await StitchedLabel.updateOne(
        { _id: stitchedLabelId },
        { status: 'ocr_processed' }
      );

      // Read stitched image
      const stitchedImageBuffer = await fs.readFile(stitchedLabel.stitchedImage);

      Logger.info('StitchedLabelService', `Stitched image loaded: ${stitchedImageBuffer.length} bytes`);

      // Process with Google Vision API with proper timeout handling
      const imageSizeKB = Math.round(stitchedImageBuffer.length / 1024);
      const imageSizeMB = Math.round(imageSizeKB / 1024 * 100) / 100;

      console.log('🔥 [EXTENSIVE DEBUG] STITCHED IMAGE ANALYSIS:', {
        imageSize: `${imageSizeKB}KB (${imageSizeMB}MB)`,
        bufferLength: stitchedImageBuffer.length,
        expectedLabels: stitchedLabel.batchSize || 30,
        gridLayout: `${stitchedLabel.stitchingConfig?.gridColumns || 1}x${stitchedLabel.stitchingConfig?.gridRows || 30}`,
        imagePath: stitchedLabel.stitchedImage,
        timestamp: new Date().toISOString()
      });

      Logger.info('StitchedLabelService', `Sending ${imageSizeMB}MB stitched image to Google Vision API - this may take 60-120 seconds...`);

      const ocrStartTime = Date.now();

      console.log('⏳ [OCR START] Beginning Google Vision API call...');

      const batchOcrResult = await Promise.race([
        googleVisionService.extractText(stitchedImageBuffer.toString('base64'), {
          languageHints: ['en']
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Google Vision API timeout after 5 minutes')), 300000)
        )
      ]);

      const ocrProcessingTime = Date.now() - ocrStartTime;

      console.log('✅ [OCR COMPLETE] Google Vision API finished:', {
        processingTime: `${ocrProcessingTime}ms`,
        processingTimeSeconds: `${Math.round(ocrProcessingTime / 1000)}s`,
        timestamp: new Date().toISOString()
      });

      console.log('🔥 [EXTENSIVE DEBUG] OCR RESULT ANALYSIS:', {
        textLength: batchOcrResult.text?.length || 0,
        confidence: batchOcrResult.confidence || 0,
        textAnnotationsCount: batchOcrResult.textAnnotations?.length || 0,
        hasPages: Boolean(batchOcrResult.pages && batchOcrResult.pages.length > 0),
        textPreview: `${batchOcrResult.text?.substring(0, 500)}...`,
        ocrProcessingTime: `${ocrProcessingTime}ms`,
        timestamp: new Date().toISOString()
      });

      Logger.info('StitchedLabelService', `OCR processing completed: ${batchOcrResult.text?.length || 0} characters extracted in ${Math.round(ocrProcessingTime / 1000)}s`);

      // EXTENSIVE VALIDATION
      if (!batchOcrResult.text || batchOcrResult.text.length === 0) {
        console.error('💥 [OCR FAILURE] Google Vision API returned empty text result!');
        console.error('💥 [OCR DEBUG] Full result object:', JSON.stringify(batchOcrResult, null, 2));
        throw new Error('Google Vision API returned empty text result');
      }

      if (batchOcrResult.text.length < 100) {
        console.warn('⚠️ [OCR WARNING] Very short text extracted - possible issue:', batchOcrResult.text.length, 'characters');
        console.warn('⚠️ [OCR TEXT]:', batchOcrResult.text);
      }

      console.log('✅ [OCR VALIDATION] Text extraction successful:', batchOcrResult.text.length, 'characters');

      // Save batch OCR result
      const batchOcrResultData = {
        fullText: batchOcrResult.text,
        confidence: batchOcrResult.confidence,
        processingTime: Date.now() - startTime,
        textAnnotations: batchOcrResult.textAnnotations || [],
        // 🔥 CRITICAL: Store hierarchical coordinate data from DOCUMENT_TEXT_DETECTION
        fullTextAnnotation: batchOcrResult.fullTextAnnotation || null,
        pages: batchOcrResult.pages || []
      };

      await StitchedLabel.updateOne(
        { _id: stitchedLabelId },
        { batchOcrResult: batchOcrResultData }
      );

      // Update existing PSA labels with OCR data from the batch result
      if (stitchedLabel.psaLabels && stitchedLabel.psaLabels.length > 0) {
        Logger.info('StitchedLabelService', `Updating ${stitchedLabel.psaLabels.length} existing PSA labels with OCR data`);

        console.log('🔥 [EXTENSIVE DEBUG] UPDATING PSA LABELS:', {
          psaLabelCount: stitchedLabel.psaLabels.length,
          ocrTextLength: batchOcrResult.text.length,
          psaLabelIds: stitchedLabel.psaLabels.map(label => label._id || label),
          timestamp: new Date().toISOString()
        });

        const psaLabelIds = stitchedLabel.psaLabels.map(label => label._id || label);

        await this.updatePsaLabelsWithOcrData(psaLabelIds, batchOcrResult.text, batchOcrResult.textAnnotations, stitchedLabelId);

        console.log('✅ [PSA UPDATE COMPLETE] All PSA labels updated with OCR data');

      } else {
        Logger.warn('StitchedLabelService', 'No existing PSA labels found to update with OCR data');
      }

      // PSA labels already updated with OCR data above
      const finalStatus = 'completed';
      const finalProcessingTime = Date.now() - startTime;

      await StitchedLabel.updateOne(
        { _id: stitchedLabelId },
        {
          status: finalStatus,
          processingTime: finalProcessingTime
        }
      );

      Logger.info('StitchedLabelService', `Stitched label processing completed: ${stitchedLabel.psaLabels.length}/${stitchedLabel.batchSize} labels updated`);

      // Return the updated document
      const updatedStitchedLabel = await StitchedLabel.findById(stitchedLabelId);

      return updatedStitchedLabel;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error processing stitched label with OCR:', error);

      // Update status to failed
      try {
        await StitchedLabel.findByIdAndUpdate(stitchedLabelId, {
          status: 'failed',
          $push: { errors: error.message }
        });
      } catch (updateError) {
        Logger.error('StitchedLabelService', 'Error updating failed status:', updateError);
      }

      throw error;
    }
  }

  /**
   * Create and process stitched label in one operation
   */
  async createAndProcessStitchedLabel(images, options = {}) {
    try {
      Logger.info('StitchedLabelService', `Creating and processing stitched label with ${images.length} images`);

      // Step 1: Create stitched image
      const stitchedLabel = await this.createStitchedLabel(images, options);

      // Step 2: Process with OCR
      const processedStitchedLabel = await this.processStitchedLabelWithOcr(stitchedLabel._id);

      return processedStitchedLabel;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error creating and processing stitched label:', error);
      throw error;
    }
  }

  /**
   * Get stitched label by ID
   */
  async getStitchedLabelById(id) {
    try {
      const stitchedLabel = await StitchedLabel.findById(id).populate('psaLabels');

      return stitchedLabel;
    } catch (error) {
      Logger.error('StitchedLabelService', 'Error getting stitched label by ID:', error);
      throw error;
    }
  }

  /**
   * Get stitched label by batch ID
   */
  async getStitchedLabelByBatchId(batchId) {
    try {
      const stitchedLabel = await StitchedLabel.findByBatchId(batchId);

      return stitchedLabel;
    } catch (error) {
      Logger.error('StitchedLabelService', 'Error getting stitched label by batch ID:', error);
      throw error;
    }
  }

  /**
   * Get stitched labels with filtering
   */
  async getStitchedLabels(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'processedAt',
        sortOrder = 'desc'
      } = options;

      let query = StitchedLabel.find(filters);

      // Apply sorting
      const sortObj = {};

      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      query = query.sort(sortObj);

      // Apply pagination
      const skip = (page - 1) * limit;

      query = query.skip(skip).limit(limit);

      // Populate references
      query = query.populate('psaLabels');

      const labels = await query.exec();
      const totalCount = await StitchedLabel.countDocuments(filters);

      return {
        labels,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      };

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error getting stitched labels:', error);
      throw error;
    }
  }

  /**
   * Update stitched label
   */
  async updateStitchedLabel(id, updates) {
    try {
      const stitchedLabel = await StitchedLabel.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('psaLabels');

      return stitchedLabel;
    } catch (error) {
      Logger.error('StitchedLabelService', 'Error updating stitched label:', error);
      throw error;
    }
  }

  /**
   * Delete stitched label and associated files
   */
  async deleteStitchedLabel(id) {
    try {
      const stitchedLabel = await StitchedLabel.findById(id);

      if (!stitchedLabel) {
        return null;
      }

      // Delete associated PSA labels
      if (stitchedLabel.psaLabels.length > 0) {
        await Promise.all(
          stitchedLabel.psaLabels.map(psaLabelId =>
            psaLabelService.deletePsaLabel(psaLabelId)
          )
        );
      }

      // Delete stitched image file
      if (stitchedLabel.stitchedImage) {
        try {
          await fs.unlink(stitchedLabel.stitchedImage);
        } catch (fileError) {
          Logger.warn('StitchedLabelService', `Could not delete stitched image: ${stitchedLabel.stitchedImage}`);
        }
      }

      // Delete individual label files
      for (const labelInfo of stitchedLabel.individualLabels) {
        if (labelInfo.labelImage && !labelInfo.labelImage.startsWith('temp_')) {
          try {
            await fs.unlink(labelInfo.labelImage);
          } catch (fileError) {
            Logger.warn('StitchedLabelService', `Could not delete label image: ${labelInfo.labelImage}`);
          }
        }
      }

      // Delete the record
      await StitchedLabel.findByIdAndDelete(id);

      Logger.info('StitchedLabelService', `Deleted stitched label: ${id}`);
      return stitchedLabel;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error deleting stitched label:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    try {
      const [stats, costSavings] = await Promise.all([
        StitchedLabel.getProcessingStats(),
        StitchedLabel.getCostSavingsReport()
      ]);

      return {
        processingStats: stats,
        costSavingsReport: costSavings[0] || {}
      };

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error getting processing stats:', error);
      throw error;
    }
  }

  // Helper methods

  calculateGridDimensions(labelCount) {
    // VERTICAL STACKING: 30×1 layout for perfect OCR segmentation
    // Each label gets its own row, eliminating cross-label text bleeding
    return { cols: 1, rows: labelCount };
  }

  async createStitchedImage(images, width, height, backgroundColor, spacing = 0) {
    try {
      // Create base image
      const composite = sharp({
        create: {
          width,
          height,
          channels: 3,
          background: backgroundColor
        }
      });

      // Prepare composite operations for label images
      const compositeOperations = images.map(img => ({
        input: img.buffer,
        top: img.y,
        left: img.x
      }));

      // Apply composite operations (labels only - no visual separators needed)
      const result = await composite
        .composite(compositeOperations)
        .jpeg({ quality: 95 })
        .toBuffer();

      Logger.info('StitchedLabelService', 'Stitched image created with pure coordinate-based approach');
      return result;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error creating stitched image:', error);
      throw error;
    }
  }

  async saveStitchedImage(buffer, batchId) {
    try {
      const filename = `stitched_${batchId}_${Date.now()}.jpg`;
      const filePath = path.join(this.stitchedLabelsDir, filename);

      await fs.writeFile(filePath, buffer);
      Logger.info('StitchedLabelService', `Stitched image saved: ${filePath}`);
      return filePath;
    } catch (error) {
      Logger.error('StitchedLabelService', 'Error saving stitched image:', error);
      throw error;
    }
  }

  async saveIndividualLabel(buffer, batchId, index) {
    try {
      const filename = `label_${batchId}_${index}_${Date.now()}.jpg`;
      const filePath = path.join(this.extractedLabelsDir, filename);

      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      Logger.error('StitchedLabelService', 'Error saving individual label:', error);
      throw error;
    }
  }

  calculateCostSavings(batchSize) {
    // Approximate Google Vision API costs
    const costPerImage = 0.0015; // $1.50 per 1000 images
    const individualCost = batchSize * costPerImage;
    const stitchedCost = costPerImage; // Single API call for stitched image

    const savingsAmount = individualCost - stitchedCost;
    const savingsPercentage = Math.round((savingsAmount / individualCost) * 100);

    return {
      individualApiCalls: individualCost,
      stitchedApiCall: stitchedCost,
      savingsAmount,
      savingsPercentage
    };
  }

  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateBufferHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Export stitched label as JSON with individual extraction filenames
   * @param {string} stitchedLabelId - Stitched label document ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with file path
   */
  async exportStitchedLabelAsJson(stitchedLabelId, options = {}) {
    try {
      const startTime = Date.now();

      Logger.info('StitchedLabelService', `Exporting stitched label ${stitchedLabelId} as JSON`);

      // Get the stitched label with populated PSA labels
      const stitchedLabel = await StitchedLabel.findById(stitchedLabelId).populate('psaLabels');

      if (!stitchedLabel) {
        throw new Error('Stitched label not found');
      }

      // Create enhanced export data with individual extraction filenames
      const exportData = {
        // Basic metadata
        exportInfo: {
          exportedAt: new Date().toISOString(),
          exportVersion: '1.0.0',
          stitchedLabelId: stitchedLabel._id,
          batchId: stitchedLabel.batchId,
          processingTime: Date.now() - startTime
        },

        // Batch summary
        batchSummary: {
          totalImages: stitchedLabel.batchSize,
          gridLayout: `${stitchedLabel.stitchingConfig.gridColumns}×${stitchedLabel.stitchingConfig.gridRows}`,
          finalDimensions: `${stitchedLabel.stitchingConfig.totalWidth}×${stitchedLabel.stitchingConfig.totalHeight}px`,
          stitchedImagePath: stitchedLabel.stitchedImage,
          status: stitchedLabel.status,
          processedAt: stitchedLabel.processedAt
        },

        // Cost analysis
        costAnalysis: stitchedLabel.costSavings,

        // Label extraction statistics
        labelExtractionStats: stitchedLabel.labelExtractionStats,

        // Full batch OCR result
        batchOcrResult: {
          fullText: stitchedLabel.batchOcrResult?.fullText || '',
          confidence: stitchedLabel.batchOcrResult?.confidence || 0,
          textLength: stitchedLabel.batchOcrResult?.fullText?.length || 0,
          processingTimeMs: stitchedLabel.batchOcrResult?.processingTime || 0,
          textAnnotationsCount: stitchedLabel.batchOcrResult?.textAnnotations?.length || 0
        },

        // Individual extractions with filenames and OCR data from actual PSA labels
        individualExtractions: await this.createIndividualExtractionsFromPsaLabels(stitchedLabel),

        // Stitching configuration
        stitchingConfig: stitchedLabel.stitchingConfig,

        // Processing errors (if any)
        errors: stitchedLabel.errors || []
      };

      // Generate export filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = options.filename || `stitched-label-export_${stitchedLabel.batchId}_${timestamp}.json`;
      const exportDir = path.join(this.stitchedLabelsDir, 'exports');

      // Ensure export directory exists
      await fs.mkdir(exportDir, { recursive: true });

      const filePath = path.join(exportDir, filename);

      // Write JSON file with pretty formatting
      const jsonContent = JSON.stringify(exportData, null, 2);

      await fs.writeFile(filePath, jsonContent, 'utf8');

      const exportResult = {
        success: true,
        filePath,
        filename,
        exportSize: jsonContent.length,
        exportSizeKB: Math.round(jsonContent.length / 1024),
        itemsExported: {
          individualExtractions: exportData.individualExtractions.length,
          totalTextCharacters: exportData.batchOcrResult.textLength,
          textAnnotations: exportData.batchOcrResult.textAnnotationsCount
        },
        processingTime: Date.now() - startTime
      };

      Logger.info('StitchedLabelService', `JSON export completed: ${filePath} (${exportResult.exportSizeKB}KB)`);

      return exportResult;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error exporting stitched label as JSON:', error);
      throw error;
    }
  }

  /**
   * SPATIAL COORDINATE-BASED SEGMENTATION using Google Vision bounding boxes
   * Maps actual text element coordinates to label boundaries for 100% accuracy
   * @param {string} fullText - Full OCR text
   * @param {Array} textAnnotations - Google Vision textAnnotations with boundingPoly
   * @param {Object} stitchingConfig - Configuration with label dimensions and spacing
   * @returns {Array} Array of text segments based on actual spatial positioning
   */
  segmentByCoordinates(fullText, textAnnotations, stitchingConfig) {
    try {
      const { labelHeight = 70, spacing = 0, gridRows = 30 } = stitchingConfig;

      Logger.info('StitchedLabelService', `🎯 SPATIAL SEGMENTATION: ${gridRows} labels, ${textAnnotations.length} text elements`);

      // Calculate Y-coordinate boundaries for each label
      const labelBoundaries = [];

      for (let i = 0; i < gridRows; i++) {
        const labelStart = i * labelHeight; // 🚀 NO SPACING - direct coordinate calculation for OCR bounding boxes
        const labelEnd = labelStart + labelHeight;

        labelBoundaries.push({
          labelNumber: i + 1,
          yStart: labelStart,
          yEnd: labelEnd,
          textElements: []
        });
      }

      // 🚨 COMPREHENSIVE DEBUG: Analyze coordinate segmentation
      console.log('🚨 [COMPREHENSIVE DEBUG] COORDINATE SEGMENTATION ANALYSIS:');
      console.log(`📐 Grid Configuration: ${gridRows} labels × ${labelHeight}px height + ${spacing}px spacing = ${labelHeight + spacing}px per label`);
      console.log(`📊 Available textAnnotations: ${textAnnotations.length}`);
      console.log(`🎯 Expected elements per label: ${Math.ceil(textAnnotations.length / gridRows)}`);

      console.log('🏷️ Label Boundaries:');
      labelBoundaries.forEach((boundary, i) => {
        console.log(`  Label ${boundary.labelNumber}: Y=${boundary.yStart}-${boundary.yEnd} (height=${boundary.yEnd - boundary.yStart}px)`);
        if (i >= 3 && i < gridRows - 3) {
          if (i === 3) console.log('  ... (showing first 3 and last 3 boundaries)');
        } else if (i >= gridRows - 3) {
          console.log(`  Label ${boundary.labelNumber}: Y=${boundary.yStart}-${boundary.yEnd} (height=${boundary.yEnd - boundary.yStart}px)`);
        }
      });

      // Group text elements by spatial position using actual coordinates
      console.log('🚨 [COMPREHENSIVE DEBUG] MAPPING textAnnotations TO BOUNDARIES:');
      let mappedCount = 0;
      let unmappedCount = 0;

      textAnnotations.forEach((annotation, index) => {
        if (!annotation.boundingPoly || !annotation.boundingPoly.vertices || annotation.boundingPoly.vertices.length === 0) {
          console.log(`❌ Annotation ${index + 1}: Missing coordinates for "${annotation.description}"`);
          unmappedCount++;
          return; // Skip elements without coordinates
        }

        // Calculate average Y position of the text element
        const { vertices } = annotation.boundingPoly;
        const avgY = vertices.reduce((sum, vertex) => sum + (vertex.y || 0), 0) / vertices.length;
        const avgX = vertices.reduce((sum, vertex) => sum + (vertex.x || 0), 0) / vertices.length;

        // Find which label this text element belongs to based on Y position
        const matchingLabel = labelBoundaries.find(boundary =>
          avgY >= boundary.yStart && avgY <= boundary.yEnd
        );

        if (matchingLabel) {
          matchingLabel.textElements.push({
            text: annotation.description || '',
            x: avgX,
            y: avgY,
            boundingPoly: annotation.boundingPoly,
            confidence: annotation.confidence || 0
          });
          console.log(`✅ Mapped "${annotation.description}" at Y=${avgY} to LABEL${matchingLabel.labelNumber}`);
          mappedCount++;
        } else {
          // Text element doesn't fit in any label boundary - might be separator
          console.log(`❌ UNMAPPED: "${annotation.description}" at Y=${avgY} (no matching boundary)`);
          unmappedCount++;
        }
      });

      console.log(`📊 MAPPING RESULTS: ${mappedCount} mapped, ${unmappedCount} unmapped`);

      // Build segments from spatially grouped text elements
      const segments = [];

      console.log('🚨 [COMPREHENSIVE DEBUG] BUILDING SEGMENTS FROM MAPPED TEXT:');

      labelBoundaries.forEach((boundary) => {
        console.log(`\n🏷️ Processing LABEL${boundary.labelNumber} (Y=${boundary.yStart}-${boundary.yEnd}):`);
        console.log(`   📊 Found ${boundary.textElements.length} text elements`);

        if (boundary.textElements.length === 0) {
          console.log(`   ❌ No text elements found for LABEL${boundary.labelNumber}`);
          return;
        }

        // Sort text elements by reading order (top-to-bottom, left-to-right)
        boundary.textElements.sort((a, b) => {
          // Primary sort: Y position (top to bottom)
          const yDiff = a.y - b.y;

          if (Math.abs(yDiff) > 10) { // If Y difference > 10px, different lines
            return yDiff;
          }
          // Secondary sort: X position (left to right) for same line
          return a.x - b.x;
        });

        console.log('   📝 Text elements in reading order:');
        boundary.textElements.forEach((element, i) => {
          console.log(`      ${i + 1}. "${element.text}" at (${Math.round(element.x)}, ${Math.round(element.y)})`);
        });

        // Reconstruct text in proper reading order
        const reconstructedText = boundary.textElements.map(element => element.text).join(' ');

        console.log(`   🔗 Reconstructed text: "${reconstructedText}"`);

        // Parse the segment
        const segment = this.parseCardSegment([reconstructedText], 0);

        if (segment) {
          segment.labelNumber = boundary.labelNumber;
          segment.method = 'spatial-coordinate';
          segment.spatialData = {
            textElementCount: boundary.textElements.length,
            yBounds: { start: boundary.yStart, end: boundary.yEnd },
            reconstructedText
          };
          // 🔥 CRITICAL FIX: Preserve coordinate data for individual PSA label updates
          segment.textAnnotations = boundary.textElements.map(element => ({
            description: element.text,
            boundingPoly: element.boundingPoly,
            confidence: element.confidence
          }));
          segments.push(segment);

          console.log(`   ✅ Created segment: Year=${segment.year}, Cert=${segment.certificationNumber}, Coordinates=${segment.textAnnotations.length}`);

          Logger.info('StitchedLabelService',
            `🎯 Spatial segment ${boundary.labelNumber}: ${boundary.textElements.length} elements, "${reconstructedText.substring(0, 50)}..."`
          );
        }
      });

      Logger.info('StitchedLabelService', `🎯 SPATIAL SEGMENTATION completed: ${segments.length}/${gridRows} segments created`);

      // Sort segments by label number
      segments.sort((a, b) => (a.labelNumber || 0) - (b.labelNumber || 0));

      return segments;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error in spatial coordinate segmentation:', error);
      return [];
    }
  }

  /**
   * Parse individual card segment using dynamic field detection
   * @param {Array} lines - Lines for this card
   * @param {number} startIndex - Starting line index
   * @returns {Object} Parsed card data
   */
  parseCardSegment(lines, startIndex) {
    if (!lines || lines.length === 0) {
      return null;
    }

    // Join lines with proper newlines
    const rawText = lines.join('\n');

    // SIMPLE LOGIC: Year (1996-2030) -> Dynamic fields -> Cert (6+ digits)

    // Extract YEAR (1996-2030)
    let year = null;
    const yearMatch = rawText.match(/\b(199[6-9]|20[0-2][0-9]|2030)\b/);

    if (yearMatch) {
      year = yearMatch[0];
    }

    // Extract PSA CERTIFICATION NUMBER (6+ digits)
    let certificationNumber = null;
    const certMatches = rawText.match(/\b\d{6,}\b/g);

    if (certMatches && certMatches.length > 0) {
      certificationNumber = certMatches[0]; // Take first 6+ digit number
    }

    // Dynamic text extraction - create fields based on total text inputs
    const textFields = {};
    let fieldCount = 1;

    lines.forEach((line, index) => {
      const cleanLine = line.trim();

      if (cleanLine.length === 0) return;

      // Skip lines that are year or cert only
      const isYear = (/^\s*\b(199[6-9]|20[0-2][0-9]|2030)\b\s*$/).test(cleanLine);
      const isCert = (/^\s*\b\d{6,}\b\s*$/).test(cleanLine);

      if (!isYear && !isCert) {
        textFields[`text${fieldCount}`] = cleanLine;
        fieldCount++;
      }
    });

    return {
      year,
      certificationNumber,
      ...textFields, // Dynamic fields: text1, text2, text3, etc
      rawText,
      lines,
      startIndex,
      endIndex: startIndex + lines.length - 1,
      totalTextFields: fieldCount - 1
    };
  }

  /**
   * Comprehensive hash validation across PSA labels and stitched labels
   * Prevents duplicate processing by checking both collections
   */
  async validateImageHash(imageHash) {
    try {
      Logger.info('StitchedLabelService', `Validating image hash: ${imageHash.substring(0, 8)}...`);

      // Check PSA labels collection
      const existingPsaLabel = await PsaLabel.findOne({ imageHash });

      if (existingPsaLabel) {
        Logger.info('StitchedLabelService', `Hash found in PSA labels: ${existingPsaLabel._id}`);
        return {
          exists: true,
          source: 'psalabels',
          document: existingPsaLabel,
          reason: 'Image already processed as individual PSA label'
        };
      }

      // Check stitched labels collection (images could be part of a previous batch)
      const existingStitchedLabel = await StitchedLabel.findOne({
        imageHashes: { $in: [imageHash] }
      });

      if (existingStitchedLabel) {
        Logger.info('StitchedLabelService', `Hash found in stitched labels: ${existingStitchedLabel._id}`);
        return {
          exists: true,
          source: 'stitchedlabels',
          document: existingStitchedLabel,
          reason: 'Image already processed as part of stitched batch'
        };
      }

      // Hash is new - safe to process
      Logger.info('StitchedLabelService', 'Hash validation passed - image is new');
      return {
        exists: false,
        source: null,
        document: null,
        reason: 'Image hash not found in database'
      };

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error during hash validation:', error);
      // Fail safe - assume exists to prevent potential duplicates
      return {
        exists: true,
        source: 'error',
        document: null,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use validateImageHash instead
   */
  async checkExistingPsaLabel(imageHash) {
    const validation = await this.validateImageHash(imageHash);

    return validation.exists ? validation.document : null;
  }

  /**
   * Save individual image to disk
   */
  async saveIndividualImage(imageBuffer, batchId, index, originalname) {
    try {
      const filename = `${batchId}_full_${index}_${originalname || 'image.jpg'}`;
      const imagePath = path.join(this.fullImagesDir, filename);

      // Save full image to full-images folder
      await fs.writeFile(imagePath, imageBuffer);

      return imagePath;
    } catch (error) {
      Logger.error('StitchedLabelService', 'Error saving individual image:', error);
      throw error;
    }
  }

  /**
   * Update individual PSA labels with OCR text segments using service method
   */
  async updatePsaLabelsWithOcrData(psaLabelIds, fullOcrText, textAnnotations = [], stitchedLabelId) {
    try {
      Logger.info('StitchedLabelService', `Updating ${psaLabelIds.length} PSA labels with OCR data`);

      // Segment the full OCR text with coordinate-based approach
      // Get stitching config from the current stitched label document
      const stitchedLabelDoc = await StitchedLabel.findById(stitchedLabelId);
      const stitchingConfig = stitchedLabelDoc?.stitchingConfig || null;

      // Use coordinate-based segmentation with textAnnotations
      const textSegments = this.segmentByCoordinates(fullOcrText, textAnnotations, stitchingConfig);

      if (textSegments.length !== psaLabelIds.length) {
        Logger.warn('StitchedLabelService', `OCR segments (${textSegments.length}) don't match PSA labels (${psaLabelIds.length})`);
      }

      // Use the PSA Label service for batch updates
      const psaLabelService = (await import('./psaLabelService.js')).default;
      const result = await psaLabelService.updateBatchWithOcrSegments(psaLabelIds, textSegments);

      Logger.info('StitchedLabelService', `Batch update completed: ${result.successful}/${result.totalRequested} successful`);

      return result.results.filter(r => r.success).map(r => r.updatedLabel);

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error updating PSA labels with OCR data:', error);
      throw error;
    }
  }

  /**
   * Create individual extractions from PSA labels for JSON export
   */
  async createIndividualExtractionsFromPsaLabels(stitchedLabel) {
    try {
      if (!stitchedLabel.psaLabels || stitchedLabel.psaLabels.length === 0) {
        Logger.warn('StitchedLabelService', 'No PSA labels found for individual extractions');
        return [];
      }

      // Populate PSA labels if they're not already populated
      const populatedStitchedLabel = await StitchedLabel.findById(stitchedLabel._id).populate('psaLabels');
      const { psaLabels } = populatedStitchedLabel;

      const individualExtractions = [];

      for (let i = 0; i < psaLabels.length; i++) {
        const psaLabel = psaLabels[i];

        const extraction = {
          // Position and grid info
          index: psaLabel.batchIndex || i,
          gridPosition: {
            row: Math.floor(i / (stitchedLabel.stitchingConfig?.gridColumns || 6)),
            col: i % (stitchedLabel.stitchingConfig?.gridColumns || 6)
          },
          positionInStitchedImage: this.calculateLabelPositionInStitch(
            i,
            stitchedLabel.stitchingConfig || {}
          ),

          // Original file information
          originalFilename: psaLabel.originalFileName,
          imageHash: psaLabel.imageHash,
          psaLabelId: psaLabel._id,

          // OCR data from PSA label
          ocrText: psaLabel.ocrText || '',
          ocrConfidence: psaLabel.ocrConfidence || 0,
          textAnnotations: psaLabel.textAnnotations || [],

          // Parsed PSA data
          parsedPsaData: psaLabel.psaData || {},

          // Processing metadata
          processingInfo: {
            hasOcrText: Boolean(psaLabel.ocrText && psaLabel.ocrText.length > 0),
            ocrTextLength: psaLabel.ocrText?.length || 0,
            processingTime: psaLabel.processingTime || 0,
            processedAt: psaLabel.processedAt,
            ocrProvider: psaLabel.ocrProvider || 'google-vision'
          },

          // Quality assessment
          qualityMetrics: {
            hasYear: Boolean(psaLabel.psaData?.year),
            hasCertNumber: Boolean(psaLabel.psaData?.certificationNumber),
            hasTextFields: Boolean(psaLabel.psaData?.totalTextFields > 0),
            totalTextFields: psaLabel.psaData?.totalTextFields || 0,
            completenessScore: this.calculateCompletenessScore(psaLabel.psaData || {})
          }
        };

        individualExtractions.push(extraction);
      }

      Logger.info('StitchedLabelService', `Created ${individualExtractions.length} individual extractions from PSA labels`);
      return individualExtractions;

    } catch (error) {
      Logger.error('StitchedLabelService', 'Error creating individual extractions from PSA labels:', error);
      return [];
    }
  }

  /**
   * Calculate label position in stitched image
   */
  calculateLabelPositionInStitch(index, stitchingConfig) {
    const {
      gridColumns = 1, // VERTICAL STACK: 1 column
      labelWidth = 350, // Optimal width
      labelHeight = 80, // Optimal height
      spacing = 2 // Minimal spacing
    } = stitchingConfig;

    // VERTICAL STACK: each label is in its own row (index = row number)
    const row = index;
    const col = 0;

    return {
      x: spacing, // Always at left margin
      y: spacing + (row * (labelHeight + spacing)), // Stacked vertically
      width: labelWidth,
      height: labelHeight
    };
  }

  /**
   * Calculate completeness score for PSA data
   */
  calculateCompletenessScore(psaData) {
    const requiredFields = ['year', 'certificationNumber'];
    const presentFields = requiredFields.filter(field => psaData[field]);
    const textFieldsScore = psaData.totalTextFields > 0 ? 0.5 : 0;

    return (presentFields.length / requiredFields.length) + textFieldsScore;
  }
}

export default new StitchedLabelService();
