// Agent definitions and types

export type AgentRole = 'forge' | 'sentinel' | 'oracle' | 'nexus' | 'scribe' | 'conductor'

export interface AgentConfig {
  role: AgentRole
  name: string
  icon: string
  description: string
  defaultModel: string
  color: string
}

export const AGENT_ROLES: Record<AgentRole, AgentConfig> = {
  forge: {
    role: 'forge',
    name: 'FORGE',
    icon: '🔨',
    description: 'Builder - Creates and implements features',
    defaultModel: 'anthropic/claude-sonnet-4',
    color: '#00ff88'
  },
  sentinel: {
    role: 'sentinel',
    name: 'SENTINEL',
    icon: '🛡️',
    description: 'Tester - Validates and verifies code',
    defaultModel: 'anthropic/claude-sonnet-4',
    color: '#ffcc00'
  },
  oracle: {
    role: 'oracle',
    name: 'ORACLE',
    icon: '🔮',
    description: 'Researcher - Analyzes and explores solutions',
    defaultModel: 'anthropic/claude-sonnet-4',
    color: '#a855f7'
  },
  nexus: {
    role: 'nexus',
    name: 'NEXUS',
    icon: '🔗',
    description: 'Integrator - Connects systems and APIs',
    defaultModel: 'anthropic/claude-sonnet-4',
    color: '#00d4ff'
  },
  scribe: {
    role: 'scribe',
    name: 'SCRIBE',
    icon: '📝',
    description: 'Documenter - Writes docs and comments',
    defaultModel: 'anthropic/claude-sonnet-4',
    color: '#ff6b6b'
  },
  conductor: {
    role: 'conductor',
    name: 'CONDUCTOR',
    icon: '👑',
    description: 'Orchestrator - Coordinates the swarm',
    defaultModel: 'anthropic/claude-sonnet-4',
    color: '#ff9500'
  }
}

export interface Agent {
  id: string
  role: AgentRole
  name: string
  task: string
  model: string
  status: 'idle' | 'active' | 'error' | 'stopped'
  sessionName: string
  startedAt: Date
  runtime: number
}

export function createAgentId(role: AgentRole, task: string): string {
  const sanitizedTask = task.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
  return `hive-${role}-${sanitizedTask}`
}

export function getAgentConfig(role: AgentRole): AgentConfig {
  return AGENT_ROLES[role]
}

