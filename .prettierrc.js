/**
 * Prettier Configuration
 *
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  // Line wrapping - match ESLint max-len
  printWidth: 120,

  // Indentation
  tabWidth: 2,
  useTabs: false,

  // Quotes and semicolons
  singleQuote: true,
  semi: true,

  // Trailing commas
  trailingComma: 'all',

  // Spacing
  bracketSpacing: true,
  bracketSameLine: false,

  // Arrow functions
  arrowParens: 'always',

  // Line endings (Unix-style for consistency)
  endOfLine: 'lf',

  // Object wrapping
  objectWrap: 'preserve',

  // Overrides for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        tabWidth: 2,
        printWidth: 120
      }
    },
    {
      files: '*.md',
      options: {
        proseWrap: 'preserve',
        printWidth: 120
      }
    },
    {
      files: ['*.yaml', '*.yml'],
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: '.prettierrc',
      options: {
        parser: 'json'
      }
    }
  ]
};

module.exports = config;
