// TerminalPanel - Agent terminal output with secret redaction
import { useState, useEffect, useRef, memo, useCallback } from 'react'
import type { Agent } from '../stores/swarmStore'

// ============================================================================
// Secret Redaction - Keeps hive-generated keys visible, hides infrastructure secrets
// ============================================================================

export function redactSecrets(text: string): string {
  if (!text) return text
  
  let cleaned = text
  
  // Redact OpenRouter API keys (may span lines)
  cleaned = cleaned.replace(/sk-or-v1-[a-zA-Z0-9\n]{20,}/g, 'sk-or-v1-••••••••••••••••')
  
  // Redact Anthropic API keys (may span lines)  
  cleaned = cleaned.replace(/sk-ant-api[0-9]*-[a-zA-Z0-9_\n-]{20,}/g, 'sk-ant-••••••••••••••••')
  
  // Redact OpenAI API keys
  cleaned = cleaned.replace(/sk-[a-zA-Z0-9]{16,}/g, 'sk-••••••••••••••••')
  
  // Redact any export KEY= statements entirely
  cleaned = cleaned.replace(
    /export\s+(OPENROUTER_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|API_KEY|SECRET|TOKEN)=["']?[^"'\n]*["']?/gi, 
    'export $1="••••••••••••••••"'
  )
  
  // AWS keys
  cleaned = cleaned.replace(/AKIA[A-Z0-9]{12,}/g, 'AKIA••••••••••••')
  
  return cleaned
}

// ============================================================================
// Types
// ============================================================================

export interface TerminalPanelProps {
  selectedAgent: string | null
  agents: Agent[]
  apiBase: string
  onSelectAgent?: (agentId: string) => void
}

// ============================================================================
// Component
// ============================================================================

