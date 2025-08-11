/**
 * API Versioning Middleware
 * 
 * Implements API versioning following Zalando guidelines:
 * - Header-based versioning (primary)
 * - URL-based versioning (fallback)  
 * - Version negotiation
 * - Deprecation warnings
 * - Migration support
 */

const Logger = require('../utils/Logger');

/**
 * Supported API versions
 */
const API_VERSIONS = {
  'v1': {
    version: '1.0',
    status: 'deprecated',
    deprecationDate: '2025-08-01',
    sunsetDate: '2025-12-01',
    mediaType: 'application/vnd.pokemon-collection+json;version=1'
  },
  'v2': {
    version: '2.0', 
    status: 'current',
    mediaType: 'application/vnd.pokemon-collection+json;version=2'
  }
};

/**
 * Default version configuration
 */
const VERSION_CONFIG = {
  DEFAULT_VERSION: 'v2',
  HEADER_NAME: 'API-Version',
  ACCEPT_HEADER_PATTERN: /application\/vnd\.pokemon-collection\+json;version=(\d+)/,
  CONTENT_TYPE_PREFIX: 'application/vnd.pokemon-collection+json',
  DEPRECATION_WARNING_HEADER: 'Sunset',
  LINK_HEADER_PREFIX: 'Link'
};

/**
 * Version negotiation utilities
 */
class VersionNegotiator {
  /**
   * Extracts version from request headers
   * @param {Object} req - Express request object
   * @returns {string|null} Extracted version
   */
  static extractVersionFromHeaders(req) {
    // Check API-Version header first
    const apiVersionHeader = req.get(VERSION_CONFIG.HEADER_NAME);
    if (apiVersionHeader) {
      return this.normalizeVersion(apiVersionHeader);
    }

    // Check Accept header for media type versioning
    const acceptHeader = req.get('Accept');
    if (acceptHeader) {
      const match = acceptHeader.match(VERSION_CONFIG.ACCEPT_HEADER_PATTERN);
      if (match) {
        return `v${match[1]}`;
      }
    }

    return null;
  }

  /**
   * Extracts version from URL path
   * @param {string} path - Request path
   * @returns {string|null} Extracted version
   */
  static extractVersionFromUrl(path) {
    const urlMatch = path.match(/^\/api\/(v\d+)\//);
    return urlMatch ? urlMatch[1] : null;
  }

  /**
   * Normalizes version string
   * @param {string} version - Version string
   * @returns {string} Normalized version
   */
  static normalizeVersion(version) {
    // Handle various version formats
    if (version.startsWith('v')) return version;
    if (/^\d+$/.test(version)) return `v${version}`;
    if (/^\d+\.\d+$/.test(version)) {
      const major = version.split('.')[0];
      return `v${major}`;
    }
    return version;
  }

  /**
   * Determines the best version for the request
   * @param {Object} req - Express request object
   * @returns {string} Determined version
   */
  static negotiateVersion(req) {
    // 1. Check URL path first (most explicit)
    const urlVersion = this.extractVersionFromUrl(req.path);
    if (urlVersion && API_VERSIONS[urlVersion]) {
      return urlVersion;
    }

    // 2. Check headers (Accept or API-Version)
    const headerVersion = this.extractVersionFromHeaders(req);
    if (headerVersion && API_VERSIONS[headerVersion]) {
      return headerVersion;
    }

    // 3. Fall back to default version
    return VERSION_CONFIG.DEFAULT_VERSION;
  }

  /**
   * Validates if version is supported
   * @param {string} version - Version to validate
   * @returns {boolean} Whether version is supported
   */
  static isVersionSupported(version) {
    return version && API_VERSIONS.hasOwnProperty(version);
  }

  /**
   * Gets version metadata
   * @param {string} version - Version string
   * @returns {Object|null} Version metadata
   */
  static getVersionMetadata(version) {
    return API_VERSIONS[version] || null;
  }

  /**
   * Checks if version is deprecated
   * @param {string} version - Version string
   * @returns {boolean} Whether version is deprecated
   */
  static isVersionDeprecated(version) {
    const metadata = this.getVersionMetadata(version);
    return metadata && metadata.status === 'deprecated';
  }

  /**
   * Gets sunset date for deprecated version
   * @param {string} version - Version string
   * @returns {string|null} Sunset date
   */
  static getVersionSunsetDate(version) {
    const metadata = this.getVersionMetadata(version);
    return metadata && metadata.sunsetDate ? metadata.sunsetDate : null;
  }
}

/**
 * Version-specific response transformers
 */
class VersionTransformers {
  /**
   * Transforms response for v1 compatibility
   * @param {Object} data - Response data
   * @returns {Object} Transformed data
   */
  static transformV1Response(data) {
    // V1 used simple success/data pattern
    if (data && typeof data === 'object') {
      // If it's already a v2 response, convert to v1 format
      if (data.success !== undefined && data.data !== undefined) {
        return {
          success: data.success,
          data: data.data,
          // V1 didn't include meta or status fields
        };
      }
    }
    
    // If it's raw data, wrap in v1 format
    return {
      success: true,
      data: data
    };
  }

