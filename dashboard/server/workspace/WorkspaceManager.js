import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { ProjectState } from './ProjectState.js'
import { AgentStateManager } from './AgentStateManager.js'
import { FileWatcher } from './FileWatcher.js'

const execAsync = promisify(exec)

export class WorkspaceManager {
  constructor() {
    this.currentProject = null
    this.agentManager = new AgentStateManager()
    this.fileWatcher = null
    this.autoSaveInterval = null
  }

  /**
   * Create a new .conductor project
   */
  async createProject(masterDir, projectName) {
    const conductorPath = path.join(masterDir, `${projectName}.conductor`)
    
    // Check if project already exists
    try {
      await fs.access(conductorPath)
      throw new Error(`Project ${projectName} already exists`)
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }

    // Create directory structure
    await fs.mkdir(conductorPath, { recursive: true })
    await fs.mkdir(path.join(conductorPath, 'agents'), { recursive: true })
    await fs.mkdir(path.join(conductorPath, 'files'), { recursive: true })
    await fs.mkdir(path.join(conductorPath, 'snapshots'), { recursive: true })

    // Create manifest
    const manifest = {
      version: '1.0.0',
      projectName,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      masterDir,
      conductorPath,
      schema: 'conductor-v1'
    }
    
    await fs.writeFile(
      path.join(conductorPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )

    // Initialize empty chat history
    await fs.writeFile(path.join(conductorPath, 'chat-history.jsonl'), '')

    // Create initial project state
    this.currentProject = new ProjectState(conductorPath, manifest)
    
    // Start file watching and auto-save
    this.startWatching()
    
    return {
      success: true,
      projectPath: conductorPath,
      manifest
    }
  }

  /**
   * Load existing .conductor project
   */
  async loadProject(conductorPath) {
    try {
      // Validate directory structure
      await this.validateProjectStructure(conductorPath)
      
      // Load manifest
      const manifestPath = path.join(conductorPath, 'manifest.json')
      const manifestData = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestData)
      
      // Create project state
      this.currentProject = new ProjectState(conductorPath, manifest)
      
      // Load chat history
      await this.currentProject.loadChatHistory()
      
      // Load agent states
      await this.loadAgentStates()
      
      // Restore file tree to working directory
      await this.restoreFileTree()
      
      // Start watching and auto-save
      this.startWatching()
      
      return {
        success: true,
        project: this.currentProject.serialize(),
        agentCount: Object.keys(this.currentProject.agents).length
      }
    } catch (e) {
      throw new Error(`Failed to load project: ${e.message}`)
    }
  }

  /**
   * Save current project state
   */
  async saveProject(isAutoSave = false) {
    if (!this.currentProject) {
      throw new Error('No active project')
    }

    try {
      // Update last modified
      this.currentProject.manifest.lastModified = new Date().toISOString()
      
      // Save manifest
      await fs.writeFile(
        path.join(this.currentProject.conductorPath, 'manifest.json'),
        JSON.stringify(this.currentProject.manifest, null, 2)
      )
      
      // Save chat history (append new messages)
      await this.currentProject.saveChatHistory()
      
      // Save agent states
      await this.saveAgentStates()
      
      // Save file tracking info
      await this.saveFileTracking()
      
      // Create snapshot if not auto-save
      if (!isAutoSave) {
        await this.createSnapshot()
      }
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        type: isAutoSave ? 'auto-save' : 'manual-save'
      }
    } catch (e) {
      throw new Error(`Failed to save project: ${e.message}`)
    }
  }

  /**
   * Export project as portable archive
   */
  async exportProject(targetPath) {
    if (!this.currentProject) {
      throw new Error('No active project')
    }

    // Save current state first
    await this.saveProject()
    
    // Create tar archive
    const projectName = path.basename(this.currentProject.conductorPath)
    const archivePath = path.join(targetPath, `${projectName}.tar.gz`)
    
    await execAsync(`tar -czf "${archivePath}" -C "${path.dirname(this.currentProject.conductorPath)}" "${projectName}"`)
    
    return {
      success: true,
      archivePath,
      size: (await fs.stat(archivePath)).size
    }
  }

  /**
   * Close current project
   */
  async closeProject() {
    if (this.currentProject) {
      // Save before closing
      await this.saveProject()
      
      // Stop watching
      this.stopWatching()
      
      this.currentProject = null
    }
  }

  /**
   * Get current project info
   */
  getProjectInfo() {
    if (!this.currentProject) {
      return null
    }
    
    return {
      manifest: this.currentProject.manifest,
      agentCount: Object.keys(this.currentProject.agents).length,
      messageCount: this.currentProject.chatHistory.length,
      fileCount: Object.keys(this.currentProject.files).length
    }
  }

  // Private methods

  async validateProjectStructure(conductorPath) {
    const requiredPaths = [
      'manifest.json',
      'chat-history.jsonl',
      'agents',
      'files',
      'snapshots'
    ]
    
    for (const reqPath of requiredPaths) {
      await fs.access(path.join(conductorPath, reqPath))
    }
  }

  async loadAgentStates() {
    const agentsDir = path.join(this.currentProject.conductorPath, 'agents')
    
    try {
      const agentFiles = await fs.readdir(agentsDir)
      
      for (const file of agentFiles.filter(f => f.endsWith('.json'))) {
        const agentPath = path.join(agentsDir, file)
        const agentData = JSON.parse(await fs.readFile(agentPath, 'utf-8'))
        this.currentProject.agents[agentData.agentId] = agentData
      }
    } catch (e) {
      // Silent fail if no agents directory
    }
  }

  async saveAgentStates() {
    const agentsDir = path.join(this.currentProject.conductorPath, 'agents')
    
    for (const [agentId, agentState] of Object.entries(this.currentProject.agents)) {
      const agentPath = path.join(agentsDir, `${agentId}.json`)
      await fs.writeFile(agentPath, JSON.stringify(agentState, null, 2))
    }
  }

  async restoreFileTree() {
    const filesDir = path.join(this.currentProject.conductorPath, 'files')
    const workingDir = this.currentProject.manifest.masterDir
    
    try {
      // Copy files from .conductor/files to working directory
      await execAsync(`cp -r "${filesDir}"/* "${workingDir}/" 2>/dev/null || true`)
    } catch (e) {
      // Silent fail if no files to restore
    }
  }

  async saveFileTracking() {
    const trackingPath = path.join(this.currentProject.conductorPath, 'file-tracking.json')
    await fs.writeFile(trackingPath, JSON.stringify(this.currentProject.files, null, 2))
  }

  async createSnapshot() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const snapshotPath = path.join(this.currentProject.conductorPath, 'snapshots', `${timestamp}.json`)
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      manifest: this.currentProject.manifest,
      agentCount: Object.keys(this.currentProject.agents).length,
      messageCount: this.currentProject.chatHistory.length,
      fileCount: Object.keys(this.currentProject.files).length
    }
    
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2))
  }

  startWatching() {
    if (!this.currentProject) return
    
    // Start file watcher
    this.fileWatcher = new FileWatcher(
      this.currentProject.manifest.masterDir,
      this.currentProject.conductorPath
    )
    
    this.fileWatcher.on('change', (filePath) => {
      this.currentProject.updateFileTracking(filePath)
    })
    
    // Start auto-save (every 30 seconds)
    this.autoSaveInterval = setInterval(() => {
      if (this.currentProject && this.currentProject.hasUnsavedChanges()) {
        this.saveProject(true).catch(console.error)
      }
    }, 30000)
  }

  stopWatching() {
    if (this.fileWatcher) {
      this.fileWatcher.stop()
      this.fileWatcher = null
    }
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
  }
}
