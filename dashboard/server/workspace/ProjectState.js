import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export class ProjectState {
  constructor(conductorPath, manifest) {
    this.conductorPath = conductorPath
    this.manifest = manifest
    this.chatHistory = []
    this.agents = {}
    this.files = {}
    this.unsavedChanges = false
    this.lastSaveTimestamp = new Date().toISOString()
  }

  /**
   * Serialize project state to JSON
   */
  serialize() {
    return {
      manifest: this.manifest,
      chatHistory: this.chatHistory.slice(-50), // Last 50 messages for UI
      agents: this.agents,
      files: this.files,
      stats: {
        messageCount: this.chatHistory.length,
        agentCount: Object.keys(this.agents).length,
        fileCount: Object.keys(this.files).length,
        lastSave: this.lastSaveTimestamp
      }
    }
  }

  /**
   * Create ProjectState from serialized data
   */
  static deserialize(data, conductorPath) {
    const state = new ProjectState(conductorPath, data.manifest)
    state.chatHistory = data.chatHistory || []
    state.agents = data.agents || {}
    state.files = data.files || {}
    return state
  }

  /**
   * Add chat message to history
   */
  addChatMessage(role, content, metadata = {}) {
    const message = {
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      role,
      content,
      ...metadata
    }
    
    this.chatHistory.push(message)
    this.markUnsaved()
    
    return message
  }

  /**
   * Update agent state
   */
  updateAgentState(agentId, stateUpdate) {
    if (!this.agents[agentId]) {
      this.agents[agentId] = {
        agentId,
        created: new Date().toISOString(),
        status: 'unknown'
      }
    }
    
    this.agents[agentId] = {
      ...this.agents[agentId],
      ...stateUpdate,
      lastUpdated: new Date().toISOString()
    }
    
    this.markUnsaved()
  }

  /**
   * Remove agent from state
   */
  removeAgent(agentId) {
    delete this.agents[agentId]
    this.markUnsaved()
  }

  /**
   * Update file tracking information
   */
  updateFileTracking(filePath, metadata = {}) {
    const relativePath = path.relative(this.manifest.masterDir, filePath)
    
    this.files[relativePath] = {
      ...this.files[relativePath],
      lastModified: new Date().toISOString(),
      ...metadata
    }
    
    this.markUnsaved()
  }

  /**
   * Add new file to tracking
   */
  async addFile(filePath, createdBy = 'unknown') {
    const relativePath = path.relative(this.manifest.masterDir, filePath)
    
    try {
      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath)
      const checksum = crypto.createHash('sha256').update(content).digest('hex')
      
      this.files[relativePath] = {
        created: new Date().toISOString(),
        lastModified: stats.mtime.toISOString(),
        createdBy,
        size: stats.size,
        checksum: checksum.substring(0, 16) // Short checksum
      }
      
      // Copy file to .conductor/files
      const targetPath = path.join(this.conductorPath, 'files', relativePath)
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.copyFile(filePath, targetPath)
      
      this.markUnsaved()
    } catch (e) {
      console.error(`Failed to add file ${filePath}:`, e.message)
    }
  }

  /**
   * Mark file as deleted
   */
  markFileDeleted(filePath) {
    const relativePath = path.relative(this.manifest.masterDir, filePath)
    
    if (this.files[relativePath]) {
      this.files[relativePath].deleted = new Date().toISOString()
      this.markUnsaved()
    }
  }

  /**
   * Load chat history from JSONL file
   */
  async loadChatHistory() {
    const historyPath = path.join(this.conductorPath, 'chat-history.jsonl')
    
    try {
      const content = await fs.readFile(historyPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      
      this.chatHistory = lines.map(line => {
        try {
          return JSON.parse(line)
        } catch (e) {
          console.error('Invalid chat history line:', line)
          return null
        }
      }).filter(Boolean)
      
    } catch (e) {
      // File doesn't exist yet, start with empty history
      this.chatHistory = []
    }
  }

  /**
   * Save chat history to JSONL file (append new messages)
   */
  async saveChatHistory() {
    const historyPath = path.join(this.conductorPath, 'chat-history.jsonl')
    
    // Read existing content to find where to append
    let existingLines = 0
    try {
      const existing = await fs.readFile(historyPath, 'utf-8')
      existingLines = existing.trim().split('\n').filter(Boolean).length
    } catch (e) {
      // File doesn't exist, start fresh
    }
    
    // Append new messages
    const newMessages = this.chatHistory.slice(existingLines)
    if (newMessages.length > 0) {
      const newLines = newMessages.map(msg => JSON.stringify(msg)).join('\n') + '\n'
      await fs.appendFile(historyPath, newLines)
    }
  }

  /**
   * Get recent activity summary
   */
  getRecentActivity(minutes = 30) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000)
    
    const recentMessages = this.chatHistory.filter(msg => 
      new Date(msg.timestamp) > cutoff
    )
    
    const recentAgentActivity = Object.values(this.agents).filter(agent =>
      agent.lastUpdated && new Date(agent.lastUpdated) > cutoff
    )
    
    return {
      messages: recentMessages.length,
      agentActivity: recentAgentActivity.length,
      activeAgents: recentAgentActivity.map(a => a.agentId)
    }
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges() {
    return this.unsavedChanges
  }

  /**
   * Mark as having unsaved changes
   */
  markUnsaved() {
    this.unsavedChanges = true
  }

  /**
   * Mark as saved
   */
  markSaved() {
    this.unsavedChanges = false
    this.lastSaveTimestamp = new Date().toISOString()
  }

  /**
   * Get project statistics
   */
  getStats() {
    const now = new Date()
    const created = new Date(this.manifest.created)
    const ageHours = (now - created) / (1000 * 60 * 60)
    
    return {
      projectAge: `${Math.floor(ageHours)}h ${Math.floor((ageHours % 1) * 60)}m`,
      totalMessages: this.chatHistory.length,
      activeAgents: Object.values(this.agents).filter(a => a.status === 'active').length,
      totalAgents: Object.keys(this.agents).length,
      trackedFiles: Object.keys(this.files).length,
      lastActivity: this.chatHistory.length > 0 ? 
        this.chatHistory[this.chatHistory.length - 1].timestamp : 
        this.manifest.created
    }
  }
}
