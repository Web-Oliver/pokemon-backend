/**
 * Configuration-driven export routing
 * Eliminates switch statement DRY violations in api.js
 */
import {
    generateDbaTitle,
    generateFacebookPost,
    getCollectionFacebookTextFile
} from '@/marketplace/listings/externalListingController.js';
import {
    downloadDbaZip,
    exportToDba,
    zipPsaCardImages,
    zipRawCardImages,
    zipSealedProductImages
} from '@/marketplace/exports/exportController.js';

/**
 * Social export handlers configuration
 */
export const SOCIAL_EXPORT_HANDLERS = {
    'facebook-post': {
        handler: generateFacebookPost,
        description: 'Generate Facebook marketplace post'
    },
    'dba-title': {
        handler: generateDbaTitle,
        description: 'Generate DBA title format'
    },
    'facebook-text-file': {
        handler: getCollectionFacebookTextFile,
        description: 'Generate Facebook text file export'
    }
};

/**
 * Collection export format handlers
 */
export const COLLECTION_EXPORT_HANDLERS = {
    'dba': {
        handler: exportToDba,
        description: 'Export to DBA format',
        supportedTypes: ['all']
    },
    'zip': {
        handler: null, // Delegated to type-specific handlers
        description: 'ZIP file export',
        typeHandlers: {
            'psa-cards': zipPsaCardImages,
            'psa-graded-cards': zipPsaCardImages,
            'raw-cards': zipRawCardImages,
            'sealed-products': zipSealedProductImages
        },
        supportedTypes: ['psa-cards', 'psa-graded-cards', 'raw-cards', 'sealed-products']
    }
};

/**
 * Export download handlers
 */
export const EXPORT_DOWNLOAD_HANDLERS = {
    'dba': {
        handler: downloadDbaZip,
        matcher: (exportId) => exportId === 'dba' || exportId.includes('dba')
    }
};

/**
 * Get supported social export types
 */
export function getSupportedSocialExportTypes() {
    return Object.keys(SOCIAL_EXPORT_HANDLERS);
}

/**
 * Get supported collection export formats
 */
export function getSupportedCollectionExportFormats() {
    return Object.keys(COLLECTION_EXPORT_HANDLERS);
}

/**
 * Get supported collection types for a format
 */
export function getSupportedCollectionTypes(format) {
    const config = COLLECTION_EXPORT_HANDLERS[format];
    return config ? config.supportedTypes : [];
}

/**
 * Get handler for social export type
 */
export function getSocialExportHandler(type) {
    return SOCIAL_EXPORT_HANDLERS[type]?.handler;
}

/**
 * Get handler for collection export
 */
export function getCollectionExportHandler(format, type = null) {
    const config = COLLECTION_EXPORT_HANDLERS[format];
    if (!config) return null;

    if (format === 'zip' && type) {
        return config.typeHandlers[type];
    }

    return config.handler;
}

/**
 * Get handler for export download
 */
export function getExportDownloadHandler(exportId) {
    for (const [key, config] of Object.entries(EXPORT_DOWNLOAD_HANDLERS)) {
        if (config.matcher(exportId)) {
            return config.handler;
        }
    }
    return null;
}