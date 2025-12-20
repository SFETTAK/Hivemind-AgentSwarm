// =============================================================================
// @hivemind/connectors - Tmux Client
// =============================================================================
// All tmux operations in one place. No business logic - just tmux commands.

import { exec } from 'child_process'
import { promisify } from 'util'
import type { Agent, AgentRole, AgentStatus } from '@hivemind/core'
import { getAgentDefinition, parseSessionName } from '@hivemind/core'

const execAsync = promisify(exec)

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TmuxSession {
  id: string
  name: string
  windows: number
  created: string
  attached: boolean
}

export interface SpawnOptions {
  sessionName: string
  workingDir: string
  env?: Record<string, string>
}

export interface AiderOptions extends SpawnOptions {
  model: string
  promptPath?: string
  autoAccept?: boolean
}

// -----------------------------------------------------------------------------
// Session Management
// -----------------------------------------------------------------------------

/**
 * List all tmux sessions
 */
export async function listSessions(): Promise<TmuxSession[]> {
  try {
    const { stdout } = await execAsync(
      'tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}|#{session_attached}" 2>/dev/null'
    )
    
    return stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        const [name, windows, created, attached] = line.split('|')
        return {
          id: name,
          name,
          windows: parseInt(windows, 10) || 1,
          created,
          attached: attached === '1',
        }
      })
  } catch {
    return []
  }
}

/**
 * Check if a session exists
 */
export async function sessionExists(name: string): Promise<boolean> {
  try {
    await execAsync(`tmux has-session -t "${name}" 2>/dev/null`)
    return true
  } catch {
    return false
  }
}

/**
 * Create a new tmux session
 */
export async function createSession(options: SpawnOptions): Promise<void> {
  const { sessionName, workingDir, env } = options
  
  // Create the session
  await execAsync(`tmux new-session -d -s "${sessionName}" -c "${workingDir}"`)
  
  // Set environment variables if provided
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (value) {
        // Set env var (will show in terminal briefly)
        await execAsync(`tmux send-keys -t "${sessionName}" 'export ${key}="${value}"' Enter`)
      }
    }
    // Clear the terminal to hide the API keys from view
    await new Promise(resolve => setTimeout(resolve, 200))
    await execAsync(`tmux send-keys -t "${sessionName}" 'clear' Enter`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

/**
 * Kill a tmux session
 */
export async function killSession(name: string): Promise<void> {
  await execAsync(`tmux kill-session -t "${name}"`)
}

/**
 * Send keys/command to a session
 */
export async function sendKeys(sessionName: string, command: string): Promise<void> {
  // Escape single quotes in the command
  const escaped = command.replace(/'/g, "'\\''")
  await execAsync(`tmux send-keys -t "${sessionName}" '${escaped}' Enter`)
}

/**
 * Capture pane output
 */
export async function captureOutput(sessionName: string, lines = 500): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tmux capture-pane -t "${sessionName}" -p -S -${lines} 2>/dev/null`
    )
    return stdout
  } catch {
    return ''
  }
}

// -----------------------------------------------------------------------------
// Aider Integration
// -----------------------------------------------------------------------------

/**
 * Start aider in a session
 */
export async function startAider(options: AiderOptions): Promise<void> {
  const { sessionName, model, promptPath, autoAccept = true } = options
  
  let cmd = `aider --model ${model}`
  
  if (autoAccept) {
    cmd += ' --yes'
  }
  
  if (promptPath) {
    cmd += ` --read "${promptPath}"`
  }
  
  await sendKeys(sessionName, cmd)
}

/**
 * Spawn a full agent session with aider
 */
export async function spawnAgent(
  role: AgentRole,
  task: string,
  config: {
    workingDir: string
    promptsDir: string
    model: string
    apiKeys: { openrouter?: string; anthropic?: string }
    prefix?: string
    autoAccept?: boolean
  }
): Promise<{ sessionName: string; agent: Agent }> {
  const prefix = config.prefix || 'hive'
  const sanitizedTask = task.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase().slice(0, 20)
  const sessionName = `${prefix}-${role}-${sanitizedTask}`
  
  // Check if already exists
  if (await sessionExists(sessionName)) {
    throw new Error(`Session ${sessionName} already exists`)
  }
  
  // Create session with env vars
  await createSession({
    sessionName,
    workingDir: config.workingDir,
    env: {
      OPENROUTER_API_KEY: config.apiKeys.openrouter || '',
      ANTHROPIC_API_KEY: config.apiKeys.anthropic || '',
    },
  })
  
  // Small delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Start aider
  const promptPath = `${config.promptsDir}/${role.toUpperCase()}_PROMPT.md`
  await startAider({
    sessionName,
    workingDir: config.workingDir,
    model: config.model,
    promptPath,
    autoAccept: config.autoAccept ?? true,
  })
  
  // Build agent object
  const def = getAgentDefinition(role)
  const agent: Agent = {
    id: sessionName,
    shortName: `${role}-${sanitizedTask}`,
    role,
    name: def.name,
    icon: def.icon,
    color: def.color,
    status: 'active',
    model: config.model,
    task,
    runtime: 0, // Just spawned
  }
  
  return { sessionName, agent }
}

// -----------------------------------------------------------------------------
// Agent Discovery
// -----------------------------------------------------------------------------

/**
 * Get all hivemind agents from tmux sessions
 */
export async function getAgents(prefix = 'hive'): Promise<Agent[]> {
  const sessions = await listSessions()
  const agents: Agent[] = []
  
  for (const session of sessions) {
    if (!session.name.startsWith(`${prefix}-`)) continue
    
    const parsed = parseSessionName(session.name, prefix)
    if (!parsed) continue
    
    const def = getAgentDefinition(parsed.role)
    const output = await captureOutput(session.name, 20)
    
    // Determine status from output
    let status: AgentStatus = 'active'
    const lastLines = output.toLowerCase()
    if (lastLines.includes('error') || lastLines.includes('traceback')) {
      status = 'error'
    } else if (lastLines.includes('waiting') || lastLines.includes('>')) {
      status = 'idle'
    }
    
    // Calculate runtime in seconds from session creation time
    let runtimeSeconds = 0
    if (session.created) {
      const startTime = parseInt(session.created, 10) * 1000 // tmux returns unix timestamp
      if (!isNaN(startTime)) {
        runtimeSeconds = Math.floor((Date.now() - startTime) / 1000)
      }
    }
    
    agents.push({
      id: session.name,
      shortName: session.name.replace(`${prefix}-`, ''),
      role: parsed.role,
      name: def.name,
      icon: def.icon,
      color: def.color,
      status,
      task: parsed.task,
      model: '', // Will be populated from settings if available
      runtime: runtimeSeconds,
    })
  }
  
  return agents
}

/**
 * Get activity summary for an agent
 */
export async function getAgentActivity(sessionName: string): Promise<string> {
  const output = await captureOutput(sessionName, 20)
  const lines = output.trim().split('\n').filter(l => l.trim())
  const lastLines = lines.slice(-5).join(' ').toLowerCase()
  
  if (lastLines.includes('error') || lastLines.includes('traceback')) {
    return '✗ Error encountered'
  }
  if (lastLines.includes('commit') || lastLines.includes('committed')) {
    return '✓ Committed changes'
  }
  if (lastLines.includes('editing') || lastLines.includes('wrote')) {
    return '✎ Editing files'
  }
  if (lastLines.includes('thinking') || lastLines.includes('processing')) {
    return '⟳ Processing...'
  }
  if (lastLines.includes('>') && lines.length < 5) {
    return '◯ Ready'
  }
  
  return '◯ Active'
}

