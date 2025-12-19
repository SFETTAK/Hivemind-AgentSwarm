import { create } from 'zustand'

// Dynamically determine API URL based on current host
const getApiUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3001/api'
  const host = window.location.hostname
  return host === 'localhost' ? 'http://localhost:3001/api' : `http://${host}:3001/api`
}

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

export const useSwarmStore = create((set, get) => ({
  // State
  agents: [],
  edges: [],
  messages: [],
  selectedAgent: null,
  stats: {
    agentCount: 0,
    messageCount: 0,
    cost: '$0.00',
    runtime: '0s',
  },
  connected: false,
  loading: true,
  error: null,
  
  // Actions
  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),
  
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
      
      set({
        agents: agentsData.agents,
        edges: edgesData.edges,
        stats: { ...statsData, messageCount: parsedMessages.length },
        messages: parsedMessages,
        connected: true,
        loading: false,
        error: null,
      })
    } catch (error) {
      console.error('Failed to fetch swarm data:', error)
      set({ 
        connected: false, 
        loading: false,
        error: error.message,
      })
    }
  },
  
  // Add a message (for real-time updates later)
  addMessage: (message) => set((state) => ({
    messages: [message, ...state.messages].slice(0, 20)
  })),
}))

// Auto-fetch on store creation and poll every 2 seconds
const store = useSwarmStore.getState()
store.fetchData()
setInterval(() => store.fetchData(), 2000)