  /**
   * Transforms response for v2 format
   * @param {Object} data - Response data
   * @param {Object} meta - Metadata
   * @returns {Object} Transformed data
   */
  static transformV2Response(data, meta = {}) {
    // V2 uses enhanced format with status and meta
    return {
      success: true,
      status: 'success',
      data: data,
      meta: {
        timestamp: new Date().toISOString(),
        version: '2.0',
        ...meta
      }
    };
  }

  /**
   * Gets appropriate transformer for version
   * @param {string} version - API version
   * @returns {Function} Transformer function
   */
  static getTransformer(version) {
    switch (version) {
      case 'v1':
        return this.transformV1Response;
      case 'v2':
        return this.transformV2Response;
      default:
        return this.transformV2Response; // Default to latest
    }
  }
}

/**
 * Creates API versioning middleware
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function createVersioningMiddleware(options = {}) {
  const config = {
    ...VERSION_CONFIG,
    ...options
  };

  return (req, res, next) => {
    // Negotiate version for this request
    const negotiatedVersion = VersionNegotiator.negotiateVersion(req);
    const versionMetadata = VersionNegotiator.getVersionMetadata(negotiatedVersion);

    // Store version info in request object
    req.apiVersion = negotiatedVersion;
    req.versionMetadata = versionMetadata;

    // Add version info to response headers
    res.set(config.HEADER_NAME, negotiatedVersion);
    
    if (versionMetadata) {
      res.set('Content-Type', versionMetadata.mediaType || 
        `${config.CONTENT_TYPE_PREFIX};version=${negotiatedVersion.replace('v', '')}`);
    }

    // Add deprecation warnings for deprecated versions
    if (VersionNegotiator.isVersionDeprecated(negotiatedVersion)) {
      const sunsetDate = VersionNegotiator.getVersionSunsetDate(negotiatedVersion);
      
      if (sunsetDate) {
        res.set(config.DEPRECATION_WARNING_HEADER, `date="${sunsetDate}"`);
        res.set('Deprecation', `date="${versionMetadata.deprecationDate}"`);
      }

      // Add Link header to current version
      const currentVersion = config.DEFAULT_VERSION;
      const currentPath = req.path.replace(/^\/api\/v\d+/, `/api/${currentVersion}`);
      res.set('Link', `<${req.protocol}://${req.get('host')}${currentPath}>; rel="successor-version"`);

      Logger.warn('VersioningMiddleware', `Deprecated API version used: ${negotiatedVersion}`, {
        path: req.path,
        userAgent: req.get('User-Agent'),
        sunsetDate
      });
    }

    // Override response.json to apply version-specific transformations
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // Apply version-specific transformation
      const transformer = VersionTransformers.getTransformer(negotiatedVersion);
      let transformedData = data;

      // Only transform if not already in error state
      if (res.statusCode < 400) {
        transformedData = transformer(data, {
          version: versionMetadata?.version,
          cached: req.fromCache || false
        });
      }

      return originalJson(transformedData);
    };

    // Add convenience methods for version checking
    req.isVersion = (version) => req.apiVersion === VersionNegotiator.normalizeVersion(version);
    req.isCurrentVersion = () => req.apiVersion === config.DEFAULT_VERSION;
    req.isDeprecatedVersion = () => VersionNegotiator.isVersionDeprecated(req.apiVersion);

    next();
  };
}

/**
 * Version-aware route decorator
 * @param {string} minVersion - Minimum version required
 * @param {string} maxVersion - Maximum version supported
 * @returns {Function} Route middleware
 */
function requireVersion(minVersion, maxVersion = null) {
  return (req, res, next) => {
    const currentVersion = req.apiVersion;
    const minVersionNorm = VersionNegotiator.normalizeVersion(minVersion);
    const maxVersionNorm = maxVersion ? VersionNegotiator.normalizeVersion(maxVersion) : null;

    // Check minimum version
    if (currentVersion < minVersionNorm) {
      return res.status(400).json({
        success: false,
        error: 'API_VERSION_TOO_LOW',
        message: `This endpoint requires API version ${minVersion} or higher`,
        currentVersion,
        requiredMinVersion: minVersion
      });
    }

    // Check maximum version if specified
    if (maxVersionNorm && currentVersion > maxVersionNorm) {
      return res.status(400).json({
        success: false,
        error: 'API_VERSION_TOO_HIGH',
        message: `This endpoint is not supported in API version ${currentVersion}`,
        currentVersion,
        maxSupportedVersion: maxVersion
      });
    }

    next();
  };
}

/**
 * Returns API version information endpoint handler
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function getVersionInfo(req, res) {
  const versions = Object.entries(API_VERSIONS).map(([key, metadata]) => ({
    version: key,
    ...metadata,
    current: key === VERSION_CONFIG.DEFAULT_VERSION
  }));

  res.json({
    success: true,
    data: {
      versions,
      current: VERSION_CONFIG.DEFAULT_VERSION,
      deprecated: Object.keys(API_VERSIONS).filter(v => 
        VersionNegotiator.isVersionDeprecated(v)
      )
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = {
  createVersioningMiddleware,
  requireVersion,
  getVersionInfo,
  VersionNegotiator,
  VersionTransformers,
  API_VERSIONS,
  VERSION_CONFIG
};