// Settings routes - Configuration management

import { Router } from 'express'
import { loadJson, saveJson } from '@hivemind/connectors/filesystem'
import { MODEL_PROFILES, type ModelTier } from '@hivemind/connectors/llm'
import * as path from 'path'
import type { ServerConfig } from '../server'

export interface HivemindSettings {
  PROJECT_DIR: string
  PROMPTS_DIR: string
  OPENROUTER_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  MODEL_TIER: ModelTier
  CONDUCTOR_NAME: string
  CONDUCTOR_MODEL: string
}

const DEFAULT_SETTINGS: HivemindSettings = {
  PROJECT_DIR: process.cwd(),
  PROMPTS_DIR: './mcp/prompts',
  MODEL_TIER: 'fast',
  CONDUCTOR_NAME: 'QUEEN',
  CONDUCTOR_MODEL: 'anthropic/claude-sonnet-4'
}

let currentSettings: HivemindSettings = { ...DEFAULT_SETTINGS }

export function settingsRoutes(config: ServerConfig) {
  const router = Router()
  const settingsPath = path.join(config.projectDir, 'dashboard', 'server', 'settings.json')
  
  // Load settings on startup
  loadSettings()
  
  async function loadSettings() {
    currentSettings = await loadJson(settingsPath, DEFAULT_SETTINGS)
    // Merge with defaults for any missing fields
    currentSettings = { ...DEFAULT_SETTINGS, ...currentSettings }
  }
  
  // Get current settings
  router.get('/', (req, res) => {
    res.json({
      settings: {
        ...currentSettings,
        // Don't expose full API keys
        OPENROUTER_API_KEY: currentSettings.OPENROUTER_API_KEY ? '***configured***' : undefined,
        ANTHROPIC_API_KEY: currentSettings.ANTHROPIC_API_KEY ? '***configured***' : undefined
      }
    })
  })
  
  // Update settings
  router.post('/', async (req, res) => {
    try {
      const updates = req.body
      
      // Merge updates
      currentSettings = { ...currentSettings, ...updates }
      
      // Save to file
      await saveJson(settingsPath, currentSettings)
      
      res.json({
        success: true,
        settings: currentSettings
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Get available models
  router.get('/models', (req, res) => {
    res.json({
      profiles: MODEL_PROFILES,
      current: currentSettings.MODEL_TIER
    })
  })
  
  // Set model tier
  router.post('/tier', async (req, res) => {
    try {
      const { tier } = req.body
      
      if (!MODEL_PROFILES[tier as ModelTier]) {
        return res.status(400).json({ error: `Invalid tier: ${tier}` })
      }
      
      currentSettings.MODEL_TIER = tier
      await saveJson(settingsPath, currentSettings)
      
      res.json({
        success: true,
        tier,
        models: MODEL_PROFILES[tier as ModelTier].models
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  return router
}

