// Agent routes - List, deploy, send commands

import { Router } from 'express'
import { listSessions, readPane, sendCommand, createSession, killSession } from '@hivemind/connectors/tmux'
import { AGENT_ROLES, type AgentRole } from '@hivemind/core'
import type { ServerConfig } from '../server'

export function agentRoutes(config: ServerConfig) {
  const router = Router()
  
  // List all agents
  router.get('/', async (req, res) => {
    try {
      const sessions = await listSessions({ defaultPath: config.projectDir })
      
      // Build agent list from tmux sessions
      const agents = sessions.map(session => {
        const parts = session.shortName.split('-')
        const role = parts[0] as AgentRole
        const task = parts.slice(1).join('-')
        const roleConfig = AGENT_ROLES[role]
        
        return {
          id: session.id,
          name: session.name,
          shortName: session.shortName,
          role,
          task,
          icon: roleConfig?.icon || '🤖',
          color: roleConfig?.color || '#888',
          status: session.status,
          model: 'unknown', // Would need to track this
          runtime: Date.now() - session.created
        }
      })
      
      // Add virtual agents (USER, CONDUCTOR)
      const allAgents = [
        {
          id: 'user',
          name: 'USER',
          shortName: 'user',
          role: 'user',
          task: 'Human Operator',
          icon: '👤',
          color: '#00d4ff',
          status: 'active',
          model: 'human',
          runtime: 0
        },
        {
          id: 'conductor',
          name: 'QUEEN',
          shortName: 'conductor',
          role: 'conductor',
          task: 'Orchestrator',
          icon: '👑',
          color: '#ff9500',
          status: 'active',
          model: 'claude-sonnet-4',
          runtime: 0
        },
        ...agents
      ]
      
      res.json({
        agents: allAgents,
        count: allAgents.length
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Get agent output
  router.get('/:name/output', async (req, res) => {
    try {
      const name = req.params.name
      const sessionName = name.startsWith('hive-') ? name : `hive-${name}`
      const output = await readPane(sessionName)
      res.json({ output })
    } catch (e) {
      res.json({ output: '' })
    }
  })
  
  // Deploy new agent
  router.post('/deploy', async (req, res) => {
    try {
      const { role = 'forge', task = 'general', model } = req.body
      const roleConfig = AGENT_ROLES[role as AgentRole]
      
      if (!roleConfig) {
        return res.status(400).json({ error: `Unknown role: ${role}` })
      }
      
      const sanitizedTask = task.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
      const sessionName = `hive-${role}-${sanitizedTask}`
      
      // Build aider command
      const modelArg = model || roleConfig.defaultModel
      const promptPath = `${config.promptsDir}/${role.toUpperCase()}_PROMPT.md`
      
      const command = [
        'aider',
        `--model ${modelArg}`,
        '--yes',
        `--read ${promptPath}`
      ].join(' ')
      
      const success = await createSession(sessionName, command, config.projectDir)
      
      if (success) {
        res.json({
          success: true,
          message: `Agent ${sessionName} deployed`,
          sessionName,
          role,
          task: sanitizedTask,
          model: modelArg
        })
      } else {
        res.status(500).json({ error: 'Failed to create session' })
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Send command to agent
  router.post('/:name/send', async (req, res) => {
    try {
      const { command } = req.body
      const name = req.params.name
      const sessionName = name.startsWith('hive-') ? name : `hive-${name}`
      
      const success = await sendCommand(sessionName, command)
      
      if (success) {
        res.json({ success: true, message: `Command sent to ${sessionName}` })
      } else {
        res.status(500).json({ error: 'Failed to send command' })
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  // Kill agent
  router.delete('/:name', async (req, res) => {
    try {
      const name = req.params.name
      const sessionName = name.startsWith('hive-') ? name : `hive-${name}`
      
      const success = await killSession(sessionName)
      
      if (success) {
        res.json({ success: true, message: `Agent ${sessionName} stopped` })
      } else {
        res.status(500).json({ error: 'Failed to kill session' })
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
  
  return router
}