function TerminalPanelComponent({ selectedAgent, agents, apiBase, onSelectAgent }: TerminalPanelProps) {
  const [output, setOutput] = useState('')
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  
  // Get actual session name for the agent (for API calls)
  const getSessionName = useCallback((agentId: string | null): string | null => {
    if (!agentId) return null
    // USER is not a tmux session
    if (agentId === 'user' || agentId === 'user-entry') return null
    // Find the agent by ID and get its shortName for API calls
    const agent = agents.find(a => a.id === agentId)
    if (agent && agent.id?.startsWith('hive-')) {
      return agent.shortName || null
    }
    return null
  }, [agents])
  
  // Check if this is a real tmux session
  const isRealSession = useCallback((agentId: string | null): boolean => {
    if (!agentId) return false
    if (agentId === 'user' || agentId === 'user-entry') return false
    const agent = agents.find(a => a.id === agentId)
    return !!(agent && agent.id?.startsWith('hive-'))
  }, [agents])
  
  // Fetch terminal output for selected agent
  useEffect(() => {
    const sessionName = getSessionName(selectedAgent)
    
    if (!sessionName) {
      if (selectedAgent === 'user' || selectedAgent === 'user-entry') {
        fetch(`${apiBase}/api/cursor/messages`)
          .then(r => r.json())
          .then(data => {
            let msgList = ''
            if (data.messages && data.messages.length > 0) {
              msgList = '\n# Recent messages to Cursor AI:\n' + 
                data.messages.slice(-5).map((m: { timestamp: string; message: string }) => 
                  `# [${new Date(m.timestamp).toLocaleTimeString()}] ${m.message}`
                ).join('\n')
            }
            setOutput(`# ═══════════════════════════════════════════════════
# 👤 USER - Human Operator  
# ═══════════════════════════════════════════════════
# 
# This is YOU - the human operator.
# 
# 💬 Select an agent to view their terminal output
#    or double-click agents in the topology to chat.
#
# Use the CONDUCTOR panel on the right to orchestrate.
# ═══════════════════════════════════════════════════${msgList}`)
          })
          .catch(() => {
            setOutput(`# 👤 USER - Human Operator
# Select an agent to view terminal output`)
          })
      } else {
        setOutput('# Select an agent to view terminal output')
      }
      return
    }
    
    let lastOutput = ''
    
    const fetchOutput = async () => {
      try {
        const res = await fetch(`${apiBase}/api/agents/${sessionName}/output`)
        const data = await res.json()
        const newOutput = data.output || '# No output yet\n# Agent may still be initializing...'
        // Only update if output actually changed (prevents re-renders that steal focus)
        if (newOutput !== lastOutput) {
          lastOutput = newOutput
          setOutput(newOutput)
        }
      } catch (e: any) {
        const errMsg = `# Error fetching output: ${e.message}`
        if (errMsg !== lastOutput) {
          lastOutput = errMsg
          setOutput(errMsg)
        }
      }
    }
    
    fetchOutput()
    const interval = setInterval(fetchOutput, 2000)
    return () => clearInterval(interval)
  }, [selectedAgent, agents, apiBase, getSessionName])
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])
  
  const sendCommand = useCallback(async () => {
    if (!command.trim()) return
    
    // Special handling for USER - send message to Cursor AI
    if (selectedAgent === 'user' || selectedAgent === 'user-entry') {
      setLoading(true)
      try {
        const res = await fetch(`${apiBase}/api/cursor/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: command })
        })
        const data = await res.json()
        if (data.success) {
          setOutput(prev => prev + `\n# ✓ Sent: "${command}"`)
        }
        setCommand('')
      } catch (e: any) {
        alert('Failed to send message: ' + e.message)
      }
      setLoading(false)
      return
    }
    
    const sessionName = getSessionName(selectedAgent)
    if (!sessionName) return
    
    setLoading(true)
    try {
      await fetch(`${apiBase}/api/agents/${sessionName}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })
      setCommand('')
    } catch (e: any) {
      alert('Failed to send command: ' + e.message)
    }
    setLoading(false)
  }, [command, selectedAgent, apiBase, getSessionName])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendCommand()
    }
  }, [sendCommand])
  
  const agentInfo = agents.find(a => 
    a.shortName === selectedAgent || 
    a.id === selectedAgent ||
    (selectedAgent?.includes('conductor') && a.shortName?.includes('conductor'))
  )
  
  // Filter agents for tabs - exclude USER entry point but include CONDUCTOR
  const tabAgents = agents.filter(a => 
    a.id !== 'user-entry' && 
    a.id?.startsWith('hive-')
  )
  
  // Allow sending to USER (messages to AI) or real tmux sessions
  const isUser = selectedAgent === 'user' || selectedAgent === 'user-entry'
  const canSendCommands = isUser || (getSessionName(selectedAgent) !== null && isRealSession(selectedAgent))
  
  return (
    <div className="bg-[#0a0f14] border border-[#27272a] rounded-xl flex flex-col h-full">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <span className="text-lg">{agentInfo?.icon || '💻'}</span>
          <span className="text-sm font-medium text-white">
            {agentInfo?.name || 'Select Agent'}
          </span>
          {agentInfo && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              agentInfo.status === 'active' 
                ? 'bg-[#00ff88]/20 text-[#00ff88]' 
                : agentInfo.status === 'offline'
                ? 'bg-red-900/30 text-red-400'
                : 'bg-zinc-700 text-zinc-400'
            }`}>
              {agentInfo.status}
            </span>
          )}
        </div>
        
        {/* Agent tabs */}
        <div className="flex gap-1 flex-wrap justify-end max-w-[300px]">
          {tabAgents.slice(0, 6).map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent?.(agent.shortName || agent.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedAgent === agent.shortName || 
                (selectedAgent?.includes('conductor') && agent.shortName?.includes('conductor'))
                  ? 'bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/50' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
              title={agent.name}
            >
              {agent.icon}
            </button>
          ))}
        </div>
      </div>
      
      {/* Terminal Output */}
      <div 
        ref={outputRef}
        className="flex-1 p-4 font-mono text-xs text-[#00ff88] overflow-auto whitespace-pre-wrap"
        style={{ 
          background: 'linear-gradient(180deg, #0a0f14 0%, #0d1117 100%)',
          minHeight: '200px'
        }}
      >
        {redactSecrets(output).split('\n')
          // Filter out Aider metadata lines
          .filter(line => {
            if (/^Tokens: .* sent, .* received\. Cost:/i.test(line.trim())) return false
            if (/\.(md|py|js|ts|jsx|tsx) \(read only\)$/i.test(line.trim())) return false
            if (/^\.\.?\/.*\.(md|py|js)$/i.test(line.trim())) return false
            return true
          })
          .map((line, i) => {
            const isError = /error|exception|failed|traceback/i.test(line)
            const isPrompt = /^\$|^>|^>>>/.test(line.trim())
            const isCommit = /^commit |^Commit /i.test(line)
            
            return (
              <div 
                key={i} 
                className={`${
                  isError ? 'text-[#ff4757]' : 
                  isPrompt ? 'text-[#00d4ff]' : 
                  isCommit ? 'text-[#ffcc00]' :
                  'text-[#00ff88]'
                }`}
              >
                {line || '\u00A0'}
              </div>
            )
          })}
      </div>
      
      {/* Command Input */}
      {canSendCommands && (
        <div className="flex items-center gap-2 p-2 border-t border-[#27272a]">
          <span className="text-[#00d4ff] font-mono text-sm">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isUser ? 'Message to swarm...' : `Send to ${agentInfo?.name || 'agent'}...`}
            className="flex-1 bg-transparent text-white text-sm font-mono outline-none placeholder-zinc-600"
            disabled={loading}
          />
          <button
            onClick={sendCommand}
            disabled={loading || !command.trim()}
            className="px-3 py-1 bg-[#00d4ff]/20 text-[#00d4ff] text-xs rounded hover:bg-[#00d4ff]/30 disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}

export const TerminalPanel = memo(TerminalPanelComponent)

