# File-by-File Verification Mapping

## Purpose
This document verifies that every file in the old structure has been properly moved to the new Clean Architecture structure before safely deleting the old files.

## Verification Process Status
- ✅ **Step 1**: Catalog all old files
- 🔄 **Step 2**: Verify each file exists in new location
- ⏳ **Step 3**: Validate file contents match
- ⏳ **Step 4**: Generate verification report
- ⏳ **Step 5**: Safe deletion of verified files

## Old Files Found (95 total)

### Configuration Files (3)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/config/db.js` | `/src/Infrastructure/Configuration/db.js` | ⏳ |
| `/config/entityConfigurations.js` | `/src/Infrastructure/Configuration/entityConfigurations.js` | ⏳ |
| `/config/searchConfigurations.js` | `/src/Infrastructure/Configuration/searchConfigurations.js` | ⏳ |

### Controller Files (27)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/controllers/auctions/auctionCrudOperations.js` | `/src/Presentation/Controllers/auctionCrudOperations.js` | ⏳ |
| `/controllers/auctions/auctionItemHelpers.js` | `/src/Presentation/Controllers/auctionItemHelpers.js` | ⏳ |
| `/controllers/auctions/auctionItemOperations.js` | `/src/Presentation/Controllers/auctionItemOperations.js` | ⏳ |
| `/controllers/auctions/index.js` | `/src/Presentation/Controllers/auctionIndex.js` | ⏳ |
| `/controllers/backupController.js` | `/src/Presentation/Controllers/backupController.js` | ⏳ |
| `/controllers/base/BaseController.js` | `/src/Presentation/Controllers/BaseController.js` | ⏳ |
| `/controllers/cardsController.js` | `/src/Presentation/Controllers/cardsController.js` | ⏳ |
| `/controllers/dbaSelectionController.js` | `/src/Presentation/Controllers/dbaSelectionController.js` | ⏳ |
| `/controllers/exportController.js` | `/src/Presentation/Controllers/exportController.js` | ⏳ |
| `/controllers/externalListingController.js` | `/src/Presentation/Controllers/externalListingController.js` | ⏳ |
| `/controllers/factories/controllerFactory.js` | `/src/Presentation/Controllers/controllerFactory.js` | ⏳ |
| `/controllers/ocr/CollectionManagementController.js` | `/src/Presentation/Controllers/ocrCollectionManagementController.js` | ⏳ |
| `/controllers/ocr/LabelProcessingController.js` | `/src/Presentation/Controllers/ocrLabelProcessingController.js` | ⏳ |
| `/controllers/ocr/TextMatchingController.js` | `/src/Presentation/Controllers/ocrTextMatchingController.js` | ⏳ |
| `/controllers/ocr/index.js` | `/src/Presentation/Controllers/ocrIndex.js` | ⏳ |
| `/controllers/ocrMatchingController.js` | `/src/Presentation/Controllers/ocrMatchingController.js` | ⏳ |
| `/controllers/productsController.js` | `/src/Presentation/Controllers/productsController.js` | ⏳ |
| `/controllers/psaGradedCardsController.js` | `/src/Presentation/Controllers/psaGradedCardsController.js` | ⏳ |
| `/controllers/psaLabelController.js` | `/src/Presentation/Controllers/psaLabelController.js` | ⏳ |
| `/controllers/rawCardsController.js` | `/src/Presentation/Controllers/rawCardsController.js` | ⏳ |
| `/controllers/salesController.js` | `/src/Presentation/Controllers/salesController.js` | ⏳ |
| `/controllers/sealedProductsController.js` | `/src/Presentation/Controllers/sealedProductsController.js` | ⏳ |
| `/controllers/search/EntitySearchController.js` | `/src/Presentation/Controllers/EntitySearchController.js` | ⏳ |
| `/controllers/search/RelatedItemsController.js` | `/src/Presentation/Controllers/RelatedItemsController.js` | ⏳ |
| `/controllers/search/UnifiedSearchController.js` | `/src/Presentation/Controllers/UnifiedSearchController.js` | ⏳ |
| `/controllers/searchController.js` | `/src/Presentation/Controllers/searchController.js` | ⏳ |
| `/controllers/searchController.original.js` | `/src/Presentation/Controllers/searchControllerOriginal.js` | ⏳ |
| `/controllers/setProductsController.js` | `/src/Presentation/Controllers/setProductsController.js` | ⏳ |
| `/controllers/setsController.js` | `/src/Presentation/Controllers/setsController.js` | ⏳ |
| `/controllers/stitchedLabelController.js` | `/src/Presentation/Controllers/stitchedLabelController.js` | ⏳ |
| `/controllers/uploadController.js` | `/src/Presentation/Controllers/uploadController.js` | ⏳ |

