/**
 * Logger Integration Tests
 * 
 * Tests the centralized logging utility functionality including
 * section headers, operation logging, and error handling.
 */

const Logger = require('../../utils/Logger');

describe('Logger Integration Tests', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let logOutput;
  let errorOutput;

  beforeEach(() => {
    // Capture console output for testing
    logOutput = [];
    errorOutput = [];
    
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };
    
    console.error = (...args) => {
      errorOutput.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Section Logging', () => {
    it('should create consistent section headers', () => {
      Logger.section('Test Section');
      
      expect(logOutput).toHaveLength(3);
      expect(logOutput[0]).toBe('='.repeat(80));
      expect(logOutput[1]).toContain('Test Section');
      expect(logOutput[2]).toBe('='.repeat(80));
    });

    it('should handle empty section titles', () => {
      Logger.section('');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toBe('='.repeat(80));
    });

    it('should handle null section titles', () => {
      Logger.section(null);
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toBe('='.repeat(80));
    });
  });

  describe('Operation Logging', () => {
    it('should log operation start with consistent format', () => {
      Logger.operationStart('Card', 'CREATE', { id: '123', name: 'Test Card' });
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('=== CREATE CARD START ===');
      expect(logOutput.join(' ')).toContain('Test Card');
    });

    it('should log operation success', () => {
      Logger.operationSuccess('Card', 'CREATE', { id: '123' });
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput.some(log => log.includes('=== CREATE CARD END ==='))).toBe(true);
    });

    it('should handle operations without details', () => {
      Logger.operationStart('Card', 'DELETE');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toContain('=== DELETE CARD START ===');
    });

    it('should handle complex details objects', () => {
      const details = {
        id: '123',
        changes: ['price', 'condition'],
        metadata: { source: 'api' }
      };
      
      Logger.operationStart('Card', 'UPDATE', details);
      
      const allOutput = logOutput.join(' ');

      expect(allOutput).toContain('changes');
      expect(allOutput).toContain('metadata');
    });
  });

  describe('Error Logging', () => {
    it('should log errors with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', operation: 'create' };
      
      Logger.operationError('Card', 'CREATE', error, context);
      
      expect(errorOutput.length).toBeGreaterThan(0);
      expect(errorOutput.some(log => log.includes('=== CREATE CARD ERROR ==='))).toBe(true);
      expect(errorOutput.some(log => log.includes('Test error'))).toBe(true);
      expect(errorOutput.some(log => log.includes('userId'))).toBe(true);
    });

    it('should handle simple error logging', () => {
      const error = new Error('Simple error');
      
      Logger.error('Card', 'Simple error', error);
      
      expect(errorOutput.length).toBeGreaterThan(0);
      expect(errorOutput.some(log => log.includes('[ERROR:CARD]'))).toBe(true);
      expect(errorOutput.some(log => log.includes('Simple error'))).toBe(true);
    });

    it('should handle non-Error objects', () => {
      Logger.error('Card', 'String error', 'String error message');
      
      expect(errorOutput.length).toBeGreaterThan(0);
      expect(errorOutput.some(log => log.includes('String error message'))).toBe(true);
    });

    it('should include stack traces for Error objects in development', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      
      const error = new Error('Error with stack');

      Logger.error('Card', 'Error with stack', error);
      
      expect(errorOutput.some(log => log.includes('Stack:'))).toBe(true);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      const metrics = {
        memoryUsage: 1024,
        queryCount: 3
      };
      
      Logger.performance('Database Query', 150, metrics);
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('[PERFORMANCE]');
      expect(logOutput[0]).toContain('Database Query');
      expect(logOutput[0]).toContain('150ms');
    });

    it('should handle missing metrics', () => {
      Logger.performance('Simple Operation', 50);
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toContain('[PERFORMANCE]');
      expect(logOutput[0]).toContain('Simple Operation');
      expect(logOutput[0]).toContain('50ms');
    });
  });

  describe('Debug Logging', () => {
    it('should log debug information in non-production', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      
      Logger.debug('TestComponent', 'Test debug message', { data: 'test' });
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('[DEBUG:TESTCOMPONENT]');
      expect(logOutput[0]).toContain('Test debug message');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not log debug information in production', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'production';
      
      Logger.debug('TestComponent', 'Hidden debug message');
      
      expect(logOutput).toHaveLength(0);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Integration with BaseController', () => {
    it('should integrate seamlessly with controller operations', () => {
      // Simulate controller operation logging
      Logger.section('Card Controller');
      Logger.operationStart('Card', 'GET_ALL', { filters: { sold: false } });
      Logger.performance('Query Execution', 45, { results: 10 });
      
      expect(logOutput.length).toBeGreaterThan(4);
      expect(logOutput[1]).toContain('Card Controller');
      expect(logOutput.some(log => log.includes('=== GET_ALL CARD START ==='))).toBe(true);
      expect(logOutput.some(log => log.includes('[PERFORMANCE]'))).toBe(true);
    });

    it('should handle error scenarios in controllers', () => {
      const error = new Error('Database connection failed');
      const context = { method: 'GET', path: '/api/cards' };
      
      Logger.section('Card Controller Error');
      Logger.operationError('Card', 'GET_ALL', error, context);
      
      expect(logOutput).toHaveLength(3); // Section headers
      expect(errorOutput.length).toBeGreaterThan(0);
      expect(errorOutput.some(log => log.includes('Database connection failed'))).toBe(true);
      expect(errorOutput.some(log => log.includes('/api/cards'))).toBe(true);
    });
  });

  describe('Concurrent Logging', () => {
    it('should handle concurrent logging operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              Logger.operationStart('Card', 'CREATE', { id: i });
              resolve();
            }, Math.random() * 10);
          })
        );
      }
      
      await Promise.all(promises);
      
      expect(logOutput.length).toBeGreaterThanOrEqual(10);
      const createLogs = logOutput.filter(log => log.includes('=== CREATE CARD START ==='));

      expect(createLogs).toHaveLength(10);
    });
  });

  describe('Memory Usage', () => {
    it('should not cause memory leaks with extensive logging', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many log entries
      for (let i = 0; i < 1000; i++) {
        Logger.operationStart('Card', 'TEST', { iteration: i });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB for 1000 logs)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});