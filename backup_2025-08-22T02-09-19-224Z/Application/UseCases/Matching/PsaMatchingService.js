/**
 * Legacy PSA Matching Service Wrapper
 *
 * Maintains backward compatibility by delegating to UnifiedPsaMatchingService
 * This replaces the original PsaMatchingService.js with 280 lines of code
 */

import UnifiedPsaMatchingService from './UnifiedPsaMatchingService.js';
// Legacy wrapper - delegates all calls to the unified service
export default new UnifiedPsaMatchingService();
