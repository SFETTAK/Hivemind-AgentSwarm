// FloatingAgentChat - Draggable/resizable chat window for individual agents
import { useState, useRef, useEffect, memo, useCallback } from 'react'
import type { Agent } from '../stores/swarmStore'

// ============================================================================
// Types
// ============================================================================

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

interface ChatMessage {
  id: number
  role: 'user' | 'assistant' | 'system' | 'error'
  content: string
}

export interface FloatingAgentChatProps {
  agent: Agent
  onClose: () => void
  initialPosition?: Position
  apiBase: string
}

// ============================================================================
// Component
// ============================================================================

function FloatingAgentChatComponent({ agent, onClose, initialPosition, apiBase }: FloatingAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Draggable position
  const [position, setPosition] = useState<Position>(initialPosition || { x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 })
  
  // Resizable size
  const [size, setSize] = useState<Size>({ width: 320, height: 400 })
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Drag handling
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const newX = dragRef.current.startPosX + (e.clientX - dragRef.current.startX)
      const newY = dragRef.current.startPosY + (e.clientY - dragRef.current.startY)
      setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) })
    }
    
    const handleMouseUp = () => setIsDragging(false)
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Resize handling
  useEffect(() => {
    if (!isResizing) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const newW = resizeRef.current.startW + (e.clientX - resizeRef.current.startX)
      const newH = resizeRef.current.startH + (e.clientY - resizeRef.current.startY)
      setSize({
        width: Math.max(250, Math.min(600, newW)),
        height: Math.max(200, Math.min(600, newH))
      })
    }
    
    const handleMouseUp = () => setIsResizing(false)
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    }
    setIsDragging(true)
  }, [position])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height
    }
    setIsResizing(true)
  }, [size])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return
    
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    
    try {
      const res = await fetch(`${apiBase}/api/agents/${agent.shortName}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })
      const data = await res.json()
      
      if (data.success) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'system',
          content: `Message sent to ${agent.name}`
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'error',
        content: `Failed to reach ${agent.name}`
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, apiBase, agent])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      sendMessage()
    }
  }, [sendMessage])

  return (
    <div
      className="fixed z-50 bg-[#0d1117] border border-[#1e2a3a] rounded-lg shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height
      }}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2a3a] bg-[#080b10] cursor-move select-none"
      >
        <span className="text-lg">{agent.icon}</span>
        <span className="text-sm font-medium" style={{ color: agent.color }}>
          {agent.name}
        </span>
        <div className="flex-1" />
        <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
        <button
          onClick={onClose}
          className="ml-2 text-zinc-500 hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-zinc-600 text-xs text-center py-4">
            Send commands to {agent.name}
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`text-xs p-2 rounded ${
                msg.role === 'user' 
                  ? 'bg-[#1e2a3a] text-zinc-200 ml-4' 
                  : msg.role === 'error'
                  ? 'bg-red-900/30 text-red-400 mr-4'
                  : msg.role === 'system'
                  ? 'bg-green-900/30 text-green-400 mr-4'
                  : 'bg-[#0d1117] border border-[#1e2a3a] text-zinc-300 mr-4'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
        {loading && (
          <div className="text-xs text-zinc-500 p-2">
            <span className="animate-pulse">Sending...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="p-2 border-t border-[#1e2a3a]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 bg-[#080b10] border border-[#1e2a3a] rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-[#00d4ff] outline-none"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-3 py-1.5 text-black rounded text-xs font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: agent.color }}
          >
            Send
          </button>
        </div>
      </div>
      
      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #1e2a3a 50%)'
        }}
      />
    </div>
  )
}

export const FloatingAgentChat = memo(FloatingAgentChatComponent)

