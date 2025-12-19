// Conductor (QUEEN) routes - Chat with the orchestrator

import { Router } from 'express'
import { callOpenRouter, type LLMMessage } from '@hivemind/connectors/llm'
import { readFile } from '@hivemind/connectors/filesystem'
import * as path from 'path'
import type { ServerConfig } from '../server'

// Chat history (in-memory for now)
const chatHistory: LLMMessage[] = []
const MAX_HISTORY = 20

export function conductorRoutes(config: ServerConfig) {
  const router = Router()
  
  // Send message to conductor
  router.post('/chat', async (req, res) => {
    try {
      const { message, attachedFiles } = req.body
      
      if (!message) {
        return res.status(400).json({ error: 'Message required' })
      }
      
      // Load system prompt
      const systemPrompt = await loadConductorPrompt(config.promptsDir)
      
      // Build messages array
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-MAX_HISTORY),
        { role: 'user', content: message }
      ]
      
      // Get API key from environment
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
      }
      
      // Call LLM
      const response = await callOpenRouter(messages, {
        provider: 'openrouter',
        apiKey,
        model: 'anthropic/claude-sonnet-4'
      })
      
      // Update history
      chatHistory.push({ role: 'user', content: message })
      chatHistory.push({ role: 'assistant', content: response.content })
      
      // Trim history if too long
      while (chatHistory.length > MAX_HISTORY * 2) {
        chatHistory.shift()
      }
      
      res.json({
        response: response.content,
        model: response.model,
        usage: response.usage,
        cost: response.cost?.toFixed(4),
        historyLength: chatHistory.length
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Get chat history
  router.get('/history', (req, res) => {
    res.json({
      history: chatHistory,
      length: chatHistory.length
    })
  })
  
  // Clear chat history
  router.post('/clear', (req, res) => {
    chatHistory.length = 0
    res.json({ success: true, message: 'History cleared' })
  })
  
  return router
}

async function loadConductorPrompt(promptsDir: string): Promise<string> {
  try {
    // Try web-specific prompt first
    const webPromptPath = path.join(promptsDir, 'CONDUCTOR_WEB_PROMPT.md')
    return await readFile(webPromptPath)
  } catch {
    try {
      // Fall back to regular prompt
      const promptPath = path.join(promptsDir, 'CONDUCTOR_PROMPT.md')
      return await readFile(promptPath)
    } catch {
      // Default prompt
      return `You are QUEEN, the conductor of a Hivemind agent swarm.
You coordinate AI agents to accomplish tasks efficiently.
Be concise and direct. Ask clarifying questions when needed.
Available tools: deploy_agent, send_to_agent, broadcast, get_status.`
    }
  }
}

