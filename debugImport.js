const mongoose = require('mongoose');
const CardMarketReferenceProduct = require('./models/CardMarketReferenceProduct');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pokemon-collection');

const testImport = async () => {
  try {
    console.log('Testing CardMarket data import...');

    const filePath = path.join(__dirname, 'data/SealedProducts/Booster-Boxes/Booster-Boxes.json');

    console.log('Reading file:', filePath);

    if (!fs.existsSync(filePath)) {
      console.error('File does not exist!');
      return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log('File loaded, metadata:', data.metadata);
    console.log('Number of products:', data.products.length);

    if (data.products.length > 0) {
      const firstProduct = data.products[0];

      console.log('First product:', firstProduct);

      // Try to create one product
      const testProduct = new CardMarketReferenceProduct({
        name: firstProduct.name,
        setName: firstProduct.expansion || 'Unknown Set',
        available: parseInt(firstProduct.available.replace(/,/g, ''), 10) || 0,
        price: firstProduct.price,
        category: firstProduct.category,
        url: firstProduct.url,
        scrapedAt: new Date(firstProduct.scraped_at),
        lastUpdated: new Date(),
      });

      const saved = await testProduct.save();

      console.log('Successfully saved test product:', saved._id);

      // Check if it exists
      const count = await CardMarketReferenceProduct.countDocuments();

      console.log('Total documents in collection:', count);

      // Clean up test
      await CardMarketReferenceProduct.deleteOne({ _id: saved._id });
      console.log('Test product deleted');
    }
  } catch (error) {
    console.error('Error in test import:', error);
  } finally {
    await mongoose.disconnect();
  }
};

testImport();
