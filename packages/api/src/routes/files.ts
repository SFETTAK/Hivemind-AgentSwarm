// File routes - Browse, read, write files

import { Router } from 'express'
import { 
  listDirectory, 
  readFile, 
  writeFile, 
  createDirectory, 
  deleteFile, 
  renameFile 
} from '@hivemind/connectors/filesystem'
import * as path from 'path'
import type { ServerConfig } from '../server'

export function filesRoutes(config: ServerConfig) {
  const router = Router()
  
  // List directory contents
  router.get('/', async (req, res) => {
    try {
      const dirPath = (req.query.path as string) || config.projectDir
      const depth = parseInt(req.query.depth as string) || 3
      
      // Security: ensure path is within project
      const resolved = path.resolve(dirPath)
      if (!resolved.startsWith(config.projectDir)) {
        return res.status(403).json({ error: 'Access denied' })
      }
      
      const tree = await listDirectory(resolved, depth)
      res.json({ tree })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Read file contents
  router.get('/read', async (req, res) => {
    try {
      const filePath = req.query.path as string
      if (!filePath) {
        return res.status(400).json({ error: 'Path required' })
      }
      
      // Security: ensure path is within project
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(config.projectDir)) {
        return res.status(403).json({ error: 'Access denied' })
      }
      
      const content = await readFile(resolved)
      res.json({ content, path: resolved })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Create new file
  router.post('/new', async (req, res) => {
    try {
      const { path: filePath, content = '' } = req.body
      if (!filePath) {
        return res.status(400).json({ error: 'Path required' })
      }
      
      // Security: ensure path is within project
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(config.projectDir)) {
        return res.status(403).json({ error: 'Access denied' })
      }
      
      await writeFile(resolved, content)
      res.json({ success: true, path: resolved })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Create new directory
  router.post('/mkdir', async (req, res) => {
    try {
      const { path: dirPath } = req.body
      if (!dirPath) {
        return res.status(400).json({ error: 'Path required' })
      }
      
      // Security: ensure path is within project
      const resolved = path.resolve(dirPath)
      if (!resolved.startsWith(config.projectDir)) {
        return res.status(403).json({ error: 'Access denied' })
      }
      
      await createDirectory(resolved)
      res.json({ success: true, path: resolved })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Delete file or directory
  router.delete('/', async (req, res) => {
    try {
      const filePath = req.query.path as string
      if (!filePath) {
        return res.status(400).json({ error: 'Path required' })
      }
      
      // Security: ensure path is within project
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(config.projectDir)) {
        return res.status(403).json({ error: 'Access denied' })
      }
      
      // Don't allow deleting project root
      if (resolved === config.projectDir) {
        return res.status(403).json({ error: 'Cannot delete project root' })
      }
      
      await deleteFile(resolved)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Rename file or directory
  router.post('/rename', async (req, res) => {
    try {
      const { oldPath, newPath } = req.body
      if (!oldPath || !newPath) {
        return res.status(400).json({ error: 'Both oldPath and newPath required' })
      }
      
      // Security: ensure paths are within project
      const resolvedOld = path.resolve(oldPath)
      const resolvedNew = path.resolve(newPath)
      
      if (!resolvedOld.startsWith(config.projectDir) || !resolvedNew.startsWith(config.projectDir)) {
        return res.status(403).json({ error: 'Access denied' })
      }
      
      await renameFile(resolvedOld, resolvedNew)
      res.json({ success: true, path: resolvedNew })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  return router
}

