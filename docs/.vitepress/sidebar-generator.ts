import { glob } from 'glob'
import path from 'path'

/**
 * Sidebar item interface for VitePress configuration
 */
export interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

/**
 * Automatically builds sidebar from generated TypeDoc files
 * @returns Dynamically generated sidebar configuration
 */
export function buildDocsSidebar(): SidebarItem[] {
  try {
    // Get all markdown files from the API docs directory using absolute path
    const apiFiles = glob.sync('docs/api/**/*.md', { absolute: true })
    
    // Build sidebar structure
    const apiSidebar: SidebarItem[] = []
    
    // Define documentation sections to process
    const sections = [
      { name: 'Modules', path: 'modules' },
      { name: 'Classes', path: 'classes' },
      { name: 'Interfaces', path: 'interfaces' },
      { name: 'Functions', path: 'functions' },
      { name: 'Types', path: 'types' }
    ]

    // Process each section
    sections.forEach(({ name, path: sectionPath }) => {
      const sectionFiles = apiFiles.filter(file => {
        const relativePath = path.relative('docs', file)
        return relativePath.includes(`/api/${sectionPath}/`) && !relativePath.endsWith('index.md')
      }).map(file => {
        const relativePath = path.relative('docs', file)
        const basename = path.basename(file, '.md')
        return {
          text: basename.replace(/^_/, '').replace(/-/g, ' '),
          link: '/' + relativePath.replace(/\.md$/, '')
        }
      })
      
      if (sectionFiles.length > 0) {
        apiSidebar.push({
          text: name,
          collapsed: false,
          items: sectionFiles
        })
      }
    })
    
    // Add main API index as first item
    apiSidebar.unshift({
      text: 'API Reference',
      link: '/api/'
    })
    
    return apiSidebar
  } catch (error) {
    console.error('Error building docs sidebar:', error)
    // Return basic sidebar if there's an error
    return [{
      text: 'API Reference',
      link: '/api/'
    }]
  }
}