import { useState, useEffect, useRef } from 'react'

// Dynamic API base
const getApiBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:3001'
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : `http://${host}:3001`
}

export default function TerminalPanel({ selectedAgent, agents }) {
  const [output, setOutput] = useState('')
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const outputRef = useRef(null)
  const API_BASE = getApiBase()
  
  // Get actual session name for the agent
  const getSessionName = (agent) => {
    if (!agent) return null
    // CURSOR is not a tmux session - it's the human!
    if (agent === 'cursor' || agent === 'cursor-entry') return null
    // For conductor, use the actual session name from the agents list
    if (agent === 'conductor' || agent.includes('conductor')) {
      const conductorAgent = agents.find(a => a.shortName?.includes('conductor') && a.id?.startsWith('hive-'))
      if (conductorAgent) {
        return conductorAgent.shortName
      }
      return null // No conductor session running
    }
    return agent
  }
  
  // Check if this is a real tmux session
  const isRealSession = (agent) => {
    if (!agent) return false
    if (agent === 'cursor' || agent === 'cursor-entry') return false
    // Check if it exists in agents with a hive- prefix
    return agents.some(a => 
      (a.shortName === agent || a.id === agent || a.id === `hive-${agent}`) && 
      a.id?.startsWith('hive-')
    )
  }
  
  // Fetch terminal output for selected agent
  useEffect(() => {
    const sessionName = getSessionName(selectedAgent)
    
    if (!sessionName) {
      if (selectedAgent === 'cursor' || selectedAgent === 'cursor-entry') {
        // Fetch any pending messages for display
        fetch(`${API_BASE}/api/cursor/messages`)
          .then(r => r.json())
          .then(data => {
            let msgList = ''
            if (data.messages && data.messages.length > 0) {
              msgList = '\n# Recent messages to Cursor AI:\n' + 
                data.messages.slice(-5).map(m => 
                  `# [${new Date(m.timestamp).toLocaleTimeString()}] ${m.message}`
                ).join('\n')
            }
            setOutput(`# ═══════════════════════════════════════════════════
# 💻 CURSOR - Human Interface  
# ═══════════════════════════════════════════════════
# 
# This is YOU - the human operator in Cursor IDE.
# 
# 💬 Type a message below to send it to Cursor AI!
#    (I'll see it next time you chat with me)
#
# Select an agent tab (🎯🔨🛡️🔮🔗📝) to control agents.
# ═══════════════════════════════════════════════════${msgList}`)
          })
          .catch(() => {
            setOutput(`# 💻 CURSOR - Human Interface
# Type below to send a message to Cursor AI!`)
          })
      } else {
        setOutput('# Select an agent to view terminal output')
      }
      return
    }
    
    const fetchOutput = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/agents/${sessionName}/output`)
        const data = await res.json()
        setOutput(data.output || '# No output yet\n# Agent may still be initializing...')
      } catch (e) {
        setOutput(`# Error fetching output: ${e.message}`)
      }
    }
    
    fetchOutput()
    const interval = setInterval(fetchOutput, 2000)
    return () => clearInterval(interval)
  }, [selectedAgent, agents])
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])
  
  const sendCommand = async () => {
    if (!command.trim()) return
    
    // Special handling for CURSOR - send message to Cursor AI
    if (selectedAgent === 'cursor' || selectedAgent === 'cursor-entry') {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/cursor/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: command })
        })
        const data = await res.json()
        if (data.success) {
          // Refresh the output to show the new message
          setOutput(prev => prev + `\n# ✓ Sent: "${command}"`)
        }
        setCommand('')
      } catch (e) {
        alert('Failed to send message: ' + e.message)
      }
      setLoading(false)
      return
    }
    
    const sessionName = getSessionName(selectedAgent)
    if (!sessionName) return
    
    setLoading(true)
    try {
      await fetch(`${API_BASE}/api/agents/${sessionName}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })
      setCommand('')
    } catch (e) {
      alert('Failed to send command: ' + e.message)
    }
    setLoading(false)
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendCommand()
    }
  }
  
  const agentInfo = agents.find(a => 
    a.shortName === selectedAgent || 
    a.id === selectedAgent ||
    (selectedAgent?.includes('conductor') && a.shortName?.includes('conductor'))
  )
  
  // Filter agents for tabs - exclude CURSOR entry point but include CONDUCTOR
  const tabAgents = agents.filter(a => 
    a.id !== 'cursor-entry' && 
    a.id?.startsWith('hive-')
  )
  
  // Allow sending to CURSOR (messages to AI) or real tmux sessions
  const isCursor = selectedAgent === 'cursor' || selectedAgent === 'cursor-entry'
  const canSendCommands = isCursor || (getSessionName(selectedAgent) !== null && isRealSession(selectedAgent))
  
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
        
        {/* Agent tabs - show all hive sessions including conductor */}
        <div className="flex gap-1 flex-wrap justify-end max-w-[300px]">
          {tabAgents.slice(0, 6).map(agent => (
            <button
              key={agent.id}
              onClick={() => window.dispatchEvent(new CustomEvent('selectAgent', { detail: agent.shortName }))}
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
        {output.split('\n')
          // Filter out Aider metadata lines
          .filter(line => {
            // Hide token/cost lines
            if (/^Tokens: .* sent, .* received\. Cost:/i.test(line.trim())) return false
            // Hide file listing lines (read only) or just filename.md
            if (/\.(md|py|js|ts|jsx|tsx) \(read only\)$/i.test(line.trim())) return false
            // Hide standalone file paths
            if (/^\.\.?\/.*\.(md|py|js)$/i.test(line.trim())) return false
            return true
          })
          .map((line, i) => {
          // Highlight errors in red
          const isError = /error|exception|failed|traceback/i.test(line)
          // Highlight prompts in cyan
          const isPrompt = /^\$|^>|^>>>/.test(line.trim())
          // Highlight commit messages in yellow
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
      
      {/* Command Input - show for all agents with tmux sessions */}
      {canSendCommands && (
        <div className="flex items-center gap-2 p-2 border-t border-[#27272a]">
          <span className="text-[#00d4ff] font-mono text-sm">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCursor ? 'Message Cursor AI...' : `Send to ${agentInfo?.name || 'agent'}...`}
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
