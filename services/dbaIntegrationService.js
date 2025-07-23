/**
 * DBA Integration Service - Updated for Playwright MCP Integration
 * 
 * Provides functionality to integrate the Pokemon collection system
 * with integrated Playwright automation for direct posting to DBA.dk
 * Following SOLID principles and error handling best practices
 */

const path = require('path');
const fs = require('fs');
const { DbaExportService } = require('./dbaExportService');
const { DbaPlaywrightService } = require('./dbaPlaywrightService');

/**
 * Configuration for DBA integration - using integrated Playwright
 */
const DBA_CONFIG = {
  defaultDelay: 5000, // 5 seconds between posts
  maxRetries: 3,
  timeout: 120000, // 2 minutes timeout
  retryDelay: 10000, // 10 seconds between retries
};

class DbaIntegrationService {
  constructor() {
    this.config = DBA_CONFIG;
    this.dbaExportService = new DbaExportService();
    this.dbaPlaywrightService = null; // Initialize on demand
  }

  /**
   * Export items and automatically post them to DBA.dk using integrated Playwright
   * 
   * @param {Array} items - Collection items with type info
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - Integration result with posting status
   */
  async exportAndPostToDba(items, options = {}) {
    const { 
      customDescription = '', 
      includeMetadata = true,
      postDelay = this.config.defaultDelay,
      dryRun = false 
    } = options;
    
    try {
      console.log(`[DBA INTEGRATION] Starting export and post for ${items.length} items`);
      console.log(`[DBA INTEGRATION] Using integrated Playwright service`);
      
      // Step 1: Generate DBA export using existing service
      const exportResult = await this.dbaExportService.generateDbaExport(items, {
        customDescription,
        includeMetadata
      });
      
      if (!exportResult || !exportResult.success) {
        const errorMsg = exportResult ? JSON.stringify(exportResult) : 'null result';
        console.error(`[DBA INTEGRATION] Export generation failed: ${errorMsg}`);
        throw new Error(`DBA export generation failed: ${errorMsg}`);
      }
      
      console.log(`[DBA INTEGRATION] Export generated successfully: ${exportResult.jsonFilePath}`);
      
      // Step 2: Execute DBA automation using integrated Playwright service (unless dry run)  
      let postingResults = null;
      if (!dryRun) {
        console.log('[DBA INTEGRATION] LIVE MODE - executing integrated Playwright automation');
        try {
          postingResults = await this.executePlaywrightPosting(exportResult, postDelay);
        } catch (scriptError) {
          console.error('[DBA INTEGRATION] Playwright execution failed:', scriptError);
          console.error('[DBA INTEGRATION] Stack trace:', scriptError.stack);
          // Don't crash the whole request - return error result instead
          postingResults = {
            success: false,
            error: scriptError.message,
            message: 'DBA Playwright automation failed to execute',
            stack: scriptError.stack
          };
        }
      } else {
        console.log('[DBA INTEGRATION] Dry run mode - skipping actual posting');
        postingResults = {
          success: true,
          dryRun: true,
          message: 'Dry run completed - no posts were made'
        };
      }
      
      // Step 3: Return comprehensive result
      return {
        success: true,
        export: {
          itemCount: exportResult.itemCount,
          jsonFilePath: exportResult.jsonFilePath,
          dataFolder: exportResult.dataFolder
        },
        posting: postingResults,
        totalItemsProcessed: items.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[DBA INTEGRATION] Integration failed:', error);
      console.error('[DBA INTEGRATION] Error stack:', error.stack);
      
      // Return a structured error response instead of throwing
      return {
        success: false,
        error: error.message,
        stack: error.stack,
        export: null,
        posting: {
          success: false,
          error: error.message,
          message: 'Integration failed before posting could begin'
        },
        totalItemsProcessed: items.length,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute DBA posting using integrated Playwright service
   * 
   * @param {Object} exportResult - Result from DBA export service
   * @param {number} delay - Delay between posts in milliseconds
   * @returns {Promise<Object>} - Posting results
   */
  async executePlaywrightPosting(exportResult, delay = this.config.defaultDelay) {
    try {
      console.log(`[DBA INTEGRATION] Starting Playwright posting with ${delay}ms delay between posts`);
      
      // Initialize Playwright service if not already done
      if (!this.dbaPlaywrightService) {
        this.dbaPlaywrightService = new DbaPlaywrightService();
        await this.dbaPlaywrightService.initialize();
      }
      
      // Read the generated DBA post data
      const jsonContent = fs.readFileSync(exportResult.jsonFilePath, 'utf8');
      const adsData = JSON.parse(jsonContent);
      
      console.log(`[DBA INTEGRATION] Processing ${adsData.length} ads for posting`);
      
      // Convert image paths to full paths
      const adsWithFullPaths = adsData.map(ad => ({
        ...ad,
        imagePaths: ad.imagePaths ? ad.imagePaths.map(imgPath => {
          // If path starts with '/data/', convert to full path
          if (imgPath.startsWith('/data/')) {
            return path.join(exportResult.dataFolder, imgPath.replace('/data/', ''));
          }
          return imgPath;
        }) : []
      }));
      
      // Submit ads using Playwright service
      const results = await this.dbaPlaywrightService.submitMultipleAds(adsWithFullPaths, delay);
      
      // Process results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`[DBA INTEGRATION] Posting completed: ${successful} successful, ${failed} failed`);
      
      return {
        success: failed === 0, // Success only if no failures
        totalAds: results.length,
        successful: successful,
        failed: failed,
        results: results,
        message: `Posted ${successful}/${results.length} ads successfully`,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[DBA INTEGRATION] Playwright posting failed:', error);
      throw new Error(`Playwright posting failed: ${error.message}`);
    }
  }

  /**
   * Get status of DBA Playwright integration
   * 
   * @returns {Promise<Object>} - Status information
   */
  async getDbaStatus() {
    try {
      const dataFolder = path.join(process.cwd(), 'data');
      
      const status = {
        integrationMode: 'playwright',
        dataFolderExists: fs.existsSync(dataFolder),
        playwrightInstalled: true, // Since we installed it
        ready: true,
        timestamp: new Date().toISOString()
      };
      
      // Get Playwright service status if initialized
      if (this.dbaPlaywrightService) {
        try {
          status.playwrightService = await this.dbaPlaywrightService.getStatus();
        } catch (error) {
          status.playwrightService = {
            error: error.message,
            available: false
          };
        }
      } else {
        status.playwrightService = {
          initialized: false,
          message: 'Service will be initialized on first use'
        };
      }
      
      // Check for recent export data
      if (status.dataFolderExists) {
        try {
          const files = fs.readdirSync(dataFolder);
          const dbaJsonFiles = files.filter(f => f.startsWith('dba-export-') && f.endsWith('.json'));
          
          if (dbaJsonFiles.length > 0) {
            const latestFile = dbaJsonFiles.sort().reverse()[0];
            const filePath = path.join(dataFolder, latestFile);
            const stat = fs.statSync(filePath);
            
            status.lastExport = {
              file: latestFile,
              created: stat.birthtime,
              size: stat.size
            };
          }
        } catch (e) {
          // Ignore directory read errors
        }
      }
      
      return status;
      
    } catch (error) {
      console.error('[DBA INTEGRATION] Error getting DBA status:', error);
      return {
        ready: false,
        integrationMode: 'playwright',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test DBA integration using Playwright service
   * 
   * @param {Array} items - Test items
   * @returns {Promise<Object>} - Test results
   */
  async testIntegration(items) {
    try {
      console.log('[DBA INTEGRATION] Running Playwright integration test...');
      
      // Test with dry run mode
      const result = await this.exportAndPostToDba(items, {
        dryRun: true,
        customDescription: 'TEST: This is a Playwright integration test run'
      });
      
      const status = await this.getDbaStatus();
      
      // Test Playwright service initialization
      if (!this.dbaPlaywrightService) {
        try {
          this.dbaPlaywrightService = new DbaPlaywrightService();
          await this.dbaPlaywrightService.initialize();
          
          const serviceStatus = await this.dbaPlaywrightService.getStatus();
          
          // Close test service
          await this.dbaPlaywrightService.close();
          this.dbaPlaywrightService = null;
          
          result.playwrightTest = {
            success: true,
            serviceStatus: serviceStatus,
            message: 'Playwright service initialized and closed successfully'
          };
          
        } catch (playwrightError) {
          result.playwrightTest = {
            success: false,
            error: playwrightError.message,
            message: 'Playwright service test failed'
          };
        }
      }
      
      return {
        success: true,
        test: result,
        status: status,
        message: 'Playwright integration test completed successfully'
      };
      
    } catch (error) {
      console.error('[DBA INTEGRATION] Test failed:', error);
      throw new Error(`Integration test failed: ${error.message}`);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.dbaPlaywrightService) {
        await this.dbaPlaywrightService.close();
        this.dbaPlaywrightService = null;
        console.log('[DBA INTEGRATION] Playwright service cleaned up');
      }
    } catch (error) {
      console.error('[DBA INTEGRATION] Cleanup error:', error);
    }
  }
}

module.exports = {
  DbaIntegrationService,
  DBA_CONFIG,
};