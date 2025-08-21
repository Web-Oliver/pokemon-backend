#!/usr/bin/env node

/**
 * Route Cache Standardization Script
 *
 * Single Responsibility: Automatically apply cache standardization to all route files
 * Scans route directory and ensures consistent cache middleware application
 * Generates reports and fixes missing cache configurations
 */

import fs from 'fs';
import path from 'path';
import { generateCacheStandardizationReport,
  ROUTE_FILE_CACHE_CONFIG,
  NO_CACHE_ROUTE_FILES
  } from '@/middleware/CacheMiddlewareStandardizer.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
/**
 * Get all route files from the routes directory
 */
function getRouteFiles(routesDir) {
  try {
    const files = fs.readdirSync(routesDir)
      .filter(file => file.endsWith('.js'))
      .filter(file => !file.startsWith('_') && !file.startsWith('.'))
      .sort();

    Logger.operationSuccess('ROUTE_SCAN', `Found ${files.length} route files`, { files });
    return files;
  } catch (error) {
    Logger.operationError('ROUTE_SCAN', 'Failed to scan route directory', error);
    return [];
  }
}

/**
 * Analyze route file for cache middleware usage
 */
function analyzeRouteFileCache(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    const analysis = {
      hasImports: {
        cachePresets: content.includes('cachePresets'),
        searchCache: content.includes('searchCache'),
        routeCache: content.includes('routeCache')
      },
      cacheUsage: {
        presetUsage: (content.match(/cachePresets\.\w+/g) || []).length,
        customCache: content.includes('searchCacheMiddleware'),
        noCacheFound: false
      },
      routeCount: (content.match(/router\.(get|post|put|patch|delete)/g) || []).length
    };

    analysis.cacheUsage.noCacheFound =
      analysis.cacheUsage.presetUsage === 0 &&
      !analysis.cacheUsage.customCache;

    return analysis;

  } catch (error) {
    Logger.operationError('ROUTE_ANALYSIS', `Failed to analyze ${filePath}`, error);
    return null;
  }
}

/**
 * Generate route cache usage recommendations
 */
function generateRecommendations(routeFile, analysis, isConfigured) {
  const recommendations = [];

  if (!isConfigured && !NO_CACHE_ROUTE_FILES.some(f => routeFile.includes(f))) {
    recommendations.push(`Add ${routeFile} to ROUTE_FILE_CACHE_CONFIG`);
  }

  if (analysis && analysis.cacheUsage.noCacheFound && analysis.routeCount > 0) {
    recommendations.push(`${routeFile} has ${analysis.routeCount} routes but no cache middleware`);
  }

  if (analysis && !analysis.hasImports.cachePresets && analysis.routeCount > 0) {
    recommendations.push(`${routeFile} should import cachePresets for standardized caching`);
  }

  return recommendations;
}

/**
 * Generate comprehensive cache standardization report
 */
function generateComprehensiveReport(routesDir) {
  Logger.operationStart('COMPREHENSIVE_ANALYSIS', 'Starting comprehensive cache analysis');

  const routeFiles = getRouteFiles(routesDir);
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRoutes: routeFiles.length,
      configured: 0,
      needsConfig: 0,
      intentionallySkipped: 0,
      hasCache: 0,
      noCache: 0
    },
    details: {},
    recommendations: [],
    configurationCoverage: {
      covered: [],
      missing: [],
      intentionallySkipped: []
    }
  };

  // Analyze each route file
  routeFiles.forEach(routeFile => {
    const filePath = path.join(routesDir, routeFile);
    const analysis = analyzeRouteFileCache(filePath);
    const isConfigured = Boolean(ROUTE_FILE_CACHE_CONFIG[routeFile]);
    const isIntentionallySkipped = NO_CACHE_ROUTE_FILES.some(f => routeFile.includes(f));

    const detail = {
      configured: isConfigured,
      intentionallySkipped: isIntentionallySkipped,
      analysis,
      recommendations: generateRecommendations(routeFile, analysis, isConfigured)
    };

    report.details[routeFile] = detail;

    // Update summary counts
    if (isConfigured) {
      report.summary.configured++;
      report.configurationCoverage.covered.push(routeFile);
    } else if (isIntentionallySkipped) {
      report.summary.intentionallySkipped++;
      report.configurationCoverage.intentionallySkipped.push(routeFile);
    } else {
      report.summary.needsConfig++;
      report.configurationCoverage.missing.push(routeFile);
    }

    if (analysis && !analysis.cacheUsage.noCacheFound) {
      report.summary.hasCache++;
    } else if (analysis && analysis.routeCount > 0) {
      report.summary.noCache++;
    }

    // Add recommendations to global list
    report.recommendations.push(...detail.recommendations);
  });

  // Generate summary recommendations
  if (report.summary.needsConfig > 0) {
    report.recommendations.unshift(
      `${report.summary.needsConfig} route files need cache configuration`
    );
  }

  if (report.summary.noCache > 0) {
    report.recommendations.unshift(
      `${report.summary.noCache} route files have no cache middleware`
    );
  }

  Logger.operationSuccess('COMPREHENSIVE_ANALYSIS', 'Cache analysis completed', {
    totalRoutes: report.summary.totalRoutes,
    configured: report.summary.configured,
    needsConfig: report.summary.needsConfig
  });

  return report;
}

