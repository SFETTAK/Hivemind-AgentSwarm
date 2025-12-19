// Orchestration - Task routing and coordination

import { Agent, AgentRole, createAgentId } from '../agents'

export interface Task {
  id: string
  description: string
  assignedTo?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}

export interface DeployRequest {
  role: AgentRole
  task: string
  model?: string
  workdir?: string
}

export interface DeployResult {
  success: boolean
  agent?: Agent
  sessionName?: string
  error?: string
}

// Model tier profiles for cost optimization
export type ModelTier = 'cruise' | 'fast' | 'turbo' | 'cosmic'

export interface ModelProfile {
  name: string
  icon: string
  description: string
  models: Record<AgentRole, string>
}

export const MODEL_PROFILES: Record<ModelTier, ModelProfile> = {
  cruise: {
    name: 'Cruise',
    icon: '🐢',
    description: 'Budget - Cheapest models for all agents',
    models: {
      forge: 'openrouter/deepseek/deepseek-chat-v3.1',
      sentinel: 'openrouter/deepseek/deepseek-chat-v3.1',
      oracle: 'openrouter/deepseek/deepseek-chat-v3.1',
      nexus: 'openrouter/deepseek/deepseek-chat-v3.1',
      scribe: 'openrouter/deepseek/deepseek-chat-v3.1',
      conductor: 'openrouter/anthropic/claude-sonnet-4'
    }
  },
  fast: {
    name: 'Fast',
    icon: '🐇',
    description: 'Balanced - Premium for builders, budget for support',
    models: {
      forge: 'openrouter/anthropic/claude-sonnet-4',
      sentinel: 'openrouter/deepseek/deepseek-chat-v3.1',
      oracle: 'openrouter/deepseek/deepseek-chat-v3.1',
      nexus: 'openrouter/deepseek/deepseek-chat-v3.1',
      scribe: 'openrouter/deepseek/deepseek-chat-v3.1',
      conductor: 'openrouter/anthropic/claude-sonnet-4'
    }
  },
  turbo: {
    name: 'Turbo',
    icon: '🚀',
    description: 'Performance - Sonnet 4 for all agents',
    models: {
      forge: 'openrouter/anthropic/claude-sonnet-4',
      sentinel: 'openrouter/anthropic/claude-sonnet-4',
      oracle: 'openrouter/anthropic/claude-sonnet-4',
      nexus: 'openrouter/anthropic/claude-sonnet-4',
      scribe: 'openrouter/anthropic/claude-sonnet-4',
      conductor: 'openrouter/anthropic/claude-sonnet-4'
    }
  },
  cosmic: {
    name: 'Cosmic',
    icon: '✨',
    description: 'Maximum - Opus 4.5 for all agents',
    models: {
      forge: 'openrouter/anthropic/claude-opus-4.5',
      sentinel: 'openrouter/anthropic/claude-opus-4.5',
      oracle: 'openrouter/anthropic/claude-opus-4.5',
      nexus: 'openrouter/anthropic/claude-opus-4.5',
      scribe: 'openrouter/anthropic/claude-opus-4.5',
      conductor: 'openrouter/anthropic/claude-opus-4.5'
    }
  }
}

export function getModelForRole(role: AgentRole, tier: ModelTier): string {
  return MODEL_PROFILES[tier].models[role]
}

