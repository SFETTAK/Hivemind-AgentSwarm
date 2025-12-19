import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class AgentStateManager {
  constructor() {
    this.agentStates = new Map()
  }

  /**
   * Capture current state of an agent from tmux session
   */
  async captureAgentState(agentId, tmuxSession) {
    try {
      // Get tmux session info
      const { stdout: sessionInfo } = await execAsync(
        `tmux list-sessions -F "#{session_name}|#{session_created}|#{session_attached}|#{pane_current_path}" | grep "^${tmuxSession}|"`
      )
      
      if (!sessionInfo.trim()) {
        return null // Session doesn't exist
      }
      
      const [name, created, attached, cwd] = sessionInfo.trim().split('|')
      
      // Get recent output
      const { stdout: output } = await execAsync(
        `tmux capture-pane -t ${tmuxSession} -p -S -100`
      ).catch(() => ({ stdout: '' }))
      
      // Parse current task from output
      const currentTask = this.parseCurrentTask(output)
      const workingFiles = this.parseWorkingFiles(output)
      const costs = this.parseCosts(output)
      
      const state = {
        agentId,
        role: this.inferRole(agentId),
        status: attached === '1' ? 'active' : 'idle',
        tmuxSession,
        context: {
          currentTask,
          workingFiles,
          lastActivity: new Date().toISOString(),
          workingDirectory: cwd
        },
        memory: {
          recentOutput: output.split('\n').slice(-20).join('\n'),
          conversationHistory: [], // Will be populated from chat history
          lastCommands: this.parseLastCommands(output)
        },
        costs,
        session: {
          created: parseInt(created) * 1000,
          attached: attached === '1',
          uptime: Date.now() - (parseInt(created) * 1000)
        }
      }
      
      this.agentStates.set(agentId, state)
      return state
      
    } catch (e) {
      console.error(`Failed to capture state for ${agentId}:`, e.message)
      return null
    }
  }

  /**
   * Restore agent from saved state (recreate tmux session)
   */
  async restoreAgent(agentState, projectDir) {
    const { agentId, tmuxSession, context, role } = agentState
    
    try {
      // Check if session already exists
      const { stdout: existing } = await execAsync(
        `tmux has-session -t ${tmuxSession} 2>&1 || echo "not-found"`
      )
      
      if (!existing.includes('not-found')) {
        console.log(`Session ${tmuxSession} already exists, skipping restore`)
        return { success: true, message: 'Session already exists' }
      }
      
      // Create new tmux session
      await execAsync(`tmux new-session -d -s "${tmuxSession}" -c "${projectDir}"`)
      
      // Start aider with appropriate model
      const model = this.getModelForRole(role)
      await execAsync(`tmux send-keys -t "${tmuxSession}" 'aider --model ${model} --yes' Enter`)
      
      // Wait for aider to start
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Restore context if available
      if (context.currentTask) {
        const contextMsg = `# Resuming: ${context.currentTask}`
        await execAsync(`tmux send-keys -t "${tmuxSession}" '${contextMsg}' Enter`)
      }
      
      return {
        success: true,
        message: `Restored ${agentId} with session ${tmuxSession}`,
        model
      }
      
    } catch (e) {
      console.error(`Failed to restore agent ${agentId}:`, e.message)
      return {
        success: false,
        error: e.message
      }
    }
  }

  /**
   * Get all current agent states from running tmux sessions
   */
  async getAllAgentStates() {
    try {
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^hive-" || echo ""'
      )
      
      const sessions = stdout.trim().split('\n').filter(Boolean)
      const states = {}
      
      for (const session of sessions) {
        const agentId = session.replace('hive-', '')
        const state = await this.captureAgentState(agentId, session)
        if (state) {
          states[agentId] = state
        }
      }
      
      return states
      
    } catch (e) {
      console.error('Failed to get agent states:', e.message)
      return {}
    }
  }

  /**
   * Update agent state with new information
   */
  updateAgentState(agentId, updates) {
    const current = this.agentStates.get(agentId) || {}
    const updated = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    }
    
    this.agentStates.set(agentId, updated)
    return updated
  }

  // Private helper methods

  parseCurrentTask(output) {
    // Look for common patterns that indicate current task
    const lines = output.split('\n').reverse() // Start from bottom
    
    for (const line of lines) {
      if (line.includes('# ') && !line.includes('aider')) {
        return line.replace(/^.*# /, '').trim()
      }
      if (line.includes('Applied edit to')) {
        return `Editing ${line.split(' ').pop()}`
      }
      if (line.includes('Creating') || line.includes('Implementing')) {
        return line.trim()
      }
    }
    
    return 'Ready for input'
  }

  parseWorkingFiles(output) {
    const files = []
    const lines = output.split('\n')
    
    for (const line of lines) {
      // Look for file paths in aider output
      const fileMatch = line.match(/Applied edit to ([^\s]+)/)
      if (fileMatch) {
        files.push(fileMatch[1])
      }
      
      // Look for "Adding" or "Creating" patterns
      const createMatch = line.match(/(?:Adding|Creating|Writing) ([^\s]+\.[a-z]+)/i)
      if (createMatch) {
        files.push(createMatch[1])
      }
    }
    
    // Return unique files, last 5
    return [...new Set(files)].slice(-5)
  }

  parseCosts(output) {
    // Parse cost information from aider output
    const sessionMatch = output.match(/\$(\d+\.?\d*)\s*session/i)
    const messageMatch = output.match(/\$(\d+\.?\d*)\s*message/i)
    
    return {
      sessionTotal: sessionMatch ? parseFloat(sessionMatch[1]) : 0,
      lastMessage: messageMatch ? parseFloat(messageMatch[1]) : 0,
      currency: 'USD'
    }
  }

  parseLastCommands(output) {
    const commands = []
    const lines = output.split('\n')
    
    for (const line of lines) {
      if (line.includes('> ') && !line.includes('aider>')) {
        commands.push(line.trim())
      }
    }
    
    return commands.slice(-5) // Last 5 commands
  }

  inferRole(agentId) {
    const roleMap = {
      'forge': 'FORGE',
      'sentinel': 'SENTINEL', 
      'oracle': 'ORACLE',
      'nexus': 'NEXUS',
      'scribe': 'SCRIBE',
      'conductor': 'CONDUCTOR'
    }
    
    for (const [key, role] of Object.entries(roleMap)) {
      if (agentId.includes(key)) {
        return role
      }
    }
    
    return 'AGENT'
  }

  getModelForRole(role) {
    const modelMap = {
      'FORGE': 'openrouter/anthropic/claude-sonnet-4',
      'SENTINEL': 'openrouter/anthropic/claude-sonnet-4',
      'ORACLE': 'openrouter/deepseek/deepseek-chat-v3.1',
      'NEXUS': 'openrouter/deepseek/deepseek-chat-v3.1',
      'SCRIBE': 'openrouter/deepseek/deepseek-chat-v3.1',
      'CONDUCTOR': 'openrouter/anthropic/claude-sonnet-4'
    }
    
    return modelMap[role] || 'openrouter/anthropic/claude-sonnet-4'
  }
}
