// Tmux session management types
// Actual implementation is in @hivemind/connectors

export interface TmuxSession {
  id: string
  name: string
  shortName: string
  attached: boolean
  created: Date
  windows: number
}

export interface SessionManager {
  list(): Promise<TmuxSession[]>
  create(name: string, command: string, workdir?: string): Promise<TmuxSession>
  kill(name: string): Promise<boolean>
  send(name: string, command: string): Promise<boolean>
  read(name: string, lines?: number): Promise<string>
  exists(name: string): Promise<boolean>
}

// Session name conventions
export const SESSION_PREFIX = 'hive'

export function isHivemindSession(name: string): boolean {
  return name.startsWith(`${SESSION_PREFIX}-`)
}

export function parseSessionName(fullName: string): { role: string; task: string } | null {
  if (!isHivemindSession(fullName)) return null
  
  const parts = fullName.replace(`${SESSION_PREFIX}-`, '').split('-')
  if (parts.length < 2) return null
  
  return {
    role: parts[0],
    task: parts.slice(1).join('-')
  }
}

