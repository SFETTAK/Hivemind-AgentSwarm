// Express server setup

import express from 'express'
import cors from 'cors'
import { agentRoutes } from './routes/agents'
import { swarmRoutes } from './routes/swarm'
import { filesRoutes } from './routes/files'
import { conductorRoutes } from './routes/conductor'
import { settingsRoutes } from './routes/settings'

export interface ServerConfig {
  port: number
  projectDir: string
  promptsDir: string
}

export function createServer(config: ServerConfig) {
  const app = express()
  
  // Middleware
  app.use(cors())
  app.use(express.json())
  
  // Health checks
  app.get('/health', (req, res) => res.json({ status: 'ok' }))
  app.get('/ready', (req, res) => res.json({ ready: true }))
  
  // API routes
  app.use('/api/agents', agentRoutes(config))
  app.use('/api/swarm', swarmRoutes(config))
  app.use('/api/files', filesRoutes(config))
  app.use('/api/conductor', conductorRoutes(config))
  app.use('/api/settings', settingsRoutes(config))
  
  return app
}

export function startServer(config: ServerConfig) {
  const app = createServer(config)
  
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🐝 Hivemind API running on http://0.0.0.0:${config.port}`)
    console.log(`📁 Project dir: ${config.projectDir}`)
    console.log(`📁 Prompts dir: ${config.promptsDir}`)
  })
  
  return app
}

