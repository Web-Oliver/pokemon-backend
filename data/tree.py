import os

def generate_directory_tree_text(start_path):
    """
    Recursively generates a string representing a directory tree,
    listing all subfolders and files with their names.
    """
    if not os.path.exists(start_path):
        return f"Error: The specified path does not exist: '{start_path}'\n", []

    output_lines = [f"Scanning directory tree from: {os.path.abspath(start_path)}\n"]
    found_files = []

    for root, dirs, files in os.walk(start_path):
        relative_root = os.path.relpath(root, start_path)
        
        if relative_root == ".": # For the starting directory itself
            output_lines.append(f".{os.sep}")
        else:
            indent_level = relative_root.count(os.sep)
            output_lines.append(f"{'│   ' * indent_level}├── {os.path.basename(root)}{os.sep}")

        for file_name in files:
            full_file_path = os.path.join(root, file_name)
            found_files.append(full_file_path) # Store full path
            
            file_indent_level = relative_root.count(os.sep) + 1
            output_lines.append(f"{'│   ' * file_indent_level}├── {file_name}")

    if found_files:
        output_lines.append("\n--- Summary: All Files Found (Full Paths) ---")
        for f_path in found_files:
            output_lines.append(f_path)
        output_lines.append(f"\nTotal files found: {len(found_files)}")
    else:
        output_lines.append("No files found or an error occurred during scanning.")
        
    return "\n".join(output_lines), found_files

if __name__ == "__main__":
    import sys

    # Determine the starting path for the tree scan
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
    else:
        target_path = os.path.dirname(os.path.abspath(__file__))

    # Generate the output text
    output_text, _ = generate_directory_tree_text(target_path)
    
    # Define the output filename
    output_filename = "directory_tree_output.txt"
    
    # Save the output to a text file
    try:
        with open(output_filename, "w", encoding="utf-8") as f:
            f.write(output_text)
        print(f"Directory tree and file list successfully saved to '{output_filename}'")
    except Exception as e:
        print(f"Error saving output to file: {e}")
        # Optionally, print to console if saving fails
        print("\n--- Console Output (if file save failed) ---")
        print(output_text)