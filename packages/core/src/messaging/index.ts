// Inter-agent messaging system

export interface Message {
  id: string
  from: string
  to: string | 'broadcast'
  content: string
  timestamp: Date
  type: 'task' | 'status' | 'result' | 'error' | 'broadcast'
}

export interface Inbox {
  agentId: string
  messages: Message[]
}

export function createMessage(
  from: string,
  to: string | 'broadcast',
  content: string,
  type: Message['type'] = 'task'
): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    content,
    timestamp: new Date(),
    type
  }
}

export function createBroadcast(from: string, content: string): Message {
  return createMessage(from, 'broadcast', content, 'broadcast')
}

