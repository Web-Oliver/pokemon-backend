#!/usr/bin/env node

const mongoose = require('mongoose');
const Set = require('./models/Set');
const Card = require('./models/Card');

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon-collection';

    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Find sets with no cards
const findEmptySets = async () => {
  try {
    console.log('🔍 Finding sets with no cards...\n');

    // Aggregation pipeline to find sets with no cards
    const emptySetsPipeline = [
      // Lookup cards for each set
      {
        $lookup: {
          from: 'cards',
          localField: '_id',
          foreignField: 'setId',
          as: 'cards',
        },
      },
      // Filter sets with no cards
      {
        $match: {
          cards: { $size: 0 },
        },
      },
      // Project only needed fields
      {
        $project: {
          setName: 1,
          year: 1,
          totalCardsInSet: 1,
          totalPsaPopulation: 1,
          cardCount: { $size: '$cards' },
        },
      },
      // Sort by year and set name
      {
        $sort: {
          year: 1,
          setName: 1,
        },
      },
    ];

    // Execute aggregation
    const emptySets = await Set.aggregate(emptySetsPipeline);

    // Get total set count for comparison
    const totalSetsCount = await Set.countDocuments();

    // Display results
    console.log('📊 **RESULTS:**');
    console.log(`Total sets in database: ${totalSetsCount}`);
    console.log(`Sets with no cards: ${emptySets.length}`);
    console.log(`Percentage of empty sets: ${((emptySets.length / totalSetsCount) * 100).toFixed(2)}%\n`);

    if (emptySets.length > 0) {
      console.log('📝 **EMPTY SETS DETAILS:**');
      console.log('─'.repeat(80));
      console.log(`${'SET NAME'.padEnd(40) + 'YEAR'.padEnd(8) + 'TOTAL CARDS'.padEnd(15)}PSA POP`);
      console.log('─'.repeat(80));

      emptySets.forEach((set, index) => {
        const setName = (set.setName || 'Unknown').padEnd(40);
        const year = (set.year || 'N/A').toString().padEnd(8);
        const totalCards = (set.totalCardsInSet || 0).toString().padEnd(15);
        const psaPop = (set.totalPsaPopulation || 0).toString();

        console.log(`${setName}${year}${totalCards}${psaPop}`);
      });

      console.log('─'.repeat(80));
    } else {
      console.log('✅ All sets have at least one card!');
    }

    // Additional statistics
    console.log('\n📈 **ADDITIONAL STATS:**');

    // Get sets with card counts
    const setCardCounts = await Set.aggregate([
      {
        $lookup: {
          from: 'cards',
          localField: '_id',
          foreignField: 'setId',
          as: 'cards',
        },
      },
      {
        $project: {
          setName: 1,
          cardCount: { $size: '$cards' },
        },
      },
      {
        $group: {
          _id: null,
          totalSets: { $sum: 1 },
          setsWithCards: {
            $sum: {
              $cond: { if: { $gt: ['$cardCount', 0] }, then: 1, else: 0 },
            },
          },
          totalCards: { $sum: '$cardCount' },
          avgCardsPerSet: { $avg: '$cardCount' },
        },
      },
    ]);

    if (setCardCounts.length > 0) {
      const stats = setCardCounts[0];

      console.log(`Sets with cards: ${stats.setsWithCards}`);
      console.log(`Total cards across all sets: ${stats.totalCards}`);
      console.log(`Average cards per set: ${stats.avgCardsPerSet.toFixed(2)}`);
    }
  } catch (error) {
    console.error('❌ Error finding empty sets:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await findEmptySets();

  console.log('\n🏁 Analysis complete!');
  process.exit(0);
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
