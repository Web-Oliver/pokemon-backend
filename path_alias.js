const path = require('path');
const moduleAlias = require('module-alias');

// Set up the path alias
// This tells Node.js that any import starting with '@/' should be resolved from the 'src' directory.
moduleAlias.addAlias('@', path.join(__dirname, 'src'));

console.log('Path alias @ -> src/ configured.');
