// =============================================================================
// Agent Routes
// =============================================================================

import { Router } from 'express'
import type { SettingsManager } from '@hivemind/config'
import {
  getAgents,
  spawnAgent,
  killSession,
  sendKeys,
  captureOutput,
  getAgentActivity,
} from '@hivemind/connectors'
import type { AgentRole } from '@hivemind/core'
import { isValidRole, getAgentDefinition } from '@hivemind/core'

export function createAgentRoutes(settings: SettingsManager): Router {
  const router = Router()
  const config = settings.get()
  
  // List all agents
  router.get('/', async (req, res) => {
    try {
      const agents = await getAgents(config.tmuxPrefix)
      res.json({ agents })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Deploy a new agent
  router.post('/deploy', async (req, res) => {
    const { role = 'forge', task = 'general', model } = req.body
    
    if (!isValidRole(role)) {
      return res.status(400).json({ error: `Invalid role: ${role}` })
    }
    
    try {
      const cfg = settings.get()
      const selectedModel = model || settings.getModelForRole(role as any)
      
      const { sessionName, agent } = await spawnAgent(role as AgentRole, task, {
        workingDir: cfg.projectDir,
        promptsDir: cfg.promptsDir,
        model: selectedModel,
        apiKeys: {
          openrouter: cfg.openrouterApiKey,
          anthropic: cfg.anthropicApiKey,
        },
        prefix: cfg.tmuxPrefix,
        autoAccept: cfg.autoAccept,
      })
      
      res.json({
        success: true,
        message: `Agent ${sessionName} deployed with aider (${selectedModel})`,
        sessionName,
        role,
        model: selectedModel,
        task,
      })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })
  
  // Kill an agent
  router.delete('/:name', async (req, res) => {
    const name = req.params.name
    const sessionName = name.startsWith(`${config.tmuxPrefix}-`) ? name : `${config.tmuxPrefix}-${name}`
    
    try {
      await killSession(sessionName)
      res.json({ success: true, message: `Killed ${sessionName}` })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })
  
  // Send command to agent
  router.post('/:name/send', async (req, res) => {
    const { command } = req.body
    const name = req.params.name
    const sessionName = name.startsWith(`${config.tmuxPrefix}-`) ? name : `${config.tmuxPrefix}-${name}`
    
    try {
      await sendKeys(sessionName, command)
      res.json({ success: true, message: `Command sent to ${sessionName}` })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })
  
  // Get agent output
  router.get('/:name/output', async (req, res) => {
    const name = req.params.name
    const sessionName = name.startsWith(`${config.tmuxPrefix}-`) ? name : `${config.tmuxPrefix}-${name}`
    const lines = parseInt(req.query.lines as string) || 500
    
    try {
      const output = await captureOutput(sessionName, lines)
      res.json({ output, sessionName })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Get agent activity summary
  router.get('/:name/activity', async (req, res) => {
    const name = req.params.name
    const sessionName = name.startsWith(`${config.tmuxPrefix}-`) ? name : `${config.tmuxPrefix}-${name}`
    
    try {
      const summary = await getAgentActivity(sessionName)
      res.json({ summary, sessionName })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  return router
}

