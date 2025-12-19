import express from 'express'
import cors from 'cors'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const execAsync = promisify(exec)
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// =============================================================================
// Configuration - All paths are configurable via settings.json or env vars
// =============================================================================

// Store settings in server directory to avoid triggering Vite HMR
const SETTINGS_FILE = path.join(__dirname, 'settings.json')

// Default settings - all paths relative or configurable
let currentSettings = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  MCP_SERVER_URL: process.env.MCP_SERVER_URL || 'http://127.0.0.1:8000',
  API_SERVER_URL: process.env.API_SERVER_URL || 'http://localhost:3001',
  OLLAMA_ENDPOINT: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
  // Model defaults
  MODEL_FORGE: 'openrouter/anthropic/claude-sonnet-4',
  MODEL_SENTINEL: 'openrouter/anthropic/claude-sonnet-4',
  MODEL_ORACLE: 'openrouter/deepseek/deepseek-chat-v3.1',
  MODEL_NEXUS: 'openrouter/deepseek/deepseek-chat-v3.1',
  MODEL_SCRIBE: 'openrouter/deepseek/deepseek-chat-v3.1',
  MODEL_CONDUCTOR: 'openrouter/anthropic/claude-sonnet-4',
  // Conductor customization
  CONDUCTOR_NAME: 'QUEEN',
  // Paths - relative to this package by default
  PROJECT_DIR: process.env.HIVEMIND_PROJECT_DIR || process.cwd(),
  PROMPTS_DIR: process.env.HIVEMIND_PROMPTS_DIR || path.join(__dirname, '..', '..', 'mcp', 'prompts'),
  TMUX_PREFIX: 'hive',
  AUTO_ACCEPT: true,
}

// Model tiers
const MODEL_TIERS = {
  forge: 'openrouter/anthropic/claude-sonnet-4',
  sentinel: 'openrouter/anthropic/claude-sonnet-4',
  oracle: 'openrouter/deepseek/deepseek-chat-v3.1',
  nexus: 'openrouter/deepseek/deepseek-chat-v3.1',
  scribe: 'openrouter/deepseek/deepseek-chat-v3.1',
  default: 'openrouter/anthropic/claude-sonnet-4'
}

// Load settings on startup
async function loadSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
    currentSettings = { ...currentSettings, ...JSON.parse(data) }
    
    // Update MODEL_TIERS from loaded settings
    if (currentSettings.MODEL_FORGE) MODEL_TIERS.forge = currentSettings.MODEL_FORGE
    if (currentSettings.MODEL_SENTINEL) MODEL_TIERS.sentinel = currentSettings.MODEL_SENTINEL
    if (currentSettings.MODEL_ORACLE) MODEL_TIERS.oracle = currentSettings.MODEL_ORACLE
    if (currentSettings.MODEL_NEXUS) MODEL_TIERS.nexus = currentSettings.MODEL_NEXUS
    if (currentSettings.MODEL_SCRIBE) MODEL_TIERS.scribe = currentSettings.MODEL_SCRIBE
    
    console.log('📋 Settings loaded from', SETTINGS_FILE)
  } catch (e) {
    console.log('📋 Using default settings (no settings.json found)')
  }
}
loadSettings()

// Dynamic paths based on settings
const getProjectDir = () => currentSettings.PROJECT_DIR
const getHivemindDir = () => path.join(getProjectDir(), '.hivemind')
const getPromptsDir = () => currentSettings.PROMPTS_DIR

// Agent prompt file paths (computed from PROMPTS_DIR)
const getAgentPromptPath = (role) => {
  const promptsDir = getPromptsDir()
  const promptFiles = {
    forge: 'FORGE_PROMPT.md',
    sentinel: 'SENTINEL_PROMPT.md',
    oracle: 'ORACLE_PROMPT.md',
    scribe: 'SCRIBE_PROMPT.md',
    nexus: 'NEXUS_PROMPT.md',
    conductor: 'CONDUCTOR_WEB_PROMPT.md'
  }
  return path.join(promptsDir, promptFiles[role] || promptFiles.forge)
}

