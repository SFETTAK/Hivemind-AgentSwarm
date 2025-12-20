// Tmux connector - public API
export {
  listSessions,
  sessionExists,
  createSession,
  killSession,
  sendKeys,
  captureOutput,
  startAider,
  spawnAgent,
  getAgents,
  getAgentActivity,
  type TmuxSession,
  type SpawnOptions,
  type AiderOptions,
} from './client'

