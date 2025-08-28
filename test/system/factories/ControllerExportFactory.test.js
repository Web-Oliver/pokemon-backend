/**
 * Integration Tests for ControllerExportFactory
 *
 * Tests the factory pattern implementation to ensure:
 * - Proper controller export generation
 * - Method aliasing functionality
 * - Lazy loading behavior
 * - Domain-specific configurations
 * - Error handling and validation
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { ControllerExportFactory } from '../../../src/system/factories/ControllerExportFactory.js';

// Mock controller for testing
class MockController {
  constructor() {
    this.constructorCalled = true;
    this.callCounts = {};
  }

  getAll(req, res, next) {
    this.callCounts.getAll = (this.callCounts.getAll || 0) + 1;
    return { method: 'getAll', args: [req, res, next] };
  }

  getById(req, res, next) {
    this.callCounts.getById = (this.callCounts.getById || 0) + 1;
    return { method: 'getById', args: [req, res, next] };
  }

  create(req, res, next) {
    this.callCounts.create = (this.callCounts.create || 0) + 1;
    return { method: 'create', args: [req, res, next] };
  }

  update(req, res, next) {
    this.callCounts.update = (this.callCounts.update || 0) + 1;
    return { method: 'update', args: [req, res, next] };
  }

  delete(req, res, next) {
    this.callCounts.delete = (this.callCounts.delete || 0) + 1;
    return { method: 'delete', args: [req, res, next] };
  }

  getControllerMetrics(req, res, next) {
    this.callCounts.getControllerMetrics = (this.callCounts.getControllerMetrics || 0) + 1;
    return { method: 'getControllerMetrics', args: [req, res, next] };
  }

  markAsSold(req, res, next) {
    this.callCounts.markAsSold = (this.callCounts.markAsSold || 0) + 1;
    return { method: 'markAsSold', args: [req, res, next] };
  }

  search(req, res, next) {
    this.callCounts.search = (this.callCounts.search || 0) + 1;
    return { method: 'search', args: [req, res, next] };
  }

  exportToZip(req, res, next) {
    this.callCounts.exportToZip = (this.callCounts.exportToZip || 0) + 1;
    return { method: 'exportToZip', args: [req, res, next] };
  }

  exportToDba(req, res, next) {
    this.callCounts.exportToDba = (this.callCounts.exportToDba || 0) + 1;
    return { method: 'exportToDba', args: [req, res, next] };
  }
}

describe('ControllerExportFactory', function() {
  let mockReq, mockRes, mockNext;

  beforeEach(function() {
    mockReq = { query: {}, params: {}, body: {} };
    mockRes = { status: sinon.stub().returnsThis(), json: sinon.stub() };
    mockNext = sinon.stub();
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('createControllerExports', function() {
    it('should create basic controller exports with lazy loading', function() {
      const methods = ['getAll', 'getById', 'create'];
      const exports = ControllerExportFactory.createControllerExports(MockController, methods);

      // Check that all methods are exported
      expect(exports).to.have.property('getAll');
      expect(exports).to.have.property('getById');
      expect(exports).to.have.property('create');
      expect(exports).to.have.property('getMockController');

      // Check that methods are functions
      expect(exports.getAll).to.be.a('function');
      expect(exports.getById).to.be.a('function');
      expect(exports.create).to.be.a('function');
      expect(exports.getMockController).to.be.a('function');

      // Test lazy loading - controller should not be instantiated yet
      const controller1 = exports.getMockController();
      const controller2 = exports.getMockController();
      expect(controller1).to.equal(controller2); // Same instance
      expect(controller1.constructorCalled).to.be.true;
    });

    it('should create method aliases correctly', function() {
      const methods = ['getAll', 'create'];
      const methodAliases = {
        getAll: ['list', 'findAll'],
        create: 'store'
      };

      const exports = ControllerExportFactory.createControllerExports(MockController, methods, {
        methodAliases
      });

      // Check that aliases exist
      expect(exports).to.have.property('list');
      expect(exports).to.have.property('findAll');
      expect(exports).to.have.property('store');

      // Check that aliases point to the same functions
      expect(exports.list).to.equal(exports.getAll);
      expect(exports.findAll).to.equal(exports.getAll);
      expect(exports.store).to.equal(exports.create);
    });

    it('should create default CRUD aliases when enabled', function() {
      const methods = ['getAll', 'getById', 'create', 'update', 'delete'];
      const exports = ControllerExportFactory.createControllerExports(MockController, methods, {
        includeDefaultExports: true
      });

      // Check default aliases
      expect(exports).to.have.property('list');
      expect(exports).to.have.property('show');
      expect(exports).to.have.property('store');
      expect(exports).to.have.property('edit');
      expect(exports).to.have.property('destroy');

      // Check that they point to correct methods
      expect(exports.list).to.equal(exports.getAll);
      expect(exports.show).to.equal(exports.getById);
      expect(exports.store).to.equal(exports.create);
      expect(exports.edit).to.equal(exports.update);
      expect(exports.destroy).to.equal(exports.delete);
    });

    it('should execute controller methods correctly', function() {
      const methods = ['getAll', 'create'];
      const exports = ControllerExportFactory.createControllerExports(MockController, methods);

      // Execute methods
      const result1 = exports.getAll(mockReq, mockRes, mockNext);
      const result2 = exports.create(mockReq, mockRes, mockNext);

      // Check that controller was created and methods were called
      const controller = exports.getMockController();
      expect(controller.callCounts.getAll).to.equal(1);
      expect(controller.callCounts.create).to.equal(1);

      // Check return values
      expect(result1.method).to.equal('getAll');
      expect(result2.method).to.equal('create');
    });
  });

  describe('createPokemonControllerExports', function() {
    it('should create Pokemon domain controller exports with correct aliases', function() {
      const methods = ['getAll', 'getById', 'create', 'getControllerMetrics'];
      const exports = ControllerExportFactory.createPokemonControllerExports(MockController, {
        entityName: 'Card',
        pluralName: 'cards',
        includeMetrics: true
      });

      // Check standard methods
      expect(exports).to.have.property('getAll');
      expect(exports).to.have.property('getById');
      expect(exports).to.have.property('create');
      expect(exports).to.have.property('getControllerMetrics');

      // Check Pokemon-specific aliases
      expect(exports).to.have.property('getAllcards');
      expect(exports).to.have.property('getCardList');
      expect(exports).to.have.property('getCardById');
      expect(exports).to.have.property('getCard');
      expect(exports).to.have.property('createCard');
      expect(exports).to.have.property('addCard');
      expect(exports).to.have.property('getCardMetrics');

      // Check controller getter
      expect(exports).to.have.property('getMockController');
    });

    it('should handle custom methods in Pokemon exports', function() {
      const exports = ControllerExportFactory.createPokemonControllerExports(MockController, {
        entityName: 'Set',
        customMethods: ['getSetNames']
      });

      // Custom methods should be included but not implemented (that's controller's job)
      expect(exports).to.have.property('getSetNames');
    });
  });

  describe('createCollectionControllerExports', function() {
    it('should create Collection domain controller exports', function() {
      const exports = ControllerExportFactory.createCollectionControllerExports(MockController, {
        entityName: 'Item',
        includeMarkAsSold: true
      });

      // Check standard methods
      expect(exports).to.have.property('getAll');
      expect(exports).to.have.property('getById');
      expect(exports).to.have.property('create');
      expect(exports).to.have.property('markAsSold');

      // Check collection-specific aliases
      expect(exports).to.have.property('getAllItems');
      expect(exports).to.have.property('getItemById');
      expect(exports).to.have.property('createItem');
      expect(exports).to.have.property('sellItem');
      expect(exports).to.have.property('markItemAsSold');
    });

    it('should exclude markAsSold when disabled', function() {
      const exports = ControllerExportFactory.createCollectionControllerExports(MockController, {
        entityName: 'Item',
        includeMarkAsSold: false
      });

      expect(exports).to.not.have.property('markAsSold');
      expect(exports).to.not.have.property('sellItem');
    });
  });

  describe('createSearchControllerExports', function() {
    it('should create Search controller exports', function() {
      const exports = ControllerExportFactory.createSearchControllerExports(MockController, {
        entityName: 'Entity',
        includeAdvancedSearch: true,
        includeSuggestions: true
      });

      // Check search methods
      expect(exports).to.have.property('search');
      expect(exports).to.have.property('searchAdvanced');
      expect(exports).to.have.property('getSuggestions');

      // Check search-specific aliases
      expect(exports).to.have.property('searchEntitys');
      expect(exports).to.have.property('findEntitys');
      expect(exports).to.have.property('advancedSearch');
      expect(exports).to.have.property('getEntitySuggestions');
      expect(exports).to.have.property('suggest');
      expect(exports).to.have.property('autocomplete');

      // Should not include default CRUD aliases
      expect(exports).to.not.have.property('list');
      expect(exports).to.not.have.property('store');
    });
  });

  describe('createExportControllerExports', function() {
    it('should create Export controller exports', function() {
      const exports = ControllerExportFactory.createExportControllerExports(MockController, {
        supportedFormats: ['zip', 'dba'],
        includeStatusMethods: true
      });

      // Check format-based methods
      expect(exports).to.have.property('exportToZip');
      expect(exports).to.have.property('exportToDba');

      // Check status methods
      expect(exports).to.have.property('getStatus');
      expect(exports).to.have.property('getExportHistory');

      // Should not include default CRUD aliases
      expect(exports).to.not.have.property('list');
      expect(exports).to.not.have.property('store');
    });
  });

  describe('error handling and validation', function() {
    it('should throw error for invalid controller class', function() {
      expect(() => {
        ControllerExportFactory.createControllerExports(null, ['getAll']);
      }).to.throw('ControllerClass must be a valid constructor function');

      expect(() => {
        ControllerExportFactory.createControllerExports('not-a-function', ['getAll']);
      }).to.throw('ControllerClass must be a valid constructor function');
    });

    it('should throw error for empty methods array', function() {
      expect(() => {
        ControllerExportFactory.createControllerExports(MockController, []);
      }).to.throw('Methods array must be provided and contain at least one method');

      expect(() => {
        ControllerExportFactory.createControllerExports(MockController, null);
      }).to.throw('Methods array must be provided and contain at least one method');
    });

    it('should throw error for non-existent methods', function() {
      expect(() => {
        ControllerExportFactory.createControllerExports(MockController, ['nonExistentMethod']);
      }).to.throw("Method 'nonExistentMethod' does not exist on MockController");
    });

    it('should validate controller methods exist before export', function() {
      // This should work
      expect(() => {
        ControllerExportFactory.createControllerExports(MockController, ['getAll', 'create']);
      }).to.not.throw();

      // This should fail
      expect(() => {
        ControllerExportFactory.createControllerExports(MockController, ['getAll', 'invalidMethod']);
      }).to.throw("Method 'invalidMethod' does not exist on MockController");
    });
  });

  describe('createMinimalExports', function() {
    it('should create minimal exports without extras', function() {
      const methods = ['getAll', 'getById'];
      const exports = ControllerExportFactory.createMinimalExports(MockController, methods);

      // Should have the methods
      expect(exports).to.have.property('getAll');
      expect(exports).to.have.property('getById');

      // Should not have default aliases or controller getter
      expect(exports).to.not.have.property('list');
      expect(exports).to.not.have.property('show');
      expect(exports).to.not.have.property('getMockController');
    });
  });

  describe('createFullExports', function() {
    it('should create full exports with all features enabled', function() {
      const methods = ['getAll', 'getById', 'create'];
      const customConfig = {
        methodAliases: { getAll: 'findAll' }
      };

      const exports = ControllerExportFactory.createFullExports(MockController, methods, customConfig);

      // Should have the methods
      expect(exports).to.have.property('getAll');
      expect(exports).to.have.property('getById');
      expect(exports).to.have.property('create');

      // Should have default aliases
      expect(exports).to.have.property('list');
      expect(exports).to.have.property('show');
      expect(exports).to.have.property('store');

      // Should have custom alias
      expect(exports).to.have.property('findAll');

      // Should have controller getter
      expect(exports).to.have.property('getMockController');
    });
  });
});