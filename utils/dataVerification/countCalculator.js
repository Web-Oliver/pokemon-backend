const fs = require('fs');
const path = require('path');

const calculatePsaCounts = (dir, stats, dataDir) => {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      calculatePsaCounts(fullPath, stats, dataDir);
    } else if (entry.endsWith('.json')
                    && !entry.includes('Zone.Identifier')
                    && !entry.includes('_all_sets.json')
                    && !entry.includes('_TEST.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

        if (!data.set_name || !data.cards) {
          console.log(`Skipping file ${fullPath} - not a valid set data file`);
          return;
        }

        stats.processedFiles.push(path.relative(dataDir, fullPath));
        stats.expectedSets++;

        const cardCount = data.cards.filter((card) => card.card_name !== 'TOTAL POPULATION'
                      && card.base_name !== 'TOTAL POPULATION'
                      && card.pokemon_number !== 'N/A').length;

        stats.expectedCards += cardCount;
      } catch (error) {
        console.error(`Error parsing ${fullPath}:`, error.message);
      }
    }
  }
};

const calculateCardMarketCounts = (dir, stats, dataDir) => {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      calculateCardMarketCounts(fullPath, stats, dataDir);
    } else if (entry.endsWith('.json')
                    && !entry.includes('Zone.Identifier')
                    && !entry.includes('progress')) {
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const products = data.products || [];

        stats.expectedCardMarketProducts += products.length;
        stats.processedFiles.push(path.relative(dataDir, fullPath));
      } catch (error) {
        console.error(`Error parsing ${fullPath}:`, error.message);
      }
    }
  }
};

const calculateExpectedCounts = () => {
  const dataDir = path.join(__dirname, '../../data');

  const stats = {
    expectedSets: 0,
    expectedCards: 0,
    expectedCardMarketProducts: 0,
    processedFiles: [],
  };

  const setsDir = path.join(dataDir, 'sets');

  calculatePsaCounts(setsDir, stats, dataDir);

  const sealedProductsDir = path.join(dataDir, 'SealedProducts');

  calculateCardMarketCounts(sealedProductsDir, stats, dataDir);

  return stats;
};

module.exports = {
  calculateExpectedCounts,
  calculatePsaCounts,
  calculateCardMarketCounts,
};
