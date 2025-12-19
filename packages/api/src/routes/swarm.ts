// Swarm routes - Broadcast, pause, stop, stats

import { Router } from 'express'
import { listSessions, broadcast, sendInterrupt, readPane } from '@hivemind/connectors/tmux'
import { readMessages, appendMessage } from '@hivemind/connectors/filesystem'
import { parseCostFromOutput } from '@hivemind/connectors/llm'
import type { ServerConfig } from '../server'

// Track session costs
const sessionCosts: Record<string, number> = {}
let totalCost = 0

export function swarmRoutes(config: ServerConfig) {
  const router = Router()
  
  // Get swarm stats
  router.get('/stats', async (req, res) => {
    try {
      const sessions = await listSessions({ defaultPath: config.projectDir })
      
      // Parse costs from each session
      for (const session of sessions) {
        const output = await readPane(session.id)
        const cost = parseCostFromOutput(output)
        if (cost > 0) sessionCosts[session.id] = cost
      }
      
      const currentTotal = Object.values(sessionCosts).reduce((sum, c) => sum + c, 0)
      if (currentTotal > totalCost) totalCost = currentTotal
      
      // Count messages
      let messageCount = 0
      try {
        const messages = await readMessages(config.projectDir)
        messageCount = (messages.match(/^(##|>|\[\d)/gm) || []).length
      } catch {}
      
      // Calculate runtime
      const firstSession = sessions[0]
      const runtime = firstSession ? Date.now() - firstSession.created : 0
      
      res.json({
        agentCount: sessions.length + 2, // +2 for USER and CONDUCTOR
        messageCount,
        cost: `$${totalCost.toFixed(2)}`,
        runtime: formatRuntime(runtime),
        breakdown: sessionCosts
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Broadcast to all agents
  router.post('/broadcast', async (req, res) => {
    try {
      const { message } = req.body
      
      // Append to MESSAGES.md
      await appendMessage(config.projectDir, `# BROADCAST\n${message}`)
      
      // Send to all tmux sessions
      const count = await broadcast(message, { defaultPath: config.projectDir })
      
      res.json({
        success: true,
        message: `Broadcast sent to ${count} agents`
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Pause all agents (send Ctrl+C)
  router.post('/pause', async (req, res) => {
    try {
      const sessions = await listSessions({ defaultPath: config.projectDir })
      
      for (const session of sessions) {
        await sendInterrupt(session.id)
      }
      
      res.json({
        success: true,
        message: `Paused ${sessions.length} agents`
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Emergency stop (kill all sessions)
  router.post('/stop', async (req, res) => {
    try {
      const sessions = await listSessions({ defaultPath: config.projectDir })
      const { killSession } = await import('@hivemind/connectors/tmux')
      
      for (const session of sessions) {
        await killSession(session.id)
      }
      
      res.json({
        success: true,
        message: `Stopped ${sessions.length} agents`
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Get messages
  router.get('/messages', async (req, res) => {
    try {
      const messages = await readMessages(config.projectDir)
      res.json({ messages })
    } catch (e) {
      res.json({ messages: '# No messages' })
    }
  })
  
  return router
}

function formatRuntime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

