const fs = require('fs');
const path = require('path');
const SealedProduct = require('../../models/SealedProduct');

const importSealedProductData = async (filePath) => {
  try {
    console.log(`Importing Sealed Product data from ${filePath}...`);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return { success: false, error: `File not found: ${filePath}` };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let productsProcessed = 0;
    let skippedProducts = 0;

    const products = data.products || [];
    const category = data.metadata?.category || path.basename(path.dirname(filePath));

    const productPromises = products.map(async (product) => {
      try {
        // Parse availability
        let parsedAvailability = 0;

        if (typeof product.available === 'string') {
          parsedAvailability = parseInt(product.available.replace(/,/g, ''), 10) || 0;
        } else {
          parsedAvailability = product.available || 0;
        }

        // Parse price - extract numeric value from European format price string and convert to DKK
        let parsedPrice = 0;

        if (product.price) {
          // Match European number format: "16.499,00 €" or "14,89 €"
          const priceMatch = product.price.toString().match(/[\d.,]+/);

          if (priceMatch) {
            let priceStr = priceMatch[0];

            // Handle European format: thousands separator (.) and decimal separator (,)
            if (priceStr.includes('.') && priceStr.includes(',')) {
              // Format like "16.499,00" - remove thousands separator and convert decimal separator
              priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            } else if (priceStr.includes(',')) {
              // Format like "14,89" - just convert decimal separator
              priceStr = priceStr.replace(',', '.');
            }
            const euroPrice = parseFloat(priceStr) || 0;

            // Convert EUR to DKK (1 EUR = 7.46 DKK) and round to whole numbers
            parsedPrice = Math.round(euroPrice * 7.46);
          }
        }

        await SealedProduct.findOneAndUpdate(
          {
            name: product.name,
            setName: product.expansion || 'Unknown Set',
            category,
          },
          {
            name: product.name,
            setName: product.expansion || 'Unknown Set',
            category,
            availability: parsedAvailability,
            cardMarketPrice: parsedPrice,
            myPrice: parsedPrice, // Default to CardMarket price initially
            dateAdded: new Date(product.scraped_at || new Date()),
          },
          { upsert: true, new: true },
        );

        return { processed: true, skipped: false };
      } catch (error) {
        console.error(`Error processing sealed product ${product.name}:`, error.message);
        return { processed: false, skipped: true };
      }
    });

    const productResults = await Promise.all(productPromises);

    productsProcessed = productResults.filter((result) => result.processed).length;
    skippedProducts = productResults.filter((result) => result.skipped).length;

    console.log(`Sealed Product data import from ${filePath} completed successfully`);
    console.log(`Products processed: ${productsProcessed}, Skipped: ${skippedProducts}`);

    return {
      success: true,
      productsProcessed,
      skippedProducts,
    };
  } catch (error) {
    console.error(`Error importing Sealed Product data from ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  importSealedProductData,
};