// =============================================================================
// Health Endpoints
// =============================================================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'READY', timestamp: new Date().toISOString() })
})

// =============================================================================
// Tmux Session Management
// =============================================================================

async function getTmuxSessions() {
  try {
    const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}|#{session_created}|#{session_attached}|#{pane_current_path}" 2>/dev/null || echo ""')
    const sessions = stdout.trim().split('\n').filter(Boolean).map(line => {
      const [name, created, attached, cwd] = line.split('|')
      if (!name.startsWith('hive-')) return null
      return {
        id: name,
        name: name.replace('hive-', '').toUpperCase(),
        shortName: name.replace('hive-', ''),
        attached: attached === '1',
        path: cwd || getProjectDir(),
        created: parseInt(created) * 1000,
        status: attached === '1' ? 'active' : 'idle',
      }
    }).filter(Boolean)
    return sessions
  } catch (e) {
    return []
  }
}

async function readTmuxPane(sessionName) {
  try {
    const { stdout } = await execAsync(`tmux capture-pane -t ${sessionName} -p -S -500 2>/dev/null`)
    return stdout
  } catch (e) {
    return ''
  }
}

// =============================================================================
// Hivemind File Operations
// =============================================================================

async function getHivemindStatus() {
  try {
    const content = await fs.readFile(path.join(getHivemindDir(), 'STATUS.md'), 'utf-8')
    return content
  } catch (e) {
    return '# No status file'
  }
}

async function getHivemindMessages() {
  try {
    const content = await fs.readFile(path.join(getHivemindDir(), 'MESSAGES.md'), 'utf-8')
    return content
  } catch (e) {
    return '# No messages'
  }
}

// =============================================================================
// API Routes
// =============================================================================

app.get('/api/agents', async (req, res) => {
  const sessions = await getTmuxSessions()
  
  const roleMap = {
    'forge': { icon: '🔨', color: '#00ff88', role: 'forge' },
    'sentinel': { icon: '🛡️', color: '#ffcc00', role: 'sentinel' },
    'oracle': { icon: '🔮', color: '#a855f7', role: 'oracle' },
    'nexus': { icon: '🔗', color: '#00d4ff', role: 'nexus' },
    'scribe': { icon: '📝', color: '#ff6b6b', role: 'scribe' },
    'conductor': { icon: '🎯', color: '#ff9500', role: 'conductor' },
  }
  
  const conductorSession = sessions.find(s => s.shortName.includes('conductor'))
  const workerSessions = sessions.filter(s => !s.shortName.includes('conductor'))
  
  const agents = workerSessions.map((s, i) => {
    const roleKey = Object.keys(roleMap).find(r => s.shortName.includes(r)) || 'forge'
    const roleInfo = roleMap[roleKey]
    const modelForRole = MODEL_TIERS[roleKey] || MODEL_TIERS.default
    const modelShortName = modelForRole.split('/').pop()
    
    const totalWorkers = workerSessions.length || 1
    const angle = (i / totalWorkers) * Math.PI + Math.PI
    const radius = 0.3
    
    return {
      ...s,
      ...roleInfo,
      model: modelShortName,
      modelFull: modelForRole,
      task: `Session: ${s.shortName}`,
      runtime: formatRuntime(Date.now() - s.created),
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.6 + Math.sin(angle) * radius * 0.5,
      size: 32,
    }
  })
  
  // Add USER entry point (the human operator)
  agents.unshift({
    id: 'user-entry',
    name: 'USER',
    shortName: 'user',
    icon: '👤',
    color: '#00d4ff',
    role: 'entry',
    status: 'active',
    model: 'you',
    task: 'Human Operator',
    runtime: formatRuntime(Date.now() - (sessions[0]?.created || Date.now())),
    x: 0.5,
    y: 0.15,
    size: 40,
  })
  
  // Add CONDUCTOR (name is configurable)
  const conductorName = currentSettings.CONDUCTOR_NAME || 'QUEEN'
  if (conductorSession) {
    agents.splice(1, 0, {
      ...conductorSession,
      id: conductorSession.id,
      name: conductorName,
      shortName: 'conductor',
      icon: '👑',
      color: '#ff9500',
      role: 'conductor',
      status: conductorSession.attached ? 'active' : 'idle',
      model: 'claude-3.5-sonnet',
      task: 'Orchestrating swarm',
      runtime: formatRuntime(Date.now() - conductorSession.created),
      x: 0.5,
      y: 0.4,
      size: 42,
    })
  } else {
    agents.splice(1, 0, {
      id: 'conductor-placeholder',
      name: conductorName,
      shortName: 'conductor',
      icon: '👑',
      color: '#666666',
      role: 'conductor',
      status: 'offline',
      model: 'not deployed',
      task: 'Not running',
      runtime: '0s',
      x: 0.5,
      y: 0.4,
      size: 42,
    })
  }
  
  res.json({ agents, count: agents.length })
})

