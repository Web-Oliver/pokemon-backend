#!/usr/bin/env node

/**
 * Test script for OcrTextDistributor with real PSA data
 * Tests the coordinate mapping algorithm against actual database data
 */

import {MongoClient} from 'mongodb';
import OcrTextDistributor from './src/icr/shared/OcrTextDistributor.js';

const MONGODB_URI = 'mongodb://localhost:27017/pokemon_collection';

async function testOcrTextDistributor() {
  let client;

  try {
    console.log('🧪 TESTING OCR TEXT DISTRIBUTOR');
    console.log('================================\n');

    // Connect to database
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();

    // Get stitched label data
    const stitchedLabel = await db.collection('stitchedlabels').findOne();
    if (!stitchedLabel) {
      throw new Error('No stitched label found in database');
    }

    console.log('📊 DATABASE DATA:');
    console.log(`- Stitched label ID: ${stitchedLabel._id}`);
    console.log(`- Label positions: ${stitchedLabel.labelPositions?.length || 0}`);
    console.log(`- OCR annotations: ${stitchedLabel.ocrAnnotations?.length || 0}`);
    console.log(`- Processing status: ${stitchedLabel.processingStatus}\n`);

    if (!stitchedLabel.labelPositions || !stitchedLabel.ocrAnnotations) {
      throw new Error('Missing labelPositions or ocrAnnotations in stitched label');
    }

    // Test the distribution algorithm
    console.log('🔬 RUNNING DISTRIBUTION ALGORITHM...\n');

    const textSegments = OcrTextDistributor.distributeByActualPositions(
      stitchedLabel.ocrAnnotations,
      stitchedLabel.labelPositions
    );

    console.log('📋 DISTRIBUTION RESULTS:');
    console.log(`- Total segments created: ${textSegments.length}`);
    console.log(`- Segments with text: ${textSegments.filter(t => t.length > 0).length}`);
    console.log(`- Empty segments: ${textSegments.filter(t => t.length === 0).length}\n`);

    // Test specific indexes for verification
    console.log('🎯 KEY TEST CASES:');

    // Index 0 should have HITMONCHAN
    console.log(`\nIndex 0 (Y: ${stitchedLabel.labelPositions[0]?.y}):`);
    console.log(`Text: "${textSegments[0]?.substring(0, 100)}..."`);

    // Index 30 should have DARK ALAKAZAM
    const index30Position = stitchedLabel.labelPositions.find(pos => pos.index === 30);
    if (index30Position) {
      console.log(`\nIndex 30 (Y: ${index30Position.y}):`);
      console.log(`Text: "${textSegments[30]?.substring(0, 100)}..."`);

      // Check if it contains DARK ALAKAZAM
      const hasDarkAlakazam = textSegments[30]?.toUpperCase().includes('DARK ALAKAZAM');
      console.log(`✅ Contains "DARK ALAKAZAM": ${hasDarkAlakazam ? '✓ YES' : '✗ NO'}`);
    }

    // Quality metrics
    const metrics = OcrTextDistributor.getDistributionQualityMetrics(textSegments, stitchedLabel.ocrAnnotations);
    console.log('\n📈 QUALITY METRICS:');
    console.log(`- Distribution rate: ${(metrics.distributionRate * 100).toFixed(1)}%`);
    console.log(`- Labels with text: ${metrics.labelsWithText}/${metrics.totalLabels}`);
    console.log(`- Average text length: ${metrics.averageTextLength.toFixed(1)} chars`);
    console.log(`- Total characters: ${metrics.totalCharacters}`);

    // Test with specific Y coordinates to verify accuracy
    console.log('\n🎯 COORDINATE VERIFICATION:');

    // Find annotations that should map to specific positions
    const testCases = [
      { index: 0, expectedY: 0, expectedText: 'HITMONCHAN' },
      { index: 30, expectedY: 9882, expectedText: 'DARK ALAKAZAM' }
    ];

    for (const testCase of testCases) {
      const position = stitchedLabel.labelPositions.find(pos => pos.index === testCase.index);
      if (position) {
        console.log(`\n📍 Index ${testCase.index}:`);
        console.log(`   Expected Y: ${testCase.expectedY}, Actual Y: ${position.y}`);
        console.log(`   Y Range: ${position.y} - ${position.y + position.height}`);
        console.log(`   Assigned text: "${textSegments[testCase.index]?.substring(0, 80)}..."`);

        const containsExpectedText = textSegments[testCase.index]?.toUpperCase().includes(testCase.expectedText);
        console.log(`   Contains "${testCase.expectedText}": ${containsExpectedText ? '✅ YES' : '❌ NO'}`);
      }
    }

    console.log('\n✅ OCR TEXT DISTRIBUTOR TEST COMPLETED');

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run the test
testOcrTextDistributor();