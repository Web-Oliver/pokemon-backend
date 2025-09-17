/**
 * OCR PIPELINE TEST SCRIPT - COMPREHENSIVE API TESTING VERSION
 *
 * Complete end-to-end test of the OCR pipeline with 10 PSA card images using actual API endpoints.
 * This script has been completely fixed and enhanced to properly test the full pipeline:
 *
 * PIPELINE STEPS:
 * 1. Uploads 10 input images via API (/api/icr/upload)
 * 2. Calls extract labels API (/api/icr/extract-labels)
 * 3. Calls stitch labels API (/api/icr/stitch) - stores imageHashes for next steps
 * 4. Calls OCR processing API (/api/icr/ocr) - uses imageHashes
 * 5. Calls text distribution API (/api/icr/distribute) - FIXED endpoint URL
 * 6. Calls card matching API (/api/icr/match) - NEW step added
 * 7. Collects comprehensive scan details - NEW comprehensive data collection
 * 8. Saves ALL data to detailed text file with complete analysis
 *
 * KEY FIXES IMPLEMENTED:
 * - Fixed endpoint URLs: /api/icr/distribute-text -> /api/icr/distribute
 * - Fixed parameter flow: Uses imageHashes throughout pipeline instead of stitchedLabelId
 * - Added card matching step with proper imageHashes parameter
 * - Added comprehensive data collection for all scans, OCR results, and stitched images
 * - Enhanced report generation with complete scan details, OCR annotations, and confidence scores
 * - Added better error handling with continuation for partial failures
 * - Improved error messages with context and step information
 *
 * OUTPUT:
 * - Comprehensive text report with all pipeline details
 * - JSON file with complete API response data
 * - Detailed scan information including OCR text, card matches, and processing status
 * - Complete stitched image details with dimensions and label positions
 * - Summary statistics and success/failure analysis
 */

