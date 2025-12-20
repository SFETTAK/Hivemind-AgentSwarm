// =============================================================================
// @hivemind/core - Agent Definitions
// =============================================================================
// Static definitions for agent roles. No runtime logic here.

import type { AgentRole } from './types'

export interface AgentDefinition {
  role: AgentRole
  name: string
  icon: string
  color: string
  description: string
  defaultModel: string
}

export const AGENT_DEFINITIONS: Record<AgentRole, AgentDefinition> = {
  forge: {
    role: 'forge',
    name: 'FORGE',
    icon: '🔨',
    color: '#4ecdc4',
    description: 'Builder - writes code, creates features, implements solutions',
    defaultModel: 'openrouter/anthropic/claude-sonnet-4',
  },
  sentinel: {
    role: 'sentinel',
    name: 'SENTINEL',
    icon: '🛡️',
    color: '#45b7d1',
    description: 'Guardian - tests, validates, reviews, catches bugs',
    defaultModel: 'openrouter/anthropic/claude-sonnet-4',
  },
  oracle: {
    role: 'oracle',
    name: 'ORACLE',
    icon: '🔮',
    color: '#a855f7',
    description: 'Seer - researches, analyzes, explores possibilities',
    defaultModel: 'openrouter/anthropic/claude-3-5-haiku',
  },
  nexus: {
    role: 'nexus',
    name: 'NEXUS',
    icon: '🔗',
    color: '#ffeaa7',
    description: 'Connector - integrates systems, handles APIs, coordinates',
    defaultModel: 'openrouter/anthropic/claude-3-5-haiku',
  },
  scribe: {
    role: 'scribe',
    name: 'SCRIBE',
    icon: '📝',
    color: '#dfe6e9',
    description: 'Chronicler - documents, writes guides, maintains knowledge',
    defaultModel: 'openrouter/anthropic/claude-3-5-haiku',
  },
  conductor: {
    role: 'conductor',
    name: 'CONDUCTOR',
    icon: '👑',
    color: '#ff6b6b',
    description: 'Orchestrator - coordinates the swarm, manages tasks',
    defaultModel: 'openrouter/anthropic/claude-sonnet-4',
  },
}

/**
 * Get agent definition by role
 */
export function getAgentDefinition(role: AgentRole): AgentDefinition {
  return AGENT_DEFINITIONS[role]
}

/**
 * Generate session name from role and task
 */
export function generateSessionName(role: AgentRole, task: string, prefix = 'hive'): string {
  const sanitizedTask = task
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase()
    .slice(0, 20)
  return `${prefix}-${role}-${sanitizedTask}`
}

/**
 * Parse session name to extract role and task
 */
export function parseSessionName(sessionName: string, prefix = 'hive'): { role: AgentRole; task: string } | null {
  const pattern = new RegExp(`^${prefix}-([a-z]+)-(.+)$`)
  const match = sessionName.match(pattern)
  if (!match) return null
  
  const [, role, task] = match
  if (!isValidRole(role)) return null
  
  return { role: role as AgentRole, task }
}

/**
 * Check if string is a valid agent role
 */
export function isValidRole(role: string): role is AgentRole {
  return role in AGENT_DEFINITIONS
}

