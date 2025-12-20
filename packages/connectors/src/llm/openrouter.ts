// =============================================================================
// @hivemind/connectors - OpenRouter LLM Client
// =============================================================================
// Clean interface for OpenRouter API calls.

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}

export interface ChatResponse {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  cost: number
}

// -----------------------------------------------------------------------------
// Client
// -----------------------------------------------------------------------------

export class OpenRouterClient {
  private apiKey: string
  private baseUrl = 'https://openrouter.ai/api/v1'
  
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }
  
  /**
   * Send a chat completion request
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const { model, messages, maxTokens = 4096, temperature = 0.7 } = options
    
    // Strip 'openrouter/' prefix if present
    const modelId = model.replace('openrouter/', '')
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://hivemind.local',
        'X-Title': 'Hivemind Swarm',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter error: ${error}`)
    }
    
    const data = await response.json() as {
      choices?: { message: { content: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const choice = data.choices?.[0]
    
    if (!choice) {
      throw new Error('No response from OpenRouter')
    }
    
    const usage = data.usage || {}
    
    // Estimate cost (rough approximation)
    const promptCost = (usage.prompt_tokens || 0) * 0.003 / 1000
    const completionCost = (usage.completion_tokens || 0) * 0.015 / 1000
    
    return {
      content: choice.message.content,
      model: modelId,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      cost: promptCost + completionCost,
    }
  }
}

/**
 * Create an OpenRouter client
 */
export function createOpenRouterClient(apiKey: string): OpenRouterClient {
  if (!apiKey) {
    throw new Error('OpenRouter API key required')
  }
  return new OpenRouterClient(apiKey)
}

