# Frontend Files Todo List

## API Files ✅ COMPLETED - Backend Optimized & Over-engineering Removed
- [x] src/api/unifiedApiClient.ts - ✅ Verified optimal SOLID implementation
- [x] src/api/genericApiOperations.ts - ✅ DRY patterns verified, bulk operations cleaned
- [x] src/api/searchApi.ts - ✅ Pure TanStack Query, all endpoints verified
- [x] src/api/activityApi.ts - ✅ Backend endpoints verified and working
- [x] src/api/auctionsApi.ts - ✅ Backend routes verified with PUT compatibility
- [x] src/api/backupApi.ts - ✅ Backend backup endpoints verified
- [x] src/api/batchOperations.ts - ✅ Frontend utility, backend bulk routes removed
- [x] src/api/cardMarketRefProductsApi.ts - ✅ Reference data endpoints verified
- [x] src/api/cardsApi.ts - ✅ Enhanced routes removed, standard routes verified
- [x] src/api/collectionApi.ts - ✅ Collection routes properly mounted with prefixes
- [x] src/api/dbaSelectionApi.ts - ✅ DBA selection tracking endpoints verified
- [x] src/api/exportApi.ts - ✅ All export endpoints verified (ZIP, DBA, Facebook)
- [x] src/api/salesApi.ts - ✅ Sales analytics endpoints verified
- [x] src/api/setsApi.ts - ✅ Sets reference data endpoints verified
- [x] src/api/uploadApi.ts - ✅ File upload endpoints verified
- [x] src/api/cardMarket/cardMarketApi.ts - ✅ CardMarket API endpoints verified

## Caching Files
- [x] src/config/cacheConfig.ts
- [x] src/utils/imageCache.ts
- [x] src/utils/apiOptimization.ts
- [x] src/utils/cacheDebug.ts

## Search Files
- [x] src/hooks/useOptimizedSearch.ts
- [x] src/hooks/useSearch.ts
- [x] src/hooks/useAutocomplete.ts
- [x] src/components/search/AutocompleteField.tsx
- [x] src/components/search/SearchDropdown.tsx
- [x] src/components/search/LazySearchDropdown.tsx
- [x] src/components/common/OptimizedAutocomplete.tsx
- [x] src/utils/searchHelpers.ts
- [x] src/utils/searchHelpers.optimized.ts
- [x] src/services/SearchApiService.ts

## Hook Files
- [x] src/hooks/useDebounce.ts
- [x] src/hooks/useActivity.ts
- [x] src/hooks/useAsyncOperation.ts
- [x] src/hooks/useAuction.ts
- [x] src/hooks/useBaseForm.ts
- [x] src/hooks/useCollectionExport.ts
- [x] src/hooks/useCollectionImageExport.ts
- [x] src/hooks/useCollectionOperations.ts
- [x] src/hooks/useCollectionState.ts
- [x] src/hooks/useCollectionStats.ts
- [x] src/hooks/useDataTable.ts
- [x] src/hooks/useDbaExport.ts
- [x] src/hooks/useExportOperations.ts
- [x] src/hooks/useFetchCollectionItems.ts
- [x] src/hooks/useFormSubmission.ts
- [ ] src/hooks/useFormValidation.ts
- [ ] src/hooks/useGenericCrudOperations.ts
- [ ] src/hooks/useImageUpload.ts
- [ ] src/hooks/useMarkSold.ts
- [ ] src/hooks/usePageLayout.ts
- [ ] src/hooks/usePriceHistory.ts
- [ ] src/hooks/usePsaCardOperations.ts
- [ ] src/hooks/useRawCardOperations.ts
- [ ] src/hooks/useSalesAnalytics.ts
- [ ] src/hooks/useSealedProductOperations.ts
- [ ] src/hooks/form/useCardSelection.ts
- [ ] src/hooks/form/useFormInitialization.ts

## Service Files
- [ ] src/services/ServiceRegistry.ts
- [ ] src/services/CollectionApiService.ts
- [ ] src/services/ExportApiService.ts
- [ ] src/services/SearchApiService.ts
- [ ] src/services/UploadApiService.ts
- [ ] src/domain/services/SalesAnalyticsService.ts

