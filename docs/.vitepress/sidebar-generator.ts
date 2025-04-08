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
  // Get all markdown files from the API docs directory
  const apiFiles = glob.sync('../docs/api/**/*.md')
  
  // Build sidebar structure
  const apiSidebar: SidebarItem[] = []
  
  // Define documentation sections to process
  const sections = [
    { name: 'Modules', path: '/modules/' },
    { name: 'Classes', path: '/classes/' },
    { name: 'Interfaces', path: '/interfaces/' },
    { name: 'Functions', path: '/functions/' },
    { name: 'Types', path: '/types/' }
  ]

  // Process each section
  sections.forEach(({ name, path: sectionPath }) => {
    const sectionFiles = apiFiles.filter(file => 
      file.includes(sectionPath) && !file.includes('index.md')
    ).map(file => ({
      text: path.basename(file, '.md'),
      link: '/' + file.replace('docs/', '').replace(/README\.md$/, '')
    }))
    
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
}