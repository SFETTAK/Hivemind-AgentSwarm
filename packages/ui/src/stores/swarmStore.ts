// Swarm state management store
// Manages agents, edges, messages, and connection status

import { create } from 'zustand'

// Types
export interface Agent {
  id: string
  name: string
  shortName: string
  role: string
  task: string
  icon: string
  color: string
  status: 'active' | 'idle' | 'error' | 'stopped' | 'offline'
  model: string
  runtime: number
}

export interface Edge {
  source: string
  target: string
  active?: boolean
}

export interface SwarmMessage {
  time: string
  sender: string
  recipient: string
  text: string
  type: 'task' | 'info' | 'alert' | 'error'
}

export interface SwarmStats {
  agentCount: number
  messageCount: number
  cost: string
}

export interface SwarmState {
  // Data
  agents: Agent[]
  edges: Edge[]
  messages: SwarmMessage[]
  stats: SwarmStats
  runtime: string
  
  // UI State
  selectedAgent: string | null
  connected: boolean
  loading: boolean
  error: string | null
  
  // Actions
  setSelectedAgent: (agentId: string | null) => void
  setAgents: (agents: Agent[]) => void
  setEdges: (edges: Edge[]) => void
  setMessages: (messages: SwarmMessage[]) => void
  setStats: (stats: SwarmStats) => void
  setRuntime: (runtime: string) => void
  setConnected: (connected: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addMessage: (message: SwarmMessage) => void
  fetchData: (apiBase: string) => Promise<void>
}

// API Base URL - can be configured at runtime
let API_BASE = 'http://localhost:3001'

export function setApiBase(url: string) {
  API_BASE = url
}

// Format uptime seconds to human-readable string
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

// Parse messages from markdown format
export function parseMessages(markdown: string): SwarmMessage[] {
  const messages: SwarmMessage[] = []
  
  // Match broadcasts
  const broadcastRegex = /# BROADCAST \[([^\]]+)\]\n([^\n#]+)/g
  // Match direct messages
  const messageRegex = /\[([^\]]+)\] ([A-Z0-9_-]+) (?:→|->|→) ([A-Z0-9_-]+): (.+)/gi
  
  let match
  
  // Parse broadcasts
  while ((match = broadcastRegex.exec(markdown)) !== null) {
    const timestamp = match[1]
    let timeStr: string
    try {
      timeStr = new Date(timestamp).toLocaleTimeString()
    } catch {
      timeStr = timestamp.slice(11, 19)
    }
    messages.push({
      time: timeStr,
      sender: 'CONDUCTOR',
      recipient: 'ALL',
      text: match[2].trim(),
      type: 'alert'
    })
  }
  
  // Parse direct messages
  while ((match = messageRegex.exec(markdown)) !== null) {
    const timestamp = match[1]
    let timeStr: string
    try {
      const d = new Date(timestamp)
      timeStr = isNaN(d.getTime()) ? timestamp.slice(11, 19) : d.toLocaleTimeString()
    } catch {
      timeStr = timestamp.slice(11, 19)
    }
    messages.push({
      time: timeStr,
      sender: match[2].toUpperCase(),
      recipient: match[3].toUpperCase(),
      text: match[4],
      type: match[2].toUpperCase() === 'CONDUCTOR' ? 'task' : 'info'
    })
  }
  
  return messages.reverse().slice(0, 20)
}

// Load persisted selectedAgent from localStorage
function getPersistedAgent(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('hivemind-selected-agent') || null
  } catch {
    return null
  }
}

// Persist selectedAgent to localStorage
function persistAgent(agentId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (agentId) {
      localStorage.setItem('hivemind-selected-agent', agentId)
    } else {
      localStorage.removeItem('hivemind-selected-agent')
    }
  } catch {
    // Ignore localStorage errors
  }
}

