const fs = require('fs');
const CardMarketReferenceProduct = require('../../models/CardMarketReferenceProduct');

const importCardMarketData = async (filePath) => {
  try {
    console.log(`Importing CardMarket reference data from ${filePath}...`);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return { success: false, error: `File not found: ${filePath}` };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let productsProcessed = 0;
    let skippedProducts = 0;

    const products = data.products || [];

    const productPromises = products.map(async (product) => {
      try {
        // Parse availability
        let parsedAvailable = 0;

        if (typeof product.available === 'string') {
          parsedAvailable = parseInt(product.available.replace(/,/g, ''), 10) || 0;
        } else {
          parsedAvailable = product.available || 0;
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
            console.log(`Converted from €${euroPrice} EUR → ${parsedPrice} kr.`);
          }
        }

        await CardMarketReferenceProduct.findOneAndUpdate(
          {
            name: product.name,
            setName: product.expansion || product.setName || 'Unknown Set',
            category: product.category,
          },
          {
            name: product.name,
            setName: product.expansion || product.setName || 'Unknown Set',
            available: parsedAvailable,
            price: parsedPrice.toString(),
            category: product.category,
            url: product.url,
            lastUpdated: product.last_updated ? new Date(product.last_updated) : new Date(),
          },
          { upsert: true, new: true },
        );

        return { processed: true, skipped: false };
      } catch (error) {
        console.error(`Error processing product ${product.name}:`, error.message);
        return { processed: false, skipped: true };
      }
    });

    const productResults = await Promise.all(productPromises);

    productsProcessed = productResults.filter((result) => result.processed).length;
    skippedProducts = productResults.filter((result) => result.skipped).length;

    console.log(`CardMarket reference data import from ${filePath} completed successfully`);
    console.log(`Products processed: ${productsProcessed}, Skipped: ${skippedProducts}`);

    return {
      success: true,
      productsProcessed,
      skippedProducts,
    };
  } catch (error) {
    console.error(`Error importing CardMarket reference data from ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  importCardMarketData,
};
