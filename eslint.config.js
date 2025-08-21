import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';

export default defineConfig([
  {
    // Ignore certain files and directories
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      '**/*.min.js',
      '.env',
      '.env.*',
      'package-lock.json',
      // Development and debug files
      'cleanupPersonalCollection.js',
      'debugImport.js',
      'importToLocalMongoDB.js',
      'setupAndImportData.js',
      'verifyDataImport.js',
      'verifyImport.js',
      'scripts/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        clearImmediate: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        exports: 'writable',
        global: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        setImmediate: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
      },
    },
    // Add the import plugin and configure its resolver
    plugins: {
      import: pluginImport,
    },
    settings: {
      // Use the module-alias resolver to read aliases from package.json
      'import/resolver': {
        'module-alias': {
          alias: {
            '@': './src', // Ensure the alias points to your src directory
          },
        },
      },
    },
    rules: {
      // Possible Problems
      'no-await-in-loop': 'warn', // Allow but warn for potential performance issues
      'no-constant-binary-expression': 'error',
      'no-constructor-return': 'error',
      'no-dupe-else-if': 'error',
      'no-import-assign': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-private-class-members': 'error',
      'no-use-before-define': ['error', { functions: true, classes: true, variables: true }],
      'require-atomic-updates': 'error',
      // Suggestions
      'accessor-pairs': 'off',
      'arrow-body-style': 'off',
      'block-scoped-var': 'error',
      'camelcase': 'error',
      'class-methods-use-this': 'off',
      'consistent-return': 'off',
      'default-case': 'error',
      'default-case-last': 'error',
      'default-param-last': 'error',
      'eqeqeq': ['error', 'always'],
      'func-name-matching': 'off',
      'func-names': ['error', 'as-needed'],
      'grouped-accessor-pairs': 'error',
      'guard-for-in': 'error',
      'max-classes-per-file': 'off',
      'no-alert': 'error',
      'no-bitwise': 'error',
      'no-case-declarations': 'off',
      'no-console': 'warn',
      'no-continue': 'off',
      'no-empty-function': 'error',
      'no-eq-null': 'error',
      'no-eval': 'error',
      'no-implicit-coercion': 'error',
      'no-implicit-globals': 'off',
      'no-invalid-this': 'off',
      'no-iterator': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-loop-func': 'error',
      'no-magic-numbers': 'off',
      'no-param-reassign': 'off',
      'no-useless-constructor': 'off',
      'radix': 'error', // Enforce radix parameter
      'require-await': 'warn', // Change to warn
      'yoda': 'error',
      // Layout & Formatting
      'eol-last': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'no-trailing-spaces': 'error',
      'spaced-comment': ['error', 'always'],
      'comma-spacing': 'error',
      'semi-spacing': 'error',
      'keyword-spacing': 'error',
      'array-bracket-spacing': 'error',
      'block-spacing': 'error',
      'brace-style': 'error',
      'computed-property-spacing': 'error',
      'func-call-spacing': 'error',
      'key-spacing': 'error',
      'linebreak-style': ['error', 'unix'],
      'lines-around-comment': 'off',
      'lines-between-class-members': 'off',
      'new-cap': ['error', { newIsCap: true, capIsNew: false }],
      'no-mixed-spaces-and-tabs': 'error',
      'no-multi-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
      'no-tabs': 'error',
      'no-whitespace-before-property': 'error',
      'object-curly-spacing': ['error', 'always'],
      'padding-line-between-statements': 'off',
      'quotes': ['error', 'single'],
      'rest-spread-spacing': 'error',
      'semi': ['error', 'always'],
      'semi-style': ['error', 'last'],
      'space-before-blocks': 'error',
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'space-in-parens': 'error',
      'space-infix-ops': 'error',
      'space-unary-ops': 'error',
      'switch-colon-spacing': 'error',
      'template-curly-spacing': 'error',
      'template-tag-spacing': 'error',
      'unicode-bom': 'error',
      'wrap-iife': 'error',
      'wrap-regex': 'error',
      'yield-star-spacing': 'error',
      // Import Rules
      'import/no-unresolved': ['error', { commonjs: true, caseSensitive: true }],
      'import/extensions': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/export': 'off',
      'import/no-deprecated': 'off',
      'import/no-mutable-exports': 'off',
    },
  },
  // Test-specific configuration
  {
    files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        // Mocha globals
        describe: 'readonly',
        context: 'readonly',
        it: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
        // Chai globals
        expect: 'readonly',
        should: 'readonly',
        assert: 'readonly',
      },
    },
    rules: {
      'no-unused-expressions': 'off', // Chai assertions use unused expressions
      'prefer-arrow-callback': 'off', // Mocha works better with function expressions
      'func-names': 'off', // Allow anonymous functions in tests
      'max-len': ['error', { code: 120 }], // Allow longer lines in tests
    },
  },
]);
