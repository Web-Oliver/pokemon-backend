/**
 * Service Registration Configuration
 * 
 * SINGLE PLACE to register ALL services
 * Eliminates service instantiation duplication across the codebase
 */

import { container, ServiceKeys } from './ServiceContainer.js';

// OCR Services
import { OcrTextExtractorFactory } from '@/Application/Services/Ocr/OcrTextExtractor.js';
import { OcrTextParserFactory } from '@/Application/Services/Ocr/OcrTextParser.js';
import { CardMatcherFactory } from '@/Application/Services/Ocr/CardMatcher.js';
import { ConfidenceScorerFactory } from '@/Application/Services/Ocr/ConfidenceScorer.js';
import { OcrOrchestratorFactory } from '@/Application/Services/Ocr/OcrOrchestrator.js';

// Repositories
import CardRepository from '@/Infrastructure/Persistence/Repositories/CardRepository.js';
import SetRepository from '@/Infrastructure/Persistence/Repositories/SetRepository.js';
import ProductRepository from '@/Infrastructure/Persistence/Repositories/ProductRepository.js';

/**
 * Register all services in the container
 */
export function registerServices() {
  console.log('📦 Registering all services...');

  // ============ REPOSITORY REGISTRATIONS ============
  container.registerSingleton(ServiceKeys.CARD_REPOSITORY, () => {
    console.log('🗃️ Creating CardRepository singleton');
    return new CardRepository();
  });

  container.registerSingleton(ServiceKeys.SET_REPOSITORY, () => {
    console.log('🗃️ Creating SetRepository singleton');
    return new SetRepository();
  });

  container.registerSingleton(ServiceKeys.PRODUCT_REPOSITORY, () => {
    console.log('🗃️ Creating ProductRepository singleton');
    return new ProductRepository();
  });

  // ============ OCR SERVICE REGISTRATIONS ============

  // OCR Text Extractor - singleton (expensive to initialize)
  container.registerSingleton(ServiceKeys.OCR_TEXT_EXTRACTOR, () => {
    console.log('🔍 Creating OCR Text Extractor');
    return OcrTextExtractorFactory.create();
  });

  // OCR Text Parser - singleton (stateless, can be reused)
  container.registerSingleton(ServiceKeys.OCR_TEXT_PARSER, () => {
    console.log('📝 Creating OCR Text Parser');
    return OcrTextParserFactory.create();
  });

  // Card Matcher - singleton (depends on repositories)
  container.registerSingleton(ServiceKeys.CARD_MATCHER, () => {
    console.log('🎯 Creating Card Matcher');
    const cardRepo = container.resolve(ServiceKeys.CARD_REPOSITORY);
    const setRepo = container.resolve(ServiceKeys.SET_REPOSITORY);
    return CardMatcherFactory.create(cardRepo, setRepo);
  });

  // PSA Matcher - singleton (same as card matcher for now)
  container.registerSingleton(ServiceKeys.PSA_MATCHER, () => {
    console.log('🏆 Creating PSA Matcher');
    const cardRepo = container.resolve(ServiceKeys.CARD_REPOSITORY);
    const setRepo = container.resolve(ServiceKeys.SET_REPOSITORY);
    return CardMatcherFactory.create(cardRepo, setRepo); // Reuse card matcher
  });

  // Confidence Scorer - singleton (stateless)
  container.registerSingleton(ServiceKeys.CONFIDENCE_SCORER, () => {
    console.log('📊 Creating Confidence Scorer');
    return ConfidenceScorerFactory.create();
  });

  // OCR Orchestrator - transient (might need different configurations)
  container.register(ServiceKeys.OCR_ORCHESTRATOR, () => {
    console.log('🎼 Creating OCR Orchestrator');
    
    const textExtractor = container.resolve(ServiceKeys.OCR_TEXT_EXTRACTOR);
    const textParser = container.resolve(ServiceKeys.OCR_TEXT_PARSER);
    const cardMatcher = container.resolve(ServiceKeys.CARD_MATCHER);
    const psaMatcher = container.resolve(ServiceKeys.PSA_MATCHER);
    const confidenceScorer = container.resolve(ServiceKeys.CONFIDENCE_SCORER);

    return OcrOrchestratorFactory.create(
      textExtractor,
      textParser,
      cardMatcher,
      psaMatcher,
      confidenceScorer
    );
  });

  console.log('✅ All services registered successfully');
  
  // Log registration stats
  const stats = container.getStats();
  console.log('📊 Registration stats:', stats);
}

/**
 * Initialize services that need startup initialization
 */
export async function initializeServices() {
  console.log('🚀 Initializing services...');

  try {
    // OCR services are lazy-initialized, so no need to initialize here
    console.log('✅ Services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

/**
 * Cleanup services on application shutdown
 */
export async function cleanupServices() {
  console.log('🧹 Cleaning up services...');
  
  try {
    container.clear();
    console.log('✅ Services cleaned up successfully');
  } catch (error) {
    console.error('❌ Service cleanup failed:', error);
  }
}