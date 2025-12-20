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

