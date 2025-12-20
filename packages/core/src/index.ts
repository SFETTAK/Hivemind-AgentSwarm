// =============================================================================
// @hivemind/core - Public API
// =============================================================================

// Types
export type {
  AgentRole,
  AgentStatus,
  Agent,
  AgentConfig,
  SwarmState,
  SwarmEdge,
  SwarmStats,
  SwarmMessage,
  SpeedLevel,
  ProfileKey,
  ModelProfile,
  HivemindConfig,
  ToolName,
  ToolCall,
  ToolResult,
  AgentActivity,
} from './types'

// Agent definitions
export {
  AGENT_DEFINITIONS,
  getAgentDefinition,
  generateSessionName,
  parseSessionName,
  isValidRole,
  type AgentDefinition,
} from './agents'

// Speed profiles
export {
  PROFILE_KEYS,
  DEFAULT_PROFILES,
  getProfile,
  getModelForRole,
  getModelsForLevel,
} from './profiles'

// Tool parsing
export {
  parseToolCalls,
  isValidTool,
  formatToolCall,
} from './tools'

