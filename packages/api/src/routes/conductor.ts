// =============================================================================
// Conductor Routes (QUEEN)
// =============================================================================

import { Router } from 'express'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { SettingsManager } from '@hivemind/config'
import { createOpenRouterClient, type ChatMessage } from '@hivemind/connectors'
import { parseToolCalls, type AgentRole } from '@hivemind/core'
import {
  spawnAgent,
  killSession,
  sendKeys,
  getAgents,
} from '@hivemind/connectors'

// Conversation history (in-memory for now)
let conductorHistory: ChatMessage[] = []
const MAX_HISTORY = 20

export function createConductorRoutes(settings: SettingsManager): Router {
  const router = Router()
  
  // Load conductor system prompt
  async function getSystemPrompt(): Promise<string> {
    const cfg = settings.get()
    const promptPath = path.join(cfg.promptsDir, 'CONDUCTOR_WEB_PROMPT.md')
    
    try {
      return await fs.readFile(promptPath, 'utf-8')
    } catch {
      return `You are ${cfg.conductorName}, an AI orchestrator. Help the user manage their AI agent swarm.`
    }
  }
  
  // Execute tool calls from conductor response
  async function executeTools(text: string): Promise<{ tool: string; result: any }[]> {
    const cfg = settings.get()
    const calls = parseToolCalls(text)
    const results: { tool: string; result: any }[] = []
    
    for (const call of calls) {
      console.log(`[CONDUCTOR TOOL] ${call.tool}(${call.args.join(', ')})`)
      
      try {
        let result: any = { success: false, error: 'Unknown tool' }
        
        switch (call.tool) {
          case 'deploy_agent': {
            const [role, task] = call.args
            const model = settings.getModelForRole(role as any)
            
            const { sessionName, agent } = await spawnAgent(role as AgentRole, task || 'general', {
              workingDir: cfg.projectDir,
              promptsDir: cfg.promptsDir,
              model,
              apiKeys: {
                openrouter: cfg.openrouterApiKey,
                anthropic: cfg.anthropicApiKey,
              },
              prefix: cfg.tmuxPrefix,
              autoAccept: cfg.autoAccept,
            })
            
            result = { success: true, message: `Deployed ${sessionName}`, agent }
            break
          }
          
          case 'send_to_agent': {
            const [name, message] = call.args
            const sessionName = name.startsWith(`${cfg.tmuxPrefix}-`) ? name : `${cfg.tmuxPrefix}-${name}`
            await sendKeys(sessionName, message)
            result = { success: true, message: `Sent to ${sessionName}` }
            break
          }
          
          case 'broadcast': {
            const [message] = call.args
            const agents = await getAgents(cfg.tmuxPrefix)
            for (const agent of agents) {
              await sendKeys(agent.id, `# BROADCAST: ${message}`)
            }
            result = { success: true, message: `Broadcast to ${agents.length} agents` }
            break
          }
          
          case 'kill_agent': {
            const [name] = call.args
            const sessionName = name.startsWith(`${cfg.tmuxPrefix}-`) ? name : `${cfg.tmuxPrefix}-${name}`
            await killSession(sessionName)
            result = { success: true, message: `Killed ${sessionName}` }
            break
          }
          
          case 'get_status': {
            const agents = await getAgents(cfg.tmuxPrefix)
            result = { success: true, agents: agents.map(a => ({ id: a.id, status: a.status })) }
            break
          }
        }
        
        results.push({ tool: call.tool, result })
        console.log(`[CONDUCTOR TOOL] Result:`, result)
        
      } catch (e: any) {
        results.push({ tool: call.tool, result: { success: false, error: e.message } })
        console.error(`[CONDUCTOR TOOL] Error:`, e.message)
      }
    }
    
    return results
  }
  
  // Chat with conductor
  router.post('/chat', async (req, res) => {
    const { message, clearHistory = false } = req.body
    
    if (clearHistory) conductorHistory = []
    if (!message) return res.status(400).json({ error: 'Message required' })
    
    const cfg = settings.get()
    
    try {
      const systemPrompt = await getSystemPrompt()
      conductorHistory.push({ role: 'user', content: message })
      
      // Trim history if too long
      if (conductorHistory.length > MAX_HISTORY * 2) {
        conductorHistory = conductorHistory.slice(-MAX_HISTORY * 2)
      }
      
      const client = createOpenRouterClient(cfg.openrouterApiKey || '')
      const model = 'openrouter/anthropic/claude-sonnet-4' // Conductor always uses premium
      
      const response = await client.chat({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conductorHistory,
        ],
        maxTokens: 4096,
      })
      
      // Execute any tool calls in the response
      const toolResults = await executeTools(response.content)
      
      conductorHistory.push({ role: 'assistant', content: response.content })
      
      res.json({
        message: response.content,
        model,
        usage: response.usage,
        cost: response.cost.toFixed(4),
        historyLength: conductorHistory.length,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      })
      
    } catch (e: any) {
      console.error('Conductor chat error:', e)
      res.status(500).json({ error: e.message })
    }
  })
  
  // Get history
  router.get('/history', (req, res) => {
    res.json({ history: conductorHistory, length: conductorHistory.length })
  })
  
  // Clear history
  router.post('/clear', (req, res) => {
    conductorHistory = []
    res.json({ success: true, message: 'History cleared' })
  })
  
  return router
}