export const useSwarmStore = create<SwarmState>((set, get) => ({
  // Initial state
  agents: [],
  edges: [],
  messages: [],
  stats: {
    agentCount: 0,
    messageCount: 0,
    cost: '$0.00'
  },
  runtime: '0s',
  selectedAgent: getPersistedAgent(),
  connected: false,
  loading: true,
  error: null,
  
  // Actions
  setSelectedAgent: (agentId) => {
    persistAgent(agentId)
    set({ selectedAgent: agentId })
  },
  
  setAgents: (agents) => set({ agents }),
  setEdges: (edges) => set({ edges }),
  setMessages: (messages) => set({ messages }),
  setStats: (stats) => set({ stats }),
  setRuntime: (runtime) => set({ runtime }),
  setConnected: (connected) => set({ connected }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  addMessage: (message) => set((state) => ({
    messages: [message, ...state.messages].slice(0, 20)
  })),
  
  // Fetch all data from API
  // Uses consolidated /api/swarm/status for agents/edges/stats, with fallback to legacy endpoints
  fetchData: async (apiBase: string) => {
    try {
      // Try consolidated endpoint first (new modular API)
      const statusRes = await fetch(`${apiBase}/api/swarm/status`)
      
      let agents: Agent[] = []
      let edges: Edge[] = []
      let stats: SwarmStats = { agentCount: 0, messageCount: 0, cost: '$0.00' }
      let runtime = '0s'
      
      if (statusRes.ok) {
        // New modular API - consolidated response
        const statusData = await statusRes.json()
        agents = statusData.agents || []
        edges = statusData.edges || []
        stats = {
          agentCount: statusData.stats?.totalAgents || agents.length,
          messageCount: statusData.stats?.messagesExchanged || 0,
          cost: '$0.00', // TODO: track costs
        }
        runtime = formatUptime(statusData.stats?.uptime || 0)
      } else {
        // Fallback to legacy endpoints
        const [agentsRes, edgesRes, statsRes] = await Promise.all([
          fetch(`${apiBase}/api/agents`),
          fetch(`${apiBase}/api/edges`),
          fetch(`${apiBase}/api/stats`),
        ])
        
        if (agentsRes.ok) {
          const data = await agentsRes.json()
          agents = data.agents || []
        }
        if (edgesRes.ok) {
          const data = await edgesRes.json()
          edges = data.edges || []
        }
        if (statsRes.ok) {
          const data = await statsRes.json()
          stats = {
            agentCount: data.agentCount || 0,
            messageCount: data.messageCount || 0,
            cost: data.cost || '$0.00',
          }
          runtime = data.runtime || '0s'
        }
      }
      
      // Fetch messages separately (optional endpoint)
      let parsedMessages: SwarmMessage[] = []
      try {
        const messagesRes = await fetch(`${apiBase}/api/messages`)
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json()
          parsedMessages = parseMessages(messagesData.messages || '')
        }
      } catch {
        // Messages endpoint not available - that's fine
      }
      
      // Only update if data actually changed (prevents unnecessary re-renders)
      const currentState = get()
      const newStats = { ...stats, messageCount: parsedMessages.length || stats.messageCount }
      
      // Helper to compare agents without runtime (runtime changes every second)
      const stripRuntime = (agentList: Agent[]) => agentList.map(({ runtime: _r, ...rest }) => rest)
      // Helper to compare edges without active (active toggles frequently for animations)
      const stripActive = (edgeList: Edge[]) => edgeList.map(({ active: _a, ...rest }) => rest)
      
      // Check if anything actually changed (excluding frequently-changing visual fields)
      const agentsChanged = JSON.stringify(stripRuntime(currentState.agents)) !== JSON.stringify(stripRuntime(agents))
      const edgesChanged = JSON.stringify(stripActive(currentState.edges)) !== JSON.stringify(stripActive(edges))
      const statsChanged = JSON.stringify(currentState.stats) !== JSON.stringify(newStats)
      const messagesChanged = JSON.stringify(currentState.messages) !== JSON.stringify(parsedMessages)
      const connectionChanged = !currentState.connected || currentState.loading
      const runtimeChanged = currentState.runtime !== runtime
      
      // Build update object - only include what changed
      const updates: Partial<SwarmState> = {}
      
      if (agentsChanged) updates.agents = agents
      if (edgesChanged) updates.edges = edges
      if (statsChanged) updates.stats = newStats
      if (messagesChanged) updates.messages = parsedMessages
      if (runtimeChanged) updates.runtime = runtime
      if (connectionChanged) {
        updates.connected = true
        updates.loading = false
        updates.error = null
      }
      
      // Only call set if something meaningful changed
      if (Object.keys(updates).length > 0) {
        set(updates)
      }
    } catch (error) {
      console.error('Failed to fetch swarm data:', error)
      const currentState = get()
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (currentState.connected || currentState.loading || currentState.error !== errorMsg) {
        set({ 
          connected: false, 
          loading: false,
          error: errorMsg,
        })
      }
    }
  }
}))

// Helper to compare without frequently-changing fields
export function stripRuntimeFromAgents(agents: Agent[]): Omit<Agent, 'runtime'>[] {
  return agents.map(({ runtime, ...rest }) => rest)
}

export function stripActiveFromEdges(edges: Edge[]): Omit<Edge, 'active'>[] {
  return edges.map(({ active, ...rest }) => rest)
}

// Initialize polling when this module loads
let pollingStarted = false

export function startPolling(apiBase: string) {
  if (pollingStarted) return
  pollingStarted = true
  
  const store = useSwarmStore.getState()
  
  // Initial fetch
  store.fetchData(apiBase)
  
  // Poll every 5 seconds
  setInterval(() => {
    useSwarmStore.getState().fetchData(apiBase)
  }, 5000)
}

