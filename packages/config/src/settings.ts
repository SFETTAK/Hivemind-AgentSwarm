// =============================================================================
// @hivemind/config - Settings Manager
// =============================================================================
// Single source of truth for all configuration.

import * as fs from 'fs/promises'
import * as path from 'path'
import type { HivemindConfig, SpeedLevel } from '@hivemind/core'
import { DEFAULT_PROFILES } from '@hivemind/core'

// -----------------------------------------------------------------------------
// Default Configuration
// -----------------------------------------------------------------------------

export const DEFAULT_CONFIG: HivemindConfig = {
  // API Keys (empty by default - user must provide)
  openrouterApiKey: '',
  anthropicApiKey: '',
  openaiApiKey: '',
  
  // Endpoints
  mcpServerUrl: 'http://127.0.0.1:8000',
  apiServerUrl: 'http://localhost:3001',
  ollamaEndpoint: 'http://localhost:11434',
  
  // Paths (will be set at runtime)
  projectDir: process.cwd(),
  promptsDir: './mcp/prompts',
  
  // Swarm settings
  tmuxPrefix: 'hive',
  autoAccept: true,
  conductorName: 'QUEEN',
  
  // Default to Fast profile
  speedLevel: 2,
  
  // Profiles
  profiles: DEFAULT_PROFILES,
}

// -----------------------------------------------------------------------------
// Settings Manager
// -----------------------------------------------------------------------------

export class SettingsManager {
  private config: HivemindConfig
  private filePath: string
  
  constructor(filePath: string) {
    this.filePath = filePath
    this.config = { ...DEFAULT_CONFIG }
  }
  
  /**
   * Load settings from file
   */
  async load(): Promise<HivemindConfig> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8')
      const saved = JSON.parse(content)
      
      // Merge with defaults (in case new fields were added)
      this.config = {
        ...DEFAULT_CONFIG,
        ...saved,
        profiles: {
          ...DEFAULT_CONFIG.profiles,
          ...saved.profiles,
        },
      }
    } catch (e) {
      // File doesn't exist or is invalid - use defaults
      this.config = { ...DEFAULT_CONFIG }
    }
    
    return this.config
  }
  
  /**
   * Save settings to file
   */
  async save(): Promise<void> {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(this.config, null, 2))
  }
  
  /**
   * Get current config
   */
  get(): HivemindConfig {
    return this.config
  }
  
  /**
   * Update config (partial update)
   */
  async update(updates: Partial<HivemindConfig>): Promise<HivemindConfig> {
    this.config = {
      ...this.config,
      ...updates,
    }
    await this.save()
    return this.config
  }
  
  /**
   * Set speed level and update model settings accordingly
   */
  async setSpeedLevel(level: SpeedLevel): Promise<HivemindConfig> {
    this.config.speedLevel = level
    await this.save()
    return this.config
  }
  
  /**
   * Get model for a specific role based on current speed level
   */
  getModelForRole(role: 'forge' | 'sentinel' | 'oracle' | 'nexus' | 'scribe'): string {
    const profile = this.config.profiles[this.config.speedLevel]
    return profile.models[role]
  }
  
  /**
   * Get all models for current speed level
   */
  getCurrentModels(): Record<string, string> {
    const profile = this.config.profiles[this.config.speedLevel]
    return {
      MODEL_FORGE: profile.models.forge,
      MODEL_SENTINEL: profile.models.sentinel,
      MODEL_ORACLE: profile.models.oracle,
      MODEL_NEXUS: profile.models.nexus,
      MODEL_SCRIBE: profile.models.scribe,
    }
  }
  
  /**
   * Convert to legacy settings format (for backwards compatibility)
   */
  toLegacyFormat(): Record<string, unknown> {
    const models = this.getCurrentModels()
    return {
      OPENROUTER_API_KEY: this.config.openrouterApiKey,
      ANTHROPIC_API_KEY: this.config.anthropicApiKey,
      OPENAI_API_KEY: this.config.openaiApiKey,
      MCP_SERVER_URL: this.config.mcpServerUrl,
      API_SERVER_URL: this.config.apiServerUrl,
      OLLAMA_ENDPOINT: this.config.ollamaEndpoint,
      PROJECT_DIR: this.config.projectDir,
      PROMPTS_DIR: this.config.promptsDir,
      TMUX_PREFIX: this.config.tmuxPrefix,
      AUTO_ACCEPT: this.config.autoAccept,
      CONDUCTOR_NAME: this.config.conductorName,
      SPEED_LEVEL: this.config.speedLevel,
      ...models,
    }
  }
}

/**
 * Create a settings manager
 */
export function createSettingsManager(filePath: string): SettingsManager {
  return new SettingsManager(filePath)
}

