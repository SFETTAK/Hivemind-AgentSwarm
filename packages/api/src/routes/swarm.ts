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
      const agents = await getAgents(cfg.tmuxPrefix)
      
      // Build edges (conductor connects to all)
      const edges = agents
        .filter(a => a.role !== 'conductor')
        .map(a => ({
          source: 'user-entry',
          target: a.id,
          active: a.status === 'active',
        }))
      
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
  
  return router
}

