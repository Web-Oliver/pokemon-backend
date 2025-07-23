/**
 * DBA Playwright Service - Integrated DBA Automation using Playwright MCP
 * 
 * This service replaces the external DBA automation scripts and integrates
 * Playwright browser automation directly into the Pokemon collection backend.
 * Following SOLID principles and utilizing MCP tools for browser control.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Configuration for DBA automation
 */
const DBA_CONFIG = {
  baseUrl: 'https://www.dba.dk',
  userDataDir: path.resolve('/home/oliver/dba/user-data-dba'), // Use existing logged-in session
  defaultDelay: { min: 500, max: 2000 },
  typingDelay: { min: 30, max: 150 },
  navigationTimeout: 30000,
  actionTimeout: 10000,
  retryAttempts: 3,
  viewport: { width: 1920, height: 1080 },
};

/**
 * Helper function for random delays to mimic human behavior
 */
function randomDelay(min = 500, max = 2000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * DBA Playwright Service Class
 * Handles direct browser automation for posting to DBA.dk
 */
class DbaPlaywrightService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.config = DBA_CONFIG;
  }

  /**
   * Initialize browser with persistent session
   */
  async initialize() {
    try {
      console.log('[DBA PLAYWRIGHT] Initializing browser context...');
      console.log(`[DBA PLAYWRIGHT] Using user data directory: ${this.config.userDataDir}`);
      
      // Verify the user data directory exists (should contain logged-in session)
      if (!fs.existsSync(this.config.userDataDir)) {
        throw new Error(`User data directory not found: ${this.config.userDataDir}. Please ensure the DBA login session exists.`);
      }

      // Launch persistent browser context to maintain login sessions
      this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
        headless: false, // Keep visible for debugging - will work in WSL with X11
        viewport: this.config.viewport,
        slowMo: randomDelay(200, 500),
        args: [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-sandbox', // Required for WSL/Linux environments
          '--disable-setuid-sandbox',
          '--disable-gpu' // Disable GPU acceleration for headless environments
        ],
        permissions: ['geolocation', 'notifications'],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        acceptDownloads: true,
        timeout: 30000, // 30 second timeout for browser launch
        // Disable video and HAR recording for performance
      });

      // Get or create the first page
      this.page = this.context.pages()[0] || await this.context.newPage();
      
      // Set longer timeouts for stability
      this.page.setDefaultTimeout(this.config.actionTimeout);
      this.page.setDefaultNavigationTimeout(this.config.navigationTimeout);

      console.log('[DBA PLAYWRIGHT] Browser initialized successfully');
      return true;

    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Failed to initialize browser:', error);
      throw new Error(`Browser initialization failed: ${error.message}`);
    }
  }

  /**
   * Ensure user is logged in to DBA.dk
   */
  async ensureLoggedIn() {
    try {
      console.log('[DBA PLAYWRIGHT] Checking login status...');
      
      // Navigate to DBA homepage
      await this.page.goto(this.config.baseUrl, { 
        waitUntil: 'networkidle', 
        timeout: this.config.navigationTimeout 
      });

      // Wait for page to load completely
      await this.page.waitForTimeout(randomDelay(1000, 2000));

      // Check if user is already logged in by looking for "Min DBA" or "Log ind"
      const isLoggedIn = await this.page.locator('text=Min DBA').isVisible().catch(() => false);
      
      if (isLoggedIn) {
        console.log('[DBA PLAYWRIGHT] User already logged in');
        return true;
      }

      // Not logged in - check if login button exists
      const loginButton = await this.page.locator('text=Log ind').first();
      const loginVisible = await loginButton.isVisible().catch(() => false);

      if (loginVisible) {
        console.log('[DBA PLAYWRIGHT] User not logged in. Manual login required.');
        console.log('[DBA PLAYWRIGHT] Please log in manually in the browser window...');
        
        // Wait for user to complete login - look for "Min DBA" to appear
        try {
          await this.page.waitForSelector('text=Min DBA', { 
            timeout: 300000 // 5 minutes for manual login
          });
          console.log('[DBA PLAYWRIGHT] Login completed successfully');
          return true;
        } catch (timeoutError) {
          throw new Error('Login timeout - user did not complete login within 5 minutes');
        }
      }

      throw new Error('Unable to determine login status - page structure may have changed');

    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Login check failed:', error);
      throw new Error(`Login verification failed: ${error.message}`);
    }
  }

  /**
   * Submit a single form to DBA.dk
   */
  async submitForm(formData) {
    const { title, description, price, imagePaths = [], metadata = null } = formData;

    try {
      console.log(`[DBA PLAYWRIGHT] Starting form submission: ${title}`);
      
      if (metadata) {
        console.log(`[DBA PLAYWRIGHT] Card: ${metadata.cardName} | Set: ${metadata.setName} | Grade: PSA ${metadata.grade}`);
      }

      // Step 1: Ensure we're logged in
      await this.ensureLoggedIn();

      // Step 2: Navigate to create new ad
      console.log('[DBA PLAYWRIGHT] Clicking "Ny annonce"...');
      await this.page.getByRole('link', { name: 'Ny annonce' }).click();
      await this.page.waitForTimeout(randomDelay(800, 1500));

      // Step 3: Click marketplace option
      console.log('[DBA PLAYWRIGHT] Selecting marketplace option...');
      await this.page.getByRole('link', { name: 'Opret annonce på' }).click();
      await this.page.waitForTimeout(randomDelay(1000, 2000));

      // Step 4: Upload images if provided
      if (imagePaths && imagePaths.length > 0) {
        console.log(`[DBA PLAYWRIGHT] Uploading ${imagePaths.length} images...`);
        await this.uploadImages(imagePaths);
      }

      // Step 5: Select category using AI assistant
      console.log('[DBA PLAYWRIGHT] Selecting category...');
      await this.selectCategory();

      // Step 6: Fill form fields
      console.log('[DBA PLAYWRIGHT] Filling form fields...');
      await this.fillFormFields(title, description, price);

      // Step 7: Navigate through form steps
      console.log('[DBA PLAYWRIGHT] Proceeding through form steps...');
      await this.completeFormFlow();

      // Step 8: Publish the ad
      console.log('[DBA PLAYWRIGHT] Publishing ad...');
      await this.publishAd();

      // Step 9: Verify success
      await this.verifySuccess();

      console.log(`[DBA PLAYWRIGHT] ✅ Successfully submitted: ${title}`);
      return {
        success: true,
        message: 'Ad published successfully to DBA.dk',
        title: title,
        metadata: metadata,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[DBA PLAYWRIGHT] ❌ Form submission failed for "${title}":`, error);
      
      // Take screenshot for debugging
      try {
        const screenshotPath = path.join(__dirname, '../data', `dba-error-${Date.now()}.png`);
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[DBA PLAYWRIGHT] Error screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error('[DBA PLAYWRIGHT] Failed to take error screenshot:', screenshotError);
      }

      return {
        success: false,
        error: error.message,
        title: title,
        metadata: metadata,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Upload images to the form
   */
  async uploadImages(imagePaths) {
    try {
      // Validate image paths exist
      const validPaths = imagePaths.filter(imgPath => {
        const exists = fs.existsSync(imgPath);
        if (!exists) {
          console.warn(`[DBA PLAYWRIGHT] Image not found: ${imgPath}`);
        }
        return exists;
      });

      if (validPaths.length === 0) {
        console.warn('[DBA PLAYWRIGHT] No valid images found to upload');
        return;
      }

      // Wait for and click the image upload button
      const fileChooserPromise = this.page.waitForEvent('filechooser');
      await this.page.getByRole('button', { name: 'Billeder' }).click();
      
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(validPaths);
      
      console.log(`[DBA PLAYWRIGHT] Uploaded ${validPaths.length} images`);
      
      // Wait for upload to complete
      await this.page.waitForTimeout(randomDelay(2000, 4000));
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Image upload failed:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  /**
   * Select the Pokemon card category using AI assistant
   */
  async selectCategory() {
    try {
      // Wait for AI assistant to load
      await this.page.waitForTimeout(randomDelay(2000, 4000));
      
      // Look for and click the Pokemon/Trading card category
      const categoryLocator = this.page.getByText('Samlerobjekter/Samlekort');
      await categoryLocator.click();
      
      console.log('[DBA PLAYWRIGHT] Category selected: Samlerobjekter/Samlekort');
      await this.page.waitForTimeout(randomDelay(800, 1500));
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Category selection failed:', error);
      throw new Error(`Category selection failed: ${error.message}`);
    }
  }

  /**
   * Fill the main form fields
   */
  async fillFormFields(title, description, price) {
    try {
      // Fill title with human-like typing
      const titleField = this.page.getByRole('textbox', { name: 'Annonceoverskrift' });
      await titleField.fill(''); // Clear first
      await titleField.type(title, { delay: randomDelay(50, 150) });
      await this.page.waitForTimeout(randomDelay(300, 800));

      // Fill description with human-like typing
      const descField = this.page.getByRole('textbox', { name: 'Beskrivelse' });
      await descField.fill(''); // Clear first
      await descField.type(description, { delay: randomDelay(30, 100) });
      await this.page.waitForTimeout(randomDelay(400, 900));

      // Fill price
      const priceField = this.page.getByRole('spinbutton', { name: 'Pris' });
      await priceField.fill(price.toString());
      await this.page.waitForTimeout(randomDelay(300, 700));

      console.log('[DBA PLAYWRIGHT] Form fields filled successfully');
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Form field filling failed:', error);
      throw new Error(`Form field filling failed: ${error.message}`);
    }
  }

  /**
   * Complete the multi-step form flow
   */
  async completeFormFlow() {
    try {
      // Step 1: Click first "Fortsæt"
      await this.page.getByRole('button', { name: 'Fortsæt' }).click();
      await this.page.waitForTimeout(randomDelay(800, 1500));

      // Step 2: Select shipping option "Jeg kan ikke sende varen"
      await this.page.getByRole('radio', { name: 'Jeg kan ikke sende varen' }).click();
      await this.page.waitForTimeout(randomDelay(400, 800));

      // Step 3: Click second "Fortsæt"
      await this.page.getByRole('button', { name: 'Fortsæt' }).click();
      await this.page.waitForTimeout(randomDelay(900, 1600));

      // Step 4: Select free basic ad package
      await this.page.getByRole('checkbox', { name: 'Basis Mere information om' }).click();
      await this.page.waitForTimeout(randomDelay(500, 1000));

      console.log('[DBA PLAYWRIGHT] Form flow completed successfully');
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Form flow failed:', error);
      throw new Error(`Form flow completion failed: ${error.message}`);
    }
  }

  /**
   * Publish the ad
   */
  async publishAd() {
    try {
      await this.page.getByRole('button', { name: 'Offentliggør annoncen' }).click();
      await this.page.waitForTimeout(randomDelay(1000, 2000));
      
      console.log('[DBA PLAYWRIGHT] Ad publication initiated');
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Ad publication failed:', error);
      throw new Error(`Ad publication failed: ${error.message}`);
    }
  }

  /**
   * Verify successful submission
   */
  async verifySuccess() {
    try {
      // Wait for success confirmation
      await this.page.waitForSelector('h3:has-text("Fremragende!")', { 
        timeout: this.config.actionTimeout 
      });
      
      console.log('[DBA PLAYWRIGHT] Success confirmation detected');
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Success verification failed:', error);
      throw new Error(`Success verification failed: ${error.message}`);
    }
  }

  /**
   * Submit multiple ads with delays
   */
  async submitMultipleAds(adsArray, delayBetweenAds = 5000) {
    const results = [];
    
    console.log(`[DBA PLAYWRIGHT] Starting batch submission of ${adsArray.length} ads`);
    
    for (let i = 0; i < adsArray.length; i++) {
      const ad = adsArray[i];
      console.log(`[DBA PLAYWRIGHT] Processing ad ${i + 1}/${adsArray.length}: ${ad.title}`);
      
      try {
        const result = await this.submitForm(ad);
        results.push(result);
        
        // Add delay between submissions (except for last ad)
        if (i < adsArray.length - 1) {
          const randomDelayMs = randomDelay(delayBetweenAds - 2000, delayBetweenAds + 3000);
          console.log(`[DBA PLAYWRIGHT] Waiting ${randomDelayMs/1000} seconds before next submission...`);
          await new Promise(resolve => setTimeout(resolve, randomDelayMs));
        }
        
      } catch (error) {
        console.error(`[DBA PLAYWRIGHT] Failed to submit ad ${i + 1}:`, error.message);
        results.push({
          success: false,
          error: error.message,
          title: ad.title,
          metadata: ad.metadata || null,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(filename = `dba-debug-${Date.now()}.png`) {
    try {
      if (this.page) {
        const screenshotPath = path.join(__dirname, '../data', filename);
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[DBA PLAYWRIGHT] Screenshot saved: ${screenshotPath}`);
        return screenshotPath;
      }
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Screenshot failed:', error);
    }
    return null;
  }

  /**
   * Get current page status and info
   */
  async getStatus() {
    try {
      const status = {
        browserInitialized: !!this.context,
        pageAvailable: !!this.page,
        currentUrl: this.page ? await this.page.url().catch(() => null) : null,
        sessionPath: this.config.userDataDir,
        sessionExists: fs.existsSync(this.config.userDataDir),
        timestamp: new Date().toISOString()
      };

      if (this.page) {
        try {
          status.pageTitle = await this.page.title();
          status.isVisible = await this.page.isVisible('body').catch(() => false);
        } catch (e) {
          // Ignore page access errors
        }
      }

      return status;
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Status check failed:', error);
      return {
        browserInitialized: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clean shutdown of browser resources
   */
  async close() {
    try {
      console.log('[DBA PLAYWRIGHT] Closing browser resources...');
      
      if (this.context) {
        await this.context.close();
        this.context = null;
        this.page = null;
      }
      
      console.log('[DBA PLAYWRIGHT] Browser closed successfully');
      
    } catch (error) {
      console.error('[DBA PLAYWRIGHT] Error closing browser:', error);
    }
  }
}

module.exports = {
  DbaPlaywrightService,
  DBA_CONFIG,
  randomDelay
};