### Middleware Files (10)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/middleware/CacheMiddlewareStandardizer.js` | `/src/Presentation/Middleware/CacheMiddlewareStandardizer.js` | ⏳ |
| `/middleware/CentralizedErrorHandler.js` | `/src/Presentation/Middleware/CentralizedErrorHandler.js` | ⏳ |
| `/middleware/cachePresets.js` | `/src/Presentation/Middleware/cachePresets.js` | ⏳ |
| `/middleware/commonValidation.js` | `/src/Presentation/Middleware/commonValidation.js` | ⏳ |
| `/middleware/compression.js` | `/src/Presentation/Middleware/compression.js` | ⏳ |
| `/middleware/errorHandler.js` | `/src/Presentation/Middleware/errorHandler.js` | ⏳ |
| `/middleware/pagination.js` | `/src/Presentation/Middleware/pagination.js` | ⏳ |
| `/middleware/responseTransformer.js` | `/src/Presentation/Middleware/responseTransformer.js` | ⏳ |
| `/middleware/routeCacheStandardizer.js` | `/src/Presentation/Middleware/routeCacheStandardizer.js` | ⏳ |
| `/middleware/searchCache.js` | `/src/Presentation/Middleware/searchCache.js` | ⏳ |
| `/middleware/versioning.js` | `/src/Presentation/Middleware/versioning.js` | ⏳ |

### Repository Files (7)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/repositories/CardRepository.js` | `/src/Infrastructure/Persistence/Repositories/CardRepository.js` | ⏳ |
| `/repositories/CollectionRepository.js` | `/src/Infrastructure/Persistence/Repositories/CollectionRepository.js` | ⏳ |
| `/repositories/ProductRepository.js` | `/src/Infrastructure/Persistence/Repositories/ProductRepository.js` | ⏳ |
| `/repositories/SetProductRepository.js` | `/src/Infrastructure/Persistence/Repositories/SetProductRepository.js` | ⏳ |
| `/repositories/SetRepository.js` | `/src/Infrastructure/Persistence/Repositories/SetRepository.js` | ⏳ |
| `/repositories/base/BaseRepository.js` | `/src/Infrastructure/Persistence/Repositories/BaseRepository.js` | ⏳ |
| `/repositories/base/SearchableRepository.js` | `/src/Infrastructure/Persistence/Repositories/SearchableRepository.js` | ⏳ |

### Route Files (18)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/routes/activityRoutes.js` | `/src/Presentation/Routes/activityRoutes.js` | ⏳ |
| `/routes/api.js` | `/src/Presentation/Routes/api.js` | ⏳ |
| `/routes/backup.js` | `/src/Presentation/Routes/backup.js` | ⏳ |
| `/routes/cacheManagement.js` | `/src/Presentation/Routes/cacheManagement.js` | ⏳ |
| `/routes/cards.js` | `/src/Presentation/Routes/cards.js` | ⏳ |
| `/routes/collections.js` | `/src/Presentation/Routes/collections.js` | ⏳ |
| `/routes/dbaSelection.js` | `/src/Presentation/Routes/dbaSelection.js` | ⏳ |
| `/routes/factories/crudRouteFactory.js` | `/src/Presentation/Routes/crudRouteFactory.js` | ⏳ |
| `/routes/images.js` | `/src/Presentation/Routes/images.js` | ⏳ |
| `/routes/ocr.js` | `/src/Presentation/Routes/ocr.js` | ⏳ |
| `/routes/ocr/card-matching.js` | `/src/Presentation/Routes/ocrCardMatching.js` | ⏳ |
| `/routes/ocr/core-detection.js` | `/src/Presentation/Routes/ocrCoreDetection.js` | ⏳ |
| `/routes/ocr/index.js` | `/src/Presentation/Routes/ocrRoutesIndex.js` | ⏳ |
| `/routes/ocr/vision-processing.js` | `/src/Presentation/Routes/ocrVisionProcessing.js` | ⏳ |
| `/routes/ocrMatching.js` | `/src/Presentation/Routes/ocrMatching.js` | ⏳ |
| `/routes/pluginManagement.js` | `/src/Presentation/Routes/pluginManagement.js` | ⏳ |
| `/routes/products.js` | `/src/Presentation/Routes/products.js` | ⏳ |
| `/routes/psaLabels.js` | `/src/Presentation/Routes/psaLabels.js` | ⏳ |
| `/routes/setProducts.js` | `/src/Presentation/Routes/setProducts.js` | ⏳ |
| `/routes/sets.js` | `/src/Presentation/Routes/sets.js` | ⏳ |
| `/routes/stitchedLabels.js` | `/src/Presentation/Routes/stitchedLabels.js` | ⏳ |
| `/routes/unifiedSearch.js` | `/src/Presentation/Routes/unifiedSearch.js` | ⏳ |

