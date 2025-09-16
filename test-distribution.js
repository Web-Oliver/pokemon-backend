/**
 * TEXT DISTRIBUTION DEBUGGER
 *
 * This script tests the OCR text distribution repeatedly until it's perfect
 * NO STATUS CHECKS - OVERWRITES EVERYTHING
 */

import fetch from 'node-fetch';
import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://localhost:27017/pokemon_collection';

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
}

async function debugDistribution() {
  await connectDB();

  const StitchedLabel = mongoose.model('StitchedLabel', new mongoose.Schema({}, { strict: false }), 'stitchedlabels');
  const GradedCardScan = mongoose.model('GradedCardScan', new mongoose.Schema({}, { strict: false }), 'gradedcardscans');

  // Get the stitched label with OCR data
  const stitchedLabel = await StitchedLabel.findOne({});
  if (!stitchedLabel) {
    console.error('❌ No stitched label found!');
    process.exit(1);
  }

  console.log('\n📊 STITCHED LABEL DATA:');
  console.log('  - ID:', stitchedLabel._id);
  console.log('  - Status:', stitchedLabel.processingStatus);
  console.log('  - OCR Text Length:', stitchedLabel.ocrText?.length || 0);
  console.log('  - Total Annotations:', stitchedLabel.ocrAnnotations?.length || 0);
  console.log('  - Label Count:', stitchedLabel.labelCount);
  console.log('  - Label Hashes:', stitchedLabel.labelHashes?.length || 0);

  // Show label positions
  console.log('\n📍 LABEL POSITIONS:');
  stitchedLabel.labelPositions?.forEach((pos, i) => {
    console.log(`  Label ${i}: Y=${pos.y} to ${pos.y + pos.height} (height=${pos.height})`);
  });

  // Show some annotations with their positions
  console.log('\n📝 SAMPLE ANNOTATIONS WITH Y POSITIONS:');
  const sampleIndices = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];
  sampleIndices.forEach(i => {
    const ann = stitchedLabel.ocrAnnotations?.[i];
    if (ann) {
      const y = ann.boundingPoly?.vertices?.[0]?.y || 0;
      const text = (ann.description || ann.text || '').substring(0, 30);
      console.log(`  Ann ${i}: Y=${y} "${text}"`);

      // Find which label this should belong to
      const labelIndex = stitchedLabel.labelPositions?.findIndex(pos =>
        y >= pos.y && y < (pos.y + pos.height)
      );
      console.log(`    -> Should be in Label ${labelIndex}`);
    }
  });

  // Get the gradedcardscans
  const scans = await GradedCardScan.find({});
  console.log('\n📋 GRADEDCARDSCANS:');
  console.log('  - Total Scans:', scans.length);

  // Show current OCR text status
  console.log('\n📊 CURRENT OCR TEXT STATUS:');
  scans.forEach((scan, i) => {
    const hasText = scan.ocrText && scan.ocrText.length > 0;
    const preview = hasText ? scan.ocrText.substring(0, 50) : 'NO TEXT';
    console.log(`  Scan ${i}: ${scan.imageHash?.substring(0, 10)}... - ${preview}`);
  });

  // Get imageHashes for API call
  const imageHashes = stitchedLabel.labelHashes || scans.map(s => s.imageHash);
  console.log('\n🔄 CALLING TEXT DISTRIBUTION API...');
  console.log('  Using imageHashes:', imageHashes.length);

  try {
    const response = await fetch('http://localhost:3000/api/icr/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageHashes })
    });

    const result = await response.json();

    console.log('\n📊 DISTRIBUTION API RESPONSE:');
    console.log('  - Success:', result.success);
    console.log('  - Message:', result.message);

    if (result.data) {
      console.log('  - Data keys:', Object.keys(result.data));
      if (result.data.distributionMetrics) {
        const metrics = result.data.distributionMetrics;
        console.log('\n  Distribution Metrics:');
        console.log('    - Total Scans:', metrics.totalScans);
        console.log('    - Successful Updates:', metrics.successfulUpdates);
        console.log('    - Failed Updates:', metrics.failedUpdates);
        console.log('    - Text Assignments:', metrics.textAssignments);
        console.log('    - Empty Assignments:', metrics.emptyAssignments);
      }

      if (result.data.updateResults) {
        console.log('\n  Update Results:');
        result.data.updateResults.forEach((ur, i) => {
          const status = ur.success ? '✅' : '❌';
          const preview = ur.textLength > 0 ? `${ur.textLength} chars` : 'NO TEXT';
          console.log(`    ${status} Scan ${i}: ${preview} - Confidence: ${ur.confidence || 0}`);
          if (!ur.success && ur.error) {
            console.log(`       Error: ${ur.error}`);
          }
        });
      }
    }

    if (result.error) {
      console.error('\n❌ ERROR:', result.error.message || result.error);
    }

  } catch (error) {
    console.error('\n❌ API CALL FAILED:', error.message);
  }

  // Check the results after distribution
  console.log('\n📊 CHECKING RESULTS AFTER DISTRIBUTION...');
  const updatedScans = await GradedCardScan.find({});

  console.log('\n✅ FINAL OCR TEXT STATUS:');
  let successCount = 0;
  updatedScans.forEach((scan, i) => {
    const hasText = scan.ocrText && scan.ocrText.length > 0;
    if (hasText) successCount++;
    const preview = hasText ? scan.ocrText.substring(0, 80) : 'NO TEXT';
    const status = hasText ? '✅' : '❌';
    console.log(`  ${status} Scan ${i}: ${preview}`);
  });

  console.log('\n📊 SUMMARY:');
  console.log(`  - ${successCount}/${updatedScans.length} scans have OCR text`);

  // Analyze the distribution algorithm
  console.log('\n🔬 ANALYZING DISTRIBUTION ALGORITHM:');
  console.log('  The distribution should map text based on Y coordinates:');
  console.log('  1. Each annotation has a Y position from boundingPoly.vertices[0].y');
  console.log('  2. Each label has a Y range (labelPositions[i].y to y+height)');
  console.log('  3. Text should be assigned to the label whose range contains the annotation Y');

  // Manual distribution test
  console.log('\n🧪 MANUAL DISTRIBUTION TEST:');
  const manualDistribution = Array(stitchedLabel.labelCount || 10).fill('');

  stitchedLabel.ocrAnnotations?.slice(1).forEach(ann => { // Skip first (full text)
    if (ann.boundingPoly?.vertices?.[0]?.y !== undefined) {
      const y = ann.boundingPoly.vertices[0].y;
      const text = ann.description || ann.text || '';

      // Find which label this belongs to
      const labelIndex = stitchedLabel.labelPositions?.findIndex(pos =>
        y >= pos.y && y < (pos.y + pos.height)
      );

      if (labelIndex >= 0 && labelIndex < manualDistribution.length) {
        manualDistribution[labelIndex] += text + ' ';
      }
    }
  });

  console.log('\n📝 MANUAL DISTRIBUTION RESULTS:');
  manualDistribution.forEach((text, i) => {
    const preview = text.trim().substring(0, 80);
    console.log(`  Label ${i}: "${preview}"`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Test complete!');
}

// Run the test
debugDistribution().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});