// Tmux session management connector
// Handles all tmux interactions for the swarm

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface TmuxSession {
  id: string
  name: string
  shortName: string
  attached: boolean
  path: string
  created: number
  status: 'active' | 'idle'
}

export interface TmuxConnectorConfig {
  prefix?: string
  defaultPath?: string
}

const DEFAULT_CONFIG: TmuxConnectorConfig = {
  prefix: 'hive',
  defaultPath: process.cwd()
}

/**
 * List all Hivemind tmux sessions
 */
export async function listSessions(config: TmuxConnectorConfig = DEFAULT_CONFIG): Promise<TmuxSession[]> {
  const prefix = config.prefix || 'hive'
  
  try {
    const { stdout } = await execAsync(
      'tmux list-sessions -F "#{session_name}|#{session_created}|#{session_attached}|#{pane_current_path}" 2>/dev/null || echo ""'
    )
    
    const sessions = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [name, created, attached, cwd] = line.split('|')
        if (!name.startsWith(`${prefix}-`)) return null
        
        return {
          id: name,
          name: name.replace(`${prefix}-`, '').toUpperCase(),
          shortName: name.replace(`${prefix}-`, ''),
          attached: attached === '1',
          path: cwd || config.defaultPath || process.cwd(),
          created: parseInt(created) * 1000,
          status: (attached === '1' ? 'active' : 'idle') as 'active' | 'idle'
        }
      })
      .filter((s): s is TmuxSession => s !== null)
    
    return sessions
  } catch (e) {
    return []
  }
}

/**
 * Read output from a tmux pane
 */
export async function readPane(sessionName: string, lines: number = 500): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tmux capture-pane -t ${sessionName} -p -S -${lines} 2>/dev/null`
    )
    return stdout
  } catch (e) {
    return ''
  }
}

/**
 * Send a command to a tmux session
 */
export async function sendCommand(sessionName: string, command: string): Promise<boolean> {
  try {
    // Escape single quotes in command
    const escapedCommand = command.replace(/'/g, "'\\''")
    await execAsync(`tmux send-keys -t ${sessionName} '${escapedCommand}' Enter`)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Create a new tmux session with a command
 */
export async function createSession(
  sessionName: string,
  command: string,
  workdir?: string
): Promise<boolean> {
  try {
    const cdPart = workdir ? `cd ${workdir} && ` : ''
    await execAsync(
      `tmux new-session -d -s ${sessionName} -c "${workdir || process.cwd()}" "${cdPart}${command}"`
    )
    return true
  } catch (e) {
    console.error('Failed to create tmux session:', e)
    return false
  }
}

/**
 * Kill a tmux session
 */
export async function killSession(sessionName: string): Promise<boolean> {
  try {
    await execAsync(`tmux kill-session -t ${sessionName} 2>/dev/null`)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Check if a tmux session exists
 */
export async function sessionExists(sessionName: string): Promise<boolean> {
  try {
    await execAsync(`tmux has-session -t ${sessionName} 2>/dev/null`)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Send Ctrl+C to interrupt a running command
 */
export async function sendInterrupt(sessionName: string): Promise<boolean> {
  try {
    await execAsync(`tmux send-keys -t ${sessionName} C-c`)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Broadcast a message to all Hivemind sessions
 */
export async function broadcast(
  message: string,
  config: TmuxConnectorConfig = DEFAULT_CONFIG
): Promise<number> {
  const sessions = await listSessions(config)
  let sent = 0
  
  for (const session of sessions) {
    const success = await sendCommand(session.id, `# BROADCAST: ${message}`)
    if (success) sent++
  }
  
  return sent
}

