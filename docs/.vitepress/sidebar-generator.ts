import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url'; // Needed for ESM __dirname equivalent

/**
 * Sidebar item interface for VitePress configuration
 */
export interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

// --- Helper to get the directory name in ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Assuming sidebar-generator.ts is directly inside 'docs' ---
// If it's deeper, adjust accordingly (e.g., path.resolve(__dirname, '..'))
const docsDir = __dirname;
const apiDir = path.join(docsDir, 'api'); // Absolute path to the api directory

/**
 * Automatically builds sidebar from generated TypeDoc files
 * @returns Dynamically generated sidebar configuration
 */
export function buildDocsSidebar(): SidebarItem[] {
  try {
    // Log the directory being scanned
    console.log(`Scanning for markdown files in: ${apiDir}`);

    // Get all markdown files from the API docs directory using absolute path
    // Use path.join for cross-platform compatibility
    const apiFiles = glob.sync(path.join(apiDir, '**/*.md').replace(/\\/g, '/'), {
      absolute: true,
    }); // Use forward slashes for glob

    // Log found files for debugging
    console.log(`Found ${apiFiles.length} API files:`, apiFiles);

    // Build sidebar structure
    const apiSidebar: SidebarItem[] = [];

    // Define documentation sections to process
    const sections = [
      { name: 'Modules', path: 'modules' },
      { name: 'Classes', path: 'classes' },
      { name: 'Interfaces', path: 'interfaces' },
      { name: 'Functions', path: 'functions' },
      { name: 'Types', path: 'types' },
      // Add other sections if needed
    ];

    // Process each section
    sections.forEach(({ name, path: sectionPath }) => {
      // Filter files based on the absolute path to the section directory
      const sectionDir = path.join(apiDir, sectionPath);
      const sectionFiles = apiFiles
        .filter(file => {
          // Check if the file is within the current section's directory
          // and is not an index file directly within that section directory
          const fileDirPath = path.dirname(file);
          return (
            file.startsWith(sectionDir) && fileDirPath !== sectionDir && !file.endsWith('index.md')
          );
          // Alternative, simpler check if structure is flat within sections:
          // return file.startsWith(path.join(apiDir, sectionPath, '/')) && !file.endsWith('index.md');
        })
        .map(file => {
          // Calculate path relative to the 'docs' directory for the link
          const relativePath = path.relative(docsDir, file);
          const basename = path.basename(file, '.md');
          const link = '/' + relativePath.replace(/\\/g, '/').replace(/\.md$/, ''); // Ensure forward slashes for URL

          console.log(`Processing file: ${file}, Relative Path: ${relativePath}, Link: ${link}`); // Debug log

          return {
            text: basename.replace(/^_/, '').replace(/-/g, ' '), // Basic cleanup
            link: link,
          };
        })
        .sort((a, b) => a.text.localeCompare(b.text)); // Sort items alphabetically

      if (sectionFiles.length > 0) {
        apiSidebar.push({
          text: name,
          collapsed: false, // Or true if you prefer them collapsed
          items: sectionFiles,
        });
      }
    });

    // Add main API index if it exists (relative to docsDir)
    const mainApiIndex = path.join(apiDir, 'index.md'); // Or maybe README.md? Check your TypeDoc output
    // Check if the main index file exists using glob result or fs.existsSync
    const mainApiIndexExists = apiFiles.some(file => file === mainApiIndex);

    if (mainApiIndexExists) {
      apiSidebar.unshift({
        text: 'API Overview', // Or 'API Reference'
        link: '/api/', // Link to the root index file of the API section
      });
    } else {
      // Maybe add a placeholder or log a warning if the main index is missing
      console.warn(
        'Main API index file (e.g., docs/api/index.md or docs/api/README.md) not found.'
      );
    }

    // Log the final generated sidebar
    console.log('Generated API Sidebar:', JSON.stringify(apiSidebar, null, 2));

    return apiSidebar;
  } catch (error) {
    console.error('Error building docs sidebar:', error);
    // Return basic sidebar if there's an error
    return [
      {
        text: 'API Reference (Error)',
        link: '/api/',
      },
    ];
  }
}
