import { create } from 'zustand'
import { getApiUrl } from '../config'

const API_URL = getApiUrl()

// Parse messages from markdown format
function parseMessages(markdown) {
  const messages = []
  
  // Match patterns like: [TIMESTAMP] SENDER → TARGET: Message
  // Or: # BROADCAST [TIMESTAMP]\nMessage
  const broadcastRegex = /# BROADCAST \[([^\]]+)\]\n([^\n#]+)/g
  // Support both → (UTF-8) and -> (ASCII) arrows, and alphanumeric agent names
  const messageRegex = /\[([^\]]+)\] ([A-Z0-9_-]+) (?:→|->|→) ([A-Z0-9_-]+): (.+)/gi
  
  let match
  
  // Parse broadcasts
  while ((match = broadcastRegex.exec(markdown)) !== null) {
    const timestamp = match[1]
    let timeStr
    try {
      timeStr = new Date(timestamp).toLocaleTimeString()
    } catch {
      timeStr = timestamp.slice(11, 19) // fallback to HH:MM:SS
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
    let timeStr
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
  
  // Return most recent first
  return messages.reverse().slice(0, 20)
}

// Load persisted selectedAgent from localStorage
const getPersistedAgent = () => {
  try {
    return localStorage.getItem('hivemind-selected-agent') || null
  } catch {
    return null
  }
}

export const useSwarmStore = create((set, get) => ({
  // State
  agents: [],
  edges: [],
  messages: [],
  selectedAgent: getPersistedAgent(),
  stats: {
    agentCount: 0,
    messageCount: 0,
    cost: '$0.00',
  },
  runtime: '0s', // Separate from stats to prevent re-renders
  connected: false,
  loading: true,
  error: null,
  
  // Actions
  setSelectedAgent: (agentId) => {
    // Persist to localStorage
    try {
      if (agentId) {
        localStorage.setItem('hivemind-selected-agent', agentId)
      } else {
        localStorage.removeItem('hivemind-selected-agent')
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    set({ selectedAgent: agentId })
  },
  
  // Fetch all data from API
  fetchData: async () => {
    try {
      const [agentsRes, edgesRes, statsRes, messagesRes] = await Promise.all([
        fetch(`${API_URL}/agents`),
        fetch(`${API_URL}/edges`),
        fetch(`${API_URL}/stats`),
        fetch(`${API_URL}/messages`),
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
      const stripRuntime = (agents) => agents.map(({ runtime, ...rest }) => rest)
      // Helper to compare edges without active (active toggles frequently for animations)
      const stripActive = (edges) => edges.map(({ active, ...rest }) => rest)
      
      // Check if anything actually changed (excluding frequently-changing visual fields)
      const agentsChanged = JSON.stringify(stripRuntime(currentState.agents)) !== JSON.stringify(stripRuntime(agentsData.agents))
      const edgesChanged = JSON.stringify(stripActive(currentState.edges)) !== JSON.stringify(stripActive(edgesData.edges))
      const statsChanged = JSON.stringify(currentState.stats) !== JSON.stringify(newStats)
      const messagesChanged = JSON.stringify(currentState.messages) !== JSON.stringify(parsedMessages)
      const connectionChanged = !currentState.connected || currentState.loading
      const runtimeChanged = currentState.runtime !== runtime
      
      // Build update object - only include what changed
      const updates = {}
      
      // For agents, we need to update runtime values without triggering full re-renders
      // So we update agents array but components should use shallow comparison
      if (agentsChanged) {
        updates.agents = agentsData.agents
      }
      if (edgesChanged) updates.edges = edgesData.edges
      if (statsChanged) updates.stats = newStats
      if (messagesChanged) updates.messages = parsedMessages
      if (runtimeChanged) updates.runtime = runtime
      if (connectionChanged) {
        updates.connected = true
        updates.loading = false
        updates.error = null
      }
      
      // Only call set if something meaningful changed (not just runtime/active)
      if (Object.keys(updates).length > 0) {
        set(updates)
      }
    } catch (error) {
      console.error('Failed to fetch swarm data:', error)
      const currentState = get()
      if (currentState.connected || currentState.loading || currentState.error !== error.message) {
        set({ 
          connected: false, 
          loading: false,
          error: error.message,
        })
      }
    }
  },
  
  // Add a message (for real-time updates later)
  addMessage: (message) => set((state) => ({
    messages: [message, ...state.messages].slice(0, 20)
  })),
}))

// Auto-fetch on store creation
const store = useSwarmStore.getState()
store.fetchData()

// Poll for data changes every 5 seconds (slower, less disruptive)
setInterval(() => store.fetchData(), 5000)
