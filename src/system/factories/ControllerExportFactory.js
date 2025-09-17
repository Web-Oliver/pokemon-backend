/**
 * ControllerExportFactory - Eliminate Controller Export Duplication
 *
 * Eliminates repeated lazy controller instantiation and method export patterns
 * found in Pokemon domain controllers (and potentially other domains).
 *
 * BEFORE: Repeated in cardsController.js, productsController.js:
 * - let controller = null;
 * - const getController = () => { if (!controller) controller = new Controller(); return controller; };
 * - Individual method exports for each controller method
 *
 * AFTER: Single factory function that generates all necessary exports
 */

export class ControllerExportFactory {
    /**
     * Create standardized controller exports with lazy initialization
     * @param {Class} ControllerClass - Controller class to instantiate
     * @param {Array} methods - Methods to export from controller
     * @param {Object} options - Export configuration options
     * @returns {Object} Complete set of controller exports
     */
    static createControllerExports(ControllerClass, methods, options = {}) {
        const {
            enableLazyLoading = true,
            includeControllerGetter = true,
            methodAliases = {},
            includeDefaultExports = true
        } = options;

        let controller = null;

        /**
         * Get controller instance with lazy initialization
         * @returns {Object} Controller instance
         */
        const getController = () => {
            if (!controller) {
                controller = new ControllerClass();
            }
            return controller;
        };

        const exports = {};

        // Create method exports
        methods.forEach(method => {
            // Standard method export
            exports[method] = (req, res, next) => getController()[method](req, res, next);

            // Create aliases if specified
            if (methodAliases[method]) {
                const aliases = Array.isArray(methodAliases[method])
                    ? methodAliases[method]
                    : [methodAliases[method]];

                aliases.forEach(alias => {
                    exports[alias] = exports[method];
                });
            }
        });

        // Include controller getter if requested
        if (includeControllerGetter) {
            const controllerName = ControllerClass.name.replace(/Controller$/, '');
            exports[`get${controllerName}Controller`] = getController;
        }

        // Add default exports for common patterns
        if (includeDefaultExports && methods.includes('getAll')) {
            exports.list = exports.getAll;
        }
        if (includeDefaultExports && methods.includes('getById')) {
            exports.show = exports.getById;
        }
        if (includeDefaultExports && methods.includes('create')) {
            exports.store = exports.create;
        }
        if (includeDefaultExports && methods.includes('update')) {
            exports.edit = exports.update;
        }
        if (includeDefaultExports && methods.includes('delete')) {
            exports.destroy = exports.delete;
        }

        return exports;
    }

    /**
     * Create controller exports for Pokemon domain pattern
     * @param {Class} ControllerClass - Controller class
     * @param {Object} domainConfig - Domain-specific configuration
     * @returns {Object} Pokemon domain controller exports
     */
    static createPokemonControllerExports(ControllerClass, domainConfig = {}) {
        const {
            entityName = 'Entity',
            pluralName = 'entities',
            includeMetrics = true,
            customMethods = []
        } = domainConfig;

        // Standard CRUD methods
        const standardMethods = ['getAll', 'getById', 'create', 'update', 'delete'];

        // Add metrics method if enabled
        const methods = includeMetrics
            ? [...standardMethods, 'getControllerMetrics', ...customMethods]
            : [...standardMethods, ...customMethods];

        // Create method aliases for Pokemon domain patterns
        const capitalizedPluralName = pluralName.charAt(0).toUpperCase() + pluralName.slice(1);
        const methodAliases = {
            getAll: [`getAll${capitalizedPluralName}`, `get${entityName}List`],
            getById: [`get${entityName}ById`, `get${entityName}`],
            create: [`create${entityName}`, `add${entityName}`],
            update: [`update${entityName}`, `edit${entityName}`],
            delete: [`delete${entityName}`, `remove${entityName}`]
        };

        // Add metrics aliases if included
        if (includeMetrics) {
            methodAliases.getControllerMetrics = [`get${entityName}Metrics`, 'getMetrics'];
        }

        return this.createControllerExports(ControllerClass, methods, {
            methodAliases,
            includeDefaultExports: true,
            includeControllerGetter: true
        });
    }

