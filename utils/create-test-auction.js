const mongoose = require('mongoose');
const Auction = require('./models/Auction');
const SealedProduct = require('./models/SealedProduct');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-collection');

async function createTestAuction() {
  try {
    console.log('🔍 Creating test auction with items...');
    
    // Find some sealed products to add to auction
    const sealedProducts = await SealedProduct.find().limit(3);
    console.log('Found sealed products:', sealedProducts.length);
    
    if (sealedProducts.length === 0) {
      console.log('❌ No sealed products found to create test auction');
      return;
    }
    
    // Create test auction
    const testAuction = new Auction({
      topText: 'Test Auction for Remove Item Debug',
      bottomText: 'Testing remove functionality',
      status: 'draft',
      items: sealedProducts.map(product => ({
        itemId: product._id,
        itemCategory: 'SealedProduct',
        sold: false
      }))
    });
    
    const savedAuction = await testAuction.save();
    console.log('✅ Test auction created successfully!');
    console.log('Auction ID:', savedAuction._id);
    console.log('Items added:', savedAuction.items.length);
    
    // Display the items
    console.log('\nItems in auction:');
    savedAuction.items.forEach((item, index) => {
      console.log(`${index + 1}. itemId: ${item.itemId}, category: ${item.itemCategory}`);
    });
    
    return savedAuction;
    
  } catch (error) {
    console.error('❌ Error creating test auction:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestAuction();