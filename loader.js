import {fileURLToPath, pathToFileURL} from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function resolve(specifier, context, nextResolve) {
  // Handle @/* imports
  if (specifier.startsWith('@/')) {
    const resolvedPath = path.resolve(__dirname, 'src', specifier.slice(2));
    return {
      shortCircuit: true,
      url: pathToFileURL(resolvedPath).href
    };
  }

  // Let Node.js handle other imports
  return nextResolve(specifier);
}
