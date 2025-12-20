// =============================================================================
// @hivemind/core - Type Definitions
// =============================================================================
// These types define the contract for the entire system.
// NO external dependencies. Pure TypeScript types.

// -----------------------------------------------------------------------------
// Agent Types
// -----------------------------------------------------------------------------

export type AgentRole = 'forge' | 'sentinel' | 'oracle' | 'nexus' | 'scribe' | 'conductor'

export type AgentStatus = 'active' | 'idle' | 'offline' | 'error'

export interface Agent {
  id: string              // e.g., "hive-forge-task1"
  shortName: string       // e.g., "forge-task1"
  role: AgentRole
  name: string            // Display name, e.g., "FORGE"
  icon: string            // Emoji
  color: string           // Hex color
  status: AgentStatus
  model?: string          // LLM model being used
  task?: string           // Current task description
  runtime: number         // Seconds since agent started
}

export interface AgentConfig {
  role: AgentRole
  task: string
  model?: string
  startAider?: boolean
  injectPrompt?: boolean
}

// -----------------------------------------------------------------------------
// Swarm Types
// -----------------------------------------------------------------------------

export interface SwarmState {
  agents: Agent[]
  edges: SwarmEdge[]
  status: 'running' | 'paused' | 'stopped'
  stats: SwarmStats
}

export interface SwarmEdge {
  source: string
  target: string
  active?: boolean
}

export interface SwarmStats {
  activeAgents: number
  totalAgents: number
  messagesExchanged: number
  tasksCompleted: number
  uptime: number
}

// -----------------------------------------------------------------------------
// Message Types
// -----------------------------------------------------------------------------

export interface SwarmMessage {
  id: string
  from: string
  to: string | 'broadcast'
  content: string
  timestamp: string
  type: 'command' | 'response' | 'broadcast' | 'system'
}

// -----------------------------------------------------------------------------
// Config Types
// -----------------------------------------------------------------------------

export type SpeedLevel = 1 | 2 | 3 | 4
export type ProfileKey = 'cruise' | 'fast' | 'turbo' | 'cosmic'

export interface ModelProfile {
  name: string
  icon: string
  color: string
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

export interface HivemindConfig {
  // API Keys
  openrouterApiKey?: string
  anthropicApiKey?: string
  openaiApiKey?: string
  
  // Endpoints
  mcpServerUrl: string
  apiServerUrl: string
  ollamaEndpoint: string
  
  // Paths
  projectDir: string
  promptsDir: string
  
  // Swarm settings
  tmuxPrefix: string
  autoAccept: boolean
  conductorName: string
  
  // Current speed level
  speedLevel: SpeedLevel
  
  // Model profiles (customizable)
  profiles: Record<SpeedLevel, ModelProfile>
}

// -----------------------------------------------------------------------------
// Tool Execution Types (for Conductor)
// -----------------------------------------------------------------------------

export type ToolName = 'deploy_agent' | 'send_to_agent' | 'broadcast' | 'kill_agent' | 'get_status'

export interface ToolCall {
  tool: ToolName
  args: string[]
}

export interface ToolResult {
  tool: ToolName
  args: string[]
  result: {
    success: boolean
    message?: string
    error?: string
    data?: unknown
  }
}

// -----------------------------------------------------------------------------
// Activity Types
// -----------------------------------------------------------------------------

export interface AgentActivity {
  agent: string
  role: AgentRole
  summary: string
  timestamp: string
  type: 'action' | 'thinking' | 'error' | 'success' | 'info'
}