    /**
     * Create collection controller exports (for collection domain pattern)
     * @param {Class} ControllerClass - Controller class
     * @param {Object} collectionConfig - Collection-specific configuration
     * @returns {Object} Collection controller exports
     */
    static createCollectionControllerExports(ControllerClass, collectionConfig = {}) {
        const {
            entityName = 'Item',
            includeMarkAsSold = true,
            includeBulkOperations = false,
            customMethods = []
        } = collectionConfig;

        const standardMethods = ['getAll', 'getById', 'create', 'update', 'delete'];

        // Add collection-specific methods
        const methods = [
            ...standardMethods,
            ...(includeMarkAsSold ? ['markAsSold'] : []),
            ...(includeBulkOperations ? ['bulkCreate', 'bulkUpdate', 'bulkDelete'] : []),
            ...customMethods
        ];

        const methodAliases = {
            getAll: [`getAll${entityName}s`],
            getById: [`get${entityName}ById`],
            create: [`create${entityName}`],
            update: [`update${entityName}`],
            delete: [`delete${entityName}`]
        };

        if (includeMarkAsSold) {
            methodAliases.markAsSold = [`sell${entityName}`, `mark${entityName}AsSold`];
        }

        return this.createControllerExports(ControllerClass, methods, {
            methodAliases,
            includeDefaultExports: true,
            includeControllerGetter: true
        });
    }

    /**
     * Create search controller exports
     * @param {Class} ControllerClass - Controller class
     * @param {Object} searchConfig - Search-specific configuration
     * @returns {Object} Search controller exports
     */
    static createSearchControllerExports(ControllerClass, searchConfig = {}) {
        const {
            entityName = 'Entity',
            includeAdvancedSearch = true,
            includeSuggestions = true,
            customMethods = []
        } = searchConfig;

        const methods = [
            'search',
            ...(includeAdvancedSearch ? ['searchAdvanced'] : []),
            ...(includeSuggestions ? ['getSuggestions'] : []),
            ...customMethods
        ];

        const methodAliases = {
            search: [`search${entityName}s`, `find${entityName}s`],
            searchAdvanced: ['advancedSearch', `search${entityName}sAdvanced`],
            getSuggestions: [`get${entityName}Suggestions`, 'suggest', 'autocomplete']
        };

        return this.createControllerExports(ControllerClass, methods, {
            methodAliases,
            includeDefaultExports: false, // Search controllers don't follow CRUD patterns
            includeControllerGetter: true
        });
    }

    /**
     * Create export controller exports (for marketplace domain)
     * @param {Class} ControllerClass - Controller class
     * @param {Object} exportConfig - Export-specific configuration
     * @returns {Object} Export controller exports
     */
    static createExportControllerExports(ControllerClass, exportConfig = {}) {
        const {
            supportedFormats = ['zip', 'dba'],
            includeStatusMethods = true,
            customMethods = []
        } = exportConfig;

        const methods = [
            ...supportedFormats.map(format => `exportTo${format.charAt(0).toUpperCase() + format.slice(1)}`),
            ...(includeStatusMethods ? ['getStatus', 'getExportHistory'] : []),
            ...customMethods
        ];

        return this.createControllerExports(ControllerClass, methods, {
            includeDefaultExports: false, // Export controllers have specialized patterns
            includeControllerGetter: true
        });
    }

    /**
     * Validate controller class and methods
     * @param {Class} ControllerClass - Controller class to validate
     * @param {Array} methods - Methods to validate
     * @throws {Error} If validation fails
     * @private
     */
    static validateController(ControllerClass, methods) {
        if (!ControllerClass || typeof ControllerClass !== 'function') {
            throw new Error('ControllerClass must be a valid constructor function');
        }

        if (!Array.isArray(methods) || methods.length === 0) {
            throw new Error('Methods array must be provided and contain at least one method');
        }

        // Create temporary instance to check method existence
        const tempInstance = new ControllerClass();
        methods.forEach(method => {
            if (typeof tempInstance[method] !== 'function') {
                throw new Error(`Method '${method}' does not exist on ${ControllerClass.name}`);
            }
        });
    }

    /**
     * Create minimal controller exports (for simple controllers)
     * @param {Class} ControllerClass - Controller class
     * @param {Array} methods - Methods to export
     * @returns {Object} Minimal controller exports
     */
    static createMinimalExports(ControllerClass, methods) {
        this.validateController(ControllerClass, methods);

        return this.createControllerExports(ControllerClass, methods, {
            includeDefaultExports: false,
            includeControllerGetter: false
        });
    }

    /**
     * Create full-featured controller exports (with all options enabled)
     * @param {Class} ControllerClass - Controller class
     * @param {Array} methods - Methods to export
     * @param {Object} customConfig - Custom configuration
     * @returns {Object} Full-featured controller exports
     */
    static createFullExports(ControllerClass, methods, customConfig = {}) {
        this.validateController(ControllerClass, methods);

        return this.createControllerExports(ControllerClass, methods, {
            includeDefaultExports: true,
            includeControllerGetter: true,
            ...customConfig
        });
    }
}

export default ControllerExportFactory;