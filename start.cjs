// start.cjs

// This is the new entry point for the application.
// The .cjs extension ensures this file is treated as a CommonJS module.

const path = require('path');
const moduleAlias = require('module-alias');

// Set up the path alias for the ES module environment.
// This tells Node.js that any import starting with '@/ should be resolved from the 'src' directory.
moduleAlias.addAliases({
  '@': path.resolve(__dirname, 'src')
});

// Dynamically import the main server file, which is an ES module.
// We use dynamic import so that the alias is registered before the import is executed.
(async () => {
  try {
    await import('./src/Infrastructure/Startup/server.js');
  } catch (e) {
    console.error('Failed to start the application:', e);
    process.exit(1);
  }
})();
