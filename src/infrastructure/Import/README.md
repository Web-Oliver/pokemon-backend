# Pokemon Collection Import System

## Overview

High-performance import system for Pokemon collection data with bulk operations and comprehensive validation.

## Quick Start

```bash
# Run import with all enhancements
node Import/MainImporter.js

# Dry run to test without changes
node Import/MainImporter.js --dry-run

# Skip existing records for faster updates
node Import/MainImporter.js --skip-existing

# High-speed mode for large datasets
node Import/MainImporter.js --fast
```

## Features

- **Bulk Operations**: MongoDB bulkWrite() for maximum performance
- **Pre-validation**: Comprehensive data validation before database insertion
- **Memory Efficient**: Configurable batch processing (200-500 docs/batch)
- **Error Recovery**: Individual fallback processing for failed batches
- **Performance Metrics**: Real-time monitoring and reporting
- **Cache Optimization**: Smart duplicate detection using Set data structures

## Import Order

1. **SetProduct** - Product expansion/set data (no dependencies)
2. **Set** - Pokemon card sets (no dependencies)
3. **Product** - Products that reference SetProduct
4. **Card** - Cards that reference Set

## Configuration Options

```javascript
const options = {
  dryRun: false,        // Test mode, no database changes
  skipExisting: false,  // Skip records that already exist
  batchSize: 200,       // Records per batch (100-500 recommended)  
  verbose: true,        // Enable detailed logging
  maxErrors: 50         // Stop after N validation errors
};
```

## Data Sources

- **Sets & Cards**: `data/new_sets/set-details/*.json`
- **Products**: `data/Products/*/category.json`

## Validation

The optimized system includes comprehensive validation:

- **Data Types**: Ensures correct field types
- **Required Fields**: Validates all mandatory fields exist
- **Relationships**: Verifies foreign key references
- **Business Rules**: Applies domain-specific validation
- **Format Checking**: Validates URLs, numbers, enums

## Error Handling

- **Validation Errors**: Detailed field-level error reporting
- **Database Errors**: Automatic retry with individual processing
- **Performance Issues**: Memory and timeout monitoring
- **Data Quality**: Comprehensive reporting of issues found

## Monitoring

The optimized system provides detailed metrics:

```
📊 Performance Metrics:
   Sets/second: 1,247.50
   Avg validation time: 2.1ms
   Avg database time: 15.3ms
   Time breakdown: 12.5% validation, 67.8% database
```

## Troubleshooting

### Common Issues

1. **"No Sets found in database"**
    - Import Sets before Cards
    - Check MongoDB connection

2. **"No SetProducts found in database"**
    - Import SetProducts before Products
    - Verify Products data contains setProductName fields

3. **High memory usage**
    - Reduce batchSize (try 100)
    - Use --skip-existing for updates

4. **Slow performance**
    - Increase batchSize (try 500)
    - Ensure MongoDB indexes exist
    - Use SSD storage for better I/O

### Debug Mode

```bash
# Enable debug logging
DEBUG=* node Import/MainImporter.js

# Test with small batch
node Import/MainImporter.js --dry-run --verbose
```

## Development

### Adding New Importers

1. Extend base validation in `validators/ImportValidators.js`
2. Create importer following existing patterns
3. Add to MainImporter.js
4. Update this README

### Testing

```bash
# Test validation only
node -e "
const {ImportValidators} = require('./Import/validators/ImportValidators');
console.log('Validation works:', ImportValidators.validateSetData({...}));
"

# Test with dry run
node Import/MainImporter.js --dry-run
```

## Architecture

```
Import/
├── MainImporter.js      # Orchestrates all imports
├── SetImporter.js       # Bulk set import
├── CardImporter.js      # Bulk card import  
├── ProductImporter.js   # Bulk product import
├── SetProductImporter.js # Bulk set product import
└── validators/          # Comprehensive validation system
    └── ImportValidators.js           # All validation logic
```

The system follows CLAUDE.md principles with SOLID architecture, DRY validation patterns, and performance-first design.