app.get('/api/agents/:name/output', async (req, res) => {
  // Handle both "hive-xxx" and "xxx" formats
  const name = req.params.name
  const sessionName = name.startsWith('hive-') ? name : `hive-${name}`
  const output = await readTmuxPane(sessionName)
  res.json({ output })
})

app.get('/api/status', async (req, res) => {
  const status = await getHivemindStatus()
  res.json({ status })
})

app.get('/api/messages', async (req, res) => {
  const messages = await getHivemindMessages()
  res.json({ messages })
})

app.get('/api/edges', async (req, res) => {
  const sessions = await getTmuxSessions()
  const conductorSession = sessions.find(s => s.shortName.includes('conductor'))
  const workerSessions = sessions.filter(s => !s.shortName.includes('conductor'))
  
  const edges = []
  
  edges.push({
    from: 'user-entry',
    to: conductorSession ? conductorSession.id : 'conductor-placeholder',
    active: true,
    label: 'commands',
  })
  
  workerSessions.forEach(s => {
    edges.push({
      from: conductorSession ? conductorSession.id : 'conductor-placeholder',
      to: s.id,
      active: s.status === 'active' || Math.random() > 0.5,
      label: 'task',
    })
  })
  
  res.json({ edges })
})

// =============================================================================
// Cost Tracking
// =============================================================================

const COSTS_FILE = path.join(__dirname, '..', 'costs.json')
let sessionCosts = {}
let totalCost = 0

async function loadCosts() {
  try {
    const data = await fs.readFile(COSTS_FILE, 'utf-8')
    const saved = JSON.parse(data)
    sessionCosts = saved.sessionCosts || {}
    totalCost = saved.totalCost || 0
    console.log(`💰 Loaded costs: $${totalCost.toFixed(2)}`)
  } catch (e) {
    console.log('💰 Starting fresh cost tracking')
  }
}
loadCosts()

async function saveCosts() {
  try {
    await fs.writeFile(COSTS_FILE, JSON.stringify({ sessionCosts, totalCost, lastSaved: new Date().toISOString() }, null, 2))
  } catch (e) {
    console.error('Failed to save costs:', e)
  }
}

function parseCostFromOutput(output) {
  const sessionMatch = output.match(/\$(\d+\.?\d*)\s*session/i)
  if (sessionMatch) return parseFloat(sessionMatch[1])
  const costMatch = output.match(/Cost:\s*\$(\d+\.?\d*)/i)
  if (costMatch) return parseFloat(costMatch[1])
  return 0
}

