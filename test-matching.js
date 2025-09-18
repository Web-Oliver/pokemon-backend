#!/usr/bin/env node

/**
 * Comprehensive Card Matching Verification Script
 *
 * This script analyzes the card matching results from the database and API
 * to verify matching accuracy and debug any issues.
 *
 * Does NOT make any Vision API calls - only analyzes existing data.
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

class MatchingVerificationTool {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.testId = `matching-verification-${Date.now()}`;
    this.resultsDir = path.join(process.cwd(), 'test-results', this.testId);
  }

  async init() {
    await fs.mkdir(this.resultsDir, { recursive: true });
    console.log(`🔍 Starting Card Matching Verification: ${this.testId}`);
    console.log(`📁 Results will be saved to: ${this.resultsDir}`);
  }

  /**
   * Get all scans with OCR text from database
   */
  async getAllScansWithOcrText() {
    console.log('\n📋 Step 1: Fetching all scans with OCR text from database...');

    try {
      const response = await fetch(`${this.baseUrl}/api/icr/scans?limit=50`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(`API Error: ${data.message}`);
      }

      const scansWithOcr = data.data.scans.filter(scan => scan.ocrText && scan.ocrText.trim());

      console.log(`✅ Found ${scansWithOcr.length} scans with OCR text`);

      return scansWithOcr;
    } catch (error) {
      console.error('❌ Failed to fetch scans:', error.message);
      throw error;
    }
  }

  /**
   * Analyze OCR text extraction for each scan
   */
  analyzeOcrExtraction(scans) {
    console.log('\n🔍 Step 2: Analyzing OCR text extraction patterns...');

    const analysis = {
      totalScans: scans.length,
      withYear: 0,
      withCardNumber: 0,
      withPokemonName: 0,
      withCertNumber: 0,
      withGrade: 0,
      extractionPatterns: []
    };

    scans.forEach((scan, index) => {
      const ocrText = scan.ocrText.toUpperCase();

      // Extract year pattern
      const yearMatch = ocrText.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
      if (year) analysis.withYear++;

      // Extract card number patterns
      const cardNumberMatches = [
        ...ocrText.matchAll(/#\s*(\w+)/g),
        ...ocrText.matchAll(/\b([A-Z]{1,3}\d+[A-Z]*)\b/g),
        ...ocrText.matchAll(/\b(\d{1,4})\b/g)
      ];
      const cardNumbers = [...new Set(cardNumberMatches.map(m => m[1]))];
      if (cardNumbers.length > 0) analysis.withCardNumber++;

      // Extract Pokemon name patterns (common names)
      const pokemonNames = [
        'CHARIZARD', 'BLASTOISE', 'VENUSAUR', 'PIKACHU', 'ALAKAZAM', 'LAPRAS',
        'POLIWHIRL', 'CHARMANDER', 'TAUROS', 'HOUNDOUR', 'ESPEON'
      ].filter(name => ocrText.includes(name));
      if (pokemonNames.length > 0) analysis.withPokemonName++;

      // Extract certification number (7-9 digits)
      const certMatch = ocrText.match(/\b(\d{7,9})\b/);
      const certNumber = certMatch ? certMatch[1] : null;
      if (certNumber) analysis.withCertNumber++;

      // Extract grade (1-10)
      const gradeMatch = ocrText.match(/(?:MINT|GEM MINT|NM-MT|EX-MT|EX|VG-EX|VG|GOOD|PR)\s*(\d+)/i) ||
                        ocrText.match(/\b(10|9|8|7|6|5|4|3|2|1)\b/);
      const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : null;
      if (grade) analysis.withGrade++;

      analysis.extractionPatterns.push({
        scanIndex: index,
        imageHash: scan.imageHash.substring(0, 10) + '...',
        year,
        cardNumbers,
        pokemonNames,
        certNumber,
        grade,
        ocrTextLength: ocrText.length,
        ocrTextSample: ocrText.substring(0, 100) + (ocrText.length > 100 ? '...' : '')
      });
    });

    console.log('📊 OCR Extraction Analysis:');
    console.log(`  - Scans with Year: ${analysis.withYear}/${analysis.totalScans}`);
    console.log(`  - Scans with Card Numbers: ${analysis.withCardNumber}/${analysis.totalScans}`);
    console.log(`  - Scans with Pokemon Names: ${analysis.withPokemonName}/${analysis.totalScans}`);
    console.log(`  - Scans with Cert Numbers: ${analysis.withCertNumber}/${analysis.totalScans}`);
    console.log(`  - Scans with Grades: ${analysis.withGrade}/${analysis.totalScans}`);

    return analysis;
  }

  /**
   * Test card matching API with current scan data
   */
  async testCardMatchingAPI(scans) {
    console.log('\n🎯 Step 3: Testing card matching API with current OCR data...');

    try {
      const imageHashes = scans.map(scan => scan.imageHash);

      console.log(`🔄 Sending ${imageHashes.length} image hashes to matching API...`);

      const response = await fetch(`${this.baseUrl}/api/icr/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageHashes })
      });

      const matchingData = await response.json();

      if (!matchingData.success) {
        throw new Error(`Matching API Error: ${matchingData.message}`);
      }

      console.log(`✅ Matching API completed: ${matchingData.message}`);

      return matchingData.data;
    } catch (error) {
      console.error('❌ Card matching API failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze matching results in detail
   */
  analyzeMatchingResults(matchingResults, originalScans) {
    console.log('\n📊 Step 4: Analyzing detailed matching results...');

    const analysis = {
      totalProcessed: matchingResults.totalProcessed,
      successfulMatches: matchingResults.successfulMatches,
      successRate: (matchingResults.successfulMatches / matchingResults.totalProcessed * 100).toFixed(1),
      detailedResults: []
    };

    matchingResults.matchingResults.forEach((result, index) => {
      const originalScan = originalScans.find(scan => scan.imageHash === result.imageHash);


      const detailed = {
        scanIndex: index,
        imageHash: result.imageHash.substring(0, 10) + '...',
        originalFileName: result.originalFileName,
        matchingStatus: result.matchingStatus,
        hasOcrText: !!result.ocrText,
        ocrTextLength: result.ocrText?.length || 0,
        extractedData: result.extractedData || {},
        cardMatches: originalScan?.cardMatches || [], // Use cardMatches from database scan
        cardMatchesCount: originalScan?.cardMatches?.length || 0,
        bestMatch: result.bestMatch || null,
        ocrTextSample: result.ocrText?.substring(0, 150) + (result.ocrText?.length > 150 ? '...' : '') || 'No OCR text'
      };

      if (result.bestMatch) {
        detailed.bestMatchDetails = {
          cardName: result.bestMatch.cardName,
          cardNumber: result.bestMatch.cardNumber,
          setName: result.bestMatch.setName,
          year: result.bestMatch.year,
          scores: result.bestMatch.scores
        };
      }

      if (result.error) {
        detailed.error = result.error;
      }

      analysis.detailedResults.push(detailed);
    });

    console.log('📊 Matching Results Summary:');
    console.log(`  - Total Processed: ${analysis.totalProcessed}`);
    console.log(`  - Successful Matches: ${analysis.successfulMatches}`);
    console.log(`  - Success Rate: ${analysis.successRate}%`);

    return analysis;
  }

  /**
   * Compare database state before and after matching
   */
  async compareDbState(scansBeforeMatching) {
    console.log('\n🔄 Step 5: Comparing database state after matching...');

    try {
      const response = await fetch(`${this.baseUrl}/api/icr/scans?limit=50`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(`API Error: ${data.message}`);
      }

      const scansAfterMatching = data.data.scans;

      const comparison = {
        totalScans: scansAfterMatching.length,
        changedScans: 0,
        newMatches: 0,
        statusChanges: []
      };

      scansAfterMatching.forEach(afterScan => {
        const beforeScan = scansBeforeMatching.find(scan => scan.imageHash === afterScan.imageHash);

        if (beforeScan) {
          const statusChanged = beforeScan.processingStatus !== afterScan.processingStatus;
          const matchChanged = beforeScan.matchingStatus !== afterScan.matchingStatus;

          if (statusChanged || matchChanged) {
            comparison.changedScans++;

            if (afterScan.processingStatus === 'matched' && beforeScan.processingStatus !== 'matched') {
              comparison.newMatches++;
            }

            comparison.statusChanges.push({
              imageHash: afterScan.imageHash.substring(0, 10) + '...',
              processingStatus: {
                before: beforeScan.processingStatus,
                after: afterScan.processingStatus
              },
              matchingStatus: {
                before: beforeScan.matchingStatus || 'unknown',
                after: afterScan.matchingStatus || 'unknown'
              },
              newMatchedCard: afterScan.matchedCard || null
            });
          }
        }
      });

      console.log('📊 Database State Comparison:');
      console.log(`  - Changed Scans: ${comparison.changedScans}`);
      console.log(`  - New Matches: ${comparison.newMatches}`);

      return comparison;
    } catch (error) {
      console.error('❌ Failed to compare database state:', error.message);
      throw error;
    }
  }

  /**
   * Save comprehensive results to file
   */
  async saveResults(ocrAnalysis, matchingAnalysis, dbComparison, originalScans, matchingResults) {
    console.log('\n💾 Step 6: Saving comprehensive verification results...');

    const timestamp = new Date().toISOString();

    const report = {
      metadata: {
        testId: this.testId,
        timestamp,
        testType: 'Card Matching Verification',
        description: 'Comprehensive analysis of OCR text extraction and card matching accuracy'
      },
      rawData: {
        originalScans: originalScans,
        matchingApiResults: matchingResults,
        ocrExtractionPatterns: ocrAnalysis.extractionPatterns,
        detailedMatchingResults: matchingAnalysis.detailedResults,
        databaseStateChanges: dbComparison.statusChanges
      },
      ocrExtraction: ocrAnalysis,
      cardMatching: matchingAnalysis,
      databaseComparison: dbComparison,
      summary: {
        totalScansAnalyzed: ocrAnalysis.totalScans,
        ocrExtractionSuccessRate: `${((ocrAnalysis.withYear / ocrAnalysis.totalScans) * 100).toFixed(1)}%`,
        cardMatchingSuccessRate: matchingAnalysis.successRate + '%',
        newMatchesCreated: dbComparison.newMatches,
        overallStatus: matchingAnalysis.successfulMatches > 0 ? 'SUCCESS' : 'NEEDS_IMPROVEMENT'
      }
    };

    // Save detailed JSON report with ALL raw data
    const reportPath = path.join(this.resultsDir, 'matching-verification-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Save human-readable text report
    const textReportPath = path.join(this.resultsDir, 'matching-verification-report.txt');
    const textReport = this.generateTextReport(report);
    await fs.writeFile(textReportPath, textReport);

    // Save a simple results.json file in project root for easy access
    const simpleResultsPath = path.join(process.cwd(), 'matching-results.json');
    const simpleResults = {
      timestamp,
      summary: report.summary,
      scanResults: matchingAnalysis.detailedResults.map(result => ({
        imageHash: result.imageHash,
        matchingStatus: result.matchingStatus,
        bestMatch: result.bestMatch,
        allMatches: result.cardMatches || [],
        totalMatches: result.cardMatches?.length || 0,
        hasMultipleVarieties: (result.cardMatches?.length || 0) > 1,
        ocrTextSample: result.ocrTextSample,
        extractedData: result.extractedData
      }))
    };
    await fs.writeFile(simpleResultsPath, JSON.stringify(simpleResults, null, 2));

    console.log('✅ Results saved to:');
    console.log(`  - Detailed JSON: ${reportPath}`);
    console.log(`  - Text Report: ${textReportPath}`);
    console.log(`  - Simple Results: ${simpleResultsPath}`);

    return report;
  }

  /**
   * Generate human-readable text report
   */
  generateTextReport(report) {
    let text = '';
    text += '============================================================\n';
    text += '📊 POKEMON CARD MATCHING VERIFICATION REPORT\n';
    text += '============================================================\n';
    text += `Test ID: ${report.metadata.testId}\n`;
    text += `Timestamp: ${report.metadata.timestamp}\n`;
    text += `Overall Status: ${report.summary.overallStatus}\n`;
    text += '\n';

    text += '📋 OCR EXTRACTION ANALYSIS\n';
    text += '============================================================\n';
    text += `Total Scans Analyzed: ${report.ocrExtraction.totalScans}\n`;
    text += `Scans with Year: ${report.ocrExtraction.withYear}/${report.ocrExtraction.totalScans}\n`;
    text += `Scans with Card Numbers: ${report.ocrExtraction.withCardNumber}/${report.ocrExtraction.totalScans}\n`;
    text += `Scans with Pokemon Names: ${report.ocrExtraction.withPokemonName}/${report.ocrExtraction.totalScans}\n`;
    text += `Scans with Cert Numbers: ${report.ocrExtraction.withCertNumber}/${report.ocrExtraction.totalScans}\n`;
    text += `Scans with Grades: ${report.ocrExtraction.withGrade}/${report.ocrExtraction.totalScans}\n`;
    text += '\n';

    text += '🎯 CARD MATCHING RESULTS\n';
    text += '============================================================\n';
    text += `Total Processed: ${report.cardMatching.totalProcessed}\n`;
    text += `Successful Matches: ${report.cardMatching.successfulMatches}\n`;
    text += `Success Rate: ${report.cardMatching.successRate}%\n`;
    text += '\n';

    text += '📊 DETAILED MATCHING BREAKDOWN\n';
    text += '============================================================\n';
    report.cardMatching.detailedResults.forEach((result, index) => {
      text += `Scan ${index + 1}: ${result.imageHash}\n`;
      text += `  Status: ${result.matchingStatus}\n`;
      text += `  OCR Length: ${result.ocrTextLength} chars\n`;
      if (result.bestMatch) {
        text += `  Best Match: ${result.bestMatch.cardName} #${result.bestMatch.cardNumber}\n`;
        text += `  Set: ${result.bestMatch.setName} (${result.bestMatch.year})\n`;
      }
      if (result.error) {
        text += `  Error: ${result.error}\n`;
      }
      text += `  OCR Sample: ${result.ocrTextSample}\n`;
      text += '\n';
    });

    text += '🔄 DATABASE STATE CHANGES\n';
    text += '============================================================\n';
    text += `Changed Scans: ${report.databaseComparison.changedScans}\n`;
    text += `New Matches Created: ${report.databaseComparison.newMatches}\n`;
    text += '\n';

    text += '✅ SUMMARY\n';
    text += '============================================================\n';
    text += `OCR Extraction Success Rate: ${report.summary.ocrExtractionSuccessRate}\n`;
    text += `Card Matching Success Rate: ${report.summary.cardMatchingSuccessRate}\n`;
    text += `New Matches Created: ${report.summary.newMatchesCreated}\n`;
    text += `Overall Status: ${report.summary.overallStatus}\n`;

    return text;
  }

  /**
   * Run complete verification workflow
   */
  async runVerification() {
    try {
      await this.init();

      // Get current database state
      const scansWithOcr = await this.getAllScansWithOcrText();

      if (scansWithOcr.length === 0) {
        console.log('❌ No scans with OCR text found. Run the OCR pipeline first.');
        return;
      }

      // Analyze OCR extraction patterns
      const ocrAnalysis = this.analyzeOcrExtraction(scansWithOcr);

      // Test card matching API
      const matchingResults = await this.testCardMatchingAPI(scansWithOcr);

      // Analyze matching results
      const matchingAnalysis = this.analyzeMatchingResults(matchingResults, scansWithOcr);

      // Compare database state
      const dbComparison = await this.compareDbState(scansWithOcr);

      // Save comprehensive results
      const report = await this.saveResults(ocrAnalysis, matchingAnalysis, dbComparison, scansWithOcr, matchingResults);

      console.log('\n============================================================');
      console.log('📊 VERIFICATION COMPLETE');
      console.log('============================================================');
      console.log(`Overall Status: ${report.summary.overallStatus}`);
      console.log(`OCR Extraction Success: ${report.summary.ocrExtractionSuccessRate}`);
      console.log(`Card Matching Success: ${report.summary.cardMatchingSuccessRate}`);
      console.log(`New Matches Created: ${report.summary.newMatchesCreated}`);
      console.log('============================================================');

    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the verification
const verificationTool = new MatchingVerificationTool();
verificationTool.runVerification();