### Utility Files (14)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/utils/ActivityHelpers.js` | `/src/Infrastructure/Utilities/ActivityHelpers.js` | ⏳ |
| `/utils/ItemBatchFetcher.js` | `/src/Infrastructure/Utilities/ItemBatchFetcher.js` | ⏳ |
| `/utils/Logger.js` | `/src/Infrastructure/Utilities/Logger.js` | ⏳ |
| `/utils/addUniqueExpansionIds.js` | `/src/Infrastructure/Utilities/addUniqueExpansionIds.js` | ⏳ |
| `/utils/addUniqueProductIds.js` | `/src/Infrastructure/Utilities/addUniqueProductIds.js` | ⏳ |
| `/utils/cardQueryHelpers.js` | `/src/Infrastructure/Utilities/cardQueryHelpers.js` | ⏳ |
| `/utils/core/FileUtils.js` | `/src/Infrastructure/Utilities/FileUtils.js` | ⏳ |
| `/utils/core/ProgressReporter.js` | `/src/Infrastructure/Utilities/ProgressReporter.js` | ⏳ |
| `/utils/dataImporter.js` | `/src/Infrastructure/Utilities/dataImporter.js` | ⏳ |
| `/utils/errorHandler.js` | `/src/Infrastructure/Utilities/errorHandler.js` | ⏳ |
| `/utils/exportHelpers.js` | `/src/Infrastructure/Utilities/exportHelpers.js` | ⏳ |
| `/utils/fieldMapper.js` | `/src/Infrastructure/Utilities/fieldMapper.js` | ⏳ |
| `/utils/mapExpansionNames.js` | `/src/Infrastructure/Utilities/mapExpansionNames.js` | ⏳ |
| `/utils/nameShortener.js` | `/src/Infrastructure/Utilities/nameShortener.js` | ⏳ |

### Plugin Files (4)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/plugins/PluginManager.js` | `/src/Infrastructure/Plugins/PluginManager.js` | ⏳ |
| `/plugins/activityTracking.js` | `/src/Infrastructure/Plugins/activityTracking.js` | ⏳ |
| `/plugins/controllerPlugins.js` | `/src/Infrastructure/Plugins/controllerPlugins.js` | ⏳ |
| `/plugins/queryOptimization.js` | `/src/Infrastructure/Plugins/queryOptimization.js` | ⏳ |

### Presenter Files (1)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/presenters/ActivityPresenter.js` | `/src/Presentation/Presenters/ActivityPresenter.js` | ⏳ |

### Startup Files (1)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/startup/initializeCacheSystem.js` | `/src/Infrastructure/Startup/initializeCacheSystem.js` | ⏳ |

### Root Files (6)
| Old Path | New Path | Status |
|----------|----------|--------|
| `/server.js` | `/src/Infrastructure/Startup/server.js` | ⏳ |
| `/container/index.js` | `/src/Infrastructure/Configuration/container.js` | ⏳ |
| `/.prettierrc.js` | `/.prettierrc.js` | 🔄 Keep in root |
| `/eslint.config.js` | `/eslint.config.js` | 🔄 Keep in root |
| `/jest.config.js` | `/jest.config.js` | 🔄 Keep in root |

## Next Steps
1. ✅ Verify each file exists in new location
2. ⏳ Compare file contents to ensure integrity
3. ⏳ Update any import paths if necessary
4. ⏳ Safe deletion of old files after verification

## File Count Summary
- **Total Old Files**: 95
- **Config Files**: 3
- **Controllers**: 31
- **Middleware**: 10
- **Repositories**: 7
- **Routes**: 18
- **Utils**: 14
- **Plugins**: 4
- **Presenters**: 1
- **Startup**: 1
- **Root**: 6 (3 to keep, 3 to move)