const fs = require('fs');
const path = require('path');

// Get all PSA metadata files (*_all_sets.json)
const getAllPsaMetadataFiles = () => {
  const dataDir = path.join(__dirname, '../../data');
  const setsDir = path.join(dataDir, 'sets');
  const metadataFiles = [];

  // Function to recursively find all metadata JSON files in sets directory
  const findMetadataFiles = (dir) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findMetadataFiles(fullPath);
      } else if (
        entry.endsWith('.json') &&
        !entry.includes('Zone.Identifier') &&
        entry.includes('_all_sets.json') &&
        !entry.includes('_TEST.json')
      ) {
        metadataFiles.push(fullPath);
      }
    }
  };

  findMetadataFiles(setsDir);
  return metadataFiles;
};

// Get all individual PSA set files (excluding *_all_sets.json)
const getAllPsaIndividualFiles = () => {
  const dataDir = path.join(__dirname, '../../data');
  const setsDir = path.join(dataDir, 'sets');
  const psaFiles = [];

  // Function to recursively find all JSON files in sets directory
  const findJsonFiles = (dir) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findJsonFiles(fullPath);
      } else if (
        entry.endsWith('.json') &&
        !entry.includes('Zone.Identifier') &&
        !entry.includes('_all_sets.json') &&
        !entry.includes('_TEST.json')
      ) {
        psaFiles.push(fullPath);
      }
    }
  };

  findJsonFiles(setsDir);
  return psaFiles;
};

// Get all PSA files (both metadata and individual)
const getAllPsaFiles = () => [...getAllPsaMetadataFiles(), ...getAllPsaIndividualFiles()];

const getAllSealedProductFiles = () => {
  const dataDir = path.join(__dirname, '../../data');
  const sealedProductsDir = path.join(dataDir, 'SealedProducts');
  const sealedProductFiles = [];

  // Function to recursively find all JSON files in SealedProducts directory
  const findJsonFiles = (dir) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findJsonFiles(fullPath);
      } else if (entry.endsWith('.json') && !entry.includes('Zone.Identifier') && !entry.includes('progress')) {
        sealedProductFiles.push(fullPath);
      }
    }
  };

  findJsonFiles(sealedProductsDir);
  return sealedProductFiles;
};

module.exports = {
  getAllPsaFiles,
  getAllPsaMetadataFiles,
  getAllPsaIndividualFiles,
  getAllSealedProductFiles,
};
