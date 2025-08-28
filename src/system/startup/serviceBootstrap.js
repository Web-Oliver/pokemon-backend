/**
 * Service Bootstrap - Application Startup Integration
 *
 * SINGLE RESPONSIBILITY: Initialize dependency injection system during app startup
 */

import { registerServices, initializeServices, cleanupServices } from '@/system/dependency-injection/ServiceRegistration.js';

/**
 * Bootstrap services during application startup
 */
export async function bootstrapServices() {
  console.log('🚀 [BOOTSTRAP] Starting service bootstrap...');

  try {
    // Step 1: Register all services in the container
    registerServices();

    // Step 2: Initialize services that need async setup
    await initializeServices();

    console.log('✅ [BOOTSTRAP] Service bootstrap completed successfully');

  } catch (error) {
    console.error('❌ [BOOTSTRAP] Service bootstrap failed:', error);
    throw error;
  }
}

/**
 * Shutdown services during application cleanup
 */
export async function shutdownServices() {
  console.log('🛑 [BOOTSTRAP] Starting service shutdown...');

  try {
    await cleanupServices();
    console.log('✅ [BOOTSTRAP] Service shutdown completed');
  } catch (error) {
    console.error('❌ [BOOTSTRAP] Service shutdown failed:', error);
  }
}