## Component Files
- [ ] src/components/ImageUploader.tsx
- [ ] src/components/PriceHistoryDisplay.tsx
- [ ] src/components/common/Button.tsx
- [ ] src/components/common/ConfirmModal.tsx
- [ ] src/components/common/DateRangeFilter.tsx
- [ ] src/components/common/FormActionButtons.tsx
- [ ] src/components/common/FormHeader.tsx
- [ ] src/components/common/ImageProductView.tsx
- [ ] src/components/common/ImageSlideshow.tsx
- [ ] src/components/common/Input.tsx
- [ ] src/components/common/LoadingSpinner.tsx
- [ ] src/components/common/LoadingStates.tsx
- [ ] src/components/common/Modal.tsx
- [ ] src/components/common/OptimizedImageView.tsx
- [ ] src/components/common/Select.tsx
- [ ] src/components/common/FormElements/ErrorMessage.tsx
- [ ] src/components/common/FormElements/FormWrapper.tsx
- [ ] src/components/common/FormElements/Glow.tsx
- [ ] src/components/common/FormElements/HelperText.tsx
- [ ] src/components/common/FormElements/Label.tsx
- [ ] src/components/common/FormElements/Shimmer.tsx
- [ ] src/components/dba/DbaCompactCard.tsx
- [ ] src/components/dba/DbaCosmicBackground.tsx
- [ ] src/components/dba/DbaCustomDescriptionInput.tsx
- [ ] src/components/dba/DbaEmptyState.tsx
- [ ] src/components/dba/DbaExportActions.tsx
- [ ] src/components/dba/DbaExportConfiguration.tsx
- [ ] src/components/dba/DbaExportSuccess.tsx
- [ ] src/components/dba/DbaHeaderActions.tsx
- [ ] src/components/dba/DbaHeaderGalaxy.tsx
- [ ] src/components/dba/DbaItemCard.tsx
- [ ] src/components/dba/DbaItemCustomizer.tsx
- [ ] src/components/dba/DbaItemsWithTimers.tsx
- [ ] src/components/dba/DbaItemsWithoutTimers.tsx
- [ ] src/components/debug/PerformanceMonitor.tsx
- [ ] src/components/debug/ReactProfiler.tsx
- [ ] src/components/error/ErrorBoundary.tsx
- [ ] src/components/forms/AddEditPsaCardForm.tsx
- [ ] src/components/forms/AddEditRawCardForm.tsx
- [ ] src/components/forms/AddEditSealedProductForm.tsx
- [ ] src/components/forms/MarkSoldForm.tsx
- [ ] src/components/forms/ProductSearchSection.tsx
- [ ] src/components/forms/SearchSection.tsx
- [ ] src/components/forms/containers/AuctionFormContainer.tsx
- [ ] src/components/forms/containers/CardFormContainer.tsx
- [ ] src/components/forms/fields/CardInformationFields.tsx
- [ ] src/components/forms/fields/InformationFieldRenderer.tsx
- [ ] src/components/forms/fields/ProductInformationFields.tsx
- [ ] src/components/forms/sections/AuctionItemSelectionSection.tsx
- [ ] src/components/forms/sections/CardInformationDisplaySection.tsx
- [ ] src/components/forms/sections/GradingPricingSection.tsx
- [ ] src/components/forms/sections/ImageUploadSection.tsx
- [ ] src/components/forms/sections/SaleDetailsSection.tsx
- [ ] src/components/forms/wrappers/FormSubmissionWrapper.tsx
- [ ] src/components/layouts/MainLayout.tsx
- [ ] src/components/layouts/PageLayout.tsx
- [ ] src/components/lists/CategoryOrderingList.tsx
- [ ] src/components/lists/CollectionExportModal.tsx
- [ ] src/components/lists/CollectionItemCard.tsx
- [ ] src/components/lists/CollectionStats.tsx
- [ ] src/components/lists/CollectionTabs.tsx
- [ ] src/components/lists/ItemOrderingSection.tsx
- [ ] src/components/lists/OrderableItemCard.tsx
- [ ] src/components/lists/SortableCategoryOrderingList.tsx
- [ ] src/components/lists/SortableItemCard.tsx
- [ ] src/components/modals/AddItemToAuctionModal.tsx
- [ ] src/components/modals/ItemSelectorModal.tsx
- [ ] src/components/ui/ThemeToggle.tsx

## Utility Files
- [ ] src/utils/apiLogger.ts
- [ ] src/utils/common.ts
- [ ] src/utils/constants.ts
- [ ] src/utils/errorHandler.ts
- [ ] src/utils/exportUtils.ts
- [ ] src/utils/extensionDetection.ts
- [ ] src/utils/fileOperations.ts
- [ ] src/utils/formatting.ts
- [ ] src/utils/logger.ts
- [ ] src/utils/navigation.ts
- [ ] src/utils/orderingUtils.ts
- [ ] src/utils/performanceMonitor.ts
- [ ] src/utils/responseTransformer.ts
- [ ] src/utils/storageUtils.ts

## Interface Files
- [ ] src/interfaces/api/ICollectionApiService.ts
- [ ] src/interfaces/api/IExportApiService.ts
- [ ] src/interfaces/api/ISearchApiService.ts
- [ ] src/interfaces/api/IUploadApiService.ts

## Context Files
- [ ] src/contexts/DragDropContext.tsx

## Domain Model Files
- [ ] src/domain/models/auction.ts
- [ ] src/domain/models/card.ts
- [ ] src/domain/models/common.ts
- [ ] src/domain/models/ordering.ts
- [ ] src/domain/models/sale.ts
- [ ] src/domain/models/sealedProduct.ts

## Page Files
- [ ] src/pages/Activity.tsx
- [ ] src/pages/AddEditItem.tsx
- [ ] src/pages/Analytics.tsx
- [ ] src/pages/AuctionDetail.tsx
- [ ] src/pages/AuctionEdit.tsx
- [ ] src/pages/Auctions.tsx
- [ ] src/pages/Collection.tsx
- [ ] src/pages/CollectionItemDetail.tsx
- [ ] src/pages/CreateAuction.tsx
- [ ] src/pages/Dashboard.tsx
- [ ] src/pages/DbaExport.tsx
- [ ] src/pages/SalesAnalytics.tsx
- [ ] src/pages/SealedProductSearch.tsx
- [ ] src/pages/SetSearch.tsx

## Config Files
- [ ] src/lib/queryClient.ts
- [ ] src/theme/formThemes.ts

## Main Files
- [ ] src/App.tsx
- [ ] src/main.tsx