// =============================================================================
// Settings Routes
// =============================================================================

import { Router } from 'express'
import type { SettingsManager } from '@hivemind/config'
import type { SpeedLevel } from '@hivemind/core'

export function createSettingsRoutes(settings: SettingsManager): Router {
  const router = Router()
  
  // Get current settings
  router.get('/', (req, res) => {
    const config = settings.get()
    res.json({ settings: settings.toLegacyFormat() })
  })
  
  // Update settings
  router.post('/', async (req, res) => {
    const { settings: updates } = req.body
    
    if (!updates) {
      return res.status(400).json({ error: 'No settings provided' })
    }
    
    try {
      // Map legacy format to new format
      const mapped: any = {}
      
      if (updates.OPENROUTER_API_KEY !== undefined) mapped.openrouterApiKey = updates.OPENROUTER_API_KEY
      if (updates.ANTHROPIC_API_KEY !== undefined) mapped.anthropicApiKey = updates.ANTHROPIC_API_KEY
      if (updates.OPENAI_API_KEY !== undefined) mapped.openaiApiKey = updates.OPENAI_API_KEY
      if (updates.MCP_SERVER_URL !== undefined) mapped.mcpServerUrl = updates.MCP_SERVER_URL
      if (updates.API_SERVER_URL !== undefined) mapped.apiServerUrl = updates.API_SERVER_URL
      if (updates.OLLAMA_ENDPOINT !== undefined) mapped.ollamaEndpoint = updates.OLLAMA_ENDPOINT
      if (updates.PROJECT_DIR !== undefined) mapped.projectDir = updates.PROJECT_DIR
      if (updates.PROMPTS_DIR !== undefined) mapped.promptsDir = updates.PROMPTS_DIR
      if (updates.TMUX_PREFIX !== undefined) mapped.tmuxPrefix = updates.TMUX_PREFIX
      if (updates.AUTO_ACCEPT !== undefined) mapped.autoAccept = updates.AUTO_ACCEPT
      if (updates.CONDUCTOR_NAME !== undefined) mapped.conductorName = updates.CONDUCTOR_NAME
      if (updates.SPEED_LEVEL !== undefined) mapped.speedLevel = updates.SPEED_LEVEL as SpeedLevel
      
      await settings.update(mapped)
      res.json({ success: true, message: 'Settings saved' })
      
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  // Set speed level
  router.post('/speed', async (req, res) => {
    const { level } = req.body
    
    if (![1, 2, 3, 4].includes(level)) {
      return res.status(400).json({ error: 'Invalid speed level (must be 1-4)' })
    }
    
    try {
      await settings.setSpeedLevel(level as SpeedLevel)
      res.json({ 
        success: true, 
        level,
        models: settings.getCurrentModels(),
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })
  
  return router
}

