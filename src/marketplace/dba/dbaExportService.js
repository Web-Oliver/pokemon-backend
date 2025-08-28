/**
 * DBA.dk Export Service
 *
 * Provides functionality to export Pokemon collection items as DBA.dk posts
 * Following SOLID principles and Danish market requirements
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import JSZip from 'jszip';
import { createPokemonNameShortener } from '@/pokemon/products/pokemonNameShortener.js';
/**
 * Configuration for DBA export
 */
const DBA_CONFIG = {
  maxTitleLength: 80,
  imageFolder: '/data/',
  outputFileName: 'dba-post.json',
  defaultDescriptionTemplate: {
    danish: {
      rare: 'Sjældent',
      card: 'kort',
      mint: 'mint condition',
      standardText: 'Kan afhentes i København eller sendes med GLS, Jeg er ikke interesseret i at bytte.',
      collection: 'samling',
      from: 'fra',
      different: 'forskellige',
      sets: 'sæt'
    }
  },
  conditionTranslations: {
    'Mint': 'Mint',
    'Near Mint': 'Near Mint',
    'Light Play': 'Light Play',
    'Moderate Play': 'Moderate Play',
    'Heavy Play': 'Heavy Play',
    'Damaged': 'Damaged',
    'Poor': 'Poor'
  }
};

import OperationManager from '@/system/utilities/OperationManager.js';
import StandardResponseBuilder from '@/system/utilities/StandardResponseBuilder.js';

class DbaExportService {
  constructor() {
    this.config = DBA_CONFIG;
    // Create name shortener without "Pokémon Kort" prefix to avoid duplication
    this.nameShortener = createPokemonNameShortener({
      addPokemonKortPrefix: false
    });
  }

