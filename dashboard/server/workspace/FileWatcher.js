import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

export class FileWatcher extends EventEmitter {
  constructor(watchDir, conductorPath) {
    super()
    this.watchDir = watchDir
    this.conductorPath = conductorPath
    this.watchers = new Map()
    this.debounceTimers = new Map()
    this.isWatching = false
    
    this.startWatching()
  }

  startWatching() {
    if (this.isWatching) return
    
    try {
      // Watch the main directory recursively
      this.watchDirectory(this.watchDir)
      this.isWatching = true
      console.log(`📁 Watching ${this.watchDir} for changes`)
    } catch (e) {
      console.error('Failed to start file watching:', e.message)
    }
  }

  watchDirectory(dirPath) {
    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        
        const fullPath = path.join(dirPath, filename)
        
        // Skip .conductor directory and common ignore patterns
        if (this.shouldIgnore(fullPath)) return
        
        // Debounce rapid file changes
        this.debounceFileChange(fullPath, eventType)
      })
      
      this.watchers.set(dirPath, watcher)
      
    } catch (e) {
      console.error(`Failed to watch directory ${dirPath}:`, e.message)
    }
  }

  debounceFileChange(filePath, eventType) {
    const key = filePath
    
    // Clear existing timer
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key))
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      this.handleFileChange(filePath, eventType)
      this.debounceTimers.delete(key)
    }, 500) // 500ms debounce
    
    this.debounceTimers.set(key, timer)
  }

  async handleFileChange(filePath, eventType) {
    try {
      // Check if file still exists
      const exists = await this.fileExists(filePath)
      
      if (exists) {
        const stats = await fs.promises.stat(filePath)
        
        if (stats.isFile()) {
          this.emit('change', filePath, {
            type: eventType,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            exists: true
          })
        }
      } else {
        // File was deleted
        this.emit('change', filePath, {
          type: 'delete',
          exists: false
        })
      }
      
    } catch (e) {
      // Silent fail for file access errors
    }
  }

  shouldIgnore(filePath) {
    const relativePath = path.relative(this.watchDir, filePath)
    
    // Ignore patterns
    const ignorePatterns = [
      /\.conductor/, // Our own directory
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /\.tmp/,
      /\.log$/,
      /~$/,
      /\.swp$/,
      /\.pyc$/,
      /__pycache__/
    ]
    
    return ignorePatterns.some(pattern => pattern.test(relativePath))
  }

  async fileExists(filePath) {
    try {
      await fs.promises.access(filePath)
      return true
    } catch (e) {
      return false
    }
  }

  stop() {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
    
    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    
    this.isWatching = false
    console.log('📁 Stopped file watching')
  }

  // Get current file tracking info
  async getFileInfo(filePath) {
    try {
      const stats = await fs.promises.stat(filePath)
      const content = await fs.promises.readFile(filePath)
      const crypto = await import('crypto')
      const checksum = crypto.createHash('sha256').update(content).digest('hex')
      
      return {
        size: stats.size,
        modified: stats.mtime.toISOString(),
        checksum: checksum.substring(0, 16),
        exists: true
      }
    } catch (e) {
      return {
        exists: false,
        error: e.message
      }
    }
  }
}
