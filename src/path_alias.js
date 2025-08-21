import path from 'path';
import moduleAlias from 'module-alias';
import { fileURLToPath   } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up the path alias
// This tells Node.js that any import starting with '@/' should be resolved from the 'src' directory.
moduleAlias.addAlias('@', __dirname);

console.log('Path alias @ -> src/ configured.');