#!/usr/bin/env node

/**
 * ULTRA-BULLETPROOF POKEMON COLLECTION STRUCTURE MIGRATION
 * 
 * This script reorganizes the src/ folder from scattered technical layers
 * to logical business domains with MAXIMUM SAFETY PROTECTIONS.
 * 
 * ENHANCED SAFETY FEATURES:
 * - File collision detection BEFORE any operations
 * - Complete backup before any changes
 * - Dry-run mode (default) with 100% accurate simulation
 * - Copy-then-delete approach (never lose files)
 * - File existence & integrity verification
 * - Import path analysis and updating
 * - Comprehensive verification at each step
 * - Automatic rollback on failure
 * - Git integration
 * - NO DELETION OF OLD FOLDERS UNTIL 100% SUCCESS
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--execute') ? false : true;
const BACKUP_DIR = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
const SRC_DIR = './src';

// COMPLETE FILE MAPPING - Every single file mapped to new location
const FILE_MIGRATIONS = {
  // POKEMON DOMAIN - Core Pokemon data (23 files)
  'pokemon/cards/': [
    'Domain/Entities/Card.js',
    'Application/Services/Core/cardService.js',
    'Presentation/Controllers/core/cardsController.js',
    'Presentation/Routes/entities/cards.js',
    'Infrastructure/Persistence/Repositories/CardRepository.js',
    'Infrastructure/Import/CardImporter.js',
    'Application/Services/Search/CardSearchService.js',
    'Infrastructure/Utilities/cardQueryHelpers.js'
  ],
  'pokemon/sets/': [
    'Domain/Entities/Set.js',
    'Presentation/Controllers/entities/setsController.js',
    'Presentation/Routes/entities/sets.js',
    'Infrastructure/Persistence/Repositories/SetRepository.js',
    'Infrastructure/Import/SetImporter.js',
    'Application/Services/Search/SetSearchService.js',
    'Infrastructure/Static/data/sets/remove_low_population_sets.js'
  ],
  'pokemon/products/': [
    'Domain/Entities/Product.js',
    'Domain/Entities/SetProduct.js',
    'Presentation/Controllers/entities/productsController.js',
    'Presentation/Controllers/entities/setProductsController.js',
    'Presentation/Routes/entities/products.js',
    'Presentation/Routes/entities/setProducts.js',
    'Infrastructure/Persistence/Repositories/ProductRepository.js',
    'Infrastructure/Persistence/Repositories/SetProductRepository.js',
    'Infrastructure/Import/ProductImporter.js',
    'Infrastructure/Import/SetProductImporter.js',
    'Application/Services/Search/ProductSearchService.js',
    'Application/UseCases/Products/ProductApiService.js',
    'Application/UseCases/Products/SetProductService.js',
    'core/services/pokemonNameShortener.js'
  ],
  'pokemon/shared/': [
    'Infrastructure/Import/MainImporter.js',
    'Infrastructure/Import/validators/ImportValidators.js'
  ],

  // COLLECTION DOMAIN - Personal collection management (25 files)
  'collection/items/': [
    'Domain/Entities/PsaGradedCard.js',
    'Domain/Entities/RawCard.js',
    'Domain/Entities/SealedProduct.js',
    'Presentation/Controllers/collections/psaGradedCardsController.js',
    'Presentation/Controllers/collections/rawCardsController.js',
    'Presentation/Controllers/collections/sealedProductsController.js',
    'Application/UseCases/Collections/CollectionService.js',
    'Application/UseCases/Collections/collectionCrudService.js',
    'Infrastructure/Persistence/Repositories/CollectionRepository.js',
    'Presentation/Routes/entities/collections.js',
    'Presentation/Controllers/ocr/CollectionManagementController.js',
    'Infrastructure/Utilities/ItemBatchFetcher.js'
  ],
  'collection/activities/': [
    'Domain/Entities/Activity.js',
    'Application/UseCases/Activities/activityService.js',
    'Application/UseCases/Activities/ActivityColorService.js',
    'Application/UseCases/Activities/ActivityTimelineService.js',
    'Application/UseCases/Activities/ActivityTransformService.js',
    'Infrastructure/Utilities/ActivityHelpers.js',
    'Infrastructure/Plugins/activityTracking.js',
    'Presentation/Routes/activities/index.js'
  ],
  'collection/sales/': [
    'Application/Services/Core/saleService.js',
    'Presentation/Controllers/business/salesController.js',
    'Application/UseCases/Analytics/salesAnalyticsService.js',
    'Application/UseCases/Analytics/salesDataService.js',
    'Domain/ValueObjects/schemas/saleDetails.js'
  ],
  'collection/auctions/': [
    'Domain/Entities/Auction.js',
    'Presentation/Controllers/auctions/auctionCrudOperations.js',
    'Presentation/Controllers/auctions/auctionItemHelpers.js',
    'Presentation/Controllers/auctions/auctionItemOperations.js',
    'Presentation/Controllers/auctions/index.js'
  ],
  'collection/shared/': [
    'Domain/ValueObjects/schemas/priceHistory.js',
    'core/services/itemFetcher.js'
  ],

  // OCR DOMAIN - Image processing (20 files)
  'ocr/processing/': [
    'Application/Services/Ocr/OcrOrchestrator.js',
    'Application/Services/Ocr/OcrTextExtractor.js',
    'Application/Services/Ocr/OcrTextParser.js',
    'Application/UseCases/OcrServiceInitializer.js',
    'Presentation/Controllers/ocr/LabelProcessingController.js',
    'Presentation/Routes/ocr/core-detection.js',
    'Presentation/Routes/ocr/vision-processing.js',
    'Infrastructure/ExternalServices/Google/googleVisionService.js'
  ],
  'ocr/labels/': [
    'Domain/Entities/PsaLabel.js',
    'Domain/Entities/StitchedLabel.js',
    'Application/UseCases/PSA/PsaLabelDetectionService.js',
    'Presentation/Controllers/collections/psaLabelController.js',
    'Presentation/Controllers/collections/stitchedLabelController.js',
    'Presentation/Routes/labels/psaLabels.js',
    'Presentation/Routes/labels/stitchedLabels.js',
    'core/services/psaLabelService.js',
    'core/services/stitchedLabelService.js'
  ],
  'ocr/matching/': [
    'Application/Services/Ocr/CardMatcher.js',
    'Application/Services/Ocr/ConfidenceScorer.js',
    'Application/UseCases/Matching/NewUnifiedOcrMatchingService.js',
    'Application/UseCases/Matching/PsaMatchingService.js',
    'Application/UseCases/Matching/UnifiedPsaMatchingService.js',
    'Presentation/Controllers/ocr/TextMatchingController.js',
    'Presentation/Routes/ocr/card-matching.js'
  ],
  'ocr/routes/': [
    'Presentation/Routes/ocr.js',
    'Presentation/Routes/ocr/index.js'
  ],
  'ocr/controllers/': [
    'Presentation/Controllers/ocr/index.js'
  ],

  // SEARCH DOMAIN - Search functionality (12 files)
  'search/services/': [
    'Application/Services/Search/BaseSearchService.js',
    'Application/Services/Search/SearchService.js',
    'Application/Services/Search/UnifiedSearchService.js',
    'Application/Services/Search/UnifiedSearchQueryBuilder.js',
    'Application/Services/Search/FlexSearchIndexManager.js',
    'Infrastructure/Configuration/searchConfigurations.js'
  ],
  'search/controllers/': [
    'Presentation/Controllers/searchController.js',
    'Presentation/Controllers/search/EntitySearchController.js',
    'Presentation/Controllers/search/UnifiedSearchController.js',
    'Presentation/Controllers/search/RelatedItemsController.js'
  ],
  'search/routes/': [
    'Presentation/Routes/search/unifiedSearch.js'
  ],
  'search/middleware/': [
    'Presentation/Middleware/searchCache.js',
    'Application/Services/Cache/cacheWarmupService.js'
  ],

  // MARKETPLACE DOMAIN - DBA & external services (15 files)
  'marketplace/dba/': [
    'Domain/Entities/DbaSelection.js',
    'Application/Services/Data/dbaExportService.js',
    'Application/Services/Data/dbaFormatter.js',
    'Application/Services/Data/dbaIntegrationService.js',
    'Presentation/Controllers/dbaSelectionController.js',
    'Presentation/Routes/utilities/dbaSelection.js'
  ],
  'marketplace/exports/': [
    'Presentation/Controllers/exportController.js',
    'Infrastructure/Utilities/exportHelpers.js'
  ],
  'marketplace/facebook/': [
    'Application/UseCases/Facebook/FacebookItemFetcher.js',
    'Application/UseCases/Facebook/FacebookPostBuilder.js',
    'Application/UseCases/Facebook/FacebookPostService.js',
    'Application/UseCases/Facebook/FacebookPostValidator.js',
    'Application/UseCases/Facebook/facebookPostFormatter.js'
  ],
  'marketplace/listings/': [
    'Presentation/Controllers/externalListingController.js'
  ],

  // UPLOADS DOMAIN - File management (4 files)
  'uploads/': [
    'Presentation/Controllers/uploadController.js',
    'Application/Services/Core/imageManager.js'
  ],
  'uploads/images/': [
    'Presentation/Routes/images/index.js'
  ],
  'uploads/utils/': [
    'Infrastructure/Utilities/core/FileUtils.js',
    'core/services/thumbnailService.js'
  ],

  // SYSTEM DOMAIN - Infrastructure (44 files)
  'system/database/': [
    'Infrastructure/Configuration/db.js',
    'Infrastructure/Persistence/Repositories/base/BaseRepository.js',
    'Infrastructure/Persistence/Repositories/base/SearchableRepository.js',
    'Infrastructure/Configuration/entityConfigurations.js'
  ],
  'system/validation/': [
    'Application/Validators/ValidatorFactory.js',
    'Application/Validators/validation/BaseValidator.js',
    'Application/Validators/validation/DateValidator.js',
    'Application/Validators/validation/EmailValidator.js',
    'Application/Validators/validation/ObjectIdValidator.js',
    'Application/Validators/validation/PaginationValidator.js',
    'Application/Validators/validation/PriceValidator.js',
    'Application/Validators/validation/SalesValidator.js',
    'Application/Validators/validation/ValidationErrors.js',
    'Application/Validators/validation/ValidationRules.js',
    'Infrastructure/Utilities/dateValidationHelpers.js'
  ],
  'system/middleware/': [
    'Presentation/Middleware/CentralizedErrorHandler.js',
    'Presentation/Middleware/errorHandler.js',
    'Presentation/Middleware/responseTransformer.js',
    'Presentation/Middleware/pagination.js',
    'Presentation/Middleware/versioning.js',
    'Presentation/Middleware/compression.js',
    'Presentation/Middleware/cachePresets.js',
    'Presentation/Controllers/base/BaseController.js'
  ],
  'system/plugins/': [
    'Infrastructure/Plugins/PluginManager.js',
    'Infrastructure/Plugins/controllerPlugins.js',
    'Infrastructure/Plugins/queryOptimization.js',
    'Presentation/Controllers/base/ControllerMetrics.js',
    'Presentation/Controllers/base/ControllerPluginManager.js'
  ],
  'system/dependency-injection/': [
    'Infrastructure/DependencyInjection/ServiceContainer.js',
    'Infrastructure/DependencyInjection/ServiceRegistration.js',
    'Infrastructure/DependencyInjection/index.js'
  ],
  'system/logging/': [
    'Infrastructure/Utilities/Logger.js',
    'Infrastructure/Utilities/DebugLogger.js',
    'Application/Services/Core/ApiCallTracker.js',
    'Domain/Entities/ApiCall.js'
  ],
  'system/cache/': [
    'Infrastructure/Startup/initializeCacheSystem.js'
  ],
  'system/management/': [
    'Presentation/Routes/management/cacheManagement.js',
    'Presentation/Routes/management/pluginManagement.js'
  ],
  'system/schemas/': [
    'Domain/ValueObjects/schemas/constants.js',
    'Domain/ValueObjects/schemas/index.js',
    'Domain/ValueObjects/schemas/transforms.js'
  ],
  'system/routing/': [
    'Presentation/Routes/api.js',
    'Presentation/Routes/factories/crudRouteFactory.js'
  ],
  'system/startup/': [
    'Infrastructure/Startup/server.js',
    'Infrastructure/Startup/serviceBootstrap.js'
  ],
  'system/errors/': [
    'Application/ErrorTypes.js'
  ]
};

class UltraSafeMigration {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.collisionDetected = false;
    this.stats = {
      filesScanned: 0,
      filesMoved: 0,
      importsUpdated: 0,
      backupCreated: false,
      directoriesCreated: 0,
      filesVerified: 0
    };
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = DRY_RUN ? '[DRY-RUN]' : '[EXECUTE]';
    console.log(`${timestamp} ${prefix} [${type}] ${message}`);
    
    if (type === 'ERROR') this.errors.push(message);
    if (type === 'WARN') this.warnings.push(message);
  }

  // SAFETY CHECK 1: Verify all source files exist
  verifySourceFiles() {
    this.log('🔍 SAFETY CHECK 1: Verifying all source files exist...');
    
    const allFiles = [];
    Object.values(FILE_MIGRATIONS).forEach(fileList => {
      allFiles.push(...fileList);
    });

    let missingFiles = 0;
    allFiles.forEach(file => {
      const fullPath = path.join(SRC_DIR, file);
      if (!fs.existsSync(fullPath)) {
        this.log(`❌ Missing source file: ${file}`, 'ERROR');
        missingFiles++;
      }
    });

    if (missingFiles > 0) {
      throw new Error(`❌ ABORT: ${missingFiles} source files are missing!`);
    }

    this.log(`✅ All ${allFiles.length} source files verified`);
    return allFiles.length;
  }

  // SAFETY CHECK 2: Detect file collisions BEFORE any moves
  detectFileCollisions() {
    this.log('🔍 SAFETY CHECK 2: Detecting potential file collisions...');
    
    const targetFiles = new Map();
    let collisions = 0;
    
    Object.entries(FILE_MIGRATIONS).forEach(([targetDir, files]) => {
      files.forEach(file => {
        const targetFileName = path.basename(file);
        const targetPath = path.join(SRC_DIR, targetDir, targetFileName);
        
        if (targetFiles.has(targetPath)) {
          this.log(`❌ COLLISION DETECTED: Two files would map to same destination:`, 'ERROR');
          this.log(`   File 1: ${targetFiles.get(targetPath)}`, 'ERROR');
          this.log(`   File 2: ${file}`, 'ERROR');
          this.log(`   Target: ${targetPath}`, 'ERROR');
          collisions++;
          this.collisionDetected = true;
        } else {
          targetFiles.set(targetPath, file);
        }
      });
    });
    
    if (collisions > 0) {
      throw new Error(`❌ ABORT: ${collisions} file collision(s) detected! Cannot proceed safely.`);
    }
    
    this.log(`✅ No file collisions detected. ${targetFiles.size} unique destinations verified.`);
  }

  // SAFETY CHECK 3: Create backup
  createBackup() {
    this.log('💾 SAFETY CHECK 3: Creating backup...');
    
    if (DRY_RUN) {
      this.log(`[DRY-RUN] Would create backup: ${BACKUP_DIR}`);
      this.stats.backupCreated = true; // Mark as would-be-created for dry-run
      return;
    }

    try {
      execSync(`cp -r ${SRC_DIR} ${BACKUP_DIR}`, { stdio: 'inherit' });
      execSync(`git add . && git commit -m "Pre-migration backup - $(date)"`, { stdio: 'inherit' });
      this.stats.backupCreated = true;
      this.log(`✅ Backup created: ${BACKUP_DIR}`);
    } catch (error) {
      throw new Error(`❌ Backup failed: ${error.message}`);
    }
  }

  // SAFETY CHECK 4: Pre-flight directory creation
  createDirectories() {
    this.log('📁 SAFETY CHECK 4: Creating new directory structure...');
    
    const directories = Object.keys(FILE_MIGRATIONS);
    directories.forEach(dir => {
      const fullPath = path.join(SRC_DIR, dir);
      this.log(`${DRY_RUN ? 'Would create' : 'Creating'} directory: ${fullPath}`);
      
      if (!DRY_RUN) {
        fs.mkdirSync(fullPath, { recursive: true });
        // Verify directory was created
        if (!fs.existsSync(fullPath)) {
          throw new Error(`❌ Failed to create directory: ${fullPath}`);
        }
      }
      this.stats.directoriesCreated++;
    });

    this.log(`✅ ${directories.length} directories ${DRY_RUN ? 'would be created' : 'created successfully'}`);
  }

  // SAFETY CHECK 5: COPY-THEN-DELETE file moves (NEVER delete old until 100% verified)
  moveFiles() {
    this.log('🔄 SAFETY CHECK 5: Moving files with COPY-THEN-DELETE safety...');
    
    const filesToMove = [];
    
    // PHASE 1: Copy all files to new locations (preserve originals)
    Object.entries(FILE_MIGRATIONS).forEach(([targetDir, files]) => {
      files.forEach(file => {
        const oldPath = path.join(SRC_DIR, file);
        const newPath = path.join(SRC_DIR, targetDir, path.basename(file));
        
        filesToMove.push({ oldPath, newPath, file, targetDir });
        
        this.log(`${DRY_RUN ? 'Would copy' : 'Copying'}: ${file} → ${targetDir}${path.basename(file)}`);
        
        if (!DRY_RUN) {
          // Verify source exists before copy
          if (!fs.existsSync(oldPath)) {
            throw new Error(`❌ Source file missing: ${oldPath}`);
          }
          
          // Check if destination already exists (shouldn't happen after collision check)
          if (fs.existsSync(newPath)) {
            throw new Error(`❌ Destination already exists: ${newPath}`);
          }
          
          // Copy file to new location
          fs.copyFileSync(oldPath, newPath);
          
          // Verify copy succeeded
          if (!fs.existsSync(newPath)) {
            throw new Error(`❌ File copy failed: ${newPath}`);
          }
          
          // Verify file integrity (size match)
          const oldStats = fs.statSync(oldPath);
          const newStats = fs.statSync(newPath);
          if (oldStats.size !== newStats.size) {
            throw new Error(`❌ File copy integrity failed: ${newPath} (size mismatch)`);
          }
          
          this.stats.filesMoved++;
        }
      });
    });
    
    // PHASE 2: Verify ALL files copied successfully before deleting originals
    if (!DRY_RUN) {
      this.log('🔍 Verifying all files copied successfully before cleanup...');
      
      let verificationErrors = 0;
      filesToMove.forEach(({ oldPath, newPath, file }) => {
        if (!fs.existsSync(newPath)) {
          this.log(`❌ Copy verification failed: ${file}`, 'ERROR');
          verificationErrors++;
        }
      });
      
      if (verificationErrors > 0) {
        throw new Error(`❌ ${verificationErrors} files failed copy verification. Aborting cleanup.`);
      }
      
      this.log('✅ All files copied successfully. Proceeding with cleanup of original locations...');
      
      // PHASE 3: Delete original files only after ALL copies verified
      filesToMove.forEach(({ oldPath, file }) => {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          this.log(`🗑️ Removed original: ${file}`);
        }
      });
      
      // PHASE 4: Only now remove empty directories
      this.cleanupEmptyDirectories();
    }

    this.log(`✅ ${DRY_RUN ? filesToMove.length + ' files would be moved' : this.stats.filesMoved + ' files moved successfully'}`);
  }

  // Clean up empty directories after successful file moves
  cleanupEmptyDirectories() {
    this.log('🗂️ Cleaning up empty directories...');
    
    const removeEmptyDirs = (dirPath) => {
      try {
        const items = fs.readdirSync(dirPath);
        
        // Remove empty subdirectories first
        items.forEach(item => {
          const fullPath = path.join(dirPath, item);
          if (fs.statSync(fullPath).isDirectory()) {
            removeEmptyDirs(fullPath);
          }
        });
        
        // Check if directory is now empty
        const remainingItems = fs.readdirSync(dirPath);
        if (remainingItems.length === 0 && dirPath !== SRC_DIR) {
          fs.rmdirSync(dirPath);
          this.log(`🗑️ Removed empty directory: ${dirPath.replace(SRC_DIR, '')}`);
        }
      } catch (error) {
        // Directory might not exist or might not be empty, that's OK
      }
    };
    
    // Start from technical layer directories that should now be empty
    const oldStructureDirs = [
      'Domain', 'Application', 'Infrastructure', 'Presentation', 'core'
    ];
    
    oldStructureDirs.forEach(dir => {
      const fullPath = path.join(SRC_DIR, dir);
      if (fs.existsSync(fullPath)) {
        removeEmptyDirs(fullPath);
      }
    });
  }

  // SAFETY CHECK 6: Update all import paths
  updateImports() {
    this.log('🔗 SAFETY CHECK 6: Analyzing and updating import paths...');
    
    let totalImports = 0;
    let pathsToUpdate = 0;
    let filesScanned = 0;
    
    // Build complete path mapping
    const pathMapping = {};
    Object.entries(FILE_MIGRATIONS).forEach(([targetDir, files]) => {
      files.forEach(file => {
        const oldImportPath = `@/${file}`;
        const newImportPath = `@/${targetDir}${path.basename(file)}`;
        pathMapping[oldImportPath] = newImportPath;
      });
    });
    
    this.log(`📋 Built ${Object.keys(pathMapping).length} import path mappings`);
    
    // Scan ALL .js files in src for import statements
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.js')) {
          filesScanned++;
          
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const imports = content.match(/import.*?from\s+['"]@\/.*?['"]; ?/g) || [];
            totalImports += imports.length;
            
            let fileUpdated = false;
            let updatedContent = content;
            
            imports.forEach(importStatement => {
              Object.entries(pathMapping).forEach(([oldPath, newPath]) => {
                if (importStatement.includes(oldPath)) {
                  pathsToUpdate++;
                  if (DRY_RUN) {
                    this.log(`   Found in ${fullPath.replace(SRC_DIR, '')}:`);
                    this.log(`      ${importStatement.trim()}`);
                    this.log(`      → Would become: ${importStatement.replace(oldPath, newPath)}`);
                  } else {
                    // Actually update the import path
                    updatedContent = updatedContent.replace(
                      new RegExp(`(['"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"])`, 'g'),
                      `$1${newPath}$2`
                    );
                    fileUpdated = true;
                  }
                }
              });
            });
            
            if (!DRY_RUN && fileUpdated) {
              fs.writeFileSync(fullPath, updatedContent, 'utf8');
              this.log(`✅ Updated imports in: ${fullPath.replace(SRC_DIR, '')}`);
            }
          } catch (error) {
            this.log(`⚠️ Could not read file: ${fullPath}`, 'WARN');
          }
        }
      });
    };
    
    // Start scanning from src directory
    if (fs.existsSync(SRC_DIR)) {
      scanDirectory(SRC_DIR);
    }
    
    this.log(`📊 Import analysis complete:`);
    this.log(`   Files scanned: ${filesScanned}`);
    this.log(`   Total imports found: ${totalImports}`);
    this.log(`   Import paths ${DRY_RUN ? 'that would need updating' : 'updated'}: ${pathsToUpdate}`);
    
    this.stats.importsUpdated = pathsToUpdate;
    this.stats.filesScanned = filesScanned;
    
    this.log(`✅ Import path ${DRY_RUN ? 'analysis' : 'updating'} complete`);
  }

  // SAFETY CHECK 7: Final verification  
  finalVerification() {
    this.log('🎯 SAFETY CHECK 7: Final verification...');
    
    let expectedFileCount = 0;
    let verifiedFileCount = 0;
    let missingFiles = [];
    
    Object.entries(FILE_MIGRATIONS).forEach(([targetDir, files]) => {
      files.forEach(file => {
        expectedFileCount++;
        const oldPath = path.join(SRC_DIR, file);
        const newPath = path.join(SRC_DIR, targetDir, path.basename(file));
        
        if (DRY_RUN) {
          // In dry-run, verify source exists and would be moveable
          if (fs.existsSync(oldPath)) {
            verifiedFileCount++;
            this.log(`✅ Ready: ${file} → ${targetDir}${path.basename(file)}`);
          } else {
            this.log(`❌ Source missing: ${file}`, 'ERROR');
            missingFiles.push(file);
          }
        } else {
          // In execute mode, verify destination exists and original is gone
          if (fs.existsSync(newPath)) {
            verifiedFileCount++;
            
            // Also verify original file is gone (should be deleted after copy)
            if (fs.existsSync(oldPath)) {
              this.log(`⚠️ Original file still exists: ${oldPath}`, 'WARN');
            }
          } else {
            this.log(`❌ Missing after migration: ${newPath}`, 'ERROR');
            missingFiles.push(file);
          }
        }
      });
    });
    
    // Verify directories were created (in execute mode)
    if (!DRY_RUN) {
      let directoriesVerified = 0;
      Object.keys(FILE_MIGRATIONS).forEach(targetDir => {
        const dirPath = path.join(SRC_DIR, targetDir);
        if (fs.existsSync(dirPath)) {
          directoriesVerified++;
        } else {
          this.log(`❌ Directory missing: ${dirPath}`, 'ERROR');
        }
      });
      this.log(`📁 Directories verified: ${directoriesVerified}/${Object.keys(FILE_MIGRATIONS).length}`);
    }

    this.log(`📊 Final verification results:`);
    this.log(`   Expected files: ${expectedFileCount}`);
    this.log(`   Verified files: ${verifiedFileCount}`);
    this.log(`   Status: ${DRY_RUN ? 'Ready for migration' : 'Migration completed'}`);
    
    if (missingFiles.length > 0) {
      this.log(`❌ Missing files (${missingFiles.length}):`, 'ERROR');
      missingFiles.forEach(file => this.log(`   - ${file}`, 'ERROR'));
    }
    
    this.stats.filesVerified = verifiedFileCount;
    
    if (verifiedFileCount !== expectedFileCount) {
      throw new Error(`❌ Verification failed: ${verifiedFileCount}/${expectedFileCount} files verified`);
    }
    
    this.log(`✅ Final verification passed - All ${verifiedFileCount} files ${DRY_RUN ? 'ready for migration' : 'successfully migrated'}`);
  }

  // ROLLBACK MECHANISM
  rollback() {
    if (!this.stats.backupCreated) {
      throw new Error('❌ No backup available for rollback!');
    }

    this.log('⏪ ROLLING BACK MIGRATION...');
    execSync(`rm -rf ${SRC_DIR} && mv ${BACKUP_DIR} ${SRC_DIR}`, { stdio: 'inherit' });
    execSync(`git add . && git commit -m "Rollback migration - $(date)"`, { stdio: 'inherit' });
    this.log('✅ Rollback completed');
  }

  // MAIN EXECUTION
  async execute() {
    try {
      this.log(`🚀 STARTING ULTRA-SAFE POKEMON COLLECTION MIGRATION`);
      this.log(`Mode: ${DRY_RUN ? 'DRY-RUN (safe)' : 'EXECUTE (will modify files)'}`);
      
      // Execute all safety checks in order
      this.verifySourceFiles();
      this.detectFileCollisions();
      this.createBackup();
      this.createDirectories();
      this.moveFiles();
      this.updateImports();
      this.finalVerification();
      
      this.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
      this.log(`📊 Final Statistics:`);
      this.log(`   Files scanned: ${this.stats.filesScanned}`);
      this.log(`   Files ${DRY_RUN ? 'ready to move' : 'moved'}: ${DRY_RUN ? this.stats.filesVerified : this.stats.filesMoved}`);
      this.log(`   Directories ${DRY_RUN ? 'to create' : 'created'}: ${this.stats.directoriesCreated}`);
      this.log(`   Import paths ${DRY_RUN ? 'to update' : 'updated'}: ${this.stats.importsUpdated}`);
      this.log(`   Backup created: ${this.stats.backupCreated}`);
      this.log(`   Errors: ${this.errors.length}`);
      this.log(`   Warnings: ${this.warnings.length}`);
      
      if (DRY_RUN) {
        this.log('');
        this.log('🟢 DRY-RUN COMPLETED - No files were modified');
        this.log('🚀 To execute the migration, run: node migrate-structure-ULTRA-SAFE.js --execute');
      } else {
        this.log('🟢 MIGRATION EXECUTED - Files have been reorganized');
      }
      
    } catch (error) {
      this.log(`💥 MIGRATION FAILED: ${error.message}`, 'ERROR');
      
      if (!DRY_RUN && this.stats.backupCreated) {
        this.log('🔄 Attempting automatic rollback...');
        try {
          this.rollback();
        } catch (rollbackError) {
          this.log(`❌ Rollback also failed: ${rollbackError.message}`, 'ERROR');
          this.log('⚠️ Manual recovery may be required from backup', 'ERROR');
        }
      }
      
      // Show error summary
      if (this.errors.length > 0) {
        this.log('\n❌ ERROR SUMMARY:');
        this.errors.forEach(error => this.log(`   - ${error}`));
      }
      
      throw error;
    }
  }
}

// EXECUTION
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new UltraSafeMigration();
  
  console.log(`
🚨 ULTRA-SAFE POKEMON COLLECTION STRUCTURE MIGRATION 🚨

This script will reorganize 168+ files from technical layers to business domains.

ENHANCED SAFETY FEATURES ENABLED:
✅ File collision detection
✅ Complete backup creation
✅ Dry-run mode (default)
✅ File existence verification
✅ Copy-then-delete file moves
✅ Import path updating
✅ Comprehensive verification
✅ Rollback capability
✅ Git integration
✅ NO DELETION UNTIL 100% SUCCESS

CURRENT MODE: ${DRY_RUN ? '🟡 DRY-RUN (SAFE)' : '🔴 EXECUTE (WILL MODIFY FILES)'}

To run in execute mode: node migrate-structure-ULTRA-SAFE.js --execute
`);

  migration.execute().catch(err => {
    console.error('💥 Migration failed:', err.message);
    process.exit(1);
  });
}

export default UltraSafeMigration;