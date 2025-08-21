import fs from 'fs';
import path from 'path';
/**
 * Centralized file utility class to eliminate duplication across utilities
 * Follows DRY principles by providing common file operations
 */
class FileUtils {
  /**
   * Read JSON file synchronously
   * @param {string} filePath - Path to the JSON file
   * @returns {Object} Parsed JSON object
   * @throws {Error} If file cannot be read or parsed
   */
  static readJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write JSON file synchronously with pretty formatting
   * @param {string} filePath - Path to write the JSON file
   * @param {Object} data - Data to write
   * @param {number} indent - JSON indentation spaces (default: 2)
   */
  static writeJsonFile(filePath, data, indent = 2) {
    try {
      const content = JSON.stringify(data, null, indent);

      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Read JSON file asynchronously
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<Object>} Parsed JSON object
   */
  static async readJsonFileAsync(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');

      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write JSON file asynchronously
   * @param {string} filePath - Path to write the JSON file
   * @param {Object} data - Data to write
   * @param {number} indent - JSON indentation spaces (default: 2)
   */
  static async writeJsonFileAsync(filePath, data, indent = 2) {
    try {
      const content = JSON.stringify(data, null, indent);

      await fs.promises.writeFile(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get category directories from a base directory
   * @param {string} baseDir - Base directory path
   * @returns {string[]} Array of directory names sorted alphabetically
   */
  static getCategoryDirectories(baseDir) {
    try {
      const items = fs.readdirSync(baseDir, { withFileTypes: true });

      return items
        .filter(item => item.isDirectory())
        .map(item => item.name)
        .sort();
    } catch (error) {
      throw new Error(`Failed to read directories from ${baseDir}: ${error.message}`);
    }
  }

  /**
   * Get all JSON files from a directory
   * @param {string} dirPath - Directory path
   * @returns {string[]} Array of JSON file paths
   */
  static getJsonFiles(dirPath) {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      return items
        .filter(item => item.isFile() && item.name.endsWith('.json'))
        .map(item => path.join(dirPath, item.name));
    } catch (error) {
      throw new Error(`Failed to read JSON files from ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   * @param {string} dirPath - Directory path
   */
  static ensureDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path
   * @returns {boolean} True if file exists
   */
  static fileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file stats
   * @param {string} filePath - File path
   * @returns {fs.Stats|null} File stats or null if file doesn't exist
   */
  static getFileStats(filePath) {
    try {
      return fs.statSync(filePath);
    } catch (error) {
      return null;
    }
  }

  /**
   * Copy file from source to destination
   * @param {string} srcPath - Source file path
   * @param {string} destPath - Destination file path
   */
  static copyFile(srcPath, destPath) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);

      this.ensureDirectory(destDir);

      fs.copyFileSync(srcPath, destPath);
    } catch (error) {
      throw new Error(`Failed to copy file from ${srcPath} to ${destPath}: ${error.message}`);
    }
  }

  /**
   * Move file from source to destination
   * @param {string} srcPath - Source file path
   * @param {string} destPath - Destination file path
   */
  static moveFile(srcPath, destPath) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);

      this.ensureDirectory(destDir);

      fs.renameSync(srcPath, destPath);
    } catch (error) {
      throw new Error(`Failed to move file from ${srcPath} to ${destPath}: ${error.message}`);
    }
  }

  /**
   * Delete file
   * @param {string} filePath - File path
   */
  static deleteFile(filePath) {
    try {
      if (this.fileExists(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get file size in bytes
   * @param {string} filePath - File path
   * @returns {number} File size in bytes
   */
  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);

      return stats.size;
    } catch (error) {
      throw new Error(`Failed to get file size for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Read file content as string
   * @param {string} filePath - File path
   * @param {string} encoding - File encoding (default: 'utf8')
   * @returns {string} File content
   */
  static readTextFile(filePath, encoding = 'utf8') {
    try {
      return fs.readFileSync(filePath, encoding);
    } catch (error) {
      throw new Error(`Failed to read text file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write text content to file
   * @param {string} filePath - File path
   * @param {string} content - Content to write
   * @param {string} encoding - File encoding (default: 'utf8')
   */
  static writeTextFile(filePath, content, encoding = 'utf8') {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);

      this.ensureDirectory(dir);

      fs.writeFileSync(filePath, content, encoding);
    } catch (error) {
      throw new Error(`Failed to write text file ${filePath}: ${error.message}`);
    }
  }
}

export default FileUtils;
