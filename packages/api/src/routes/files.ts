// =============================================================================
// File Routes
// =============================================================================

import { Router } from 'express'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { SettingsManager } from '@hivemind/config'

interface FileTreeNode {
  name: string
  type: 'file' | 'folder'
  path: string
  expanded?: boolean
  children?: FileTreeNode[]
}

// Directories to skip
const SKIP_DIRS = ['node_modules', '.git', '__pycache__', 'dist', 'build', '.next', '.cache', 'coverage']

export function createFilesRoutes(settings: SettingsManager): Router {
  const router = Router()
  
  // Build file tree
  async function buildTree(dirPath: string, depth = 3, currentDepth = 0): Promise<FileTreeNode> {
    const name = path.basename(dirPath)
    const node: FileTreeNode = {
      name,
      type: 'folder',
      path: dirPath,
      expanded: currentDepth === 0,
      children: [],
    }
    
    if (currentDepth >= depth) return node
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries.sort((a, b) => {
        // Folders first, then alphabetical
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue
        if (SKIP_DIRS.includes(entry.name)) continue
        
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          const child = await buildTree(fullPath, depth, currentDepth + 1)
          node.children!.push(child)
        } else {
          node.children!.push({
            name: entry.name,
            type: 'file',
            path: fullPath,
          })
        }
      }
    } catch (e) {
      // Permission denied or other error
    }
    
    return node
  }
  
  // Validate path is within project
  function validatePath(filePath: string, projectDir: string): boolean {
    const resolved = path.resolve(filePath)
    const resolvedProject = path.resolve(projectDir)
    return resolved.startsWith(resolvedProject)
  }
  
  // List files
  router.get('/', async (req, res) => {
    const cfg = settings.get()
    const requestedPath = (req.query.path as string) || cfg.projectDir
    const depth = parseInt(req.query.depth as string) || 3
    
    try {
      const tree = await buildTree(requestedPath, depth)
      res.json({ tree, basePath: requestedPath })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Read file
  router.get('/read', async (req, res) => {
    const cfg = settings.get()
    const filePath = req.query.path as string
    
    if (!filePath) {
      return res.status(400).json({ error: 'Path required' })
    }
    
    if (!validatePath(filePath, cfg.projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const stats = await fs.stat(filePath)
      
      res.json({
        content,
        path: filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Create new file
  router.post('/new', async (req, res) => {
    const cfg = settings.get()
    const { filePath, content = '' } = req.body
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' })
    }
    
    if (!validatePath(filePath, cfg.projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content)
      res.json({ success: true, path: filePath })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Create directory
  router.post('/mkdir', async (req, res) => {
    const cfg = settings.get()
    const { folderPath } = req.body
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path required' })
    }
    
    if (!validatePath(folderPath, cfg.projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    try {
      await fs.mkdir(folderPath, { recursive: true })
      res.json({ success: true, path: folderPath })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Delete file/folder
  router.delete('/', async (req, res) => {
    const cfg = settings.get()
    const { filePath } = req.body
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' })
    }
    
    if (!validatePath(filePath, cfg.projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    if (path.resolve(filePath) === path.resolve(cfg.projectDir)) {
      return res.status(403).json({ error: 'Cannot delete project root' })
    }
    
    try {
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true })
      } else {
        await fs.unlink(filePath)
      }
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Rename file/folder
  router.post('/rename', async (req, res) => {
    const cfg = settings.get()
    const { oldPath, newPath } = req.body
    
    if (!oldPath || !newPath) {
      return res.status(400).json({ error: 'Both oldPath and newPath required' })
    }
    
    if (!validatePath(oldPath, cfg.projectDir) || !validatePath(newPath, cfg.projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    try {
      await fs.rename(oldPath, newPath)
      res.json({ success: true, oldPath, newPath })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  return router
}

