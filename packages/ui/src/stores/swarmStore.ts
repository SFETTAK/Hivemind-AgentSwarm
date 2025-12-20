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

// API Base URL - can be configured
let API_BASE = 'http://192.168.1.133:3001'

export function setApiBase(url: string) {
  API_BASE = url
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
  fetchData: async (apiBase: string) => {
    try {
      const [agentsRes, edgesRes, statsRes, messagesRes] = await Promise.all([
        fetch(`${apiBase}/api/agents`),
        fetch(`${apiBase}/api/edges`),
        fetch(`${apiBase}/api/stats`),
        fetch(`${apiBase}/api/messages`),
      ])
      
      if (!agentsRes.ok || !edgesRes.ok || !statsRes.ok) {
        throw new Error('API request failed')
      }
      
      const agentsData = await agentsRes.json()
      const edgesData = await edgesRes.json()
      const statsData = await statsRes.json()
      const messagesData = await messagesRes.json()
      
      // Parse messages from markdown
      const parsedMessages = parseMessages(messagesData.messages || '')
      
      // Only update if data actually changed (prevents unnecessary re-renders)
      const currentState = get()
      const { runtime, ...statsWithoutRuntime } = statsData
      const newStats = { ...statsWithoutRuntime, messageCount: parsedMessages.length }
      
      // Helper to compare agents without runtime (runtime changes every second)
      const stripRuntime = (agents: Agent[]) => agents.map(({ runtime, ...rest }) => rest)
      // Helper to compare edges without active (active toggles frequently for animations)
      const stripActive = (edges: Edge[]) => edges.map(({ active, ...rest }) => rest)
      
      // Check if anything actually changed (excluding frequently-changing visual fields)
      const agentsChanged = JSON.stringify(stripRuntime(currentState.agents)) !== JSON.stringify(stripRuntime(agentsData.agents || []))
      const edgesChanged = JSON.stringify(stripActive(currentState.edges)) !== JSON.stringify(stripActive(edgesData.edges || []))
      const statsChanged = JSON.stringify(currentState.stats) !== JSON.stringify(newStats)
      const messagesChanged = JSON.stringify(currentState.messages) !== JSON.stringify(parsedMessages)
      const connectionChanged = !currentState.connected || currentState.loading
      const runtimeChanged = currentState.runtime !== runtime
      
      // Build update object - only include what changed
      const updates: Partial<SwarmState> = {}
      
      if (agentsChanged) updates.agents = agentsData.agents || []
      if (edgesChanged) updates.edges = edgesData.edges || []
      if (statsChanged) updates.stats = newStats
      if (messagesChanged) updates.messages = parsedMessages
      if (runtimeChanged) updates.runtime = runtime || '0s'
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