app.get('/api/stats', async (req, res) => {
  const sessions = await getTmuxSessions()
  
  let currentTotalCost = 0
  for (const session of sessions) {
    try {
      const output = await readTmuxPane(session.id)
      const sessionCost = parseCostFromOutput(output)
      if (sessionCost > 0) sessionCosts[session.id] = sessionCost
    } catch (e) {}
  }
  
  currentTotalCost = Object.values(sessionCosts).reduce((sum, cost) => sum + cost, 0)
  if (currentTotalCost > totalCost) {
    totalCost = currentTotalCost
    saveCosts()
  }
  
  let messageCount = 0
  try {
    const messages = await getHivemindMessages()
    messageCount = (messages.match(/^(##|>|\[\d)/gm) || []).length
  } catch (e) {}
  
  res.json({
    agentCount: sessions.length + 1,
    messageCount,
    cost: `$${totalCost.toFixed(2)}`,
    runtime: formatRuntime(Date.now() - (sessions[0]?.created || Date.now())),
    breakdown: sessionCosts,
  })
})

app.get('/api/costs', async (req, res) => {
  const sessions = await getTmuxSessions()
  
  for (const session of sessions) {
    try {
      const output = await readTmuxPane(session.id)
      const sessionCost = parseCostFromOutput(output)
      if (sessionCost > 0) sessionCosts[session.id] = sessionCost
    } catch (e) {}
  }
  
  const breakdown = Object.entries(sessionCosts).map(([id, cost]) => ({
    agent: id.replace('hive-', '').toUpperCase(),
    sessionId: id,
    cost: cost,
    formatted: `$${cost.toFixed(2)}`,
  }))
  
  const total = Object.values(sessionCosts).reduce((sum, cost) => sum + cost, 0)
  
  res.json({
    total: `$${total.toFixed(2)}`,
    totalRaw: total,
    breakdown,
    lastUpdated: new Date().toISOString(),
  })
})

app.post('/api/costs/reset', async (req, res) => {
  sessionCosts = {}
  totalCost = 0
  await saveCosts()
  res.json({ success: true, message: 'Cost tracking reset' })
})

// =============================================================================
// Settings Endpoints
// =============================================================================

app.get('/api/settings', (req, res) => {
  res.json({ settings: currentSettings })
})

app.post('/api/settings', async (req, res) => {
  const { settings } = req.body
  
  if (!settings) {
    return res.status(400).json({ error: 'No settings provided' })
  }
  
  Object.keys(settings).forEach(key => {
    if (settings[key] !== undefined && settings[key] !== '') {
      currentSettings[key] = settings[key]
    }
  })
  
  if (settings.MODEL_FORGE) MODEL_TIERS.forge = settings.MODEL_FORGE
  if (settings.MODEL_SENTINEL) MODEL_TIERS.sentinel = settings.MODEL_SENTINEL
  if (settings.MODEL_ORACLE) MODEL_TIERS.oracle = settings.MODEL_ORACLE
  if (settings.MODEL_NEXUS) MODEL_TIERS.nexus = settings.MODEL_NEXUS
  if (settings.MODEL_SCRIBE) MODEL_TIERS.scribe = settings.MODEL_SCRIBE
  
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2))
    
    if (currentSettings.OPENROUTER_API_KEY) {
      process.env.OPENROUTER_API_KEY = currentSettings.OPENROUTER_API_KEY
    }
    if (currentSettings.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = currentSettings.ANTHROPIC_API_KEY
    }
    
    res.json({ success: true, message: 'Settings saved' })
  } catch (err) {
    console.error('Failed to save settings:', err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

app.get('/api/models', (req, res) => {
  res.json({
    tiers: MODEL_TIERS,
    recommended: {
      'opus-4.5': 'openrouter/anthropic/claude-opus-4.5',
      'sonnet-4': 'openrouter/anthropic/claude-sonnet-4',
      'deepseek': 'openrouter/deepseek/deepseek-chat-v3.1',
      'deepseek-free': 'openrouter/deepseek/deepseek-chat:free',
      'gemini-flash': 'openrouter/google/gemini-2.0-flash-001',
    },
    description: {
      forge: 'Heavy lifting, code generation - Sonnet 4',
      sentinel: 'Testing, validation - Sonnet 4', 
      oracle: 'Research, analysis - DeepSeek (affordable)',
      nexus: 'Integration, APIs - DeepSeek (affordable)',
      scribe: 'Documentation - DeepSeek (affordable)',
    }
  })
})

// =============================================================================
// Agent Control Endpoints
// =============================================================================

app.post('/api/agents/deploy', async (req, res) => {
  const { role = 'forge', task = 'general', model, startAider = true, injectPrompt = true } = req.body
  
  const selectedModel = model || MODEL_TIERS[role] || MODEL_TIERS.default
  const sanitizedTask = task.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase().slice(0, 20)
  const sessionName = `hive-${role}-${sanitizedTask}`
  
  try {
    const { stdout: existingCheck } = await execAsync(`tmux has-session -t ${sessionName} 2>&1 || echo "not-found"`)
    if (!existingCheck.includes('not-found')) {
      return res.status(400).json({ 
        success: false, 
        error: `Session ${sessionName} already exists. Kill it first or use a different name.` 
      })
    }
    
    await execAsync(`tmux new-session -d -s "${sessionName}" -c "${getProjectDir()}"`)
    
    if (startAider) {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const openrouterKey = currentSettings.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || ''
      const anthropicKey = currentSettings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || ''
      
      if (openrouterKey) {
        await execAsync(`tmux send-keys -t "${sessionName}" 'export OPENROUTER_API_KEY="${openrouterKey}"' Enter`)
      }
      if (anthropicKey) {
        await execAsync(`tmux send-keys -t "${sessionName}" 'export ANTHROPIC_API_KEY="${anthropicKey}"' Enter`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const promptFile = getAgentPromptPath(role)
      let aiderCmd = `aider --model ${selectedModel} --yes`
      
      // Check if prompt file exists before adding it
      try {
        await fs.access(promptFile)
        if (injectPrompt) {
          aiderCmd += ` --read ${promptFile}`
        }
      } catch (e) {
        // Prompt file doesn't exist, skip
      }
      
      await execAsync(`tmux send-keys -t "${sessionName}" '${aiderCmd}' Enter`)
      
      if (injectPrompt) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        const roleUpper = role.toUpperCase()
        const identityMsg = `You are ${roleUpper}. Read your prompt file and say "Ready." only.`
        await execAsync(`tmux send-keys -t "${sessionName}" '${identityMsg}' Enter`)
      }
    }
    
    res.json({ 
      success: true, 
      message: `Agent ${sessionName} deployed with aider (${selectedModel})`,
      sessionName,
      role,
      model: selectedModel,
      tier: MODEL_TIERS[role] ? role : 'default',
      task: sanitizedTask,
    })
  } catch (e) {
    console.error('Deploy error:', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

app.post('/api/agents/:name/send', async (req, res) => {
  const { command } = req.body
  // Handle both "hive-xxx" and "xxx" formats
  const name = req.params.name
  const sessionName = name.startsWith('hive-') ? name : `hive-${name}`
  
  try {
    await execAsync(`tmux send-keys -t ${sessionName} '${command.replace(/'/g, "'\\''")}' Enter`)
    res.json({ success: true, message: `Command sent to ${sessionName}` })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.post('/api/broadcast', async (req, res) => {
  const { message } = req.body
  const sessions = await getTmuxSessions()
  
  try {
    const timestamp = new Date().toISOString()
    const broadcastMsg = `# BROADCAST [${timestamp}]\n${message}\n\n`
    
    await fs.appendFile(path.join(getHivemindDir(), 'MESSAGES.md'), broadcastMsg).catch(() => {})
    
    for (const session of sessions) {
      await execAsync(`tmux send-keys -t ${session.id} '# BROADCAST: ${message.replace(/'/g, "'\\''")}' Enter`).catch(() => {})
    }
    
    res.json({ success: true, message: `Broadcast sent to ${sessions.length} agents` })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.post('/api/swarm/pause', async (req, res) => {
  const sessions = await getTmuxSessions()
  
  try {
    for (const session of sessions) {
      await execAsync(`tmux send-keys -t ${session.id} C-c`).catch(() => {})
    }
    res.json({ success: true, message: `Paused ${sessions.length} agents` })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.post('/api/swarm/stop', async (req, res) => {
  const sessions = await getTmuxSessions()
  
  try {
    for (const session of sessions) {
      await execAsync(`tmux kill-session -t ${session.id}`).catch(() => {})
    }
    res.json({ success: true, message: `Killed ${sessions.length} agent sessions` })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// =============================================================================
// Activity Feed Endpoint
// =============================================================================

app.get('/api/activity', async (req, res) => {
  try {
    const sessions = await getTmuxSessions()
    const activities = []
    
    for (const session of sessions) {
      // Session ID starts with hive-, shortName has it stripped
      if (!session.id?.startsWith('hive-')) continue
      
      try {
        // Get last 20 lines from the tmux session
        const { stdout } = await execAsync(`tmux capture-pane -t ${session.id} -p -S -20 2>/dev/null || echo ""`)
        const lines = stdout.trim().split('\n').filter(l => l.trim())
        
        // Try to summarize what's happening
        let summary = ''
        const lastLines = lines.slice(-5).join(' ').toLowerCase()
        
        if (lastLines.includes('error') || lastLines.includes('traceback')) {
          summary = '✗ Error encountered'
        } else if (lastLines.includes('commit') || lastLines.includes('committed')) {
          summary = '✓ Made a commit'
        } else if (lastLines.includes('test') && lastLines.includes('pass')) {
          summary = '✓ Tests passing'
        } else if (lastLines.includes('test') && lastLines.includes('fail')) {
          summary = '✗ Tests failing'
        } else if (lastLines.includes('writing') || lastLines.includes('creating')) {
          summary = '📝 Writing files...'
        } else if (lastLines.includes('reading') || lastLines.includes('analyzing')) {
          summary = '🔍 Analyzing code...'
        } else if (lastLines.includes('thinking') || lastLines.includes('...')) {
          summary = '💭 Thinking...'
        } else if (lastLines.includes('done') || lastLines.includes('complete')) {
          summary = '✓ Task complete'
        } else if (lines.length > 0) {
          // Just show last meaningful line (skip bare prompts)
          const lastLine = lines[lines.length - 1].trim()
          if (lastLine === '>' || lastLine === '$' || lastLine === '>>>' || lastLine.length < 3) {
            summary = '⏳ Idle at prompt'
          } else {
            const truncated = lastLine.slice(0, 60)
            summary = truncated.length > 50 ? truncated + '...' : truncated
          }
        } else {
          summary = '⏳ Waiting...'
        }
        
        // Extract role from session name (hive-forge-xxx -> forge)
        const parts = session.shortName.replace('hive-', '').split('-')
        const role = parts[0]
        
        activities.push({
          agent: session.shortName,
          role: role,
          status: session.attached ? 'active' : 'idle',
          summary: summary,
          lastOutput: lines.slice(-3).join('\n')
        })
      } catch (e) {
        // Skip sessions we can't read
      }
    }
    
    res.json({ activities })
  } catch (e) {
    res.status(500).json({ error: e.message, activities: [] })
  }
})

// =============================================================================
// Conductor Chat Endpoint
// =============================================================================

let conductorHistory = []
const MAX_HISTORY = 20

async function getConductorSystemPrompt() {
  try {
    const promptPath = getAgentPromptPath('conductor')
    const prompt = await fs.readFile(promptPath, 'utf-8')
    
    const sessions = await getTmuxSessions()
    const agentStatus = sessions
      .filter(s => s.shortName.startsWith('hive-'))
      .map(s => `- ${s.shortName}: ${s.status}`)
      .join('\n') || '- No active agents'
    
    return `${prompt}

## Current State (Live)
### Active Agents
${agentStatus}

### Available Tools
You have these API endpoints available:
- deploy_agent(role, task) - Deploy FORGE/SENTINEL/ORACLE/SCRIBE/NEXUS
- send_to_agent(name, message) - Send message to specific agent
- broadcast(message) - Send to all agents
- get_status() - Get current swarm status
- kill_agent(name) - Kill an agent session
`
  } catch (e) {
    console.error('Error loading conductor prompt:', e)
    return 'You are CONDUCTOR, an AI orchestrator. Help the user manage their AI agent swarm.'
  }
}

app.post('/api/conductor/chat', async (req, res) => {
  const { message, clearHistory = false } = req.body
  
  if (clearHistory) conductorHistory = []
  if (!message) return res.status(400).json({ error: 'Message required' })
  
  try {
    const systemPrompt = await getConductorSystemPrompt()
    conductorHistory.push({ role: 'user', content: message })
    
    if (conductorHistory.length > MAX_HISTORY * 2) {
      conductorHistory = conductorHistory.slice(-MAX_HISTORY * 2)
    }
    
    const model = currentSettings.MODEL_CONDUCTOR || 'openrouter/anthropic/claude-sonnet-4'
    const apiKey = currentSettings.OPENROUTER_API_KEY
    
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' })
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://hivemind.local',
        'X-Title': 'Hivemind Conductor'
      },
      body: JSON.stringify({
        model: model.replace('openrouter/', ''),
        messages: [
          { role: 'system', content: systemPrompt },
          ...conductorHistory
        ],
        max_tokens: 4096
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter error: ${error}`)
    }
    
    const data = await response.json()
    let assistantMessage = data.choices[0].message.content
    
    conductorHistory.push({ role: 'assistant', content: assistantMessage })
    
    const usage = data.usage || {}
    const cost = ((usage.prompt_tokens || 0) * 0.003 + (usage.completion_tokens || 0) * 0.015) / 1000
    
    res.json({
      message: assistantMessage,
      model,
      usage,
      cost: cost.toFixed(4),
      historyLength: conductorHistory.length,
    })
    
  } catch (e) {
    console.error('Conductor chat error:', e)
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/conductor/history', (req, res) => {
  res.json({ history: conductorHistory, length: conductorHistory.length })
})

app.post('/api/conductor/clear', (req, res) => {
  conductorHistory = []
  res.json({ success: true, message: 'History cleared' })
})

// =============================================================================
// Inbox (Multi-source messaging)
// =============================================================================

const INBOX_FILE = path.join(__dirname, '..', 'hivemind-inbox.json')
let inbox = { messages: [], sources: {} }

async function loadInbox() {
  try {
    const data = await fs.readFile(INBOX_FILE, 'utf-8')
    inbox = JSON.parse(data)
  } catch (e) {
    inbox = { messages: [], sources: {} }
  }
}
loadInbox()

async function saveInbox() {
  await fs.writeFile(INBOX_FILE, JSON.stringify(inbox, null, 2))
}

app.post('/api/inbox', async (req, res) => {
  const { message, source = 'unknown', sender = 'anonymous', metadata = {} } = req.body
  
  if (!message) return res.status(400).json({ error: 'No message provided' })
  
  const msg = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    source, sender, message, metadata,
    read: false, replied: false
  }
  
  inbox.messages.push(msg)
  if (inbox.messages.length > 200) inbox.messages = inbox.messages.slice(-200)
  await saveInbox()
  
  res.json({ success: true, message: `Message received from ${source}`, id: msg.id })
})

app.get('/api/inbox', async (req, res) => {
  const { source, unread_only } = req.query
  
  let messages = inbox.messages
  if (source) messages = messages.filter(m => m.source === source)
  if (unread_only === 'true') messages = messages.filter(m => !m.read)
  
  res.json({ 
    messages,
    total: inbox.messages.length,
    unread: inbox.messages.filter(m => !m.read).length,
    sources: inbox.sources
  })
})

// =============================================================================
// File System API
// =============================================================================

// List files in a directory (recursive tree structure)
app.get('/api/files', async (req, res) => {
  try {
    const baseDir = req.query.path || getProjectDir()
    const depth = parseInt(req.query.depth) || 3
    
    async function buildTree(dirPath, currentDepth = 0) {
      const name = path.basename(dirPath)
      const stats = await fs.stat(dirPath)
      
      if (!stats.isDirectory()) {
        return { name, type: 'file', path: dirPath }
      }
      
      const result = {
        name,
        type: 'folder',
        path: dirPath,
        expanded: currentDepth < 1, // Auto-expand first level
        children: []
      }
      
      if (currentDepth >= depth) {
        return result
      }
      
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        // Sort: folders first, then files, alphabetically
        const sorted = entries.sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })
        
        // Filter out hidden files and common excludes
        const filtered = sorted.filter(entry => {
          if (entry.name.startsWith('.') && entry.name !== '.hivemind') return false
          if (['node_modules', '__pycache__', '.git', 'dist', 'build'].includes(entry.name)) return false
          return true
        })
        
        for (const entry of filtered) {
          const childPath = path.join(dirPath, entry.name)
          const child = await buildTree(childPath, currentDepth + 1)
          result.children.push(child)
        }
      } catch (e) {
        // Can't read directory - permission denied, etc.
        result.error = e.message
      }
      
      return result
    }
    
    const tree = await buildTree(baseDir)
    res.json({ tree, basePath: baseDir })
    
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Create new file
app.post('/api/files/new', async (req, res) => {
  try {
    const { filePath, content = '' } = req.body
    if (!filePath) return res.status(400).json({ error: 'filePath required' })
    
    // Security: ensure path is within project dir
    const fullPath = path.resolve(filePath)
    const projectDir = path.resolve(getProjectDir())
    if (!fullPath.startsWith(projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    await fs.writeFile(fullPath, content, 'utf-8')
    res.json({ success: true, path: fullPath })
    
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Create new folder
app.post('/api/files/mkdir', async (req, res) => {
  try {
    const { folderPath } = req.body
    if (!folderPath) return res.status(400).json({ error: 'folderPath required' })
    
    // Security: ensure path is within project dir
    const fullPath = path.resolve(folderPath)
    const projectDir = path.resolve(getProjectDir())
    if (!fullPath.startsWith(projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    await fs.mkdir(fullPath, { recursive: true })
    res.json({ success: true, path: fullPath })
    
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Delete file or folder
app.delete('/api/files', async (req, res) => {
  try {
    const { filePath } = req.body
    if (!filePath) return res.status(400).json({ error: 'filePath required' })
    
    // Security: ensure path is within project dir
    const fullPath = path.resolve(filePath)
    const projectDir = path.resolve(getProjectDir())
    if (!fullPath.startsWith(projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    // Don't allow deleting the project root
    if (fullPath === projectDir) {
      return res.status(403).json({ error: 'Cannot delete project root' })
    }
    
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true })
    } else {
      await fs.unlink(fullPath)
    }
    
    res.json({ success: true, deleted: fullPath })
    
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Rename file or folder
app.post('/api/files/rename', async (req, res) => {
  try {
    const { oldPath, newPath } = req.body
    if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' })
    
    // Security: ensure both paths are within project dir
    const fullOldPath = path.resolve(oldPath)
    const fullNewPath = path.resolve(newPath)
    const projectDir = path.resolve(getProjectDir())
    
    if (!fullOldPath.startsWith(projectDir) || !fullNewPath.startsWith(projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    await fs.rename(fullOldPath, fullNewPath)
    res.json({ success: true, oldPath: fullOldPath, newPath: fullNewPath })
    
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Read file content
app.get('/api/files/read', async (req, res) => {
  try {
    const filePath = req.query.path
    if (!filePath) return res.status(400).json({ error: 'path query param required' })
    
    // Security: ensure path is within project dir
    const fullPath = path.resolve(filePath)
    const projectDir = path.resolve(getProjectDir())
    if (!fullPath.startsWith(projectDir)) {
      return res.status(403).json({ error: 'Path outside project directory' })
    }
    
    const content = await fs.readFile(fullPath, 'utf-8')
    const stats = await fs.stat(fullPath)
    
    res.json({ 
      content, 
      path: fullPath,
      size: stats.size,
      modified: stats.mtime
    })
    
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// =============================================================================
// Utility Functions
// =============================================================================

function formatRuntime(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🐝 Hivemind API running on http://0.0.0.0:${PORT}`)
  console.log(`📁 Project dir: ${getProjectDir()}`)
  console.log(`📁 Prompts dir: ${getPromptsDir()}`)
})

