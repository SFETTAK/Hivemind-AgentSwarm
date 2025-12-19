// LLM Provider connector
// Handles API calls to OpenRouter, Anthropic, OpenAI, etc.

export interface LLMConfig {
  provider: 'openrouter' | 'anthropic' | 'openai'
  apiKey: string
  model: string
  maxTokens?: number
  temperature?: number
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  cost?: number
}

export interface LLMError {
  code: string
  message: string
}

/**
 * Parse cost from aider output
 */
export function parseCostFromOutput(output: string): number {
  // Match "$X.XX session" format
  const sessionMatch = output.match(/\$(\d+\.?\d*)\s*session/i)
  if (sessionMatch) return parseFloat(sessionMatch[1])
  
  // Match "Cost: $X.XX" format
  const costMatch = output.match(/Cost:\s*\$(\d+\.?\d*)/i)
  if (costMatch) return parseFloat(costMatch[1])
  
  return 0
}

/**
 * Get OpenRouter API endpoint
 */
export function getOpenRouterEndpoint(): string {
  return 'https://openrouter.ai/api/v1/chat/completions'
}

/**
 * Call OpenRouter API
 */
export async function callOpenRouter(
  messages: LLMMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const response = await fetch(getOpenRouterEndpoint(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hivemind.dev',
      'X-Title': 'Hivemind Swarm'
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'OpenRouter API error')
  }

  const data = await response.json()
  
  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens
    } : undefined,
    cost: data.usage?.cost
  }
}

/**
 * Model tier definitions
 */
export type ModelTier = 'cruise' | 'fast' | 'turbo' | 'cosmic'

export interface ModelProfile {
  name: string
  icon: string
  description: string
  models: {
    forge: string
    sentinel: string
    oracle: string
    nexus: string
    scribe: string
    conductor: string
  }
}

export const MODEL_PROFILES: Record<ModelTier, ModelProfile> = {
  cruise: {
    name: 'Cruise',
    icon: '🐢',
    description: 'Budget - Cheapest models',
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
    description: 'Balanced - Premium for builders',
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
    description: 'Performance - Sonnet 4 everywhere',
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
    description: 'Maximum - Opus 4.5 everywhere',
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

export function getModelForRole(role: keyof ModelProfile['models'], tier: ModelTier): string {
  return MODEL_PROFILES[tier].models[role]
}

