/**
 * Service Bootstrap - Application Startup Integration
 * 
 * SINGLE RESPONSIBILITY: Initialize dependency injection system during app startup
 * Integrates new architecture with existing application
 */

import { registerServices, initializeServices, cleanupServices } from '@/Infrastructure/DependencyInjection/ServiceRegistration.js';

/**
 * Bootstrap services during application startup
 * 
 * Call this BEFORE starting the Express server
 */
export async function bootstrapServices(): Promise<void> {
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
 * 
 * Call this during graceful shutdown
 */
export async function shutdownServices(): Promise<void> {
  console.log('🛑 [BOOTSTRAP] Starting service shutdown...');
  
  try {
    await cleanupServices();
    console.log('✅ [BOOTSTRAP] Service shutdown completed');
  } catch (error) {
    console.error('❌ [BOOTSTRAP] Service shutdown failed:', error);
  }
}

/**
 * Health check for services
 */
export function checkServiceHealth(): { healthy: boolean; details: any } {
  try {
    // TODO: Implement actual health checks
    return {
      healthy: true,
      details: {
        message: 'All services healthy',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      healthy: false,
      details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}