  /**
   * Generate DBA post title with 80 character limit
   * Format: "Pokémon Kort [SetName] [PokemonName] [PokemonNumber] PSA [Grade]"
   *
   * @param {Object} item - Collection item (PSA/Raw/Sealed)
   * @param {string} itemType - 'psa', 'raw', or 'sealed'
   * @returns {string} - Formatted title (max 80 chars)
   */
  generateTitle(item, itemType) {
    try {
      // Get set name (shortened if needed)
      const setName = item.cardId?.setId?.setName || item.setName || '';
      const shortenedSet = this.nameShortener.shortenSetName(setName).shortenedName || setName;

      // Build title parts
      const parts = ['Pokemon Kort'];

      if (shortenedSet) {
        parts.push(shortenedSet);
      }

      // Handle different item types
      if (itemType === 'sealed') {
        // For sealed products: use the product name directly
        const productName = item.name || item.productId?.productName || '';

        if (productName) {
          // Clean the product name (remove Pokemon prefix to avoid duplication)
          const cleanProductName = productName
            .replace(/^pokemon\s+/gi, '')
            .replace(/^pokémon\s+/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (cleanProductName) {
            parts.push(cleanProductName);
          }
        } else if (item.category) {
          parts.push(item.category);
        }
        parts.push('Sealed');
      } else {
        // For cards: handle card name and pokemon number
        const cardName = item.cardId?.cardName || item.cardName || item.name || '';
        const cardNumber = item.cardId?.cardNumber || '';

        if (cardName) {
          // Remove technical formatting from card name and clean up text
          const cleanCardName = cardName
            .replace(/-/g, ' ')
            .replace(/\(#\d+\)$/, '')
            .replace(/1st Edition/gi, '1 Ed')
            .replace(/\bholo\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          parts.push(cleanCardName);
        }

        if (cardNumber) {
          parts.push(cardNumber);
        }

        // Add card-specific suffix
        if (itemType === 'psa' && item.grade) {
          parts.push(`PSA ${item.grade}`);
        } else if (itemType === 'raw' && item.condition) {
          parts.push(this.config.conditionTranslations[item.condition] || item.condition);
        }
      }

      // Join parts and ensure max length
      let fullTitle = parts.join(' ');

      if (fullTitle.length > this.config.maxTitleLength) {
        // Truncate smartly - keep most important parts
        const baseTitle = `Pokemon Kort ${shortenedSet} `;
        const remaining = this.config.maxTitleLength - baseTitle.length - 10; // Reserve space for suffix
        const cardName = item.cardId?.cardName || item.cardName || item.name || '';
        const cardPart = `${cardName.substring(0, remaining)}...`;
        let suffix = '';

        if (itemType === 'psa' && item.grade) {
          suffix = ` PSA ${item.grade}`;
        } else if (itemType === 'raw' && item.condition) {
          suffix = ` ${item.condition}`;
        }

        fullTitle = baseTitle + cardPart + suffix;

        // Final length check
        if (fullTitle.length > this.config.maxTitleLength) {
          fullTitle = `${fullTitle.substring(0, this.config.maxTitleLength - 3)}...`;
        }
      }

      return fullTitle;

    } catch (error) {
      console.error('[DBA EXPORT] Error generating title:', error);
      return 'Pokemon Kort Pokemon Card'; // Fallback
    }
  }

  /**
   * Generate default description for an item
   *
   * @param {Object} item - Collection item
   * @param {string} itemType - Item type
   * @param {string} customPrefix - Custom description prefix
   * @returns {string} - Generated description
   */
  generateDescription(item, itemType, customPrefix = '') {
    try {
      let description = customPrefix ? `${customPrefix} ` : '';

      // Add full item details
      const setName = item.cardId?.setId?.setName || item.setName || '';
      const cardName = item.cardId?.cardName || item.cardName || item.name || '';

      // Clean up card name - remove dashes, fix "1st Edition", and remove "holo"
      const cleanCardName = cardName.replace(/-/g, ' ').replace(/1st Edition/gi, '1 Ed').replace(/\bholo\b/gi, '').replace(/\s+/g, ' ').trim();
      const cleanSetName = setName.replace(/-/g, ' ').replace(/1st Edition/gi, '1 Ed');

      if (cleanSetName && cleanCardName) {
        description += `${cleanSetName} ${cleanCardName}`;
      } else if (cleanCardName) {
        description += cleanCardName;
      }

      // Add condition/grade info
      if (itemType === 'psa' && item.grade) {
        description += ` PSA ${item.grade}`;
      } else if (itemType === 'raw' && item.condition) {
        description += ` (${this.config.conditionTranslations[item.condition] || item.condition})`;
      }
      // For sealed products, don't add anything extra - just the name and standard text

      // Add standard Danish text
      description += `. ${this.config.defaultDescriptionTemplate.danish.standardText}`;

      return description.trim();

    } catch (error) {
      console.error('[DBA EXPORT] Error generating description:', error);
      return `Pokemon kort. ${this.config.defaultDescriptionTemplate.danish.standardText}`;
    }
  }

  /**
   * Process collection items into DBA post format
   *
   * @param {Array} items - Array of collection items with type info
   * @param {string} customDescription - Optional custom description prefix
   * @returns {Array} - Array of DBA post objects
   */
  processItemsForDba(items, customDescription = '') {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No valid items provided for DBA export');
    }

    return items.map((itemData, index) => {
      const { item, itemType, customTitle, customDescription: itemCustomDescription } = itemData;

      try {
        // Use custom title if provided, otherwise generate default
        const title = customTitle || this.generateTitle(item, itemType);

        // Use custom description if provided, otherwise generate default
        const description = itemCustomDescription || this.generateDescription(item, itemType, customDescription);

        // Process images - convert from /uploads/ paths to data/ folder
        const imagePaths = (item.images || []).map(imagePath => {
          const filename = path.basename(imagePath);

          return `${this.config.imageFolder}${filename}`;
        });

        // Get price
        const price = item.myPrice ? parseFloat(item.myPrice.toString()) : 0;

        return {
          id: item._id || item.id,
          title,
          description,
          price: Math.round(price), // DBA expects integer prices
          imagePaths,
          originalImagePaths: item.images || [], // Keep original paths for copying
          itemType,
          metadata: {
            cardName: item.cardId?.cardName || item.cardName || item.name,
            setName: item.cardId?.setId?.setName || item.setName,
            grade: item.grade,
            condition: item.condition,
            category: item.category,
            cardNumber: item.cardId?.cardNumber
          }
        };

      } catch (error) {
        console.error(`[DBA EXPORT] Error processing item ${index}:`, error);
        throw new Error(`Failed to process item ${index}: ${error.message}`);
      }
    });
  }

  /**
   * Copy images to data folder structure
   *
   * @param {Array} dbaItems - Processed DBA items
   * @param {string} uploadsPath - Path to uploads folder (default: './uploads')
   * @returns {Promise<string>} - Path to created data folder
   */
  async copyImagesToDataFolder(dbaItems, uploadsPath = './uploads') {
    const dataFolder = path.join(process.cwd(), 'data');

    try {
      // Create data folder if it doesn't exist
      if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
      }

      // Copy all images
      for (const item of dbaItems) {
        for (const originalPath of item.originalImagePaths) {
          try {
            // Clean up the image path - handle cases where path might have duplicated segments
            let cleanPath = originalPath;

            // Remove duplicated /api/images/ segments
            cleanPath = cleanPath.replace(/(\/api\/images)+/g, '/api/images');

            // Convert API path to file system path
            if (cleanPath.startsWith('/api/images/uploads/')) {
              cleanPath = cleanPath.replace('/api/images/uploads/', '');
            } else if (cleanPath.startsWith('/api/images/')) {
              cleanPath = cleanPath.replace('/api/images/', '');
            } else if (cleanPath.startsWith('/uploads/')) {
              cleanPath = cleanPath.replace('/uploads/', '');
            }

            // Remove leading slashes
            cleanPath = cleanPath.replace(/^\/+/, '');

            // Images are stored in uploads/collection/
            const sourcePath = path.join(uploadsPath, 'collection', cleanPath);
            const filename = path.basename(cleanPath);
            const destPath = path.join(dataFolder, filename);

            if (fs.existsSync(sourcePath)) {
              fs.copyFileSync(sourcePath, destPath);
              console.log(`[DBA EXPORT] Copied image: ${filename}`);
            } else {
              console.warn(`[DBA EXPORT] Image not found: ${sourcePath}`);
            }

          } catch (error) {
            console.error(`[DBA EXPORT] Error copying image ${originalPath}:`, error);
          }
        }
      }

      return dataFolder;

    } catch (error) {
      console.error('[DBA EXPORT] Error setting up data folder:', error);
      throw new Error(`Failed to create data folder: ${error.message}`);
    }
  }

  /**
   * Generate the final DBA export package
   *
   * @param {Array} items - Collection items with type info
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - Export result with file paths
   */
  async generateDbaExport(items, options = {}) {
    const { customDescription = '', includeMetadata = true } = options;
    const context = OperationManager.createContext('DbaExport', 'generateDbaExport', {
      itemCount: items.length,
      includeMetadata
    });

    return OperationManager.executeOperation(context, async () => {
      // Process items into DBA format
      const dbaItems = this.processItemsForDba(items, customDescription);

      // Copy images to data folder
      const dataFolder = await this.copyImagesToDataFolder(dbaItems, './uploads');

      // Create the JSON structure (clean for DBA)
      const dbaPostData = dbaItems.map(item => ({
        title: item.title,
        description: item.description,
        price: item.price,
        imagePaths: item.imagePaths,
        ...(includeMetadata && { metadata: item.metadata })
      }));

      // Create metadata file with selected image filenames for ZIP creation
      const selectedImageFiles = [];

      dbaItems.forEach(item => {
        item.originalImagePaths.forEach(imagePath => {
          const filename = path.basename(imagePath);
          if (!selectedImageFiles.includes(filename)) {
            selectedImageFiles.push(filename);
          }
        });
      });

      const metadataFile = {
        selectedImageFiles,
        exportDate: new Date().toISOString(),
        itemCount: dbaItems.length
      };

      // Write JSON file
      const jsonFilePath = path.join(dataFolder, this.config.outputFileName);
      fs.writeFileSync(jsonFilePath, JSON.stringify(dbaPostData, null, 2), 'utf8');

      // Write metadata file for ZIP creation
      const metadataFilePath = path.join(dataFolder, 'export-metadata.json');
      fs.writeFileSync(metadataFilePath, JSON.stringify(metadataFile, null, 2), 'utf8');

      return StandardResponseBuilder.exportOperation({
        itemCount: items.length,
        jsonFilePath,
        dataFolder,
        items: dbaPostData,
        dbaItems // Include original processed items with image paths
      }, 'dba', {
        exportedFiles: [jsonFilePath, metadataFilePath],
        imageCount: selectedImageFiles.length
      }).data;
    });
  }

  /**
   * Create ZIP file containing only the selected items' images and JSON
   *
   * @param {string} dataFolder - Path to data folder
   * @returns {Promise<Buffer>} - ZIP file buffer
   */
  async createDbaZip(dataFolder) {
    const zip = new JSZip();

    try {
      // Add JSON file
      const jsonPath = path.join(dataFolder, this.config.outputFileName);

      if (fs.existsSync(jsonPath)) {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');

        zip.file(this.config.outputFileName, jsonContent);
      }

      // Read metadata to get selected image files
      const metadataPath = path.join(dataFolder, 'export-metadata.json');
      let selectedImageFiles = [];

      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        const metadata = JSON.parse(metadataContent);

        selectedImageFiles = metadata.selectedImageFiles || [];
        console.log(`[DBA EXPORT] Found metadata with ${selectedImageFiles.length} selected images`);
      } else {
        console.warn('[DBA EXPORT] No metadata file found, cannot determine selected images');
        throw new Error('Export metadata not found. Please regenerate the DBA export.');
      }

      // Add only the images from selected items
      for (const filename of selectedImageFiles) {
        const filePath = path.join(dataFolder, filename);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const fileContent = fs.readFileSync(filePath);

          zip.file(`data/${filename}`, fileContent);
          console.log(`[DBA EXPORT] Added selected image to ZIP: ${filename}`);
        } else {
          console.warn(`[DBA EXPORT] Selected image not found: ${filePath}`);
        }
      }

      // Generate ZIP
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      console.log(`[DBA EXPORT] ZIP file created with ${selectedImageFiles.length} selected images`);
      return zipBuffer;

    } catch (error) {
      console.error('[DBA EXPORT] Error creating ZIP:', error);
      throw new Error(`Failed to create ZIP file: ${error.message}`);
    }
  }
}

export {
  DbaExportService,
  DBA_CONFIG
};
export default DbaExportService; ;
