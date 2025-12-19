// Filesystem connector
// File operations, project state, inbox management

import * as fs from 'fs/promises'
import * as path from 'path'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  size?: number
  modified?: number
}

export interface ProjectConfig {
  projectDir: string
  hivemindDir?: string
}

/**
 * Get the .hivemind directory path
 */
export function getHivemindDir(projectDir: string): string {
  return path.join(projectDir, '.hivemind')
}

/**
 * Ensure .hivemind directory exists
 */
export async function ensureHivemindDir(projectDir: string): Promise<string> {
  const dir = getHivemindDir(projectDir)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/**
 * Read STATUS.md from .hivemind
 */
export async function readStatus(projectDir: string): Promise<string> {
  try {
    const content = await fs.readFile(
      path.join(getHivemindDir(projectDir), 'STATUS.md'),
      'utf-8'
    )
    return content
  } catch (e) {
    return '# No status file'
  }
}

/**
 * Read MESSAGES.md from .hivemind
 */
export async function readMessages(projectDir: string): Promise<string> {
  try {
    const content = await fs.readFile(
      path.join(getHivemindDir(projectDir), 'MESSAGES.md'),
      'utf-8'
    )
    return content
  } catch (e) {
    return '# No messages'
  }
}

/**
 * Append a message to MESSAGES.md
 */
export async function appendMessage(
  projectDir: string,
  message: string
): Promise<void> {
  const messagesPath = path.join(getHivemindDir(projectDir), 'MESSAGES.md')
  const timestamp = new Date().toISOString()
  const formatted = `\n## [${timestamp}]\n${message}\n`
  
  await fs.appendFile(messagesPath, formatted)
}

/**
 * List directory contents recursively
 */
export async function listDirectory(
  dirPath: string,
  depth: number = 3,
  currentDepth: number = 0
): Promise<FileNode> {
  const stats = await fs.stat(dirPath)
  const name = path.basename(dirPath)
  
  if (!stats.isDirectory()) {
    return {
      name,
      path: dirPath,
      type: 'file',
      size: stats.size,
      modified: stats.mtimeMs
    }
  }
  
  const node: FileNode = {
    name,
    path: dirPath,
    type: 'folder',
    children: []
  }
  
  if (currentDepth >= depth) {
    return node
  }
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    // Filter out common ignored directories
    const filtered = entries.filter(entry => 
      !['node_modules', '.git', '__pycache__', 'dist', 'build', '.next', '.venv', 'venv'].includes(entry.name)
    )
    
    // Sort: folders first, then files
    filtered.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })
    
    for (const entry of filtered) {
      const entryPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        const child = await listDirectory(entryPath, depth, currentDepth + 1)
        node.children!.push(child)
      } else {
        const entryStats = await fs.stat(entryPath)
        node.children!.push({
          name: entry.name,
          path: entryPath,
          type: 'file',
          size: entryStats.size,
          modified: entryStats.mtimeMs
        })
      }
    }
  } catch (e) {
    // Permission denied or other error
  }
  
  return node
}

/**
 * Read file contents
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

/**
 * Write file contents
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Create a new directory
 */
export async function createDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * Delete a file or directory
 */
export async function deleteFile(filePath: string): Promise<void> {
  const stats = await fs.stat(filePath)
  if (stats.isDirectory()) {
    await fs.rm(filePath, { recursive: true })
  } else {
    await fs.unlink(filePath)
  }
}

/**
 * Rename/move a file or directory
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await fs.rename(oldPath, newPath)
}

/**
 * Check if path exists
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// JSON file helpers (for settings, costs, inbox)
// ============================================================================

/**
 * Load JSON file with fallback default
 */
export async function loadJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return defaultValue
  }
}

/**
 * Save JSON file
 */
export async function saveJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