import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComprehensiveOcrTest {
  constructor() {
    this.testId = `ocr-test-${Date.now()}`;
    this.outputDir = path.join(__dirname, 'test-results', this.testId);
    this.resultsFile = path.join(this.outputDir, 'ocr-test-results.txt');
    this.baseUrl = 'http://localhost:3000'; // Backend API URL

    this.testResults = {
      testId: this.testId,
      timestamp: new Date().toISOString(),
      inputImages: [],
      uploadResults: [],
      extractResults: [],
      stitchResults: null,
      ocrResults: null,
      distributionResults: null,
      cardMatchingResults: null,
      scanDetails: [],
      stitchedImageDetails: null,
      imageHashes: [],
      summary: {}
    };
  }

  async initialize() {
    console.log(`🚀 Starting OCR API Test: ${this.testId}`);
    console.log(`📁 Results will be saved to: ${this.outputDir}`);

    // Create output directory
    await fs.promises.mkdir(this.outputDir, { recursive: true });

    // Check if backend is running
    try {
      const response = await fetch(`${this.baseUrl}/api/status`);
      if (!response.ok) {
        throw new Error(`Backend not responding: ${response.status}`);
      }
      console.log('✅ Backend is running and accessible');
    } catch (error) {
      throw new Error(`❌ Backend not accessible at ${this.baseUrl}: ${error.message}`);
    }
  }

  async runCompleteTest() {
    try {
      // Initialize
      await this.initialize();

      console.log(`\n🔍 Step 1: Finding 10 test images`);
      await this.findTestImages();

      console.log(`\n📤 Step 2: Uploading images via ICR API`);
      await this.uploadImages();

      console.log(`\n🏷️  Step 3: Extracting PSA labels via API`);
      await this.extractLabels();

      console.log(`\n🧩 Step 4: Stitching labels via API`);
      await this.stitchLabels();

      console.log(`\n👁️  Step 5: Running OCR processing via API`);
      await this.processOcr().catch(error => {
        console.error(`⚠️ OCR processing failed: ${error.message}`);
        this.testResults.ocrResults = { error: error.message };
      });

      console.log(`\n📝 Step 6: Distributing text to labels via API`);
      await this.distributeText().catch(error => {
        console.error(`⚠️ Text distribution failed: ${error.message}`);
        this.testResults.distributionResults = { error: error.message };
      });

      console.log(`\n🎯 Step 7: Matching cards via API`);
      await this.matchCards().catch(error => {
        console.error(`⚠️ Card matching failed: ${error.message}`);
        this.testResults.cardMatchingResults = { error: error.message };
      });

      console.log(`\n📊 Step 8: Verifying scan OCR text distribution`);
      await this.verifyScanOcrText().catch(error => {
        console.error(`⚠️ Scan verification failed: ${error.message}`);
      });

      console.log(`\n📋 Step 9: Collecting comprehensive scan details`);
      await this.collectDetailedResults().catch(error => {
        console.error(`⚠️ Data collection failed: ${error.message}`);
        // Don't store error here as collectDetailedResults already handles errors gracefully
      });

      console.log(`\n💾 Step 10: Saving comprehensive results`);
      await this.saveResults();

      // Print final summary
      this.printFinalSummary();

      console.log(`\n🎉 TEST COMPLETE! Results saved to: ${this.resultsFile}\n`);

    } catch (error) {
      console.error('❌ OCR Pipeline Test Failed:', error.message);
      if (error.step) {
        console.error(`   Failed at step: ${error.step}`);
      }
      if (error.imageHashes) {
        console.error(`   Image hashes involved: ${error.imageHashes.length}`);
      }
      await this.saveErrorResults(error);

      // Still try to save partial results if we have some
      try {
        if (this.testResults.uploadResults?.length > 0) {
          console.log('⚠️ Saving partial results...');
          await this.saveResults();
        }
      } catch (saveError) {
        console.error('Could not save partial results:', saveError.message);
      }

      throw error;
    }
  }

  async findTestImages() {
    const testImageDirs = [
      path.join(__dirname, 'test-ocr'),
      path.join(__dirname, 'uploads/icr'),
      path.join(__dirname, 'test-images'),
      path.join(__dirname, 'sample-images'),
      path.join(__dirname, 'uploads')
    ];

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const foundImages = [];

    for (const dir of testImageDirs) {
      try {
        if (!fs.existsSync(dir)) continue;

        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          if (imageExtensions.some(ext => file.toLowerCase().endsWith(ext))) {
            const fullPath = path.join(dir, file);
            const stats = await fs.promises.stat(fullPath);

            foundImages.push({
              path: fullPath,
              filename: file,
              size: stats.size,
              directory: dir
            });

            if (foundImages.length >= 10) break;
          }
        }
        if (foundImages.length >= 10) break;
      } catch (error) {
        console.warn(`Could not read directory: ${dir}`, error.message);
      }
    }

    if (foundImages.length === 0) {
      throw new Error('No test images found in any of the test directories');
    }

    this.testResults.inputImages = foundImages.slice(0, 10);
    console.log(`📷 Found ${this.testResults.inputImages.length} test images`);

    // Copy images to test directory for consistency
    for (let i = 0; i < this.testResults.inputImages.length; i++) {
      const image = this.testResults.inputImages[i];
      const testImagePath = path.join(this.outputDir, `test-image-${i + 1}${path.extname(image.filename)}`);
      await fs.promises.copyFile(image.path, testImagePath);
      image.testPath = testImagePath;
    }
  }

  async uploadImages() {
    this.testResults.uploadResults = [];

    for (let i = 0; i < this.testResults.inputImages.length; i++) {
      const image = this.testResults.inputImages[i];
      console.log(`📤 Uploading image ${i + 1}/10: ${image.filename}`);

      try {
        const formData = new FormData();
        formData.append('images', fs.createReadStream(image.path), image.filename);

        const response = await fetch(`${this.baseUrl}/api/icr/upload`, {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        // Debug: Log the actual response structure (reduced for clarity)
        console.log(`DEBUG: Upload response structure:`, {
          success: result.success,
          message: result.message,
          dataKeys: Object.keys(result.data || {}),
          hasResults: !!result.data?.results,
          resultCount: result.data?.results?.length || 0
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${result.error || response.statusText}`);
        }

        this.testResults.uploadResults.push({
          imageIndex: i + 1,
          filename: image.filename,
          success: true,
          ids: result.data?.ids || [],
          result: result
        });

        console.log(`✅ Upload ${i + 1} successful - ScanIds: ${result.data?.ids?.join(', ') || 'None'}`);

      } catch (error) {
        console.error(`❌ Upload ${i + 1} failed: ${error.message}`);
        this.testResults.uploadResults.push({
          imageIndex: i + 1,
          filename: image.filename,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = this.testResults.uploadResults.filter(r => r.success).length;
    console.log(`📊 Upload results: ${successCount}/${this.testResults.inputImages.length} successful`);

    if (successCount === 0) {
      throw new Error('No images were uploaded successfully');
    }
  }


  async extractLabels() {
    try {
      // Get all scan IDs from successful uploads
      const allScanIds = [];
      this.testResults.uploadResults.filter(r => r.success).forEach(upload => {
        allScanIds.push(...upload.ids);
      });

      console.log(`🏷️  Extracting PSA labels from ${allScanIds.length} uploaded scans`);

      const response = await fetch(`${this.baseUrl}/api/icr/extract-labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: allScanIds })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Label extraction failed: ${result.error || response.statusText}`);
      }

      this.testResults.extractResults = result;
      console.log(`✅ Label extraction completed: ${result.results?.filter(r => r.success).length || 0}/${allScanIds.length} successful`);

    } catch (error) {
      console.error(`❌ Label extraction API call failed: ${error.message}`);
      throw error;
    }
  }

  async stitchLabels() {
    try {
      console.log('\n🧩 Step 4: Stitching labels via API');

      // Get scans with "extracted" status and their imageHashes
      const scansResponse = await fetch(`${this.baseUrl}/api/icr/scans?status=extracted&limit=50`);
      if (!scansResponse.ok) {
        throw new Error('Failed to fetch extracted scans');
      }

      const scansData = await scansResponse.json();
      const extractedScans = scansData.data?.scans || [];

      if (extractedScans.length === 0) {
        throw new Error('No extracted labels found to stitch');
      }

      const imageHashes = extractedScans.map(scan => scan.imageHash);
      this.testResults.imageHashes = imageHashes; // Store for subsequent steps
      console.log(`🧩 Stitching ${imageHashes.length} extracted labels`);

      const response = await fetch(`${this.baseUrl}/api/icr/stitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageHashes })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Stitching failed: ${result.error || response.statusText}`);
      }

      this.testResults.stitchResults = result.data;
      console.log('✅ Stitching completed successfully');
      console.log(`📐 Stitched image: ${result.data.width}x${result.data.height}, ${result.data.labelCount} labels`);

    } catch (error) {
      console.error(`❌ Stitching API call failed: ${error.message}`);
      throw error;
    }
  }

  async processOcr() {
    try {
      if (!this.testResults.imageHashes || this.testResults.imageHashes.length === 0) {
        throw new Error('No image hashes available for OCR processing');
      }

      const imageHashes = this.testResults.imageHashes;
      console.log(`👁️  Processing OCR for ${imageHashes.length} images`);

      const response = await fetch(`${this.baseUrl}/api/icr/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageHashes })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error?.message || result.error || JSON.stringify(result) || response.statusText;
        throw new Error(`OCR processing failed: ${errorMsg}`);
      }

      this.testResults.ocrResults = result;
      console.log(`✅ OCR processing completed`);
      if (result.data) {
        console.log(`   - Total annotations: ${result.data.totalAnnotations || 0}`);
        console.log(`   - Processing time: ${result.data.processingTimeMs || 0}ms`);
      }

    } catch (error) {
      console.error(`❌ OCR processing API call failed: ${error.message}`);
      // Add more context to the error
      const hashCount = this.testResults.imageHashes?.length || 0;
      const enhancedError = new Error(`OCR processing failed for ${hashCount} images: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.step = 'OCR Processing';
      enhancedError.imageHashes = this.testResults.imageHashes || [];
      throw enhancedError;
    }
  }

  async distributeText() {
    try {
      if (!this.testResults.imageHashes || this.testResults.imageHashes.length === 0) {
        throw new Error('No image hashes available for text distribution');
      }

      const imageHashes = this.testResults.imageHashes;
      console.log(`📝 Distributing OCR text to ${imageHashes.length} individual labels`);

      const response = await fetch(`${this.baseUrl}/api/icr/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageHashes })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Text distribution failed: ${result.error || response.statusText}`);
      }

      this.testResults.distributionResults = result;
      const successCount = result.data?.successCount || 0;
      const totalRequested = result.data?.totalRequested || imageHashes.length;
      console.log(`✅ Text distribution completed - ${successCount}/${totalRequested} scans updated with OCR text`);

    } catch (error) {
      console.error(`❌ Text distribution API call failed: ${error.message}`);
      // Add more context to the error
      const hashCount = this.testResults.imageHashes?.length || 0;
      const enhancedError = new Error(`Text distribution failed for ${hashCount} images: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.step = 'Text Distribution';
      enhancedError.imageHashes = this.testResults.imageHashes || [];
      throw enhancedError;
    }
  }

  async saveResults() {
    console.log('💾 Saving comprehensive test results...');

    // Calculate summary statistics
    this.testResults.summary = {
      totalInputImages: this.testResults.inputImages.length,
      successfulUploads: this.testResults.uploadResults?.filter(r => r.success).length || 0,
      extractionCompleted: !!this.testResults.extractResults,
      stitchingCompleted: !!this.testResults.stitchResults,
      ocrCompleted: !!this.testResults.ocrResults,
      distributionCompleted: !!this.testResults.distributionResults,
      distributionVerified: this.testResults.scanVerification?.distributionSuccessful || false,
      cardMatchingCompleted: !!this.testResults.cardMatchingResults,
      totalImageHashes: this.testResults.imageHashes?.length || 0,
      totalScanDetails: this.testResults.scanDetails?.length || 0,
      scansWithOcrText: this.testResults.scanVerification?.scansWithText || this.testResults.scanDetails?.filter(s => s.ocrText).length || 0,
      scansWithCardMatches: this.testResults.scanDetails?.filter(s => s.cardMatches?.length > 0).length || 0,
      distributionSuccessRate: this.testResults.scanVerification?.successRate || 0,
      overallSuccess: this.isTestSuccessful()
    };

    // Create comprehensive report
    let report = this.generateTextReport();

    // Save to file
    await fs.promises.writeFile(this.resultsFile, report, 'utf-8');

    // Also save JSON version for programmatic access
    const jsonFile = path.join(this.outputDir, 'ocr-test-results.json');
    await fs.promises.writeFile(jsonFile, JSON.stringify(this.testResults, null, 2), 'utf-8');

    console.log(`✅ Results saved to: ${this.resultsFile}`);
  }

  generateTextReport() {
    let report = '';

    report += '='.repeat(80) + '\n';
    report += '                OCR PIPELINE API TEST RESULTS\n';
    report += '='.repeat(80) + '\n';
    report += `Test ID: ${this.testResults.testId}\n`;
    report += `Timestamp: ${this.testResults.timestamp}\n`;
    report += `Backend URL: ${this.baseUrl}\n`;
    report += `Overall Success: ${this.testResults.summary.overallSuccess ? '✅ PASS' : '❌ FAIL'}\n`;
    report += '\n';

    // SUMMARY SECTION
    report += '📊 SUMMARY STATISTICS\n';
    report += '-'.repeat(50) + '\n';
    report += `Total Input Images: ${this.testResults.inputImages.length}\n`;
    report += `Successful Uploads: ${this.testResults.uploadResults?.filter(r => r.success).length || 0}/${this.testResults.inputImages.length}\n`;
    report += `Label Extraction: ${this.testResults.extractResults ? 'COMPLETED' : 'NOT COMPLETED'}\n`;
    report += `Stitching: ${this.testResults.stitchResults ? 'COMPLETED' : 'NOT COMPLETED'}\n`;
    report += `OCR Processing: ${this.testResults.ocrResults ? 'COMPLETED' : 'NOT COMPLETED'}\n`;
    report += `Text Distribution: ${this.testResults.distributionResults ? 'COMPLETED' : 'NOT COMPLETED'}\n`;
    report += `Distribution Verified: ${this.testResults.scanVerification?.distributionSuccessful ? 'YES' : 'NO'}\n`;
    report += `Card Matching: ${this.testResults.cardMatchingResults ? 'COMPLETED' : 'NOT COMPLETED'}\n`;
    report += `Image Hashes Processed: ${this.testResults.imageHashes?.length || 0}\n`;
    report += `Scan Details Collected: ${this.testResults.scanDetails?.length || 0}\n`;
    report += `Scans with OCR Text: ${this.testResults.scanVerification?.scansWithText || this.testResults.scanDetails?.filter(s => s.ocrText).length || 0}\n`;
    report += `Distribution Success Rate: ${(this.testResults.scanVerification?.successRate * 100 || 0).toFixed(1)}%\n`;
    report += `Scans with Card Matches: ${this.testResults.scanDetails?.filter(s => s.cardMatches?.length > 0).length || 0}\n`;
    report += '\n';

    // INPUT IMAGES SECTION
    report += '📷 INPUT IMAGES\n';
    report += '-'.repeat(50) + '\n';
    this.testResults.inputImages.forEach((img, i) => {
      report += `${i + 1}. ${img.filename} (${(img.size / 1024).toFixed(1)} KB)\n`;
      report += `   Path: ${img.path}\n`;
    });
    report += '\n';

    // UPLOAD RESULTS
    report += '📤 UPLOAD RESULTS\n';
    report += '-'.repeat(50) + '\n';
    this.testResults.uploadResults?.forEach((result, i) => {
      report += `${i + 1}. ${result.filename}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\n`;
      if (result.success) {
        report += `   Scan IDs: ${result.ids?.join(', ')}\n`;
      } else {
        report += `   Error: ${result.error}\n`;
      }
    });
    report += '\n';

    // EXTRACTION RESULTS
    if (this.testResults.extractResults) {
      report += '🏷️  LABEL EXTRACTION RESULTS\n';
      report += '-'.repeat(50) + '\n';
      report += `Status: ✅ API CALL SUCCESSFUL\n`;
      report += `Details: ${JSON.stringify(this.testResults.extractResults, null, 2)}\n`;
      report += '\n';
    }

    // STITCHING RESULTS
    if (this.testResults.stitchResults) {
      report += '🧩 STITCHING RESULTS\n';
      report += '-'.repeat(50) + '\n';
      report += `Status: ✅ API CALL SUCCESSFUL\n`;
      report += `Stitched Label ID: ${this.testResults.stitchResults.stitchedLabelId}\n`;
      report += `Details: ${JSON.stringify(this.testResults.stitchResults, null, 2)}\n`;
      report += '\n';
    }

    // OCR RESULTS
    if (this.testResults.ocrResults) {
      report += '👁️  OCR PROCESSING RESULTS\n';
      report += '-'.repeat(50) + '\n';
      report += `Status: ✅ API CALL SUCCESSFUL\n`;
      report += `Total Annotations: ${this.testResults.ocrResults.totalAnnotations || 0}\n`;
      report += `Details: ${JSON.stringify(this.testResults.ocrResults, null, 2)}\n`;
      report += '\n';
    }

    // DISTRIBUTION RESULTS
    if (this.testResults.distributionResults) {
      report += '📝 TEXT DISTRIBUTION RESULTS\n';
      report += '-'.repeat(50) + '\n';
      report += `Status: ✅ API CALL SUCCESSFUL\n`;
      if (this.testResults.distributionResults.data) {
        report += `Success Count: ${this.testResults.distributionResults.data.successCount || 0}\n`;
        report += `Total Requested: ${this.testResults.distributionResults.data.totalRequested || 0}\n`;
        report += `Failure Count: ${this.testResults.distributionResults.data.failureCount || 0}\n`;
      }
      report += `Details: ${JSON.stringify(this.testResults.distributionResults, null, 2)}\n`;
      report += '\n';
    }

    // SCAN VERIFICATION RESULTS
    if (this.testResults.scanVerification) {
      report += '🔍 SCAN OCR TEXT VERIFICATION\n';
      report += '-'.repeat(50) + '\n';
      if (this.testResults.scanVerification.error) {
        report += `Status: ❌ VERIFICATION FAILED\n`;
        report += `Error: ${this.testResults.scanVerification.error}\n`;
      } else {
        report += `Status: ✅ VERIFICATION COMPLETED\n`;
        report += `Total Scans: ${this.testResults.scanVerification.totalScans}\n`;
        report += `Scans with OCR Text: ${this.testResults.scanVerification.scansWithText}\n`;
        report += `Success Rate: ${(this.testResults.scanVerification.successRate * 100).toFixed(1)}%\n`;
        report += `Distribution Successful: ${this.testResults.scanVerification.distributionSuccessful ? '✅ YES' : '❌ NO'}\n`;
      }
      report += '\n';
    }

    // CARD MATCHING RESULTS
    if (this.testResults.cardMatchingResults) {
      report += '🎯 CARD MATCHING RESULTS\n';
      report += '-'.repeat(50) + '\n';
      report += `Status: ✅ API CALL SUCCESSFUL\n`;
      if (this.testResults.cardMatchingResults.data) {
        report += `Successful Matches: ${this.testResults.cardMatchingResults.data.successfulMatches || 0}\n`;
        report += `Total Processed: ${this.testResults.cardMatchingResults.data.totalProcessed || 0}\n`;
        report += `Failed Matches: ${this.testResults.cardMatchingResults.data.failedMatches || 0}\n`;
      }
      report += `Details: ${JSON.stringify(this.testResults.cardMatchingResults, null, 2)}\n`;
      report += '\n';
    }

    // COMPREHENSIVE SCAN DETAILS
    if (this.testResults.scanDetails && this.testResults.scanDetails.length > 0) {
      report += '📊 DETAILED SCAN INFORMATION\n';
      report += '-'.repeat(50) + '\n';
      this.testResults.scanDetails.forEach((scan, i) => {
        report += `\n${i + 1}. SCAN DETAILS (${scan.originalFileName})\n`;
        report += `   Image Hash: ${scan.imageHash}\n`;
        report += `   Scan ID: ${scan.scanId}\n`;
        report += `   Processing Status: ${scan.processingStatus}\n`;
        report += `   Label Image Path: ${scan.labelImagePath || 'N/A'}\n`;
        report += `   Full Image Path: ${scan.fullImagePath || 'N/A'}\n`;
        report += `   Date Uploaded: ${scan.dateUploaded || 'N/A'}\n`;
        report += `   Date Processed: ${scan.dateProcessed || 'N/A'}\n`;

        if (scan.ocrText) {
          report += `   OCR Text (${scan.ocrText.length} chars): ${scan.ocrText.substring(0, 200)}${scan.ocrText.length > 200 ? '...' : ''}\n`;
          report += `   OCR Confidence: ${scan.confidence || 'N/A'}\n`;
        } else {
          report += `   OCR Text: No OCR text available\n`;
        }

        if (scan.cardMatches && scan.cardMatches.length > 0) {
          report += `   Card Matches Found: ${scan.cardMatches.length}\n`;
          scan.cardMatches.slice(0, 3).forEach((match, mi) => {
            report += `     ${mi + 1}. ${match.name || match.cardName} (Score: ${match.confidence || match.score || 'N/A'})\n`;
          });
          if (scan.selectedCardMatch) {
            report += `   Selected Match: ${scan.selectedCardMatch.name || scan.selectedCardMatch.cardName}\n`;
          }
        } else {
          report += `   Card Matches Found: 0\n`;
        }
      });
      report += '\n';
    }

    // STITCHED IMAGE DETAILS
    if (this.testResults.stitchedImageDetails) {
      report += '🖼️ STITCHED IMAGE DETAILS\n';
      report += '-'.repeat(50) + '\n';
      const stitched = this.testResults.stitchedImageDetails;
      report += `Stitched Image ID: ${stitched._id || stitched.id || 'N/A'}\n`;
      report += `Filename: ${stitched.filename || 'N/A'}\n`;
      report += `Dimensions: ${stitched.width || 'N/A'} x ${stitched.height || 'N/A'}\n`;
      report += `Label Count: ${stitched.labelCount || 'N/A'}\n`;
      report += `File Path: ${stitched.filePath || 'N/A'}\n`;
      report += `Date Created: ${stitched.dateCreated || 'N/A'}\n`;
      if (stitched.imageHashes) {
        report += `Image Hashes: ${stitched.imageHashes.join(', ')}\n`;
      }
      if (stitched.labelPositions) {
        report += `Label Positions: ${stitched.labelPositions.length} positions recorded\n`;
      }
      report += '\n';
    }

    // IMAGE HASHES PROCESSED
    if (this.testResults.imageHashes && this.testResults.imageHashes.length > 0) {
      report += '🔗 IMAGE HASHES PROCESSED\n';
      report += '-'.repeat(50) + '\n';
      this.testResults.imageHashes.forEach((hash, i) => {
        report += `${i + 1}. ${hash}\n`;
      });
      report += '\n';
    }

    // FILES SECTION
    report += '📁 FILES CREATED\n';
    report += '-'.repeat(50) + '\n';
    report += `Test Directory: ${this.outputDir}\n`;
    report += `Results File: ${this.resultsFile}\n`;
    report += `JSON Data: ${path.join(this.outputDir, 'ocr-test-results.json')}\n`;
    report += '\n';

    report += '='.repeat(80) + '\n';
    report += 'END OF OCR PIPELINE API TEST RESULTS\n';
    report += '='.repeat(80) + '\n';

    return report;
  }

  printFinalSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('='.repeat(60));

    const summary = this.testResults.summary;
    const success = this.isTestSuccessful();

    console.log(`Overall Result: ${success ? '✅ SUCCESS' : '❌ PARTIAL/FAILED'}`);
    console.log(`Input Images: ${summary.totalInputImages}`);
    console.log(`Successful Uploads: ${summary.successfulUploads}/${summary.totalInputImages}`);
    console.log(`Label Extraction: ${summary.extractionCompleted ? '✅' : '❌'}`);
    console.log(`Stitching: ${summary.stitchingCompleted ? '✅' : '❌'}`);
    console.log(`OCR Processing: ${summary.ocrCompleted ? '✅' : '❌'}`);
    console.log(`Text Distribution: ${summary.distributionCompleted ? '✅' : '❌'}`);
    console.log(`Distribution Verified: ${summary.distributionVerified ? '✅' : '❌'}`);
    console.log(`Card Matching: ${summary.cardMatchingCompleted ? '✅' : '❌'}`);
    console.log(`Image Hashes: ${summary.totalImageHashes}`);
    console.log(`Scan Details: ${summary.totalScanDetails}`);
    console.log(`Scans with OCR: ${summary.scansWithOcrText}`);
    console.log(`Distribution Success Rate: ${(summary.distributionSuccessRate * 100).toFixed(1)}%`);
    console.log(`Scans with Matches: ${summary.scansWithCardMatches}`);

    if (!success) {
      console.log('\n⚠️  Some steps may have failed, but partial results were saved.');
    }

    console.log('='.repeat(60));
  }

  isTestSuccessful() {
    return (
      this.testResults.uploadResults?.some(r => r.success) &&
      this.testResults.extractResults &&
      this.testResults.stitchResults &&
      this.testResults.ocrResults &&
      !this.testResults.ocrResults?.error &&
      this.testResults.distributionResults &&
      !this.testResults.distributionResults?.error &&
      this.testResults.scanVerification &&
      this.testResults.scanVerification.distributionSuccessful &&
      this.testResults.cardMatchingResults &&
      !this.testResults.cardMatchingResults?.error &&
      this.testResults.imageHashes?.length > 0
    );
  }

  async matchCards() {
    try {
      if (!this.testResults.imageHashes || this.testResults.imageHashes.length === 0) {
        throw new Error('No image hashes available for card matching');
      }

      const imageHashes = this.testResults.imageHashes;
      console.log(`🎯 Matching ${imageHashes.length} cards with Pokemon database`);

      const response = await fetch(`${this.baseUrl}/api/icr/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageHashes })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Card matching failed: ${result.error || response.statusText}`);
      }

      this.testResults.cardMatchingResults = result;
      const successfulMatches = result.data?.successfulMatches || 0;
      const totalProcessed = result.data?.totalProcessed || imageHashes.length;
      console.log(`✅ Card matching completed - ${successfulMatches}/${totalProcessed} successful matches`);

    } catch (error) {
      console.error(`❌ Card matching API call failed: ${error.message}`);
      // Add more context to the error
      const hashCount = this.testResults.imageHashes?.length || 0;
      const enhancedError = new Error(`Card matching failed for ${hashCount} images: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.step = 'Card Matching';
      enhancedError.imageHashes = this.testResults.imageHashes || [];
      throw enhancedError;
    }
  }

  async verifyScanOcrText() {
    try {
      console.log('🔍 Verifying OCR text distribution in database...');

      // Get all scans directly from database
      const scansResponse = await fetch(`${this.baseUrl}/api/icr/scans?limit=50`);
      if (!scansResponse.ok) {
        throw new Error('Failed to fetch scans for verification');
      }

      const scansData = await scansResponse.json();
      const allScans = scansData.data?.scans || [];

      console.log(`\n📋 DATABASE SCAN VERIFICATION (${allScans.length} scans):`);
      let scansWithText = 0;

      allScans.forEach((scan, i) => {
        const hasText = scan.ocrText && scan.ocrText.length > 0;
        if (hasText) scansWithText++;
        const preview = hasText ? scan.ocrText.substring(0, 80) : 'NO TEXT';
        const status = hasText ? '✅' : '❌';
        const hash = scan.imageHash ? scan.imageHash.substring(0, 10) + '...' : 'NO_HASH';
        console.log(`  ${status} Scan ${i}: ${hash} - ${preview}`);
      });

      console.log(`\n📊 OCR TEXT DISTRIBUTION SUMMARY:`);
      console.log(`  - ${scansWithText}/${allScans.length} scans have OCR text`);
      console.log(`  - Success Rate: ${((scansWithText / allScans.length) * 100).toFixed(1)}%`);

      // Store verification results
      this.testResults.scanVerification = {
        totalScans: allScans.length,
        scansWithText: scansWithText,
        successRate: scansWithText / allScans.length,
        distributionSuccessful: scansWithText === allScans.length
      };

      if (scansWithText === allScans.length) {
        console.log('🎉 SUCCESS: All scans have OCR text!');
      } else {
        console.log(`⚠️ PARTIAL SUCCESS: ${allScans.length - scansWithText} scans missing OCR text`);
      }

    } catch (error) {
      console.error('❌ Scan verification failed:', error.message);
      this.testResults.scanVerification = {
        error: error.message,
        totalScans: 0,
        scansWithText: 0,
        successRate: 0,
        distributionSuccessful: false
      };
    }
  }

  async collectDetailedResults() {
    try {
      console.log('📊 Collecting comprehensive scan details...');

      // Get detailed scan information
      if (this.testResults.imageHashes && this.testResults.imageHashes.length > 0) {
        for (const imageHash of this.testResults.imageHashes) {
          try {
            // Get scan by status to find the one with this imageHash
            const scansResponse = await fetch(`${this.baseUrl}/api/icr/scans?limit=100`);
            if (scansResponse.ok) {
              const scansData = await scansResponse.json();
              const allScans = scansData.data?.scans || [];
              const matchingScan = allScans.find(scan => scan.imageHash === imageHash);

              if (matchingScan) {
                this.testResults.scanDetails.push({
                  imageHash,
                  scanId: matchingScan._id,
                  originalFileName: matchingScan.originalFileName,
                  processingStatus: matchingScan.processingStatus,
                  labelImagePath: matchingScan.labelImagePath,
                  fullImagePath: matchingScan.fullImagePath,
                  ocrText: matchingScan.ocrText,
                  confidence: matchingScan.confidence,
                  cardMatches: matchingScan.cardMatches,
                  selectedCardMatch: matchingScan.selectedCardMatch,
                  dateUploaded: matchingScan.dateUploaded,
                  dateProcessed: matchingScan.dateProcessed
                });
              }
            }
          } catch (detailError) {
            console.warn(`Could not fetch details for imageHash ${imageHash}:`, detailError.message);
          }
        }
      }

      // Get stitched image details
      try {
        const stitchedResponse = await fetch(`${this.baseUrl}/api/icr/stitched?limit=10`);
        if (stitchedResponse.ok) {
          const stitchedData = await stitchedResponse.json();
          const stitchedImages = stitchedData.data?.stitchedImages || [];

          // Find the most recent stitched image that matches our test
          if (stitchedImages.length > 0) {
            this.testResults.stitchedImageDetails = stitchedImages[0]; // Most recent
          }
        }
      } catch (stitchedError) {
        console.warn('Could not fetch stitched image details:', stitchedError.message);
      }

      console.log(`✅ Collected details for ${this.testResults.scanDetails.length} scans`);

    } catch (error) {
      console.error(`❌ Failed to collect detailed results: ${error.message}`);
      // Don't throw here - we still want to save what we have
    }
  }

  async saveErrorResults(error) {
    try {
      const errorReport = `
OCR PIPELINE TEST FAILED
========================
Test ID: ${this.testId}
Timestamp: ${new Date().toISOString()}

ERROR:
${error.message}

STACK TRACE:
${error.stack}

TEST PROGRESS:
- Input Images: ${this.testResults.inputImages.length}
- Successful Uploads: ${this.testResults.uploadResults?.filter(r => r.success).length || 0}
- Label Extraction: ${this.testResults.extractResults ? 'Completed' : 'Not completed'}
- Stitching: ${this.testResults.stitchResults ? 'Completed' : 'Not completed'}
- OCR Processing: ${this.testResults.ocrResults ? 'Completed' : 'Not completed'}
- Text Distribution: ${this.testResults.distributionResults ? 'Completed' : 'Not completed'}
- Card Matching: ${this.testResults.cardMatchingResults ? 'Completed' : 'Not completed'}
- Image Hashes: ${this.testResults.imageHashes?.length || 0}
`;

      await fs.promises.writeFile(this.resultsFile, errorReport, 'utf-8');

    } catch (saveError) {
      console.error('Failed to save error results', saveError);
    }
  }
}

// RUN THE TEST
async function runTest() {
  try {
    const test = new ComprehensiveOcrTest();
    await test.runCompleteTest();
    process.exit(0);
  } catch (error) {
    console.error('❌ OCR Pipeline Test Failed:', error.message);
    process.exit(1);
  }
}

// Only run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTest();
}

export default ComprehensiveOcrTest;