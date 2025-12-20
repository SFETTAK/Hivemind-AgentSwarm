// =============================================================================
// @hivemind/api - Express Server
// =============================================================================

import express from 'express'
import cors from 'cors'
import * as path from 'path'
import { createSettingsManager, type SettingsManager } from '@hivemind/config'
import { createAgentRoutes } from './routes/agents'
import { createConductorRoutes } from './routes/conductor'
import { createSettingsRoutes } from './routes/settings'
import { createSwarmRoutes } from './routes/swarm'
import { createFilesRoutes } from './routes/files'

export interface ServerConfig {
  port: number
  settingsPath: string
  projectDir?: string
  promptsDir?: string
}

export async function createServer(config: ServerConfig): Promise<{ app: express.Application; settings: SettingsManager }> {
  const app = express()
  
  // Initialize settings
  const settings = createSettingsManager(config.settingsPath)
  await settings.load()
  
  // Override paths if provided
  if (config.projectDir) {
    await settings.update({ projectDir: config.projectDir })
  }
  if (config.promptsDir) {
    await settings.update({ promptsDir: config.promptsDir })
  }
  
  // Middleware
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))
  
  // Health checks
  app.get('/health', (req, res) => res.json({ status: 'ok' }))
  app.get('/ready', (req, res) => res.json({ ready: true }))
  
  // API routes
  app.use('/api/agents', createAgentRoutes(settings))
  app.use('/api/conductor', createConductorRoutes(settings))
  app.use('/api/settings', createSettingsRoutes(settings))
  app.use('/api/swarm', createSwarmRoutes(settings))
  app.use('/api/files', createFilesRoutes(settings))
  
  // Legacy compatibility endpoints for UI
  const { getAgents } = require('@hivemind/connectors')
  const cfg = settings.get()
  
  // GET /api/edges - UI expects separate edges endpoint
  app.get('/api/edges', async (req, res) => {
    try {
      const agents = await getAgents(cfg.tmuxPrefix)
      // Build proper edge structure: USER -> QUEEN -> workers
      const edges = [
        // User to Queen
        { source: 'user', target: 'queen', active: true },
        // Queen to all workers
        ...agents.map((a: any) => ({
          source: 'queen',
          target: a.id,
          active: a.status === 'active',
        }))
      ]
      res.json({ edges })
    } catch (e: any) {
      res.json({ edges: [] })
    }
  })
  
  // GET /api/stats - UI expects stats endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      const agents = await getAgents(cfg.tmuxPrefix)
      res.json({
        agentCount: agents.length,
        messageCount: 0,
        cost: '$0.00',
        runtime: '0s',
      })
    } catch (e: any) {
      res.json({ agentCount: 0, messageCount: 0, cost: '$0.00', runtime: '0s' })
    }
  })
  
  // GET /api/messages - UI expects messages endpoint
  app.get('/api/messages', async (req, res) => {
    // Return empty messages for now - could read from a log file later
    res.json({ messages: '' })
  })
  
  // Legacy compatibility routes
  app.get('/api/activity', async (req, res) => {
    // Redirect to swarm activity
    const swarmRouter = createSwarmRoutes(settings)
    req.url = '/activity'
    swarmRouter(req, res, () => {})
  })
  
  app.post('/api/broadcast', async (req, res) => {
    // Redirect to swarm broadcast
    const swarmRouter = createSwarmRoutes(settings)
    req.url = '/broadcast'
    swarmRouter(req, res, () => {})
  })
  
  return { app, settings }
}

export async function startServer(config: ServerConfig): Promise<{ app: express.Application; settings: SettingsManager }> {
  const { app, settings } = await createServer(config)
  const cfg = settings.get()
  
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🐝 Hivemind API running on http://0.0.0.0:${config.port}`)
    console.log(`📁 Project dir: ${cfg.projectDir}`)
    console.log(`📁 Prompts dir: ${cfg.promptsDir}`)
    console.log(`📋 Settings: ${config.settingsPath}`)
  })
  
  return { app, settings }
}

