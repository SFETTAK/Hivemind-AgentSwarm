// =============================================================================
// @hivemind/core - Speed Profiles
// =============================================================================
// Model configurations for different speed/cost levels.
// NO DEEPSEEK. NATO-friendly models only.

import type { SpeedLevel, ProfileKey, ModelProfile } from './types'

export const PROFILE_KEYS: Record<SpeedLevel, ProfileKey> = {
  1: 'cruise',
  2: 'fast',
  3: 'turbo',
  4: 'cosmic',
}

export const DEFAULT_PROFILES: Record<SpeedLevel, ModelProfile> = {
  1: {
    name: 'Cruise',
    icon: '🐢',
    color: '#00ff88',
    description: 'Budget mode - Haiku & GPT-4o Mini',
    models: {
      forge: 'openrouter/anthropic/claude-3-5-haiku',
      sentinel: 'openrouter/anthropic/claude-3-5-haiku',
      oracle: 'openrouter/openai/gpt-4o-mini',
      nexus: 'openrouter/openai/gpt-4o-mini',
      scribe: 'openrouter/google/gemini-2.0-flash-001',
      conductor: 'openrouter/anthropic/claude-sonnet-4',
    },
  },
  2: {
    name: 'Fast',
    icon: '🐇',
    color: '#ffcc00',
    description: 'Balanced - Sonnet for code, Haiku for support',
    models: {
      forge: 'openrouter/anthropic/claude-sonnet-4',
      sentinel: 'openrouter/anthropic/claude-sonnet-4',
      oracle: 'openrouter/anthropic/claude-3-5-haiku',
      nexus: 'openrouter/anthropic/claude-3-5-haiku',
      scribe: 'openrouter/anthropic/claude-3-5-haiku',
      conductor: 'openrouter/anthropic/claude-sonnet-4',
    },
  },
  3: {
    name: 'Turbo',
    icon: '🚀',
    color: '#ff6b6b',
    description: 'Power mode - Opus 4.5 lead, Sonnet support',
    models: {
      forge: 'openrouter/anthropic/claude-opus-4.5',
      sentinel: 'openrouter/anthropic/claude-sonnet-4',
      oracle: 'openrouter/anthropic/claude-sonnet-4',
      nexus: 'openrouter/anthropic/claude-sonnet-4',
      scribe: 'openrouter/anthropic/claude-sonnet-4',
      conductor: 'openrouter/anthropic/claude-opus-4.5',
    },
  },
  4: {
    name: 'Cosmic',
    icon: '💎',
    color: '#a855f7',
    description: 'Maximum power - all Opus 4.5',
    models: {
      forge: 'openrouter/anthropic/claude-opus-4.5',
      sentinel: 'openrouter/anthropic/claude-opus-4.5',
      oracle: 'openrouter/anthropic/claude-opus-4.5',
      nexus: 'openrouter/anthropic/claude-opus-4.5',
      scribe: 'openrouter/anthropic/claude-opus-4.5',
      conductor: 'openrouter/anthropic/claude-opus-4.5',
    },
  },
}

/**
 * Get profile by speed level
 */
export function getProfile(level: SpeedLevel): ModelProfile {
  return DEFAULT_PROFILES[level]
}

/**
 * Get model for a specific role at a speed level
 */
export function getModelForRole(role: keyof ModelProfile['models'], level: SpeedLevel): string {
  return DEFAULT_PROFILES[level].models[role]
}

/**
 * Get all models for a speed level as flat object (for API settings)
 */
export function getModelsForLevel(level: SpeedLevel): Record<string, string> {
  const profile = DEFAULT_PROFILES[level]
  return {
    MODEL_FORGE: profile.models.forge,
    MODEL_SENTINEL: profile.models.sentinel,
    MODEL_ORACLE: profile.models.oracle,
    MODEL_NEXUS: profile.models.nexus,
    MODEL_SCRIBE: profile.models.scribe,
  }
}

