// =============================================================================
// Swarm Routes
// =============================================================================

import { Router } from 'express'
import type { SettingsManager } from '@hivemind/config'
import { getAgents, sendKeys, getAgentActivity } from '@hivemind/connectors'
import { AGENT_DEFINITIONS } from '@hivemind/core'

export function createSwarmRoutes(settings: SettingsManager): Router {
  const router = Router()
  
  // Get swarm status
  router.get('/status', async (req, res) => {
    const cfg = settings.get()
    
    try {
      const tmuxAgents = await getAgents(cfg.tmuxPrefix)
      
      // Add permanent nodes: USER and QUEEN
      // These always exist in the topology regardless of tmux sessions
      const userNode = {
        id: 'user',
        shortName: 'user',
        role: 'user' as const,
        name: 'USER',
        icon: '👤',
        color: '#60a5fa', // blue
        status: 'active' as const,
        model: '',
        task: 'Human operator',
        runtime: 0,
      }
      
      const queenNode = {
        id: 'queen',
        shortName: 'queen',
        role: 'conductor' as const,
        name: 'QUEEN',
        icon: '👑',
        color: '#fbbf24', // amber/gold
        status: 'active' as const,
        model: cfg.profiles?.[cfg.speedLevel]?.models?.conductor || 'anthropic/claude-sonnet',
        task: 'Swarm orchestration',
        runtime: 0,
      }
      
      // Combine: USER + QUEEN + tmux agents
      const agents = [userNode, queenNode, ...tmuxAgents]
      
      // Build edges:
      // - USER connects to QUEEN
      // - QUEEN connects to all worker agents
      const edges = [
        // User -> Queen connection
        { source: 'user', target: 'queen', active: true },
        // Queen -> all workers
        ...tmuxAgents.map(a => ({
          source: 'queen',
          target: a.id,
          active: a.status === 'active',
        }))
      ]
      
      res.json({
        agents,
        edges,
        stats: {
          activeAgents: agents.filter(a => a.status === 'active').length,
          totalAgents: agents.length,
          messagesExchanged: 0, // TODO: track this
          tasksCompleted: 0,
          uptime: 0,
        },
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Get activity feed
  router.get('/activity', async (req, res) => {
    const cfg = settings.get()
    
    try {
      const agents = await getAgents(cfg.tmuxPrefix)
      const activities = []
      
      for (const agent of agents) {
        const summary = await getAgentActivity(agent.id)
        activities.push({
          agent: agent.id,
          role: agent.role,
          summary,
          timestamp: new Date().toISOString(),
        })
      }
      
      res.json({ activities })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Broadcast to all agents
  router.post('/broadcast', async (req, res) => {
    const { message } = req.body
    const cfg = settings.get()
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' })
    }
    
    try {
      const agents = await getAgents(cfg.tmuxPrefix)
      const timestamp = new Date().toISOString()
      const broadcastMsg = `# BROADCAST [${timestamp}]\n${message}`
      
      for (const agent of agents) {
        await sendKeys(agent.id, broadcastMsg)
      }
      
      res.json({
        success: true,
        message: `Broadcast sent to ${agents.length} agents`,
        agentCount: agents.length,
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Get available roles
  router.get('/roles', (req, res) => {
    res.json({ roles: AGENT_DEFINITIONS })
  })
  
  // Pause swarm (stub - pauses polling/activity, agents keep running)
  router.post('/pause', async (req, res) => {
    // TODO: Implement actual pause logic (could set a flag that stops new tasks)
    res.json({ 
      success: true, 
      message: 'Swarm paused',
      paused: true 
    })
  })
  
  // Emergency stop - kill all agents
  router.post('/stop', async (req, res) => {
    const cfg = settings.get()
    
    try {
      const agents = await getAgents(cfg.tmuxPrefix)
      const { killSession } = await import('@hivemind/connectors')
      
      let killed = 0
      for (const agent of agents) {
        try {
          await killSession(agent.id)
          killed++
        } catch {
          // Agent may already be dead
        }
      }
      
      res.json({ 
        success: true, 
        message: `Emergency stop: killed ${killed} agents`,
        killed 
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  return router
}