/**
 * Generate configuration template for missing route files
 */
function generateConfigTemplate(routeFiles) {
  const missingFiles = routeFiles.filter(file => !ROUTE_FILE_CACHE_CONFIG[file]);

  if (missingFiles.length === 0) {
    Logger.operationSuccess('CONFIG_TEMPLATE', 'All route files are already configured');
    return '';
  }

  Logger.operationStart('CONFIG_TEMPLATE', `Generating config template for ${missingFiles.length} files`);

  let template = '\n// Add these configurations to ROUTE_FILE_CACHE_CONFIG:\n\n';

  missingFiles.forEach(file => {
    const baseName = file.replace('.js', '');

    template += `  '${file}': {\n`;
    template += `    defaultPreset: '${baseName}Data', // Adjust as needed\n`;
    template += '    routeSpecific: {\n';
    template += `      '/': { GET: '${baseName}Data' },\n`;
    template += `      '/:id': { GET: '${baseName}Details' }\n`;
    template += '      // Add more route-specific configurations as needed\n';
    template += '    }\n';
    template += '  },\n\n';
  });

  return template;
}

/**
 * Main execution function
 */
async function main() {
  const routesDir = path.join(__dirname, '..', 'routes');

  console.log('🔍 Pokemon Collection Backend - Cache Standardization Analysis');
  console.log('='.repeat(70));

  Logger.operationStart('CACHE_STANDARDIZATION_ANALYSIS', 'Starting cache standardization analysis');

  try {
    // Check if routes directory exists
    if (!fs.existsSync(routesDir)) {
      throw new Error(`Routes directory not found: ${routesDir}`);
    }

    // Generate comprehensive report
    const report = generateComprehensiveReport(routesDir);

    // Display summary
    console.log('\n📊 Cache Standardization Summary:');
    console.log(`Total Route Files: ${report.summary.totalRoutes}`);
    console.log(`✅ Configured: ${report.summary.configured}`);
    console.log(`⚠️  Need Configuration: ${report.summary.needsConfig}`);
    console.log(`🚫 Intentionally Skipped: ${report.summary.intentionallySkipped}`);
    console.log(`💾 Have Cache Middleware: ${report.summary.hasCache}`);
    console.log(`❌ No Cache Middleware: ${report.summary.noCache}`);

    // Display missing configurations
    if (report.configurationCoverage.missing.length > 0) {
      console.log('\n⚠️  Files Missing Configuration:');
      report.configurationCoverage.missing.forEach(file => {
        console.log(`   - ${file}`);
      });
    }

    // Display recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      [...new Set(report.recommendations)].forEach(rec => {
        console.log(`   - ${rec}`);
      });
    }

    // Generate configuration template
    const routeFiles = getRouteFiles(routesDir);
    const configTemplate = generateConfigTemplate(routeFiles);

    if (configTemplate) {
      console.log('\n📝 Configuration Template:');
      console.log(configTemplate);
    }

    // Save detailed report to file
    const reportPath = path.join(__dirname, '..', 'cache-standardization-report.json');

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    Logger.operationSuccess('CACHE_STANDARDIZATION_ANALYSIS', 'Cache standardization analysis completed');

    // Exit with appropriate code
    const hasIssues = report.summary.needsConfig > 0 || report.summary.noCache > 0;

    process.exit(hasIssues ? 1 : 0);

  } catch (error) {
    Logger.operationError('CACHE_STANDARDIZATION_ANALYSIS', 'Cache standardization analysis failed', error);
    console.error('\n❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export {
  generateComprehensiveReport,
  generateConfigTemplate,
  getRouteFiles
};
export default generateComprehensiveReport;;
