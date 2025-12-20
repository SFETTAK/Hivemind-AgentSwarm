// Swarm data fetching hook
// Handles polling and updating the swarm store

import { useEffect, useCallback, useRef } from 'react'
import { 
  useSwarmStore, 
  parseMessages, 
  stripRuntimeFromAgents, 
  stripActiveFromEdges 
} from '../stores/swarmStore'
import { useApiConfig } from './useApiConfig'

export interface UseSwarmDataOptions {
  pollInterval?: number
  enabled?: boolean
}

export function useSwarmData(options: UseSwarmDataOptions = {}) {
  const { pollInterval = 5000, enabled = true } = options
  const { apiUrl } = useApiConfig()
  
  const store = useSwarmStore()
  const {
    agents,
    edges,
    messages,
    stats,
    runtime,
    connected,
    loading,
    error,
    setAgents,
    setEdges,
    setMessages,
    setStats,
    setRuntime,
    setConnected,
    setLoading,
    setError
  } = store
  
  // Use ref to track previous values for comparison
  const prevDataRef = useRef({ agents, edges, messages, stats })
  
  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, edgesRes, statsRes, messagesRes] = await Promise.all([
        fetch(`${apiUrl}/agents`),
        fetch(`${apiUrl}/edges`),
        fetch(`${apiUrl}/stats`),
        fetch(`${apiUrl}/messages`)
      ])
      
      if (!agentsRes.ok || !edgesRes.ok || !statsRes.ok) {
        throw new Error('API request failed')
      }
      
      const agentsData = await agentsRes.json()
      const edgesData = await edgesRes.json()
      const statsData = await statsRes.json()
      const messagesData = await messagesRes.json()
      
      const parsedMessages = parseMessages(messagesData.messages || '')
      const { runtime: newRuntime, ...statsWithoutRuntime } = statsData
      const newStats = { ...statsWithoutRuntime, messageCount: parsedMessages.length }
      
      // Only update if data actually changed
      const prev = prevDataRef.current
      
      const agentsChanged = JSON.stringify(stripRuntimeFromAgents(prev.agents)) !== 
                           JSON.stringify(stripRuntimeFromAgents(agentsData.agents))
      const edgesChanged = JSON.stringify(stripActiveFromEdges(prev.edges)) !== 
                          JSON.stringify(stripActiveFromEdges(edgesData.edges))
      const statsChanged = JSON.stringify(prev.stats) !== JSON.stringify(newStats)
      const messagesChanged = JSON.stringify(prev.messages) !== JSON.stringify(parsedMessages)
      
      if (agentsChanged) setAgents(agentsData.agents)
      if (edgesChanged) setEdges(edgesData.edges)
      if (statsChanged) setStats(newStats)
      if (messagesChanged) setMessages(parsedMessages)
      setRuntime(newRuntime)
      
      // Update connection status
      if (!connected || loading) {
        setConnected(true)
        setLoading(false)
        setError(null)
      }
      
      // Update prev ref
      prevDataRef.current = {
        agents: agentsData.agents,
        edges: edgesData.edges,
        messages: parsedMessages,
        stats: newStats
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (connected || loading || error !== errorMessage) {
        setConnected(false)
        setLoading(false)
        setError(errorMessage)
      }
    }
  }, [apiUrl, connected, loading, error, setAgents, setEdges, setMessages, setStats, setRuntime, setConnected, setLoading, setError])
  
  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return
    
    fetchData()
    const interval = setInterval(fetchData, pollInterval)
    
    return () => clearInterval(interval)
  }, [enabled, pollInterval, fetchData])
  
  return {
    agents,
    edges,
    messages,
    stats,
    runtime,
    connected,
    loading,
    error,
    refetch: fetchData
  }
}

