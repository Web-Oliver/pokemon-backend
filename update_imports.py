import os
import re

# This script is designed to fix import paths in a project.
# It uses regular expressions to find and replace incorrect paths.

# Define the root directory to scan for JavaScript files.
ROOT_DIR = 'src'

# Define the patterns to search for and their replacements.
# This pattern specifically targets the 'import' statements that are using the old alias.
PATTERNS = {
    # This regex will find and replace all instances of "from '@/" with "from '#@/".
    r"from '@\/": "from '#@/",
    # It's a good practice to also handle 'require' statements that might be lingering.
    r"require\('@\/": "require('#@/",
}

def update_imports(file_path):
    """Updates import and require paths to the correct aliased paths in a given file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = content
        # Apply each replacement pattern.
        for old_path, new_path in PATTERNS.items():
            new_content = re.sub(old_path, new_path, new_content)

        if new_content != content:
            print(f"Updating file: {file_path}")
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
        else:
             print(f"No changes needed for: {file_path}")

    except Exception as e:
        print(f"Error processing {file_path}: {e}")

def main():
    """Traverses the src directory and updates paths in all .js files."""
    if not os.path.isdir(ROOT_DIR):
        print(f"Error: The directory '{ROOT_DIR}' does not exist.")
        return

    for root, _, files in os.walk(ROOT_DIR):
        for file in files:
            if file.endswith('.js'):
                file_path = os.path.join(root, file)
                update_imports(file_path)

    print("\nImport update process completed. Please run your server again.")

if __name__ == "__main__":
    main()
