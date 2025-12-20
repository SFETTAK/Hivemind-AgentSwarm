// ConductorPanel - QUEEN chat panel with file attachments and collapsible messages
import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { useChatStore } from '../stores/chatStore'

// ============================================================================
// Constants
// ============================================================================

const COLLAPSE_THRESHOLD = 300

const AGENT_COLORS: Record<string, string> = {
  conductor: '#ff9500',
  forge: '#00ff88',
  sentinel: '#ffcc00',
  oracle: '#a855f7',
  nexus: '#00d4ff',
  scribe: '#ff6b6b',
}

// ============================================================================
// Types
// ============================================================================

interface AttachedFileInfo {
  name: string
  path: string
  summary?: string
  fileCount?: number
}

interface ChatMessage {
  id: number
  role: 'user' | 'assistant' | 'error'
  content: string
  agent?: string
  attachedFiles?: AttachedFileInfo[]
}

export interface ConductorPanelProps {
  apiBase: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSummary(content: string, agent?: string | null): string {
  if (!content) return ''
  const lower = content.toLowerCase()
  
  // Detect TOOL calls first
  const toolMatch = content.match(/\[TOOL:\s*(\w+)\(([^,)]+)/)
  if (toolMatch) {
    const [, toolName, target] = toolMatch
    const icons: Record<string, string> = {
      deploy_agent: '🚀',
      send_to_agent: '📤',
      kill_agent: '🛑',
      broadcast: '📢',
      get_status: '📊',
      read_file: '📖',
      write_file: '✏️',
    }
    const icon = icons[toolName] || '🔧'
    return `${icon} ${toolName}(${target}...)`
  }
  
  // Detect common patterns
  if (lower.includes('error') || lower.includes('fail')) return '❌ Error encountered'
  if (lower.includes('complete') || lower.includes('done') || lower.includes('finished')) return '✅ Task complete'
  if (lower.includes('thinking') || lower.includes('analyzing')) return '💭 Thinking...'
  if (lower.includes('commit')) return '📝 Made commits'
  if (lower.includes('test') && lower.includes('pass')) return '✅ Tests passing'
  if (lower.includes('test') && lower.includes('fail')) return '❌ Tests failing'
  if (lower.includes('spawn') || lower.includes('deploy')) return '🚀 Deploying agent'
  if (lower.includes('plan') || lower.includes('approach')) return '📋 Planning approach'
  
  // Agent-specific summaries
  if (agent) {
    const agentUpper = agent.toUpperCase()
    const firstLine = content.split('\n').find(l => l.trim().length > 10) || content.slice(0, 60)
    return `→ ${agentUpper}: ${firstLine.slice(0, 50)}${firstLine.length > 50 ? '...' : ''}`
  }
  
  // Fallback: first line truncated
  const firstLine = content.split('\n')[0]
  return firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine
}

function detectAgentFromContent(content: string): string | null {
  if (!content) return null
  const lower = content.toLowerCase()
  
  if (lower.includes('oracle') || lower.includes('send_to_agent(oracle')) return 'oracle'
  if (lower.includes('forge') || lower.includes('send_to_agent(forge')) return 'forge'
  if (lower.includes('sentinel') || lower.includes('send_to_agent(sentinel')) return 'sentinel'
  if (lower.includes('nexus') || lower.includes('send_to_agent(nexus')) return 'nexus'
  if (lower.includes('scribe') || lower.includes('send_to_agent(scribe')) return 'scribe'
  
  return null
}

// ============================================================================
// CollapsibleMessage Component
// ============================================================================

interface CollapsibleMessageProps {
  content: string
  agent?: string | null
  isLong: boolean
}

function CollapsibleMessage({ content, agent, isLong }: CollapsibleMessageProps) {
  const [expanded, setExpanded] = useState(!isLong)
  
  const agentLower = (agent || 'conductor').toLowerCase()
  const agentColor = AGENT_COLORS[agentLower] || AGENT_COLORS.conductor
  
  if (!isLong) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }
  
  return (
    <div className="relative">
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full cursor-pointer hover:w-2 transition-all opacity-80 hover:opacity-100"
        style={{ backgroundColor: agentColor }}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Click to collapse' : 'Click to expand'}
      />
      
      <div className="pl-4">
        {expanded ? (
          <>
            <div className="whitespace-pre-wrap">{content}</div>
            <button 
              onClick={() => setExpanded(false)}
              className="text-[10px] mt-2 px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: agentColor }}
            >
              ▲ Collapse
            </button>
          </>
        ) : (
          <div 
            className="cursor-pointer hover:bg-white/5 rounded p-1 -m-1 transition-colors"
            onClick={() => setExpanded(true)}
          >
            <div className="text-zinc-300 text-[11px]">{generateSummary(content, agent)}</div>
            <div className="text-[10px] mt-0.5 text-zinc-500">
              ▼ expand
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

function ConductorPanelComponent({ apiBase }: ConductorPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conductorName, setConductorName] = useState('QUEEN')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Attached files from chat store
  const attachedFiles = useChatStore(state => state.attachedFiles)
  const removeFile = useChatStore(state => state.removeFile)
  const getFileContext = useChatStore(state => state.getFileContext)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conductor name from settings
  useEffect(() => {
    fetch(`${apiBase}/api/settings`)
      .then(r => r.json())
      .then(data => {
        if (data.settings?.CONDUCTOR_NAME) setConductorName(data.settings.CONDUCTOR_NAME)
      })
      .catch(() => {})
  }, [apiBase])

  // Load history on mount
  useEffect(() => {
    fetch(`${apiBase}/api/conductor/history`)
      .then(r => r.json())
      .then(data => {
        if (data.history) {
          setMessages(data.history.map((msg: { role: string; content: string }, i: number) => ({
            id: i,
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })))
        }
      })
      .catch(() => {})
  }, [apiBase])

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && attachedFiles.length === 0) || loading) return
    
    const userText = input.trim() || 'What are these files?'
    
    // Build message with file context if any files are attached
    const fileContext = getFileContext()
    
    let fullMessage = fileContext 
      ? `${fileContext}\n\n---\nUser message: ${userText}`
      : userText
    
    // If files need summaries, ask for them
    const filesNeedingSummary = attachedFiles.filter(f => !f.summary)
    if (filesNeedingSummary.length > 0) {
      const summaryRequest = filesNeedingSummary.map(f => f.name).join(', ')
      fullMessage = `[For each attached file (${summaryRequest}), provide a 3-5 word summary in this exact format at the START of your response: "FILE_SUMMARY:filename.ext:your brief summary" - one per line. Then respond normally.]\n\n${fullMessage}`
    }
    
    // Show user message with file chips
    const userMsg: ChatMessage = { 
      id: Date.now(), 
      role: 'user', 
      content: userText,
      attachedFiles: attachedFiles.length > 0 
        ? attachedFiles.map(f => ({ name: f.name, path: f.path, summary: f.summary || 'Analyzing...' }))
        : undefined
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    
    // Clear files from store after capturing
    useChatStore.getState().clearFiles()
    
    try {
      const res = await fetch(`${apiBase}/api/conductor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMessage })
      })
      const data = await res.json()
      
      if (data.response || data.message) {
        let responseContent = data.response || data.message
        
        // Parse out file summaries from response
        const summaryRegex = /FILE_SUMMARY:([^:]+):([^\n]+)/g
        let match
        const newSummaries: Record<string, string> = {}
        
        while ((match = summaryRegex.exec(responseContent)) !== null) {
          const [fullMatch, filename, summary] = match
          newSummaries[filename.trim()] = summary.trim()
          responseContent = responseContent.replace(fullMatch + '\n', '').replace(fullMatch, '')
        }
        responseContent = responseContent.trim()
        
        // Update the user message with summaries
        if (Object.keys(newSummaries).length > 0) {
          setMessages(prev => prev.map((msg, idx) => {
            if (idx === prev.length - 1 && msg.role === 'user' && msg.attachedFiles) {
              return {
                ...msg,
                attachedFiles: msg.attachedFiles.map(f => ({
                  ...f,
                  summary: newSummaries[f.name] || f.summary
                }))
              }
            }
            return msg
          }))
        }
        
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: responseContent
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'error',
        content: `Failed to reach ${conductorName}`
      }])
    } finally {
      setLoading(false)
    }
  }, [input, attachedFiles, loading, apiBase, conductorName, getFileContext])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      sendMessage()
    }
  }, [sendMessage])

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border border-[#1e2a3a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2a3a] bg-[#080b10]">
        <span className="text-lg">👑</span>
        <span className="text-sm font-medium text-[#00d4ff]">{conductorName}</span>
        <div className="flex-1" />
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-zinc-600 text-xs text-center py-4">
            Chat with {conductorName} to orchestrate your swarm
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`text-xs p-2 rounded ${
                msg.role === 'user' 
                  ? 'bg-[#1e2a3a] text-zinc-300 ml-4' 
                  : msg.role === 'error'
                  ? 'bg-red-900/30 text-red-400 mr-4'
                  : 'bg-[#0d1117] border border-[#1e2a3a] text-[#e0e6ed] mr-4'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="text-[#00d4ff] text-[10px] mb-1">{conductorName}</div>
              )}
              {/* Show attached files/folders with summaries */}
              {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                <div className="space-y-1 mb-2">
                  {msg.attachedFiles.map(f => (
                    <div key={f.path} className="flex items-center gap-2 text-[10px] text-cyan-400 bg-cyan-900/20 px-2 py-1 rounded border border-cyan-800/30">
                      <span>{f.name?.startsWith('📁') ? '' : '📎'}</span>
                      <span className="font-medium">{f.name}</span>
                      {f.fileCount && (
                        <span className="text-zinc-500">({f.fileCount} files)</span>
                      )}
                      {f.summary && f.summary !== 'Analyzing...' && (
                        <span className="text-zinc-400 italic">— {f.summary}</span>
                      )}
                      {f.summary === 'Analyzing...' && (
                        <span className="text-zinc-500 italic animate-pulse">— analyzing...</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <CollapsibleMessage 
                content={msg.content} 
                agent={msg.agent || detectAgentFromContent(msg.content) || (msg.role === 'assistant' ? 'conductor' : null)}
                isLong={(msg.content?.length || 0) > COLLAPSE_THRESHOLD}
              />
            </div>
          ))
        )}
        {loading && (
          <div className="text-xs text-zinc-500 p-2">
            <span className="animate-pulse">{conductorName} is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Attached Files/Folders */}
      {attachedFiles.length > 0 && (
        <div className="px-2 py-1.5 border-t border-[#1e2a3a] bg-[#080b10]">
          <div className="flex flex-wrap gap-1">
            {attachedFiles.map(file => (
              <div 
                key={file.path}
                className="flex items-center gap-1 bg-[#1e2a3a] text-[#00d4ff] px-2 py-0.5 rounded text-[10px] group"
                title={file.path}
              >
                <span>{file.name?.startsWith('📁') ? '' : '📎'}</span>
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(file.path)}
                  className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Input */}
      <div className="p-2 border-t border-[#1e2a3a]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedFiles.length > 0 ? `Ask about ${attachedFiles.length} file(s)...` : `Message ${conductorName}...`}
            className="flex-1 bg-[#080b10] border border-[#1e2a3a] rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-[#00d4ff] outline-none"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              input.trim() || attachedFiles.length > 0
                ? 'bg-[#00d4ff] text-black hover:bg-[#00b8e6]'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const ConductorPanel = memo(ConductorPanelComponent)

